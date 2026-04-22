import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import EvidenceIntake, { DEFAULT_MAX_EVIDENCE } from './EvidenceIntake';

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
    const [generatedResult, setGeneratedResult] = useState(null);

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
            setGeneratedResult(data);
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo generar la prueba');
        } finally {
            setIsGenerating(false);
        }
    };

    const canAnalyze = evidences.length > 0 && !isAnalyzing && !isGenerating;
    const canGenerate = Boolean(draftId) && !isGenerating && !isAnalyzing;

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
                    {isGenerating ? 'GENERANDO PRUEBA...' : '2) GENERAR PRUEBA + PRACTICA GUIADA'}
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
                    <p className="text-sm font-black text-green-700">
                        Prueba lista: {generatedResult.questions?.length || 0} preguntas ({(generatedResult.source_mix || []).join(' + ')})
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-white border border-green-100 p-3 text-sm text-[#334155] whitespace-pre-wrap">
                        {generatedResult.practice_guide || 'Sin practica guiada.'}
                    </div>
                    <button
                        type="button"
                        onClick={() => onExamReady?.(generatedResult)}
                        className="w-full rounded-2xl bg-[#16A34A] text-white font-black py-3"
                    >
                        USAR ESTA PRUEBA EN ORACULO
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
