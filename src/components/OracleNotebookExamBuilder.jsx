import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle, Clipboard, Monitor, UploadCloud } from 'lucide-react';

const MAX_PAGES = 3;

const processDocumentImage = (canvas, ctx) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const output = new Uint8ClampedArray(pixels.length);
    const contrast = 2.0;
    const brightness = 10;
    const threshold = 215;
    const darkThreshold = 40;

    for (let i = 0; i < pixels.length; i += 4) {
        const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        let adjusted = ((gray - 128) * contrast) + 128 + brightness;
        if (adjusted > threshold) adjusted = 255;
        else if (adjusted < darkThreshold) adjusted = 0;
        else adjusted = ((adjusted - darkThreshold) / (threshold - darkThreshold)) * 255;
        output[i] = adjusted;
        output[i + 1] = adjusted;
        output[i + 2] = adjusted;
        output[i + 3] = 255;
    }

    imageData.data.set(output);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
};

const buildImageAssetFromSource = (source, pageNumber) => {
    const canvas = document.createElement('canvas');
    let width = source.width || source.videoWidth || 0;
    let height = source.height || source.videoHeight || 0;
    if (!width || !height) throw new Error('No se pudo leer la captura');

    const scale = Math.min(1, 1800 / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, width, height);
    processDocumentImage(canvas, ctx);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    return {
        id: `oracle_nb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        previewUrl: dataUrl,
        imageBase64: dataUrl.split(',')[1],
        imageMimeType: 'image/jpeg',
        pageNumber
    };
};

const OracleNotebookExamBuilder = ({
    defaultSubject = 'MATEMATICA',
    defaultSession = 1,
    questionCount = 15,
    userId = '',
    userEmail = '',
    onExamReady
}) => {
    const [pages, setPages] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
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

    const streamRef = useRef(null);
    const videoRef = useRef(null);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    useEffect(() => () => stopCamera(), []);

    useEffect(() => {
        setConfirmData((prev) => ({
            ...prev,
            subject: defaultSubject || prev.subject || 'MATEMATICA',
            session_base: String(defaultSession || prev.session_base || 1)
        }));
    }, [defaultSubject, defaultSession]);

    const addPageAsset = (asset) => {
        setErrorMsg('');
        setGeneratedResult(null);
        setPages((prev) => {
            if (prev.length >= MAX_PAGES) return prev;
            return [...prev, asset];
        });
    };

    const openCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } }
            });
            streamRef.current = stream;
            setIsCameraOpen(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => {});
            }
        } catch {
            setErrorMsg('No se pudo acceder a la camara.');
        }
    };

    const captureFromCamera = () => {
        if (!videoRef.current) return;
        try {
            const pageNumber = pages.length + 1;
            const asset = buildImageAssetFromSource(videoRef.current, pageNumber);
            addPageAsset(asset);
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo capturar la imagen');
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
            setErrorMsg('Por ahora sube imagen (foto/screenshot).');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                try {
                    const pageNumber = pages.length + 1;
                    const asset = buildImageAssetFromSource(img, pageNumber);
                    addPageAsset(asset);
                } catch (error) {
                    setErrorMsg(error.message || 'No se pudo procesar la imagen');
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (event) => {
        const items = event.clipboardData?.items || [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (!item.type.includes('image')) continue;
            const blob = item.getAsFile();
            if (!blob) continue;
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const pageNumber = pages.length + 1;
                        const asset = buildImageAssetFromSource(img, pageNumber);
                        addPageAsset(asset);
                    } catch (error) {
                        setErrorMsg(error.message || 'No se pudo procesar el screenshot pegado');
                    }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(blob);
            event.preventDefault();
            break;
        }
    };

    const captureScreen = async () => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setErrorMsg('Captura de pantalla no disponible en este dispositivo/navegador.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = stream.getVideoTracks()[0];
            const video = document.createElement('video');
            video.srcObject = new MediaStream([track]);
            await video.play();
            const pageNumber = pages.length + 1;
            const asset = buildImageAssetFromSource(video, pageNumber);
            addPageAsset(asset);
            track.stop();
        } catch {
            setErrorMsg('No se pudo capturar pantalla.');
        }
    };

    const removePage = (id) => {
        setPages((prev) => prev.filter((item) => item.id !== id));
    };

    const submitIntake = async () => {
        if (!pages.length) {
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
            const firstPage = pages[0];
            const response = await fetch('/api/oracle/exam-from-notebook/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    email: userEmail || '',
                    image_base64: firstPage.imageBase64,
                    image_mime_type: firstPage.imageMimeType,
                    subject_hint: confirmData.subject || defaultSubject || 'MATEMATICA',
                    session_hint: Number(confirmData.session_base || defaultSession || 1),
                    question_count: Number(questionCount || 15)
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
                        subtopics: confirmData.subtopics
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        keywords: confirmData.keywords
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean),
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

    const canAnalyze = pages.length > 0 && !isAnalyzing && !isGenerating;
    const canGenerate = Boolean(draftId) && !isGenerating && !isAnalyzing;

    return (
        <div className="space-y-4" onPaste={handlePaste}>
            <div className="grid md:grid-cols-4 gap-3">
                <button type="button" onClick={openCamera} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Tomar foto
                </button>
                <label className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2 cursor-pointer">
                    <UploadCloud className="w-4 h-4" /> Subir archivo
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <button type="button" onClick={captureScreen} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2">
                    <Monitor className="w-4 h-4" /> Capturar pantalla
                </button>
                <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-[#F8FAFF] px-3 py-3 text-xs font-bold text-[#64748B] flex items-center justify-center gap-2">
                    <Clipboard className="w-4 h-4" /> Pegar screenshot (Ctrl+V)
                </div>
            </div>

            {isCameraOpen && (
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-3 space-y-3">
                    <video ref={videoRef} className="w-full rounded-xl bg-black max-h-72 object-contain" playsInline muted />
                    <div className="flex gap-3">
                        <button type="button" onClick={captureFromCamera} className="px-4 py-2 rounded-xl bg-[#4D96FF] text-white text-sm font-black">
                            Capturar
                        </button>
                        <button type="button" onClick={stopCamera} className="px-4 py-2 rounded-xl bg-gray-200 text-[#334155] text-sm font-black">
                            Cerrar cámara
                        </button>
                    </div>
                </div>
            )}

            {pages.length > 0 && (
                <div className="space-y-3">
                    <div className="grid md:grid-cols-3 gap-3">
                        {pages.map((page) => (
                            <div key={page.id} className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white">
                                <img src={page.previewUrl} alt={`captura-${page.pageNumber}`} className="w-full h-28 object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removePage(page.id)}
                                    className="absolute top-2 right-2 text-xs bg-black/70 text-white px-2 py-1 rounded-lg"
                                >
                                    Quitar
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-[#64748B] font-bold">Se usarán hasta {MAX_PAGES} capturas (actual: {pages.length}).</p>
                </div>
            )}

            {errorMsg && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

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
                    {isGenerating ? 'GENERANDO PRUEBA...' : '2) GENERAR PRUEBA + PRÁCTICA GUIADA'}
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
                        <input className="w-full border rounded-lg px-3 py-2 text-sm font-bold" value={confirmData.session_base} onChange={(e) => setConfirmData((prev) => ({ ...prev, session_base: e.target.value }))} placeholder="Sesión base" />
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
                        {generatedResult.practice_guide || 'Sin práctica guiada.'}
                    </div>
                    <button
                        type="button"
                        onClick={() => onExamReady?.(generatedResult)}
                        className="w-full rounded-2xl bg-[#16A34A] text-white font-black py-3"
                    >
                        USAR ESTA PRUEBA EN ORÁCULO
                    </button>
                </div>
            )}
        </div>
    );
};

export default OracleNotebookExamBuilder;
