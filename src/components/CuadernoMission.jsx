import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, UploadCloud, AlertTriangle, RotateCcw, Award, Star, Sparkles, Video, X, Download, Eye, FileText } from 'lucide-react';

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

// Función mejorada de procesamiento tipo Adobe Scan
const processImageLikeAdobeScan = (canvas, ctx) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Crear array para el nuevo procesamiento
    const output = new Uint8ClampedArray(pixels.length);
    
    // Parámetros ajustables tipo Adobe Scan
    const contrast = 2.2;        // Más contraste
    const brightness = 15;       // Ajuste de brillo
    const threshold = 210;       // Umbral para blanco
    const darkThreshold = 45;    // Umbral para negro puro
    
    for (let i = 0; i < pixels.length; i += 4) {
        // Convertir a gris con pesos mejorados
        const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        
        // Aplicar contraste y brillo
        let adjusted = ((gray - 128) * contrast) + 128 + brightness;
        
        // Aplicar umbral adaptativo tipo scanner
        if (adjusted > threshold) {
            adjusted = 255; // Blanco puro (fondo)
        } else if (adjusted < darkThreshold) {
            adjusted = 0;   // Negro puro (texto)
        } else {
            // Suavizar valores intermedios para mejorar legibilidad
            adjusted = ((adjusted - darkThreshold) / (threshold - darkThreshold)) * 255;
        }
        
        output[i] = adjusted;     // R
        output[i + 1] = adjusted; // G
        output[i + 2] = adjusted; // B
        output[i + 3] = 255;      // A (opaco)
    }
    
    // Aplicar ligero sharpening (opcional)
    const sharpened = applySharpening(output, width, height);
    
    imageData.data.set(sharpened);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
};

// Filtro de sharpening ligero
const applySharpening = (data, width, height) => {
    const output = new Uint8ClampedArray(data);
    const kernel = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let r = 0, g = 0, b = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    const kIdx = (ky + 1) * 3 + (kx + 1);
                    r += data[idx] * kernel[kIdx];
                    g += data[idx + 1] * kernel[kIdx];
                    b += data[idx + 2] * kernel[kIdx];
                }
            }
            
            const idx = (y * width + x) * 4;
            output[idx] = Math.min(255, Math.max(0, r));
            output[idx + 1] = Math.min(255, Math.max(0, g));
            output[idx + 2] = Math.min(255, Math.max(0, b));
        }
    }
    
    return output;
};

