import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import EvidenceIntake, { DEFAULT_MAX_EVIDENCE } from './EvidenceIntake';

// Debe coincidir con normalizeQuestionSignature() del server (server/index.js).
// Si ambos generan la misma firma, el server dedupe contra lo que el cliente ya mostro.
const normalizeSignature = (questionText = '', options = {}) => {
    const clean = (value = '') => String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\\frac/g, 'frac')
        .replace(/\\sqrt/g, 'sqrt')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

    const optionText = Object.values(options || {})
        .map(clean)
        .sort()
        .join(' | ');

    return `${clean(questionText)} || ${optionText}`;
};

const OracleNotebookExamBuilder = ({
    defaultSubject = 'MATEMATICA',
    defaultSession = 1,
    questionCount = 15,
    userId = '',
    userEmail = '',
    onExamReady
}) => {
    const [evidences, setEvidences] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [draftId, setDraftId] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [detectedTopics, setDetectedTopics] = useState([]);
    const [confirmData, setConfirmData] = useState({
        subject: defaultSubject,
        topic: '',
        subtopics: '',
        keywords: '',
        grade: '1medio',
        session_base: String(defaultSession || 1)
    });
    // Resultado base (metadata + practice_guide) y preguntas acumuladas en tandas.
    const [generatedResult, setGeneratedResult] = useState(null);
    const [accumQuestions, setAccumQuestions] = useState([]);
    const [batchInfo, setBatchInfo] = useState({ total_batches: 1, done_batches: 0, has_more: false, loading_batch: false });
    const [totalExpected, setTotalExpected] = useState(0);

    useEffect(() => {
        setConfirmData((prev) => ({
            ...prev,
            subject: defaultSubject || prev.subject || 'MATEMATICA',
            session_base: String(defaultSession || prev.session_base || 1)
        }));
    }, [defaultSubject, defaultSession]);

    const submitIntake = async () => {
        if (!evidences.length) {
            setErrorMsg('Debes agregar al menos una captura.');
            return;
        }
        if (!userId) {
            setErrorMsg('Falta user_id para analizar el cuaderno.');
            return;
        }

        setIsAnalyzing(true);
        setErrorMsg('');
        setGeneratedResult(null);
        setAccumQuestions([]);
        setBatchInfo({ total_batches: 1, done_batches: 0, has_more: false, loading_batch: false });
        try {
            const response = await fetch('/api/oracle/exam-from-notebook/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    email: userEmail || '',
                    subject_hint: confirmData.subject || defaultSubject || 'MATEMATICA',
                    session_hint: Number(confirmData.session_base || defaultSession || 1),
                    question_count: Number(questionCount || 15),
                    evidences: evidences.map((item, index) => ({
                        image_base64: item.imageBase64,
                        image_mime_type: item.imageMimeType || 'image/jpeg',
                        source_type: item.sourceType || 'notebook',
                        page_number: index + 1
                    }))
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo analizar');

            setDraftId(data.draft_id || '');
            setConfidence(Number(data.confidence || 0));
            setDetectedTopics(Array.isArray(data.detected_topics) ? data.detected_topics : []);
            setConfirmData((prev) => ({
                ...prev,
                subject: data.event_preview?.subject || prev.subject || defaultSubject || 'MATEMATICA',
                topic: data.event_preview?.topic || prev.topic || '',
                subtopics: Array.isArray(data.event_preview?.subtopics)
                    ? data.event_preview.subtopics.join(', ')
                    : (prev.subtopics || ''),
                keywords: Array.isArray(data.event_preview?.keywords)
                    ? data.event_preview.keywords.join(', ')
                    : (prev.keywords || ''),
                grade: data.event_preview?.grade || prev.grade || '1medio',
                session_base: String(data.event_preview?.session_base || prev.session_base || defaultSession || 1)
            }));
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo analizar el cuaderno');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Llama /generate (primera tanda rapida + practice_guide) y luego dispara las tandas siguientes.
    const submitGenerate = async () => {
        if (!draftId) {
            setErrorMsg('Primero analiza la captura del cuaderno.');
            return;
        }
        if (!confirmData.topic?.trim()) {
            setErrorMsg('Debes confirmar al menos el tema principal.');
            return;
        }

        setIsGenerating(true);
        setErrorMsg('');
        setAccumQuestions([]);
        setGeneratedResult(null);
        try {
            const response = await fetch('/api/oracle/exam-from-notebook/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    draft_id: draftId,
                    user_id: userId,
                    question_count: Number(questionCount || 15),
                    confirmed_data: {
                        subject: confirmData.subject,
                        topic: confirmData.topic,
                        subtopics: confirmData.subtopics.split(',').map((item) => item.trim()).filter(Boolean),
                        keywords: confirmData.keywords.split(',').map((item) => item.trim()).filter(Boolean),
                        grade: confirmData.grade || '1medio',
                        session_base: Number(confirmData.session_base || defaultSession || 1)
                    }
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo generar la prueba');

            const firstQuestions = Array.isArray(data.questions) ? data.questions : [];
            setGeneratedResult(data);
            setAccumQuestions(firstQuestions);
            setTotalExpected(Number(data.question_count || questionCount || 15));
            setBatchInfo({
                total_batches: Number(data.total_batches || 1),
                done_batches: 1,
                has_more: Boolean(data.has_more),
                loading_batch: false
            });

            // Ya tenemos la primera tanda en pantalla. Podemos soltar el spinner "global"
            // y continuar cargando las siguientes tandas en background.
            setIsGenerating(false);

            if (data.has_more) {
                // Fire and forget, no bloquea la UI.
                runRemainingBatches({
                    totalBatches: Number(data.total_batches || 1),
                    startAtIndex: 1,
                    initialQuestions: firstQuestions,
                    baseResult: data
                }).catch((e) => setErrorMsg(e?.message || 'Error cargando tandas siguientes'));
            }
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo generar la prueba');
            setIsGenerating(false);
        }
    };

    const runRemainingBatches = async ({ totalBatches = 1, startAtIndex = 1, initialQuestions = [], baseResult = null }) => {
        let current = [...initialQuestions];
        let seenSigs = new Set(current.map((q) => normalizeSignature(q.question, q.options)).filter(Boolean));

        for (let idx = startAtIndex; idx < totalBatches; idx += 1) {
            setBatchInfo((prev) => ({ ...prev, loading_batch: true }));
            try {
                const response = await fetch('/api/oracle/exam-from-notebook/generate-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        draft_id: draftId,
                        user_id: userId,
                        batch_index: idx,
                        previous_signatures: Array.from(seenSigs).slice(-60)
                    })
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    // No aborta la ejecucion; solo muestra y sigue con la siguiente tanda.
                    setErrorMsg(`Tanda ${idx + 1}: ${data.error || 'No se pudo generar'}`);
                    setBatchInfo((prev) => ({ ...prev, done_batches: idx + 1, loading_batch: false }));
                    continue;
                }

                const newOnes = Array.isArray(data.questions) ? data.questions : [];
                const deduped = [];
                for (const q of newOnes) {
                    const sig = normalizeSignature(q.question, q.options);
                    if (!sig || seenSigs.has(sig)) continue;
                    seenSigs.add(sig);
                    deduped.push(q);
                }
                if (deduped.length) {
                    current = [...current, ...deduped];
                    setAccumQuestions([...current]);
                }

                setBatchInfo({
                    total_batches: totalBatches,
                    done_batches: idx + 1,
                    has_more: Boolean(data.has_more),
                    loading_batch: false
                });

                if (!data.has_more) break;
            } catch (error) {
                setErrorMsg(`Tanda ${idx + 1}: ${error.message || 'Error de red'}`);
                setBatchInfo((prev) => ({ ...prev, loading_batch: false }));
                break;
            }
        }

        // Actualiza el resultado final combinado para onExamReady.
        if (baseResult) {
            setGeneratedResult({ ...baseResult, questions: current, question_count: current.length });
        }
    };

    const handleUseExam = () => {
        if (!generatedResult) return;
        onExamReady?.({ ...generatedResult, questions: accumQuestions, question_count: accumQuestions.length });
    };

    const canAnalyze = evidences.length > 0 && !isAnalyzing && !isGenerating;
    const canGenerate = Boolean(draftId) && !isGenerating && !isAnalyzing;
    const stillLoadingBatches = batchInfo.has_more || batchInfo.loading_batch;
    const progressPct = totalExpected > 0 ? Math.min(100, Math.round((accumQuestions.length / totalExpected) * 100)) : 0;

    return (
        <div className="space-y-4">
            <EvidenceIntake
                maxEvidence={DEFAULT_MAX_EVIDENCE}
                value={evidences}
                onChange={setEvidences}
                onError={setErrorMsg}
                showNativeCapture
                showPasteHint={false}
                nativeQueueOnly
            />

            <div className="grid md:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={submitIntake}
                    disabled={!canAnalyze}
                    className={`rounded-2xl px-4 py-3 font-black text-sm ${canAnalyze ? 'bg-[#4D96FF] text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                >
                    {isAnalyzing ? 'ANALIZANDO CUADERNO...' : '1) ANALIZAR FOTO DEL CUADERNO'}
                </button>
                <button
                    type="button"
                    onClick={submitGenerate}
                    disabled={!canGenerate}
                    className={`rounded-2xl px-4 py-3 font-black text-sm ${canGenerate ? 'bg-[#7C3AED] text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                >
                    {isGenerating ? 'GENERANDO PRIMERAS 3 PREGUNTAS...' : '2) GENERAR PRUEBA + PRACTICA GUIADA'}
                </button>
            </div>

            {draftId && (
                <div className="rounded-2xl border border-[#E5ECFF] bg-[#F8FAFF] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-black text-[#2B2E4A]">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Tema detectado (confianza: {confidence}%)
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <input className="w-full border rounded-lg px-3 py-2 text-sm font-bold" value={confirmData.subject} onChange={(e) => setConfirmData((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Materia" />
                        <input className="w-full border rounded-lg px-3 py-2 text-sm font-bold" value={confirmData.session_base} onChange={(e) => setConfirmData((prev) => ({ ...prev, session_base: e.target.value }))} placeholder="Sesion base" />
                    </div>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm font-bold" value={confirmData.topic} onChange={(e) => setConfirmData((prev) => ({ ...prev, topic: e.target.value }))} placeholder="Tema principal" />
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" value={confirmData.subtopics} onChange={(e) => setConfirmData((prev) => ({ ...prev, subtopics: e.target.value }))} placeholder="Subtemas (separados por coma)" />
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" value={confirmData.keywords} onChange={(e) => setConfirmData((prev) => ({ ...prev, keywords: e.target.value }))} placeholder="Palabras clave (separadas por coma)" />
                    {detectedTopics.length > 0 && (
                        <div className="text-xs text-[#475569]">
                            Detectado: {detectedTopics.join(' · ')}
                        </div>
                    )}
                </div>
            )}

            {generatedResult?.success && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-green-700">
                            Preguntas listas: {accumQuestions.length}/{totalExpected}
                            {' '}({(generatedResult.source_mix || []).join(' + ')})
                        </p>
                        {stillLoadingBatches && (
                            <span className="flex items-center gap-1 text-xs font-black text-[#7C3AED]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generando tanda {batchInfo.done_batches + 1} de {batchInfo.total_batches}...
                            </span>
                        )}
                    </div>
                    {totalExpected > 0 && (
                        <div className="w-full h-2 rounded-full bg-green-100 overflow-hidden">
                            <div
                                className="h-full bg-[#7C3AED] transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    )}
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-white border border-green-100 p-3 text-sm text-[#334155] whitespace-pre-wrap">
                        {generatedResult.practice_guide || 'Sin practica guiada.'}
                    </div>
                    {accumQuestions.length > 0 && (
                        <div className="max-h-60 overflow-y-auto rounded-xl bg-white border border-green-100 p-3 text-xs text-[#334155] space-y-2">
                            {accumQuestions.map((q, i) => (
                                <div key={i} className="border-b last:border-b-0 pb-2 last:pb-0">
                                    <p className="font-black">{i + 1}. {q.question}</p>
                                    {q.source_topic && (
                                        <p className="text-[10px] text-[#7C3AED] font-black uppercase mt-0.5">{q.source_topic}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleUseExam}
                        disabled={stillLoadingBatches && accumQuestions.length < Math.min(3, totalExpected)}
                        className={`w-full rounded-2xl font-black py-3 ${stillLoadingBatches && accumQuestions.length < Math.min(3, totalExpected) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#16A34A] text-white'}`}
                    >
                        {stillLoadingBatches
                            ? `USAR YA (${accumQuestions.length} preguntas) - seguiran llegando`
                            : 'USAR ESTA PRUEBA EN ORACULO'}
                    </button>
                </div>
            )}

            {errorMsg && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
        </div>
    );
};

export default OracleNotebookExamBuilder;
