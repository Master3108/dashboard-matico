#!/usr/bin/env python3
"""
Aplica TODOS los parches acumulados a server/index.js:
  1) Fix dall-e response_format (gpt-image-1 no lo acepta)
  2) generateImageWithOpenAI acepta 'quality' y lo envia solo a gpt-image-1
  3) generatePedagogicalImage acepta 'quality' y prefija prompt en blanco/negro
  4) Endpoint generate_pedagogical_image pasa 'quality' al generador
  5) Nueva funcion generateQuestionWithImageFromTopic
  6) Nuevo action generate_question_with_image

Seguro correr 2 veces - cada parche verifica si ya esta aplicado.
Uso: python3 apply_image_patches.py
"""
import sys

P = 'server/index.js'
try:
    src = open(P).read()
except FileNotFoundError:
    print(f"ERROR: {P} no existe. Ejecuta desde /var/www/dashboard-matico")
    sys.exit(1)

applied = []
skipped = []

# === PARCHE 1: fix response_format para gpt-image-1 ===
old1 = """    const response = await client.images.generate({
        model,
        prompt,
        size,
        response_format: 'b64_json'
    });"""
new1 = """    // gpt-image-1 NO acepta response_format (siempre devuelve b64_json por default).
    // dall-e-3 / dall-e-2 SI lo aceptan. Solo lo enviamos para modelos DALL-E.
    const imagePayload = {
        model,
        prompt,
        size
    };
    // gpt-image-1 acepta quality: low/medium/high/auto. low = 4x mas barato.
    if (/^gpt-image/i.test(String(model || '')) && quality) {
        imagePayload.quality = quality;
    }
    if (/^dall-e/i.test(String(model || ''))) {
        imagePayload.response_format = 'b64_json';
    }
    const response = await client.images.generate(imagePayload);"""
if old1 in src:
    src = src.replace(old1, new1)
    applied.append("1) fix response_format + quality payload")
else:
    skipped.append("1) fix response_format (ya parchado)")

# === PARCHE 2: firma generateImageWithOpenAI con quality ===
old2 = """const generateImageWithOpenAI = async ({
    prompt,
    size = '1024x1024',
    settings = null
} = {}) => {"""
new2 = """const generateImageWithOpenAI = async ({
    prompt,
    size = '1024x1024',
    quality = 'low',
    settings = null
} = {}) => {"""
if old2 in src:
    src = src.replace(old2, new2)
    applied.append("2) firma generateImageWithOpenAI con quality")
else:
    skipped.append("2) firma generateImageWithOpenAI (ya parchada)")

# === PARCHE 3: generatePedagogicalImage con quality + b/n ===
old3 = """const generatePedagogicalImage = async ({
    provider = '',
    prompt = '',
    size = '1024x1024'
} = {}) => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const finalProvider = await resolveImageGeneratorProvider(provider);
    if (finalProvider === 'openai') {
        return generateImageWithOpenAI({ prompt, size, settings: effectiveSettings.openai });
    }
    if (finalProvider === 'nano_banana') {
        return generateImageWithNanoBanana({ prompt, size, settings: effectiveSettings.nano_banana });
    }"""
new3 = """const generatePedagogicalImage = async ({
    provider = '',
    prompt = '',
    size = '1024x1024',
    quality = 'low'
} = {}) => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const finalProvider = await resolveImageGeneratorProvider(provider);
    const styledPrompt = /blanco y negro|black and white/i.test(prompt)
        ? prompt
        : 'Dibujo simple en blanco y negro, estilo libro escolar, linea limpia, minimalista, fondo blanco. ' + prompt;
    if (finalProvider === 'openai') {
        return generateImageWithOpenAI({ prompt: styledPrompt, size, quality, settings: effectiveSettings.openai });
    }
    if (finalProvider === 'nano_banana') {
        return generateImageWithNanoBanana({ prompt: styledPrompt, size, settings: effectiveSettings.nano_banana });
    }"""
if old3 in src:
    src = src.replace(old3, new3)
    applied.append("3) generatePedagogicalImage con quality + b/n")
else:
    skipped.append("3) generatePedagogicalImage (ya parchado)")

# === PARCHE 4: endpoint generate_pedagogical_image acepta quality ===
old4 = """            const size = String(body.size || '1024x1024').trim() || '1024x1024';

            const generated = await generatePedagogicalImage({
                provider,
                prompt,
                size
            });"""
