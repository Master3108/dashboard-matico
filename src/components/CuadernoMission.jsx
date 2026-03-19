import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, UploadCloud, AlertTriangle, RotateCcw, Award, Star, Sparkles, Video, X } from 'lucide-react';

const TIER_CONFIG = {
    oro: {
        xp: 50,
        label: '🏅 ¡Excelente! Nivel ORO',
        gradient: 'from-yellow-400 to-amber-500',
        bgClass: 'bg-gradient-to-r from-amber-50 to-yellow-50',
        borderClass: 'border-amber-400',
        textClass: 'text-amber-700',
        badge: '🧠 Cerebro Activo'
    },
    plata: {
        xp: 30,
        label: '🥈 ¡Buen trabajo! Nivel PLATA',
        gradient: 'from-slate-300 to-gray-400',
        bgClass: 'bg-gradient-to-r from-slate-50 to-gray-50',
        borderClass: 'border-slate-400',
        textClass: 'text-slate-700',
        badge: '📝 Buen Resumen'
    },
    insuficiente: {
        xp: 0,
        label: '🔄 ¡Inténtalo de nuevo!',
        gradient: 'from-red-400 to-orange-400',
        bgClass: 'bg-gradient-to-r from-red-50 to-orange-50',
        borderClass: 'border-red-300',
        textClass: 'text-red-600',
        badge: null
    },
    pendiente: {
        xp: 0,
        label: '⏳ ¡Misión Guardada!',
        gradient: 'from-blue-400 to-indigo-500',
        bgClass: 'bg-gradient-to-r from-blue-50 to-indigo-50',
        borderClass: 'border-blue-300',
        textClass: 'text-blue-700',
        badge: '🔍 Revisión en curso'
    }
};

