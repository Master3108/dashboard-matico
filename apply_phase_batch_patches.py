#!/usr/bin/env python3
# Patches idempotentes para agregar el flujo "populate_phase_with_images":
# - Tope de 6 imagenes por fase por sesion
# - La IA elige cuales preguntas son las mas idoneas para acompanar con imagen
#
# Uso: python3 apply_phase_batch_patches.py
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER_FILE = os.path.join(ROOT, 'server', 'index.js')


def read_file():
    with open(SERVER_FILE, 'rb') as fh:
        data = fh.read()
    # Strip trailing nulls (NTFS truncation defense)
    return data.rstrip(b'\x00').decode('utf-8')


def write_file(text):
    # Final integrity check: no NUL bytes
    text = text.replace('\x00', '')
    with open(SERVER_FILE, 'wb') as fh:
        fh.write(text.encode('utf-8'))


def patch_helper_functions(text):
    """Inyecta countQuestionsWithImageInPhase y generatePhaseBatchWithImageScoring
    despues del cierre de generateQuestionWithImageFromTopic."""
    marker_signature = 'const generateQuestionWithImageFromTopic = async (sheets, {'
    if 'const countQuestionsWithImageInPhase' in text:
        print('[skip] helpers de fase ya existen')
        return text
    if marker_signature not in text:
        raise RuntimeError('No se encontro generateQuestionWithImageFromTopic')

    # Encontrar el final del bloque (siguiente declaracion al mismo nivel)
    next_marker = '\nconst readPedagogicalAssetImageAsDataUrl'
    idx = text.find(next_marker)
    if idx == -1:
        raise RuntimeError('No se encontro el ancla readPedagogicalAssetImageAsDataUrl')

    helper_block = '''
// Cuenta cuantas preguntas activas en QuestionBank tienen imagen asociada
// para una combinacion (subject, session, phase). Usado para enforcar el
// tope de imagenes por fase.
const countQuestionsWithImageInPhase = async (sheets, { subject = '', session = '', phase = '' } = {}) => {
    const normalizedSubject = String(subject || '').trim().toUpperCase();
    const normalizedSession = Number(session || 0) || 0;
    const normalizedPhase = Number(phase || 0) || 0;
    const rows = await getQuestionBankRows(sheets);
    return rows.filter((row) => {
        const rowSubject = String(row.subject || '').trim().toUpperCase();
        const rowSession = Number(row.session || 0) || 0;
        const rowPhase = Number(row.phase || 0) || 0;
        const hasImage = String(row.prompt_image_asset_id || '').trim() !== '';
        const isActive = String(row.active || 'TRUE').trim().toUpperCase() !== 'FALSE';
        return isActive
            && hasImage
            && rowSubject === normalizedSubject
            && rowSession === normalizedSession
            && rowPhase === normalizedPhase;
    }).length;
};

// Genera un batch de preguntas para una fase y le pide a la IA que indique
// para CADA pregunta su image_score (0-10) y image_role. El consumidor
// decide despues cuales reciben imagen real (respetando el cap por fase).
const generatePhaseBatchWithImageScoring = async (sheets, {
    subject = 'MATEMATICA',
    session = '',
    phase = '',
    levelName = 'BASICO',
    count = 15
} = {}) => {
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'MATEMATICA';
    const normalizedLevel = normalizeQuestionBankLevel(levelName) || 'BASICO';
    const targetCount = Math.max(3, Math.min(20, Number(count) || 15));
    const curriculumContext = await getCurriculumContext('1medio', normalizedSubject).catch(() => ({}));

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en el curriculum nacional.',
        'Generas preguntas pedagogicas de seleccion multiple (4 alternativas) para una fase concreta de una sesion.',
        'Tu mision en esta llamada: generar EXACTAMENTE ' + targetCount + ' preguntas variadas dentro de la asignatura/sesion/fase.',
        'Para CADA pregunta debes ademas evaluar si se beneficia de una imagen o diagrama acompanante.',
        'No todas las preguntas necesitan imagen: calculo numerico abstracto, definiciones puramente verbales, etimologia, etc., normalmente NO requieren imagen.',
        'Si requieren imagen: geometria, graficos cartesianos, mapas, anatomia, circuitos, lineas de tiempo, esquemas de procesos, diagramas moleculares, etc.',
        'Devuelve SOLO JSON valido con esta forma exacta:',
        '{ "questions": [ {',
        '  "topic": "...",',
        '  "question": "...",',
        '  "options": {"A":"...","B":"...","C":"...","D":"..."},',
        '  "correct_answer": "A|B|C|D",',
        '  "explanation": "...",',
        '  "image_score": 0-10,',
        '  "image_role": "required_for_interpretation" | "supporting" | "none",',
        '  "image_prompt": "..."',
        '} ] }',
        'Reglas de scoring:',
        '- image_score 9-10 = sin imagen la pregunta pierde casi todo sentido (ej: identificar el angulo en una figura).',
        '- image_score 6-8  = la imagen ayuda mucho a interpretar el contexto.',
        '- image_score 3-5  = la imagen es decorativa o redundante.',
        '- image_score 0-2  = la imagen no aporta nada.',
        'image_role debe ser "required_for_interpretation" cuando image_score >= 8, "supporting" cuando 5-7, "none" cuando < 5.',
        'image_prompt SOLO obligatorio si image_score >= 5. Debe estar en espanol, maximo 2 frases concretas.',
        'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen (esas se renderizan despues si hace falta).',
        'Estilo de imagen referencia: dibujo en blanco y negro, linea limpia, minimalista, libro escolar.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + normalizedSubject + (curriculumContext && curriculumContext.subject_label ? ' (' + curriculumContext.subject_label + ')' : '') + '.',
        'Grado: ' + ((curriculumContext && curriculumContext.grade_label) || '1 medio') + '.',
        'Sesion: ' + (session || '(libre)') + '.',
        'Fase: ' + (phase || '(libre)') + '.',
        'Nivel de dificultad: ' + normalizedLevel + '.',
        'Genera ' + targetCount + ' preguntas variadas. Asegurate de incluir al menos 3 preguntas con image_score >= 6 si la asignatura lo permite, y el resto con image_score adecuado a su naturaleza.',
        'No fuerces image_score alto si la pregunta no se beneficia realmente de la imagen.'
    ].join('\\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
    });
    const parsed = parseJsonObjectResponse(
        completion.choices?.[0]?.message?.content || '',
        'batch fase con scoring'
    );

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalizedQuestions = rawQuestions
        .map((raw) => {
            const options = {
                A: String(raw?.options?.A || '').trim(),
                B: String(raw?.options?.B || '').trim(),
                C: String(raw?.options?.C || '').trim(),
                D: String(raw?.options?.D || '').trim()
            };
            if (!options.A || !options.B || !options.C || !options.D) return null;
            const questionText = String(raw?.question || '').trim();
            if (!questionText) return null;
            const score = Math.max(0, Math.min(10, Number(raw?.image_score) || 0));
            const rawRole = String(raw?.image_role || '').trim().toLowerCase();
            const role = (rawRole === 'required_for_interpretation' || rawRole === 'supporting')
                ? rawRole
                : 'none';
            return {
                topic: String(raw?.topic || '').trim(),
                question: questionText,
                options,
                correct_answer: String(raw?.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
                explanation: String(raw?.explanation || '').trim(),
                image_score: score,
                image_role: role,
                image_prompt: String(raw?.image_prompt || '').trim()
            };
        })
        .filter(Boolean);

    return {
        subject: normalizedSubject,
        session: Number(session || 0) || 0,
        phase: Number(phase || 0) || 0,
        levelName: normalizedLevel,
        target_count: targetCount,
        questions: normalizedQuestions,
        text_model: AI_MODELS.fast
    };
};

'''

    new_text = text[:idx] + helper_block + text[idx:]
    print('[ok] helpers countQuestionsWithImageInPhase + generatePhaseBatchWithImageScoring agregados')
    return new_text


