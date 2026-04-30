#!/usr/bin/env python3
# Patches idempotentes para agregar el flujo "add_images_to_existing_phase_questions":
# - Toma preguntas YA existentes en QuestionBank (sin imagen) por fase
# - IA las puntua para decidir cuales se benefician mas de una imagen
# - Genera imagenes solo para las top, hasta el cap de 6 por fase
# - Enlaza el asset nuevo a la pregunta existente
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER_FILE = os.path.join(ROOT, 'server', 'index.js')


def read_file():
    with open(SERVER_FILE, 'rb') as fh:
        data = fh.read()
    text = data.rstrip(b'\x00').decode('utf-8')
    crlf = '\r\n' in text
    if crlf:
        text = text.replace('\r\n', '\n')
    return text, crlf


def write_file(text, crlf):
    text = text.replace('\x00', '')
    if crlf:
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(SERVER_FILE, 'wb') as fh:
        fh.write(text.encode('utf-8'))


def patch_helpers(text):
    """Agrega scoreExistingQuestionsForImage y attachImageToExistingQuestion
    despues del bloque de helpers de fase (countQuestionsWithImageInPhase)."""
    if 'scoreExistingQuestionsForImage' in text:
        print('[skip] helpers de existing questions ya existen')
        return text

    anchor = 'const generatePhaseBatchWithImageScoring = async (sheets, {'
    if anchor not in text:
        raise RuntimeError('No se encontro generatePhaseBatchWithImageScoring')

    # Encontrar el cierre de generatePhaseBatchWithImageScoring (siguiente const al mismo nivel)
    idx = text.find(anchor)
    next_marker = '\nconst readPedagogicalAssetImageAsDataUrl'
    end_idx = text.find(next_marker, idx)
    if end_idx == -1:
        raise RuntimeError('No se encontro el ancla readPedagogicalAssetImageAsDataUrl')

    helper_block = '''
// Pide a la IA puntuar preguntas YA EXISTENTES de QuestionBank: que tanto
// se benefician de una imagen, y cual seria un image_prompt apropiado.
const scoreExistingQuestionsForImage = async ({ subject = '', questions = [] } = {}) => {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const systemPrompt = [
        'Eres Matico, profesor chileno experto. Recibes una lista de preguntas YA EXISTENTES y debes evaluar cuales se beneficiarian de una imagen pedagogica.',
        'Para cada pregunta devuelves: question_id (el mismo que recibiste), image_score (0-10), image_role, image_prompt.',
        'Reglas de scoring:',
        '- 9-10 = sin imagen la pregunta pierde casi todo sentido (ej: identificar elementos en un diagrama, leer un grafico).',
        '- 6-8  = la imagen ayuda mucho a entender el contexto.',
        '- 3-5  = la imagen es decorativa o redundante.',
        '- 0-2  = la imagen no aporta nada.',
        'image_role debe ser "required_for_interpretation" si image_score>=8, "supporting" si 5-7, "none" si <5.',
        'image_prompt SOLO obligatorio si image_score>=5. En espanol, maximo 2 frases concretas describiendo elementos visuales.',
        'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen.',
        'Estilo objetivo: dibujo en blanco y negro, linea limpia, minimalista, libro escolar.',
        'Devuelve SOLO JSON valido con esta forma exacta:',
        '{ "scores": [ { "question_id": "...", "image_score": 0-10, "image_role": "required_for_interpretation|supporting|none", "image_prompt": "..." } ] }',
        'IMPORTANTE: incluye TODAS las preguntas que recibes, una entrada por cada question_id.'
    ].join(' ');

    const lines = questions.map((q, i) => '[' + (i + 1) + '] question_id=' + q.question_id + ' | tema=' + (q.topic || '?') + ' | enunciado: ' + (q.question || '').slice(0, 280));
    const userPrompt = [
        'Asignatura: ' + (subject || 'GENERICA') + '.',
        'Preguntas a evaluar (' + questions.length + ' total):',
        ...lines
    ].join('\\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
    });
    const parsed = parseJsonObjectResponse(
        completion.choices?.[0]?.message?.content || '',
        'scoring preguntas existentes'
    );

    const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
    return scores.map((s) => {
        const rawRole = String(s?.image_role || '').trim().toLowerCase();
        const role = (rawRole === 'required_for_interpretation' || rawRole === 'supporting')
            ? rawRole
            : 'none';
        return {
            question_id: String(s?.question_id || '').trim(),
            image_score: Math.max(0, Math.min(10, Number(s?.image_score) || 0)),
            image_role: role,
            image_prompt: String(s?.image_prompt || '').trim()
        };
    });
};

// Enlaza un asset RECIEN creado a una pregunta existente del QuestionBank.
// A diferencia de linkQuestionBankAsset, NO requiere status=approved porque
// el asset fue generado en este mismo flujo curado por IA.
const attachImageToExistingQuestion = async (sheets, { questionId = '', asset = null, visualRole = 'supporting' } = {}) => {
    const rows = await getQuestionBankRows(sheets);
    const target = rows.find((row) => String(row.question_id || '').trim() === String(questionId || '').trim());
    if (!target) throw new Error('La pregunta del banco no existe: ' + questionId);

    const patch = {
        ...target,
        prompt_image_asset_id: String(asset?.asset_id || '').trim(),
        prompt_image_url: String(asset?.file_url || '').trim(),
        prompt_image_alt: String(asset?.alt_text || '').trim(),
        prompt_image_caption: String(asset?.caption || '').trim(),
        question_visual_role: normalizeQuestionVisualRole(visualRole || 'supporting'),
        updated_at: new Date().toISOString()
    };

    await updateSheetRowByHeaders(sheets, QUESTION_BANK_SHEET, QUESTION_BANK_HEADERS, target.rowNumber, patch);
    return {
        question_id: target.question_id,
        prompt_image_asset_id: patch.prompt_image_asset_id,
        prompt_image_url: patch.prompt_image_url,
        prompt_image_alt: patch.prompt_image_alt,
        prompt_image_caption: patch.prompt_image_caption,
        question_visual_role: patch.question_visual_role
    };
};

'''

    # Inserta antes del marker readPedagogicalAssetImageAsDataUrl
    new_text = text[:end_idx] + helper_block + text[end_idx:]
    print('[ok] helpers scoreExistingQuestionsForImage + attachImageToExistingQuestion agregados')
    return new_text