new4 = """            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const quality = ['low','medium','high','auto'].includes(String(body.quality||'').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';

            const generated = await generatePedagogicalImage({
                provider,
                prompt,
                size,
                quality
            });"""
if old4 in src:
    src = src.replace(old4, new4)
    applied.append("4) endpoint generate_pedagogical_image con quality")
else:
    skipped.append("4) endpoint quality (ya parchado)")

# === PARCHE 5: agregar funcion generateQuestionWithImageFromTopic ===
# Se inserta justo despues del cierre de generatePedagogicalImage.
# Buscamos el cierre "};" que sigue al bloque y lo duplicamos para insertar la nueva funcion.
marker5_pattern = """    if (finalProvider === 'nano_banana') {
        return generateImageWithNanoBanana({ prompt: styledPrompt, size, settings: effectiveSettings.nano_banana });
    }
    throw new Error('Proveedor de imágenes no soportado');
};"""
new_function_block = """    if (finalProvider === 'nano_banana') {
        return generateImageWithNanoBanana({ prompt: styledPrompt, size, settings: effectiveSettings.nano_banana });
    }
    throw new Error('Proveedor de imágenes no soportado');
};

// Genera pregunta + imagen desde asignatura/sesion/fase/nivel.
// El tema tambien lo propone la IA (o admin lo sugiere via topicHint).
const generateQuestionWithImageFromTopic = async (sheets, {
    subject = 'MATEMATICA',
    session = '',
    phase = '',
    levelName = 'BASICO',
    topicHint = '',
    provider = '',
    quality = 'low',
    size = '1024x1024'
} = {}) => {
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'MATEMATICA';
    const normalizedLevel = normalizeQuestionBankLevel(levelName) || 'BASICO';
    const curriculumContext = await getCurriculumContext('1medio', normalizedSubject).catch(() => ({}));

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en crear preguntas pedagogicas para estudiantes de ensenanza media.',
        'Dado un contexto (asignatura, sesion, fase, nivel) PROPONES un tema especifico apropiado y creas UNA pregunta de seleccion multiple con 4 alternativas.',
        'Devuelve SOLO JSON valido con estas claves: topic, question, options, correct_answer, explanation, image_prompt, question_visual_role.',
        'options debe ser un objeto con claves A, B, C, D.',
        'correct_answer debe ser una sola letra (A|B|C|D).',
        'image_prompt debe estar en espanol, maximo 2 frases, describir elementos visuales concretos para ilustrar la pregunta.',
        'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen.',
        'question_visual_role puede ser required_for_interpretation o supporting.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + normalizedSubject + (curriculumContext && curriculumContext.subject_label ? ' (' + curriculumContext.subject_label + ')' : '') + '.',
        'Grado: ' + ((curriculumContext && curriculumContext.grade_label) || '1 medio') + '.',
        'Sesion: ' + (session || '(libre)') + '.',
        'Fase: ' + (phase || '(libre)') + '.',
        'Nivel de dificultad: ' + normalizedLevel + '.',
        topicHint
            ? 'Pista del admin sobre el tema: "' + topicHint + '". Si la pista es clara, usala. Si es vaga, propon un tema mas especifico dentro de ese ambito.'
            : 'El admin NO indico tema - propon uno apropiado para la asignatura, nivel y sesion.',
        'Pregunta en espanol, una sola respuesta correcta clara, alternativas plausibles pero distintas.'
    ].join('\\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.75,
        response_format: { type: 'json_object' }
    });
    const parsed = parseJsonObjectResponse(
        completion.choices?.[0]?.message?.content || '',
        'propuesta pregunta+imagen'
    );

    const proposedTopic = String(parsed.topic || topicHint || 'Tema general').trim();
    const questionText = String(parsed.question || '').trim();
    if (!questionText) throw new Error('La IA no propuso un enunciado valido');
    const options = {
        A: String(parsed.options?.A || '').trim(),
        B: String(parsed.options?.B || '').trim(),
        C: String(parsed.options?.C || '').trim(),
        D: String(parsed.options?.D || '').trim()
    };
    if (!options.A || !options.B || !options.C || !options.D) {
        throw new Error('La IA no genero las 4 alternativas completas');
    }
    const correctAnswer = String(parsed.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A';
    const explanation = String(parsed.explanation || '').trim();
    const imagePrompt = String(parsed.image_prompt || ('Ilustracion educativa de ' + proposedTopic)).trim();
    const visualRole = normalizeQuestionVisualRole(parsed.question_visual_role || 'supporting');

    const generated = await generatePedagogicalImage({
        provider,
        prompt: imagePrompt,
        size,
        quality
    });

    const extension = mimeTypeToExtension(generated.mimeType || '');
    const safeTitle = sanitizeFileSegment((proposedTopic || 'ia_question').slice(0, 60)).toLowerCase();
    const saved = await saveBufferToLocalFile(
        generated.buffer,
        safeTitle + '_' + Date.now() + extension,
        'quiz-assets'
    );
    const asset = await createPedagogicalImageAsset(sheets, {
        title: (proposedTopic + ' (IA)').slice(0, 180),
        subject: normalizedSubject,
        topicTags: proposedTopic,
        kind: 'diagram',
        fileName: saved.fileName,
        fileUrl: saved.publicUrl,
        mimeType: generated.mimeType || 'image/png',
        altText: imagePrompt.slice(0, 180),
        caption: 'Auto-generada para pregunta de ' + normalizedSubject + ' - ' + normalizedLevel,
        sourceType: 'ai_generate_' + (generated.provider || 'openai'),
        status: 'draft'
    });

    return {
        proposed_topic: proposedTopic,
        image_prompt: imagePrompt,
        subject: normalizedSubject,
        session: Number(session || 0) || 0,
        phase: Number(phase || 0) || 0,
        levelName: normalizedLevel,
        question: questionText,
        options,
        correct_answer: correctAnswer,
        explanation,
        question_visual_role: visualRole,
        asset,
        generation: {
            provider: generated.provider || provider || '',
            model: generated.model || '',
            text_model: AI_MODELS.fast
        }
    };
};"""
if "generateQuestionWithImageFromTopic" in src:
    skipped.append("5) generateQuestionWithImageFromTopic (ya existe)")