const CuadernoMission = ({ sessionId, subject, topic, readingContent, onComplete, onSkip }) => {
    const [status, setStatus] = useState('idle'); // idle, uploading, success, retry, error
    const [feedback, setFeedback] = useState('');
    const [tier, setTier] = useState(null); // 'oro', 'plata', 'insuficiente'
    const [suggestion, setSuggestion] = useState('');
    const [ocrText, setOcrText] = useState('');
    const [handwritingAnalysis, setHandwritingAnalysis] = useState('');
    const [comprehensionLevel, setComprehensionLevel] = useState(0);
    const [retryCount, setRetryCount] = useState(0);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const makeScanId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const buildScanAssets = async (source) => {
        const scanId = makeScanId();
        const canvas = document.createElement('canvas');
        let width = source.width || source.videoWidth || 0;
        let height = source.height || source.videoHeight || 0;
        const maxSize = 1800;

        if (!width || !height) {
            throw new Error('No se pudo leer el documento');
        }

        if (width > height && width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
        } else if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.filter = 'grayscale(1) contrast(1.45) brightness(1.04)';
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Scanner-style cleanup for notebook pages: preserve strokes, clean background.
        for (let i = 0; i < pixels.length; i += 4) {
            const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            const contrasted = Math.round((gray - 122) * 1.38 + 122);
            const normalized = gray > 230 ? 255 : gray < 70 ? 0 : Math.max(0, Math.min(255, contrasted));
            pixels[i] = normalized;
            pixels[i + 1] = normalized;
            pixels[i + 2] = normalized;
        }

        ctx.putImageData(imageData, 0, 0);

        const scanDataUrl = canvas.toDataURL('image/jpeg', 0.96);
        const pdfDataUrl = canvas.toDataURL('image/png');
        const imageBase64 = scanDataUrl.split(',')[1];

        const { jsPDF } = await import('jspdf');
        const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'px',
            format: [canvas.width, canvas.height],
            compress: true
        });

        pdf.addImage(pdfDataUrl, 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');

        return {
            scanId,
            imageBase64,
            imageMimeType: 'image/jpeg',
            pdfBase64: pdf.output('datauristring').split(',')[1],
            pdfFileName: `cuaderno_scan_${subject || 'materia'}_S${sessionId || 0}_${scanId}.pdf`
        };
    };

    // Al montar, intentamos iniciar la cámara automáticamente si es posible
    useEffect(() => {
        if (status === 'idle') {
            startCamera();
        }
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        try {
            // Intenta primero con la cámara trasera (para móviles), de forma preferente
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            } catch (e) {
                // Fallback para PC o dispositivos sin cámara trasera
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
            }

            streamRef.current = stream;
            setIsCameraOpen(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.log("Auto-play prevented"));
                }
            }, 300);
        } catch (err) {
            console.error("Camera access error:", err);
            // No bloqueamos con error fatal de inmediato, permitimos que el usuario use el botón manual si falla
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const takePhoto = async () => {
        if (!videoRef.current) return;

        try {
            const scanAssets = await buildScanAssets(videoRef.current);
            stopCamera();
            await uploadScan(scanAssets);
        } catch (err) {
            console.error('[CUADERNO] Error escaneando desde camara:', err);
            setStatus('error');
            setFeedback('No pudimos escanear la hoja. Intenta de nuevo con el cuaderno bien centrado y con más luz.');
        }
    };

    const handleCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const img = new Image();
        img.onload = async () => {
            try {
                const scanAssets = await buildScanAssets(img);
                await uploadScan(scanAssets);
            } catch (err) {
                console.error('[CUADERNO] Error escaneando archivo:', err);
                setStatus('error');
                setFeedback('No pudimos convertir esa imagen en un documento escaneado. Intenta con otra foto del cuaderno.');
            } finally {
                URL.revokeObjectURL(img.src);
            }
        };
        img.onerror = () => {
            setStatus('error');
            setFeedback('El archivo de imagen no es válido o está dañado.');
        };
        img.src = URL.createObjectURL(file);
    };

    const uploadScan = async ({ scanId, imageBase64, imageMimeType, pdfBase64, pdfFileName }) => {
        setStatus('uploading');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

            const response = await fetch('/webhook/MATICO', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    action: 'verify_handwriting',
                    image: imageBase64,
                    imageMimeType,
                    pdf: pdfBase64,
                    pdfFileName,
                    scanId,
                    sessionId,
                    subject,
                    topic,
                    readingContent: readingContent?.substring(0, 3000) || ''
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const rawText = await response.text();
                throw new Error(`HTTP ${response.status} - Agente ocupado: ${rawText.substring(0, 40)}...`);
            }

            const data = await response.json();

            if (data.success) {
                if (data.background) {
                    setTier('pendiente');
                    setFeedback(data.message || '¡Documento escaneado guardado! Matico lo analizará mientras sigues con el quiz.');
                    setStatus('success');
                    if (onComplete) onComplete(0, 'pendiente');
                    return;
                }
                const resultTier = data.tier || 'plata';
                setTier(resultTier);
                setFeedback(data.feedback || '¡Buen trabajo!');
                setSuggestion(data.suggestion || '');
                setOcrText(data.transcripcion_ocr || '');
                setHandwritingAnalysis(data.analisis_escritura || '');
                setComprehensionLevel(data.nivel_comprension || 0);

                if (resultTier === 'insuficiente') {
                    setStatus('retry');
                    setRetryCount(prev => prev + 1);
                } else {
                    setStatus('success');
                    const xpReward = TIER_CONFIG[resultTier]?.xp || 30;
                    if (onComplete) onComplete(xpReward, resultTier);
                }
            } else {
                setTier('insuficiente');
                setFeedback(data.feedback || data.error || 'Matico no pudo leer bien la imagen. ¡Intenta con más luz!');
                setSuggestion(data.suggestion || '');
                setStatus('retry');
                setRetryCount(prev => prev + 1);
            }
        } catch (err) {
            console.error('[CUADERNO] Error:', err);
            setStatus('error');
            if (err.name === 'AbortError') {
                setFeedback('Matico se demoró mucho analizando tu foto 🐶. Intenta con una foto más pequeña o con mejor luz.');
            } else if (err.message?.includes('HTTP')) {
                setFeedback(`El servidor respondió con error: ${err.message}. Intenta de nuevo en unos segundos.`);
            } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                setFeedback('No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo.');
            } else {
                setFeedback(`Error inesperado: ${err.message || 'desconocido'}. Intenta de nuevo.`);
            }
        }
    };

    const handleRetry = () => {
        setStatus('idle');
        setFeedback('');
        setTier(null);
        setSuggestion('');
        setOcrText('');
        setHandwritingAnalysis('');
        setComprehensionLevel(0);
    };

    const tierConfig = tier ? TIER_CONFIG[tier] : null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Camera size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">📝 Misión: El Cuaderno de Matico</h3>
                            <p className="text-sm opacity-90 mt-1">Activa tu memoria de largo plazo</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* ─── IDLE: Instrucción + Upload ─── */}
                    {status === 'idle' && (
                        <div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                                <p className="text-amber-900 text-sm leading-relaxed">
                                    <strong>¡Guau! 🐶</strong> Has terminado la lectura, pero no dejes que las ideas se escapen.
                                    Para activar tu <strong>"memoria de largo plazo"</strong>, toma tu cuaderno y escribe
                                    solo las <strong>3 ideas que más te importaron</strong> con tus propias palabras.
                                    ¡Puedes usar dibujos, flechas o esquemas! No copies todo, <strong>¡hazlo tuyo!</strong>
                                </p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-sm text-slate-700">
                                <p className="font-semibold mb-1">Escaneo inteligente tipo PDF</p>
                                <p>
                                    Matico limpiará tu hoja como si fuera un escáner: fondo blanco, tinta más oscura
                                    y documento en PDF para guardar. Después la IA revisará esa versión optimizada
                                    para decirte si el ejercicio está bien o mal.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-600">
                                <p className="font-semibold text-slate-700 mb-2">🎯 Rúbrica de Matico:</p>
                                <ul className="space-y-1">
                                    <li>🏅 <strong>Oro (+50 XP):</strong> Conceptos clave con palabras propias + esquemas o flechas</li>
                                    <li>🥈 <strong>Plata (+30 XP):</strong> Conceptos clave pero parecido al texto original</li>
                                    <li>🔄 <strong>Reintentar:</strong> Copia literal o contenido no relacionado</li>
                                </ul>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                <button
                                    onClick={startCamera}
                                    className="flex-1 bg-[#2B2E4A] text-white px-4 py-4 rounded-xl font-bold hover:bg-[#3d426b] transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                                >
                                    <Video size={20} />
                                    Cámara en Vivo
                                </button>

                                <label className="flex-1 cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-4 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transform">
                                    <Camera size={20} />
                                    Escanear Hoja
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={handleCapture}
                                    />
                                </label>
                            </div>

                            {onSkip && (
                                <button
                                    onClick={onSkip}
                                    className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
                                >
                                    Saltar por ahora (sin XP)
                                </button>
                            )}
                        </div>
                    )}

                    {/* ─── WEBCAM VIEW ─── */}
                    {status === 'idle' && isCameraOpen && (
                        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
                            <button onClick={stopCamera} className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full hover:bg-white/40">
                                <X size={24} />
                            </button>
                            <div className="relative w-full max-w-2xl px-4">
                                {/* Matico Overlay instruction */}
                                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-bold z-10 flex items-center gap-2">
                                    <Camera size={16} /> Enmarca tu cuaderno para generar un escaneo limpio en PDF
                                </div>
                                <video
                                    ref={videoRef}
                                    className="w-full rounded-2xl bg-black border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)] object-cover"
                                    playsInline
                                    muted
                                ></video>
                            </div>
                            <div className="mt-8 flex gap-6">
                                <button
                                    onClick={takePhoto}
                                    className="bg-white text-black h-20 w-20 rounded-full flex mx-auto border-4 border-amber-500 items-center justify-center hover:bg-amber-100 hover:scale-110 transition-transform shadow-xl"
                                >
                                    <div className="h-16 w-16 bg-white border border-gray-300 rounded-full shadow-inner"></div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── UPLOADING: Animación de análisis ─── */}
                    {status === 'uploading' && (
                        <div className="text-center py-8">
                            <div className="relative inline-block">
                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
                                <span className="absolute inset-0 flex items-center justify-center text-2xl">🐶</span>
                            </div>
                            <p className="mt-4 text-orange-600 font-semibold animate-pulse">
                                Matico está escaneando y analizando tus notas...
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                Generando PDF, limpiando la hoja y verificando escritura a mano
                            </p>
                        </div>
                    )}

                    {/* ─── SUCCESS: Resultado positivo (Oro o Plata) ─── */}
                    {status === 'success' && tierConfig && (
                        <div>
                            <div className={`${tierConfig.bgClass} border-2 ${tierConfig.borderClass} rounded-xl p-5`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle className={tierConfig.textClass} size={24} />
                                    <span className={`font-bold text-lg ${tierConfig.textClass}`}>
                                        {tierConfig.label}
                                    </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">"{feedback}"</p>
                                {suggestion && (
                                    <p className="mt-2 text-sm text-slate-500 italic">💡 {suggestion}</p>
                                )}

                                {ocrText && (
                                    <div className="mt-4 bg-white/60 p-3 rounded-lg border border-slate-200">
                                        <p className="text-xs uppercase font-bold text-slate-400 mb-1">Matico leyó:</p>
                                        <p className="text-sm text-slate-700 italic font-mono">"{ocrText}"</p>
                                    </div>
                                )}

                                {handwritingAnalysis && (
                                    <div className="mt-3 bg-white/60 p-3 rounded-lg border border-slate-200">
                                        <p className="text-xs uppercase font-bold text-slate-400 mb-1">Análisis Caligráfico:</p>
                                        <p className="text-sm text-slate-600">{handwritingAnalysis}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold text-lg border border-green-200 shadow-sm">
                                    <Star size={20} className="text-yellow-500" />
                                    {tier === 'pendiente' ? '¡XP en camino! ⏳' : `+${tierConfig.xp} XP`}
                                    {tierConfig.badge && <span className="text-sm ml-1 opacity-80">| {tierConfig.badge}</span>}
                                </div>
                                {comprehensionLevel > 0 && (
                                    <div className="flex bg-slate-100 px-3 py-2 rounded-full border border-slate-200 shadow-sm" title="Nivel de Comprensión">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star key={star} size={16} className={star <= comprehensionLevel ? "text-amber-500 fill-amber-500" : "text-slate-300"} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={onSkip}
                                className="w-full mt-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-xl font-bold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md"
                            >
                                ¡Continuar al Quiz! 🚀
                            </button>
                        </div>
                    )}

                    {/* ─── RETRY: Resultado insuficiente ─── */}
                    {status === 'retry' && (
                        <div>
                            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="text-orange-500" size={24} />
                                    <span className="font-bold text-lg text-orange-700">
                                        {TIER_CONFIG.insuficiente.label}
                                    </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">"{feedback}"</p>
                                {suggestion && (
                                    <p className="mt-2 text-sm text-indigo-600 font-medium">🤔 {suggestion}</p>
                                )}
                                {ocrText && (
                                    <div className="mt-4 bg-white/60 p-3 rounded-lg border border-orange-200">
                                        <p className="text-xs uppercase font-bold text-orange-400 mb-1">Matico leyó:</p>
                                        <p className="text-sm text-slate-700 italic font-mono opacity-80">"{ocrText}"</p>
                                    </div>
                                )}
                                {handwritingAnalysis && (
                                    <div className="mt-3 bg-white/60 p-3 rounded-lg border border-orange-200">
                                        <p className="text-xs uppercase font-bold text-orange-400 mb-1">Análisis de la Letra:</p>
                                        <p className="text-sm text-slate-600 opacity-90">{handwritingAnalysis}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={handleRetry}
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={18} /> Intentar de nuevo
                                </button>
                                {retryCount >= 2 && onSkip && (
                                    <button
                                        onClick={onSkip}
                                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-medium hover:bg-slate-200 transition-all"
                                    >
                                        Seguir sin XP
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── ERROR: Error de red ─── */}
                    {status === 'error' && (
                        <div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <p className="text-red-600">{feedback}</p>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleRetry}
                                    className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={18} /> Reintentar
                                </button>
                                {onSkip && (
                                    <button onClick={onSkip} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl">
                                        Saltar
                                    </button>
                                )}
                            </div>

                            {/* Mantener fallback de subida por seguridad pero menos prominente */}
                            <div className="mt-4 pt-4 border-t border-red-100">
                                <label className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-orange-500 cursor-pointer transition-colors">
                                    <UploadCloud size={16} /> O subir foto manualmente
                                    <input type="file" accept="image/*" className="hidden" onChange={handleCapture} />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CuadernoMission;