def patch_endpoint_action(text):
    """Inyecta el handler del action populate_phase_with_images justo despues
    del bloque generate_question_with_image."""
    if "currentAction === 'populate_phase_with_images'" in text:
        print('[skip] endpoint populate_phase_with_images ya existe')
        return text

    anchor = "        if (currentAction === 'update_pedagogical_asset_status') {"
    if anchor not in text:
        raise RuntimeError('No se encontro el ancla update_pedagogical_asset_status')

    handler_block = '''        // Genera un batch de preguntas para una fase con scoring de imagen.
        // La IA puntea cuales preguntas son mas idoneas para llevar imagen.
        // Aplica el cap (default 6) de imagenes por fase: las preguntas top
        // por image_score reciben imagen, el resto se guardan sin imagen.
        if (currentAction === 'populate_phase_with_images') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const session = body.session || '';
            const phase = body.phase || '';
            const levelName = normalizeQuestionBankLevel(body.levelName || body.level_name || 'BASICO') || 'BASICO';
            const count = Math.max(3, Math.min(20, Number(body.count) || 15));
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low', 'medium', 'high', 'auto'].includes(String(body.quality || '').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const maxImagesPerPhase = Math.max(0, Math.min(15, Number(body.image_cap || 6) || 6));
            const minScore = Math.max(0, Math.min(10, Number(body.min_image_score || 5) || 5));

            const batch = await generatePhaseBatchWithImageScoring(sheets, {
                subject, session, phase, levelName, count
            });

            const existingWithImage = await countQuestionsWithImageInPhase(sheets, { subject, session, phase });
            const remainingSlots = Math.max(0, maxImagesPerPhase - existingWithImage);

            const candidates = batch.questions
                .map((q, idx) => ({ ...q, originalIndex: idx }))
                .filter((q) => q.image_role !== 'none' && q.image_score >= minScore && q.image_prompt)
                .sort((a, b) => b.image_score - a.image_score)
                .slice(0, remainingSlots);
            const indexesGettingImage = new Set(candidates.map((c) => c.originalIndex));

            const items = [];
            let imagesGenerated = 0;
            let imagesSkippedCapFull = 0;
            let imagesFailed = 0;

            for (let i = 0; i < batch.questions.length; i++) {
                const q = batch.questions[i];
                let asset = null;
                let visualRole = 'illustrative_only';

                const wasCandidate = (q.image_role !== 'none' && q.image_score >= minScore && !!q.image_prompt);

                if (indexesGettingImage.has(i)) {
                    try {
                        const generated = await generatePedagogicalImage({
                            provider,
                            prompt: q.image_prompt || ('Ilustracion educativa de ' + (q.topic || subject)),
                            size,
                            quality
                        });
                        const extension = mimeTypeToExtension(generated.mimeType || '');
                        const safeTitle = sanitizeFileSegment((q.topic || 'phase_batch').slice(0, 60)).toLowerCase();
                        const saved = await saveBufferToLocalFile(
                            generated.buffer,
                            safeTitle + '_' + Date.now() + '_' + i + extension,
                            'quiz-assets'
                        );
                        asset = await createPedagogicalImageAsset(sheets, {
                            title: ((q.topic || 'IA batch') + ' (IA)').slice(0, 180),
                            subject,
                            topicTags: q.topic || '',
                            kind: 'diagram',
                            fileName: saved.fileName,
                            fileUrl: saved.publicUrl,
                            mimeType: generated.mimeType || 'image/png',
                            altText: (q.image_prompt || q.topic || subject).slice(0, 180),
                            caption: 'Auto-generada batch fase ' + (phase || '?') + ' sesion ' + (session || '?'),
                            sourceType: 'ai_phase_batch_' + (generated.provider || 'openai'),
                            status: 'draft'
                        });
                        visualRole = q.image_role === 'required_for_interpretation' ? 'required_for_interpretation' : 'supporting';
                        imagesGenerated++;
                    } catch (imgErr) {
                        console.error('[PHASE_BATCH] Error generando imagen Q' + i + ':', imgErr.message);
                        imagesFailed++;
                    }
                } else if (wasCandidate) {
                    imagesSkippedCapFull++;
                }

                const created = await appendQuestionBankQuestion(sheets, {
                    subject,
                    session,
                    phase,
                    slot: 0,
                    proposalIndex: 1,
                    levelName,
                    topic: q.topic,
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation,
                    sourceMode: 'phase_batch_ai_admin',
                    promptImage: asset,
                    questionVisualRole: visualRole
                });
                items.push({
                    ...created,
                    image_score: q.image_score,
                    image_role: q.image_role,
                    image_prompt: q.image_prompt || '',
                    had_image_attached: !!asset,
                    was_image_candidate: wasCandidate
                });
            }

            return res.json({
                success: true,
                subject,
                session: Number(session || 0) || 0,
                phase: Number(phase || 0) || 0,
                levelName,
                requested_count: count,
                saved_count: items.length,
                images_generated: imagesGenerated,
                images_skipped_cap_full: imagesSkippedCapFull,
                images_failed: imagesFailed,
                cap_per_phase: maxImagesPerPhase,
                existing_images_in_phase: existingWithImage,
                remaining_slots_at_start: remainingSlots,
                min_image_score: minScore,
                items
            });
        }

'''

    new_text = text.replace(anchor, handler_block + anchor, 1)
    print('[ok] endpoint populate_phase_with_images agregado')
    return new_text


def main():
    text = read_file()
    text = patch_helper_functions(text)
    text = patch_endpoint_action(text)
    write_file(text)
    print('[done] backend patched. Lineas:', text.count('\n') + 1)


if __name__ == '__main__':
    main()