const CuadernoMission = ({ sessionId, subject, topic, readingContent, onComplete, onSkip, userEmail, userId }) => {
    const [status, setStatus] = useState('idle'); // idle, preview, processing, uploading, success, retry, error
    const [feedback, setFeedback] = useState('');
    const [tier, setTier] = useState(null);
    const [suggestion, setSuggestion] = useState('');
    const [ocrText, setOcrText] = useState('');
    const [handwritingAnalysis, setHandwritingAnalysis] = useState('');
    const [comprehensionLevel, setComprehensionLevel] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    
    // Nuevos estados para preview y PDF
    const [previewUrl, setPreviewUrl] = useState(null);
    const [pdfData, setPdfData] = useState(null);
    const [scanAssets, setScanAssets] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const makeScanId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const buildScanAssets = async (source) => {
        const scanId = makeScanId();
        const canvas = document.createElement('canvas');
        let width = source.width || source.videoWidth || 0;
        let height = source.height || source.videoHeight || 0;
        const maxSize = 2400; // Aumentado para mejor calidad tipo Adobe Scan

        if (!width || !height) {
            throw new Error('No se pudo leer el documento - dimensiones inválidas');
        }

        // Mantener proporción pero limitar tamaño máximo
        const scale = Math.min(1, maxSize / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('No se pudo crear el contexto del canvas');
        }
        
        // Dibujar imagen original
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        
        // Aplicar procesamiento tipo Adobe Scan
        processImageLikeAdobeScan(canvas, ctx);
        
        // Generar URLs
        const processedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        // Generar PDF
        let pdfBase64, pdfFileName;
        try {
            const { jsPDF } = await import('jspdf');
            if (!jsPDF) {
                throw new Error('No se pudo cargar la librería jsPDF');
            }
            
            const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
            
            // Crear PDF con dimensiones en puntos (1 pulgada = 72 puntos)
            const pdfWidth = canvas.width > canvas.height ? 792 : 612;  // Letter size width/height in points
            const pdfHeight = canvas.width > canvas.height ? 612 : 792;
            
            const pdf = new jsPDF({
                orientation,
                unit: 'pt',
                format: [pdfWidth, pdfHeight],
                compress: true,
                putOnlyUsedFonts: true,
                floatPrecision: 16
            });

            // Calcular escala para que la imagen quepa en la página
            const scaleX = pdfWidth / canvas.width;
            const scaleY = pdfHeight / canvas.height;
            const scale = Math.min(scaleX, scaleY);
            
            const imgWidth = canvas.width * scale;
            const imgHeight = canvas.height * scale;
            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            pdf.addImage(processedDataUrl, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'MEDIUM');
            
            pdfBase64 = pdf.output('datauristring').split(',')[1];
            pdfFileName = `matico_scan_${subject || 'materia'}_S${sessionId || 0}_${scanId}.pdf`;
            
        } catch (pdfError) {
            console.error('Error generando PDF:', pdfError);
            throw new Error(`Error al generar PDF: ${pdfError.message}`);
        }

        return {
            scanId,
            imageBase64: processedDataUrl.split(',')[1],
            imageMimeType: 'image/jpeg',
            previewUrl: processedDataUrl,
            pdfBase64,
            pdfFileName,
            width: canvas.width,
            height: canvas.height
        };
    };

    // Guardar PDF en el servidor (VPS)
    const savePDFToServer = async (assets) => {
        if (!assets || !assets.pdfBase64) {
            console.error('[CUADERNO] No hay datos de PDF para guardar en servidor');
            return false;
        }
        
        try {
            const response = await fetch('/webhook/MATICO', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_notebook_pdf',
                    email: userEmail || 'anonimo@matico.ai',
                    user_id: userId || 'anonimo',
                    session_id: sessionId,
                    subject: subject,
                    topic: topic,
                    pdf_base64: assets.pdfBase64,
                    file_name: assets.pdfFileName,
                    scan_id: assets.scanId,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                console.warn('[CUADERNO] No se pudo guardar PDF en servidor:', response.status);
                return false;
            }

            const data = await response.json();
            if (data.success) {
                console.log('[CUADERNO] PDF guardado en servidor:', data.file_path);
                return true;
            } else {
                console.warn('[CUADERNO] Error del servidor al guardar PDF:', data.error);
                return false;
            }
        } catch (error) {
            console.error('[CUADERNO] Error de red al guardar PDF:', error);
            return false;
        }
    };

    // Descargar PDF localmente
    const downloadPDF = () => {
        if (!scanAssets || !scanAssets.pdfBase64) {
            setFeedback('No hay PDF disponible para descargar');
            return;
        }
        
        try {
            const byteCharacters = atob(scanAssets.pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = scanAssets.pdfFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setFeedback('¡PDF descargado exitosamente! 📄');
        } catch (error) {
            console.error('Error descargando PDF:', error);
            setFeedback('Error al descargar el PDF, intenta de nuevo');
        }
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
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
                });
            } catch (e) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                });
            }

            streamRef.current = stream;
            setIsCameraOpen(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.log("Auto-play prevented:", e));
                }
            }, 300);
        } catch (err) {
            console.error("Camera access error:", err);
            setFeedback('No se pudo acceder a la cámara. Usa el botón de subir foto.');
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

        setIsGeneratingPdf(true);
        setStatus('processing');
        
        try {
            const assets = await buildScanAssets(videoRef.current);
            stopCamera();
            setScanAssets(assets);
            setPreviewUrl(assets.previewUrl);
            
            // Intentar guardar en servidor (sin bloquear la UI)
            const saved = await savePDFToServer(assets);
            if (saved) {
                setFeedback('PDF guardado en el servidor ✅');
            } else {
                setFeedback('PDF listo (guardado localmente)');
            }
            
            setStatus('preview');
        } catch (err) {
            console.error('[CUADERNO] Error escaneando desde camara:', err);
            setStatus('error');
            setFeedback(`Error al escanear: ${err.message || 'Intenta de nuevo con el cuaderno bien centrado y con más luz.'}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsGeneratingPdf(true);
        setStatus('processing');

        const img = new Image();
        img.onload = async () => {
            try {
                const assets = await buildScanAssets(img);
                setScanAssets(assets);
                setPreviewUrl(assets.previewUrl);
                
                // Intentar guardar en servidor (sin bloquear la UI)
                const saved = await savePDFToServer(assets);
                if (saved) {
                    setFeedback('PDF guardado en el servidor ✅');
                } else {
                    setFeedback('PDF listo (guardado localmente)');
                }
                
                setStatus('preview');
            } catch (err) {
                console.error('[CUADERNO] Error escaneando archivo:', err);
                setStatus('error');
                setFeedback(`Error al procesar la imagen: ${err.message || 'Intenta con otra foto del cuaderno.'}`);
            } finally {
                setIsGeneratingPdf(false);
                URL.revokeObjectURL(img.src);
            }
        };
        img.onerror = () => {
            setIsGeneratingPdf(false);
            setStatus('error');
            setFeedback('El archivo de imagen no es válido o está dañado.');
        };
        img.src = URL.createObjectURL(file);
    };

    const uploadScan = async () => {
        if (!scanAssets) {
            setFeedback('No hay documento para subir');
            return;
        }
        
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
                    image: scanAssets.imageBase64,
                    imageMimeType: scanAssets.imageMimeType,
                    pdf: scanAssets.pdfBase64,
                    pdfFileName: scanAssets.pdfFileName,
                    scanId: scanAssets.scanId,
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
        setPreviewUrl(null);
        setScanAssets(null);
        setPdfData(null);
        startCamera();
    };
    
    const handleRetake = () => {
        setStatus('idle');
        setPreviewUrl(null);
        setScanAssets(null);
        startCamera();
    };

    const tierConfig = tier ? TIER_CONFIG[tier] : null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Camera size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">📝 Misión: El Cuaderno de Matico</h3>
                            <p className="text-sm opacity-90 mt-1">Escanear como Adobe Scan + IA</p>
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
                                <p className="font-semibold mb-1 flex items-center gap-2">
                                    <FileText size={16} />
                                    Escaneo inteligente tipo Adobe Scan
                                </p>
                                <p>
                                    Matico limpiará tu hoja automáticamente: fondo blanco puro, texto nítido,
                                    y generará un PDF profesional que puedes descargar y guardar.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-600">
                                <p className="font-semibold text-slate-700 mb-2">🎯 Rúbrica de Matico:</p>
                                <ul className="space-y-1">
                                    <li>🏅 <strong>Oro (+50 XP):</strong> Conceptos clave con palabras propias + esquemas</li>
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
                    {isCameraOpen && (status === 'idle' || status === 'processing') && (
                        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
                            <button onClick={stopCamera} className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full hover:bg-white/40 z-10">
                                <X size={24} />
                            </button>
                            
                            {/* Marco guía tipo Adobe Scan */}
                            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                                <div className="w-[85%] h-[75%] border-2 border-amber-400/60 rounded-lg relative">
                                    {/* Esquinas */}
                                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-400"></div>
                                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400"></div>
                                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-400"></div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-400"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <p className="text-white/80 text-sm bg-black/50 px-4 py-2 rounded-full">
                                            Alinea el cuaderno dentro del marco
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative w-full max-w-2xl px-4">
                                <video
                                    ref={videoRef}
                                    className="w-full rounded-2xl bg-black shadow-[0_0_30px_rgba(245,158,11,0.5)] object-cover"
                                    playsInline
                                    muted
                                ></video>
                            </div>
                            
                            <div className="mt-8 flex gap-6 items-center">
                                {isGeneratingPdf ? (
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto mb-2"></div>
                                        <p className="text-white text-sm">Procesando escaneo...</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={takePhoto}
                                        className="bg-white text-black h-20 w-20 rounded-full flex mx-auto border-4 border-amber-500 items-center justify-center hover:bg-amber-100 hover:scale-110 transition-transform shadow-xl"
                                    >
                                        <div className="h-16 w-16 bg-white border border-gray-300 rounded-full shadow-inner"></div>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── PROCESSING: Animación de procesamiento ─── */}
                    {status === 'processing' && !isCameraOpen && (
                        <div className="text-center py-8">
                            <div className="relative inline-block">
                                <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
                                <span className="absolute inset-0 flex items-center justify-center text-2xl">🐶</span>
                            </div>
                            <p className="mt-4 text-orange-600 font-semibold animate-pulse">
                                Matico está optimizando tu escaneo tipo Adobe Scan...
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                Limpiando fondo, mejorando contraste y generando PDF
                            </p>
                        </div>
                    )}

                    {/* ─── PREVIEW: Vista previa del escaneo ─── */}
                    {status === 'preview' && scanAssets && (
                        <div>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="text-green-600" size={20} />
                                    <span className="font-bold text-green-700">¡Escaneo completo!</span>
                                </div>
                                <p className="text-sm text-green-800">
                                    Tu documento ha sido procesado con calidad tipo escáner profesional.
                                </p>
                            </div>
                            
                            {/* Preview de la imagen */}
                            <div className="mb-4 rounded-xl overflow-hidden border-2 border-slate-200 shadow-lg">
                                <img 
                                    src={scanAssets.previewUrl} 
                                    alt="Preview del escaneo" 
                                    className="w-full h-auto max-h-[300px] object-contain bg-white"
                                />
                            </div>
                            
                            {/* Info del archivo */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-600">📄 {scanAssets.pdfFileName}</span>
                                </div>
                                <div className="flex gap-4 text-slate-500 text-xs">
                                    <span>📐 {scanAssets.width}×{scanAssets.height}px</span>
                                    <span>📦 PDF Generado</span>
                                </div>
                            </div>
                            
                            {/* Botones de acción */}
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={downloadPDF}
                                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2 shadow-md"
                                >
                                    <Download size={18} />
                                    Descargar PDF
                                </button>
                                
                                <button
                                    onClick={uploadScan}
                                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-2 shadow-md"
                                >
                                    <Sparkles size={18} />
                                    Enviar a Matico para revisión
                                </button>
                                
                                <button
                                    onClick={handleRetake}
                                    className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-medium hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={18} />
                                    Tomar otra foto
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
                                Matico está analizando tus notas con IA...
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                Revisando escritura, comprensión y calidad del resumen
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
                            
                            {/* Botón descargar PDF en éxito también */}
                            {scanAssets && (
                                <button
                                    onClick={downloadPDF}
                                    className="w-full mt-4 bg-blue-50 text-blue-600 py-2 rounded-xl font-medium hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-200"
                                >
                                    <Download size={16} />
                                    Descargar mi PDF escaneado
                                </button>
                            )}

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

                    {/* ─── ERROR: Error de red o procesamiento ─── */}
                    {status === 'error' && (
                        <div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="text-red-500" size={24} />
                                    <span className="font-bold text-lg text-red-700">Error</span>
                                </div>
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

                            {/* Fallback de subida */}
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