elif marker5_pattern in src:
    src = src.replace(marker5_pattern, new_function_block)
    applied.append("5) generateQuestionWithImageFromTopic")
else:
    print("NO ENCONTRE el marker para insertar la funcion 5. Revisar manualmente.")
    sys.exit(2)

# === PARCHE 6: agregar action generate_question_with_image ===
marker6 = """        if (currentAction === 'update_pedagogical_asset_status') {"""
new_action_block = """        // Genera pregunta+imagen a partir de asignatura/sesion/fase/nivel.
        // El tema tambien lo propone la IA (o admin lo sugiere con body.topic_hint).
        // Si body.save === true, ademas persiste la pregunta en el Question Bank.
        if (currentAction === 'generate_question_with_image') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const session = body.session || '';
            const phase = body.phase || '';
            const levelName = normalizeQuestionBankLevel(body.levelName || 'BASICO') || 'BASICO';
            const topicHint = String(body.topic_hint || body.topic || '').trim();
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low','medium','high','auto'].includes(String(body.quality||'').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';

            const result = await generateQuestionWithImageFromTopic(sheets, {
                subject, session, phase, levelName, topicHint, provider, quality, size
            });

            if (body.save === true) {
                const created = await appendQuestionBankQuestion(sheets, {
                    subject: result.subject,
                    session: result.session,
                    phase: result.phase,
                    slot: Number(body.slot || 0) || 0,
                    proposalIndex: 1,
                    levelName: result.levelName,
                    topic: result.proposed_topic,
                    question: result.question,
                    options: result.options,
                    correctAnswer: result.correct_answer,
                    explanation: result.explanation,
                    sourceMode: 'topic_ai_admin',
                    promptImage: result.asset,
                    questionVisualRole: result.question_visual_role
                });
                return res.json({ success: true, saved: true, item: created, draft: result });
            }

            return res.json({ success: true, saved: false, draft: result });
        }

        if (currentAction === 'update_pedagogical_asset_status') {"""
if "currentAction === 'generate_question_with_image'" in src:
    skipped.append("6) action generate_question_with_image (ya existe)")
elif marker6 in src:
    src = src.replace(marker6, new_action_block, 1)
    applied.append("6) action generate_question_with_image")
else:
    print("NO ENCONTRE el marker6 para el action. Revisar manualmente.")
    sys.exit(3)

open(P, 'w').write(src)
print("APPLIED:")
for a in applied: print("  + " + a)
print("SKIPPED:")
for s in skipped: print("  - " + s)
print("TOTAL LINEAS:", src.count('\n') + 1)
