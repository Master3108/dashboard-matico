import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle, Download, RotateCcw, Sparkles, Star, Trash2, UploadCloud, Video, X } from 'lucide-react';

const MAX_PAGES = 3;
const POLL_INTERVAL_MS = 2000;
const NOTEBOOK_QUIZ_THRESHOLD = 40;

const TIER_UI = {
    oro: { xp: 50, title: 'Excelente trabajo', box: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    plata: { xp: 30, title: 'Buen trabajo', box: 'bg-slate-50 border-slate-300', text: 'text-slate-700' },
    insuficiente: { xp: 0, title: 'Necesita mejora', box: 'bg-red-50 border-red-300', text: 'text-red-700' }
};

const processImageLikeAdobeScan = (canvas, ctx) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const output = new Uint8ClampedArray(pixels.length);
    const contrast = 2.2;
    const brightness = 15;
    const threshold = 210;
    const darkThreshold = 45;

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

const scoreToStars = (score = 0) => {
    if (score >= 90) return 5;
    if (score >= 80) return 4;
    if (score >= NOTEBOOK_QUIZ_THRESHOLD) return 3;
    if (score >= 50) return 2;
    if (score > 0) return 1;
    return 0;
};

const buildPageAsset = (source, pageNumber) => {
    const canvas = document.createElement('canvas');
    let width = source.width || source.videoWidth || 0;
    let height = source.height || source.videoHeight || 0;

    if (!width || !height) {
        throw new Error('No se pudo leer la hoja escaneada.');
    }

    const scale = Math.min(1, 1600 / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error('No se pudo preparar el escaneo.');
    }

    ctx.drawImage(source, 0, 0, width, height);
    processImageLikeAdobeScan(canvas, ctx);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    return {
        id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        previewUrl: dataUrl,
        imageBase64: dataUrl.split(',')[1],
        imageMimeType: 'image/jpeg',
        width,
        height,
        pageNumber
    };
};

const buildPdfFromPages = async (pages, subject, sessionId, scanId) => {
    if (!pages.length) {
        throw new Error('No hay páginas para generar el PDF.');
    }

    const { jsPDF } = await import('jspdf');
    const first = pages[0];
    const firstLandscape = first.width > first.height;
    const pdf = new jsPDF({
        orientation: firstLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: firstLandscape ? [792, 612] : [612, 792],
        compress: true,
        putOnlyUsedFonts: true,
        floatPrecision: 16
    });

    pages.forEach((page, index) => {
        const landscape = page.width > page.height;
        const pdfWidth = landscape ? 792 : 612;
        const pdfHeight = landscape ? 612 : 792;
        const ratio = Math.min(pdfWidth / page.width, pdfHeight / page.height);

        if (index > 0) {
            pdf.addPage([pdfWidth, pdfHeight], landscape ? 'landscape' : 'portrait');
        }

        pdf.addImage(
            page.previewUrl,
            'JPEG',
            (pdfWidth - page.width * ratio) / 2,
            (pdfHeight - page.height * ratio) / 2,
            page.width * ratio,
            page.height * ratio,
            undefined,
            'FAST'
        );
    });

    return {
        pages,
        scanId,
        pdfBase64: pdf.output('datauristring').split(',')[1],
        pdfFileName: `cuaderno_${subject || 'materia'}_S${sessionId || 0}_${scanId}.pdf`
    };
};

const CuadernoMission = ({ sessionId, subject, topic, readingContent, onComplete, onSkip, userEmail, userId }) => {
    const [status, setStatus] = useState('idle');
    const [feedback, setFeedback] = useState('');
    const [suggestion, setSuggestion] = useState('');
    const [scanAssets, setScanAssets] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [submissionId, setSubmissionId] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const pollRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => () => {
        mountedRef.current = false;
        clearPolling();
        stopCamera();
    }, []);

    const clearPolling = () => {
        if (pollRef.current) {
            clearTimeout(pollRef.current);
            pollRef.current = null;
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    const makeScanId = () => scanAssets?.scanId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const rebuildAssets = async (pages, nextScanId = makeScanId()) => {
        const built = await buildPdfFromPages(pages, subject, sessionId, nextScanId);
        setScanAssets(built);
        return built;
    };

    const openCamera = async () => {
        setFeedback('');
        setStatus('camera');
        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1080 },
                        height: { ideal: 1920 },
                        aspectRatio: { ideal: 9 / 16 }
                    }
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        aspectRatio: { ideal: 9 / 16 }
                    }
                });
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => {});
            }
        } catch {
            stopCamera();
            setStatus(scanAssets?.pages?.length ? 'preview' : 'idle');
            setFeedback('No se pudo acceder a la cámara. Usa el botón de subir foto.');
        }
    };

    const addPageFromSource = async (source) => {
        const currentPages = scanAssets?.pages || [];
        if (currentPages.length >= MAX_PAGES) {
            setStatus('preview');
            setFeedback(`Máximo ${MAX_PAGES} páginas por envío.`);
            stopCamera();
            return;
        }

        setIsGeneratingPdf(true);
        setStatus('processing');

        try {
            const pageAsset = buildPageAsset(source, currentPages.length + 1);
            await rebuildAssets([...currentPages, pageAsset], scanAssets?.scanId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
            stopCamera();
            setAnalysis(null);
            setSuggestion('');
            setSubmissionId('');
            setFeedback(`Página ${currentPages.length + 1} agregada. Puedes sumar más páginas o enviar el PDF a Profe Matico.`);
            setStatus('preview');
        } catch (error) {
            setStatus('error');
            setFeedback(error.message || 'No se pudo procesar la foto.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const takePhoto = async () => {
        if (!videoRef.current) return;
        await addPageFromSource(videoRef.current);
    };

    const handleCapture = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const img = new Image();
        img.onload = async () => {
            try {
                await addPageFromSource(img);
            } finally {
                URL.revokeObjectURL(img.src);
                event.target.value = '';
            }
        };
        img.onerror = () => {
            setStatus('error');
            setFeedback('La imagen no es válida o está dañada.');
            event.target.value = '';
        };
        img.src = URL.createObjectURL(file);
    };

    const removePage = async (pageId) => {
        const pages = (scanAssets?.pages || []).filter((page) => page.id !== pageId).map((page, index) => ({ ...page, pageNumber: index + 1 }));
        if (!pages.length) {
            setScanAssets(null);
            setStatus('idle');
            setFeedback('');
            return;
        }
        setIsGeneratingPdf(true);
        try {
            await rebuildAssets(pages, scanAssets?.scanId || makeScanId());
            setFeedback('Página eliminada del PDF.');
            setStatus('preview');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const downloadPDF = () => {
        if (!scanAssets?.pdfBase64) return;
        const bytes = atob(scanAssets.pdfBase64);
        const array = Uint8Array.from(bytes, (char) => char.charCodeAt(0));
        const blob = new Blob([array], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = scanAssets.pdfFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const applySubmissionResult = (submission) => {
        const result = submission?.analysis_result || {};
        setAnalysis(result);
        setSuggestion(result.suggestion || '');
        setFeedback(result.feedback || 'Profe Matico terminó la revisión.');

        if (submission.status === 'completed' && result.quiz_ready) {
            setStatus('success');
            return;
        }

        if (submission.status === 'completed') {
            setRetryCount((count) => count + 1);
            setStatus('retry');
            return;
        }

        setStatus('error');
        setFeedback(submission.error || 'No se pudo completar la revisión del cuaderno.');
    };

    const pollSubmission = async (id) => {
        try {
            const response = await fetch(`/api/notebook/submissions/${encodeURIComponent(id)}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudo consultar la entrega.');
            }

            if (!mountedRef.current) return;

            if (data.submission?.status === 'processing') {
                pollRef.current = setTimeout(() => pollSubmission(id), POLL_INTERVAL_MS);
                return;
            }

            clearPolling();
            applySubmissionResult(data.submission);
        } catch (error) {
            if (!mountedRef.current) return;
            clearPolling();
            setStatus('error');
            setFeedback(error.message || 'Se perdió la conexión durante la revisión.');
        }
    };

    const submitScan = async () => {
        if (!scanAssets?.pages?.length) return;

        clearPolling();
        setStatus('waiting');
        setFeedback('Profe Matico está leyendo todas las páginas de tu cuaderno...');

        try {
            const response = await fetch('/api/notebook/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId || 'anonimo',
                    email: userEmail || 'anonimo@matico.ai',
                    subject,
                    session_id: sessionId,
                    topic,
                    reading_content: readingContent?.substring(0, 4000) || '',
                    pdf_base64: scanAssets.pdfBase64,
                    pdf_file_name: scanAssets.pdfFileName,
                    preview_images_base64: scanAssets.pages.map((page) => page.imageBase64),
                    image_mime_type: scanAssets.pages[0]?.imageMimeType || 'image/jpeg',
                    scan_id: scanAssets.scanId,
                    page_count: scanAssets.pages.length
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudo enviar el cuaderno.');
            }

            setSubmissionId(data.submission_id);
            pollSubmission(data.submission_id);
        } catch (error) {
            setStatus('error');
            setFeedback(error.message || 'No se pudo enviar el cuaderno al servidor.');
        }
    };

    const restartFlow = () => {
        clearPolling();
        stopCamera();
        setStatus('idle');
        setFeedback('');
        setSuggestion('');
        setScanAssets(null);
        setAnalysis(null);
        setSubmissionId('');
    };

    const stars = scoreToStars(analysis?.interpretation_score || 0);
    const tier = TIER_UI[analysis?.tier || 'insuficiente'] || TIER_UI.insuficiente;
    const pages = scanAssets?.pages || [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl"><Camera size={28} /></div>
                        <div>
                            <h3 className="text-xl font-bold">Cuaderno con Profe Matico</h3>
                            <p className="text-sm opacity-90 mt-1">PDF automático multipágina y desbloqueo del quiz por comprensión</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {status === 'idle' && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                                Escribe en tu cuaderno con tus palabras, resume las ideas principales y corrige tus errores. Puedes enviar hasta {MAX_PAGES} páginas en un solo PDF.
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
                                El quiz se habilita solo si Profe Matico detecta escritura a mano y al menos {NOTEBOOK_QUIZ_THRESHOLD}% de interpretación del conjunto de páginas.
                            </div>
                            {feedback && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{feedback}</div>}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={openCamera} className="flex-1 bg-[#2B2E4A] text-white px-4 py-4 rounded-xl font-bold hover:bg-[#3d426b] flex items-center justify-center gap-2">
                                    <Video size={20} /> Abrir cámara
                                </button>
                                <label className="flex-1 cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                                    <UploadCloud size={20} /> Subir foto
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
                                </label>
                            </div>
                            {onSkip && <button onClick={onSkip} className="w-full text-sm text-slate-400 hover:text-slate-600 py-2">Saltar por ahora</button>}
                        </div>
                    )}

                    {status === 'processing' && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto mb-4" />
                            <p className="text-orange-600 font-semibold">Procesando página y regenerando PDF...</p>
                        </div>
                    )}

                    {(status === 'preview' || status === 'waiting') && scanAssets && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                                PDF listo con {pages.length} {pages.length === 1 ? 'página' : 'páginas'}. Puedes agregar más hojas o enviarlo a Profe Matico.
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {pages.map((page, index) => (
                                    <div key={page.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <img src={page.previewUrl} alt={`Página ${index + 1}`} className="w-full h-40 object-contain bg-slate-50" />
                                        <div className="p-3 flex items-center justify-between text-xs text-slate-600">
                                            <span>Página {index + 1}</span>
                                            {status === 'preview' && (
                                                <button onClick={() => removePage(page.id)} className="text-red-500 hover:text-red-700 flex items-center gap-1">
                                                    <Trash2 size={14} /> Quitar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
                                <div>📄 {scanAssets.pdfFileName}</div>
                                <div className="text-xs mt-1">
                                    {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
                                    {submissionId ? ` · ${submissionId}` : ''}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button onClick={downloadPDF} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                    <Download size={18} /> Descargar PDF
                                </button>

                                {status === 'preview' && pages.length < MAX_PAGES && (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button onClick={openCamera} className="flex-1 bg-[#2B2E4A] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                            <Camera size={18} /> Agregar otra página
                                        </button>
                                        <label className="flex-1 cursor-pointer bg-slate-100 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                            <UploadCloud size={18} /> Subir otra página
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
                                        </label>
                                    </div>
                                )}

                                {status === 'preview' ? (
                                    <button onClick={submitScan} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                        <Sparkles size={18} /> Enviar a Profe Matico
                                    </button>
                                ) : (
                                    <div className="w-full bg-orange-50 border border-orange-200 text-orange-700 py-4 rounded-xl font-semibold text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-200 border-t-orange-500 mx-auto mb-3" />
                                        {feedback}
                                    </div>
                                )}

                                <button onClick={restartFlow} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-medium hover:bg-slate-200 flex items-center justify-center gap-2">
                                    <RotateCcw size={18} /> Reiniciar envío
                                </button>
                            </div>
                        </div>
                    )}

                    {(status === 'success' || status === 'retry') && analysis && (
                        <div className="space-y-4">
                            <div className={`border-2 rounded-xl p-5 ${tier.box}`}>
                                <div className={`flex items-center gap-2 mb-3 ${tier.text}`}>
                                    {status === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                                    <span className="font-bold text-lg">{status === 'success' ? tier.title : 'Corrige y vuelve a intentarlo'}</span>
                                </div>
                                <p className="text-slate-700">{feedback}</p>
                                {suggestion && <p className="mt-3 text-sm text-slate-600 italic">{suggestion}</p>}
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold">Interpretación lograda</span>
                                    <span className="text-xl font-black text-emerald-600">{analysis.interpretation_score || 0}%</span>
                                </div>
                                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} className={n <= stars ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />)}</div>
                                {analysis.detected_concepts?.length > 0 && <p><strong>Conceptos detectados:</strong> {analysis.detected_concepts.join(', ')}</p>}
                                {analysis.missing_concepts?.length > 0 && <p><strong>Faltó incluir:</strong> {analysis.missing_concepts.join(', ')}</p>}
                                {analysis.ocr_text && <p><strong>OCR:</strong> {analysis.ocr_text}</p>}
                            </div>

                            {status === 'success' ? (
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold text-lg border border-green-200 shadow-sm">
                                        <Star size={20} className="text-yellow-500" /> +{analysis.xp_reward || 0} XP
                                    </div>
                                    <button onClick={() => onComplete?.(analysis.xp_reward || 0, analysis.tier || 'plata')} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-xl font-bold">
                                        Comenzar quiz
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <button onClick={restartFlow} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                        <RotateCcw size={18} /> Hacer nuevo escaneo
                                    </button>
                                    {retryCount >= 2 && onSkip && <button onClick={onSkip} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-medium">Seguir sin quiz</button>}
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3 text-red-700"><AlertTriangle size={24} /><span className="font-bold text-lg">No se pudo completar la revisión</span></div>
                                <p className="text-red-600">{feedback}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={restartFlow} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                    <RotateCcw size={18} /> Intentar de nuevo
                                </button>
                                {onSkip && <button onClick={onSkip} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl">Saltar</button>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {status === 'camera' && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
                    <button
                        onClick={() => { stopCamera(); setStatus(scanAssets?.pages?.length ? 'preview' : 'idle'); }}
                        className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full hover:bg-white/40 z-10"
                    >
                        <X size={24} />
                    </button>

                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                        <div className="w-[85%] h-[75%] border-2 border-amber-400/60 rounded-lg relative">
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-400" />
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400" />
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-400" />
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-400" />
                        </div>
                    </div>

                    <div className="relative w-full max-w-2xl px-4">
                        <div className="w-full max-w-sm mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-slate-200 shadow-inner">
                            <video ref={videoRef} className="w-full h-full bg-black object-cover" playsInline muted />
                        </div>
                    </div>

                    <div className="mt-8">
                        {isGeneratingPdf ? (
                            <div className="text-center text-white">
                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto mb-2" />
                                Procesando página...
                            </div>
                        ) : (
                            <button onClick={takePhoto} className="bg-white h-20 w-20 rounded-full border-4 border-amber-500 flex items-center justify-center shadow-xl">
                                <div className="h-16 w-16 bg-white border border-gray-300 rounded-full" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CuadernoMission;