def patch_endpoint(text):
    """Agrega el handler add_images_to_existing_phase_questions justo despues
    del handler populate_phase_with_images."""
    if "currentAction === 'add_images_to_existing_phase_questions'" in text:
        print('[skip] endpoint add_images_to_existing_phase_questions ya existe')
        return text

    # Anclamos en el cierre del bloque populate_phase_with_images.
    # Su return final es:
    #     return res.json({ ... existing_images_in_phase ... });
    #         }
    # Pero hay otros bloques con el mismo patron, asi que usamos un anchor mas especifico.
    anchor = "        if (currentAction === 'update_pedagogical_asset_status') {"
    if anchor not in text:
        raise RuntimeError('No se encontro el ancla update_pedagogical_asset_status')

    handler_block = '''        // Toma las preguntas YA EXISTENTES en QuestionBank para una fase y agrega
        // imagenes a las que la IA considera mas idoneas, hasta el cap por fase.
        if (currentAction === 'add_images_to_existing_phase_questions') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const session = body.session || '';
            const phase = body.phase || '';
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low', 'medium', 'high', 'auto'].includes(String(body.quality || '').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const maxImagesPerPhase = Math.max(1, Math.min(15, Number(body.image_cap || 6) || 6));
            const minScore = Math.max(0, Math.min(10, Number(body.min_image_score || 5) || 5));

            if (!session || !phase) {
                return res.status(400).json({ success: false, error: 'Debes indicar session y phase numericos' });
            }

            // 1. Listar preguntas activas en (subject, session, phase) SIN imagen.
            const allRows = await getQuestionBankRows(sheets);
            const sessionNum = Number(session) || 0;
            const phaseNum = Number(phase) || 0;
            const phaseQuestionsWithoutImage = allRows.filter((row) => {
                const rowSubject = String(row.subject || '').trim().toUpperCase();
                const rowSession = Number(row.session || 0) || 0;
                const rowPhase = Number(row.phase || 0) || 0;
                const hasImage = String(row.prompt_image_asset_id || '').trim() !== '';
                const isActive = String(row.active || 'TRUE').trim().toUpperCase() !== 'FALSE';
                return isActive && !hasImage
                    && rowSubject === subject
                    && rowSession === sessionNum
                    && rowPhase === phaseNum;
            });

            // 2. Contar imagenes ya existentes en la fase.
            const existingWithImage = await countQuestionsWithImageInPhase(sheets, { subject, session, phase });
            const remainingSlots = Math.max(0, maxImagesPerPhase - existingWithImage);

            if (phaseQuestionsWithoutImage.length === 0) {
                return res.json({
                    success: true,
                    subject,
                    session: sessionNum,
                    phase: phaseNum,
                    message: 'No hay preguntas sin imagen en esta fase',
                    cap_per_phase: maxImagesPerPhase,
                    existing_images_in_phase_before: existingWithImage,
                    remaining_slots: remainingSlots,
                    questions_without_image_total: 0,
                    images_generated: 0,
                    items: []
                });
            }

            if (remainingSlots === 0) {
                return res.json({
                    success: true,
                    subject,
                    session: sessionNum,
                    phase: phaseNum,
                    message: 'Cap de imagenes ya alcanzado en esta fase',
                    cap_per_phase: maxImagesPerPhase,
                    existing_images_in_phase_before: existingWithImage,
                    remaining_slots: 0,
                    questions_without_image_total: phaseQuestionsWithoutImage.length,
                    images_generated: 0,
                    items: []
                });
            }

            // 3. IA puntua todas las preguntas.
            const scoringInput = phaseQuestionsWithoutImage.map((row) => ({
                question_id: row.question_id,
                topic: row.topic,
                question: row.question
            }));
            const scores = await scoreExistingQuestionsForImage({ subject, questions: scoringInput });
            const scoreMap = new Map(scores.map((s) => [s.question_id, s]));

            // 4. Filtra y ordena candidatos top N (= remainingSlots).
            const enriched = phaseQuestionsWithoutImage.map((row) => {
                const s = scoreMap.get(row.question_id) || { image_score: 0, image_role: 'none', image_prompt: '' };
                return {
                    question_id: row.question_id,
                    topic: row.topic,
                    question: row.question,
                    image_score: s.image_score,
                    image_role: s.image_role,
                    image_prompt: s.image_prompt
                };
            });
            const candidates = enriched
                .filter((q) => q.image_role !== 'none' && q.image_score >= minScore && q.image_prompt)
                .sort((a, b) => b.image_score - a.image_score)
                .slice(0, remainingSlots);

            // 5. Para cada candidato: generar imagen, crear asset, enlazar.
            const items = [];
            let imagesGenerated = 0;
            let imagesFailed = 0;

            for (const q of candidates) {
                try {
                    const generated = await generatePedagogicalImage({
                        provider,
                        prompt: q.image_prompt,
                        size,
                        quality
                    });
                    const extension = mimeTypeToExtension(generated.mimeType || '');
                    const safeTitle = sanitizeFileSegment((q.topic || q.question_id || 'existing').slice(0, 60)).toLowerCase();
                    const saved = await saveBufferToLocalFile(
                        generated.buffer,
                        safeTitle + '_' + Date.now() + extension,
                        'quiz-assets'
                    );
                    const asset = await createPedagogicalImageAsset(sheets, {
                        title: ((q.topic || q.question_id) + ' (IA existente)').slice(0, 180),
                        subject,
                        topicTags: q.topic || '',
                        kind: 'diagram',
                        fileName: saved.fileName,
                        fileUrl: saved.publicUrl,
                        mimeType: generated.mimeType || 'image/png',
                        altText: (q.image_prompt || q.topic || subject).slice(0, 180),
                        caption: 'Auto-generada para pregunta existente sesion ' + sessionNum + ' fase ' + phaseNum,
                        sourceType: 'ai_existing_question_' + (generated.provider || 'openai'),
                        status: 'approved'
                    });
                    const visualRole = q.image_role === 'required_for_interpretation' ? 'required_for_interpretation' : 'supporting';
                    await attachImageToExistingQuestion(sheets, {
                        questionId: q.question_id,
                        asset,
                        visualRole
                    });
                    imagesGenerated++;
                    items.push({
                        question_id: q.question_id,
                        topic: q.topic,
                        question: (q.question || '').slice(0, 180),
                        image_score: q.image_score,
                        image_role: q.image_role,
                        image_prompt: q.image_prompt,
                        attached: true,
                        asset_id: asset.asset_id,
                        file_url: asset.file_url
                    });
                } catch (err) {
                    console.error('[ATTACH_IMAGE] Error en Q ' + q.question_id + ':', err.message);
                    imagesFailed++;
                    items.push({
                        question_id: q.question_id,
                        topic: q.topic,
                        attached: false,
                        error: err.message
                    });
                }
            }

            return res.json({
                success: true,
                subject,
                session: sessionNum,
                phase: phaseNum,
                cap_per_phase: maxImagesPerPhase,
                existing_images_in_phase_before: existingWithImage,
                remaining_slots: remainingSlots,
                questions_without_image_total: phaseQuestionsWithoutImage.length,
                candidates_passed_threshold: candidates.length,
                images_generated: imagesGenerated,
                images_failed: imagesFailed,
                min_image_score: minScore,
                items,
                scored_overview: enriched
                    .map((q) => ({
                        question_id: q.question_id,
                        topic: q.topic,
                        image_score: q.image_score,
                        image_role: q.image_role
                    }))
                    .sort((a, b) => b.image_score - a.image_score)
            });
        }

'''

    new_text = text.replace(anchor, handler_block + anchor, 1)
    print('[ok] endpoint add_images_to_existing_phase_questions agregado')
    return new_text


def main():
    text, crlf = read_file()
    text = patch_helpers(text)
    text = patch_endpoint(text)
    write_file(text, crlf)
    print('[done] backend patched. Lineas:', text.count('\n') + 1)


if __name__ == '__main__':
    main()
