import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clipboard, Monitor, Smartphone, UploadCloud, X } from 'lucide-react';
import {
    captureNowNativeSession,
    clearNativeQueuedCaptures,
    getNativeCaptureSessionState,
    isNativeScreenCaptureAvailable,
    listNativeQueuedCaptures,
    startNativeCaptureSession,
    stopNativeCaptureSession
} from '../mobile/screenCaptureBridge';

export const DEFAULT_MAX_EVIDENCE = 10;

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

const buildImageAssetFromSource = (source, pageNumber, sourceType = 'upload') => {
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
        id: `evidence_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        previewUrl: dataUrl,
        imageBase64: dataUrl.split(',')[1],
        imageMimeType: 'image/jpeg',
        width,
        height,
        pageNumber,
        sourceType
    };
};

const normalizeEvidenceAsset = (item = {}, index = 0) => ({
    id: item.id || `evidence_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${index}`,
    previewUrl: item.previewUrl || '',
    imageBase64: String(item.imageBase64 || item.image_base64 || '').trim(),
    imageMimeType: String(item.imageMimeType || item.image_mime_type || 'image/jpeg').trim() || 'image/jpeg',
    pageNumber: Number(item.pageNumber || item.page_number || (index + 1)) || (index + 1),
    sourceType: item.sourceType || item.source_type || 'upload'
});

const reindexEvidence = (items = []) => items.map((item, index) => ({ ...item, pageNumber: index + 1 }));

const EvidenceIntake = ({
    maxEvidence = DEFAULT_MAX_EVIDENCE,
    value = [],
    onChange,
    onError,
    showNativeCapture = true,
    showPasteHint = true
}) => {
    // Detecta si está corriendo como app nativa Android (Capacitor)
    const isNativePlatform = Boolean(window?.Capacitor?.isNativePlatform?.());

    const [items, setItems] = useState(Array.isArray(value) ? value.map(normalizeEvidenceAsset) : []);
    const [errorMsg, setErrorMsg] = useState('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [nativeCaptureSupported, setNativeCaptureSupported] = useState(false);
    const [nativeSessionActive, setNativeSessionActive] = useState(false);
    const [nativeQueueCount, setNativeQueueCount] = useState(0);

    const streamRef = useRef(null);
    const videoRef = useRef(null);

    const publish = (nextItems) => {
        const normalized = reindexEvidence(nextItems).slice(0, maxEvidence);
        setItems(normalized);
        onChange?.(normalized);
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const handleError = (message = '') => {
        const safe = String(message || '').trim();
        setErrorMsg(safe);
        onError?.(safe);
    };

    const refreshNativeState = async () => {
        if (!showNativeCapture) return;
        try {
            const state = await getNativeCaptureSessionState();
            setNativeSessionActive(Boolean(state?.active));
            setNativeQueueCount(Number(state?.queueCount || 0) || 0);
        } catch {
            setNativeSessionActive(false);
            setNativeQueueCount(0);
        }
    };

    useEffect(() => () => stopCamera(), []);

    useEffect(() => {
        setNativeCaptureSupported(isNativeScreenCaptureAvailable());
        refreshNativeState();
    }, []);

    useEffect(() => {
        if (!nativeSessionActive) return undefined;
        const interval = setInterval(() => {
            refreshNativeState();
        }, 2500);
        return () => clearInterval(interval);
    }, [nativeSessionActive]);

    useEffect(() => {
        if (!Array.isArray(value)) return;
        const normalized = value.map(normalizeEvidenceAsset);
        setItems(normalized);
    }, [value]);

    const addAsset = (asset) => {
        const current = Array.isArray(items) ? items : [];
        if (current.length >= maxEvidence) {
            handleError(`Maximo ${maxEvidence} evidencias por intento.`);
            return;
        }
        setErrorMsg('');
        publish([...current, normalizeEvidenceAsset(asset, current.length)]);
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
            handleError('No se pudo acceder a la camara.');
        }
    };

    const captureFromCamera = () => {
        if (!videoRef.current) return;
        try {
            addAsset(buildImageAssetFromSource(videoRef.current, items.length + 1, 'camera'));
        } catch (error) {
            handleError(error.message || 'No se pudo capturar la imagen');
        }
    };

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        files.forEach((file) => {
            const isImage = file.type.startsWith('image/');
            if (!isImage) {
                handleError('Por ahora sube imagen (foto/screenshot).');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        addAsset(buildImageAssetFromSource(img, items.length + 1, 'upload'));
                    } catch (error) {
                        handleError(error.message || 'No se pudo procesar la imagen');
                    }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    };

    const handlePaste = (event) => {
        const clipboardItems = event.clipboardData?.items || [];
        for (let i = 0; i < clipboardItems.length; i += 1) {
            const item = clipboardItems[i];
            if (!item.type.includes('image')) continue;
            const blob = item.getAsFile();
            if (!blob) continue;

            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        addAsset(buildImageAssetFromSource(img, items.length + 1, 'paste'));
                    } catch (error) {
                        handleError(error.message || 'No se pudo procesar el screenshot pegado');
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
            handleError('Captura de pantalla no disponible en este dispositivo/navegador.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = stream.getVideoTracks()[0];
            const video = document.createElement('video');
            video.srcObject = new MediaStream([track]);
            await video.play();
            addAsset(buildImageAssetFromSource(video, items.length + 1, 'screen'));
            track.stop();
        } catch {
            handleError('No se pudo capturar pantalla.');
        }
    };

    const captureFromNativeApp = async () => {
        try {
            if (!nativeSessionActive) {
                await startNativeCaptureSession();
                await refreshNativeState();
                setErrorMsg('Permiso activado. Ahora navega por tu celular y usa la burbuja flotante para capturar.');
                return;
            }
            await captureNowNativeSession();
            await refreshNativeState();
            setErrorMsg('Captura enviada a cola. Pulsa "Importar cola" al volver a Matico.');
        } catch (error) {
            if (error?.message === 'native_not_available') {
                handleError('Captura de pantalla celular requiere app movil nativa. En web movil usa "Subir archivo".');
                return;
            }
            if (String(error?.message || '').toLowerCase().includes('session_not_active')) {
                handleError('Primero inicia la sesion de captura celular.');
                return;
            }
            if (String(error?.message || '').toLowerCase().includes('overlay_permission_required')) {
                handleError('Debes activar "mostrar sobre otras apps" para ver la burbuja flotante.');
                return;
            }
            handleError('No se pudo iniciar la sesion de captura en app movil.');
        }
    };

    const startNativeSession = async () => {
        try {
            await startNativeCaptureSession();
            await refreshNativeState();
            setErrorMsg('Permiso activado. En Android selecciona "Pantalla completa" y luego navega con la burbuja azul.');
        } catch (error) {
            handleError(error?.message || 'No se pudo iniciar el modo captura celular.');
        }
    };

    const stopNativeSession = async () => {
        try {
            await stopNativeCaptureSession();
            await refreshNativeState();
        } catch (error) {
            handleError(error?.message || 'No se pudo detener el modo captura.');
        }
    };

    const nativeCaptureNow = async () => {
        try {
            await captureNowNativeSession();
            await refreshNativeState();
        } catch (error) {
            handleError(error?.message || 'No se pudo capturar en la sesion nativa.');
        }
    };

    const importNativeQueue = async () => {
        try {
            const queued = await listNativeQueuedCaptures();
            const rows = Array.isArray(queued?.items) ? queued.items : [];
            if (!rows.length) {
                handleError('No hay capturas en cola para importar.');
                return;
            }
            for (const row of rows) {
                if ((items.length + 1) > maxEvidence) break;
                const base64 = String(row?.imageBase64 || row?.image_base64 || '').trim();
                const mimeType = String(row?.imageMimeType || row?.image_mime_type || 'image/jpeg').trim() || 'image/jpeg';
                if (!base64) continue;
                addAsset({
                    previewUrl: `data:${mimeType};base64,${base64}`,
                    imageBase64: base64,
                    imageMimeType: mimeType,
                    sourceType: 'native_queue'
                });
            }
            await clearNativeQueuedCaptures();
            await refreshNativeState();
            setErrorMsg('');
        } catch (error) {
            handleError(error?.message || 'No se pudo importar la cola de capturas.');
        }
    };

    const removeItem = (id) => {
        publish(items.filter((item) => item.id !== id));
    };

    const moveItem = (id, direction = 'up') => {
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const cloned = [...items];
        const [item] = cloned.splice(index, 1);
        cloned.splice(targetIndex, 0, item);
        publish(cloned);
    };

    return (
        <div className="space-y-4" onPaste={handlePaste}>
            <div className="grid md:grid-cols-5 gap-3">
                <button type="button" onClick={openCamera} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Tomar foto
                </button>
                <label className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2 cursor-pointer">
                    <UploadCloud className="w-4 h-4" /> Subir archivo
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </label>
                {/* Solo en web/desktop: en Android nativo este dialogo es confuso y no funciona bien */}
                {!isNativePlatform && (
                    <button type="button" onClick={captureScreen} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 text-sm font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-2">
                        <Monitor className="w-4 h-4" /> Capturar pantalla
                    </button>
                )}
                <button
                    type="button"
                    onClick={captureFromNativeApp}
                    className={`rounded-2xl border-2 px-3 py-3 text-sm font-black flex items-center justify-center gap-2 ${nativeCaptureSupported
                        ? 'border-[#16A34A] bg-[#ECFDF3] text-[#166534] hover:border-[#15803D]'
                        : 'border-gray-200 bg-white text-[#64748B] hover:border-[#7C3AED]/50'
                        }`}
                    disabled={!showNativeCapture}
                >
                    <Smartphone className="w-4 h-4" /> {nativeSessionActive ? 'Capturar ahora (cola)' : 'Captura de pantalla celular'}
                </button>
                {showPasteHint ? (
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-[#F8FAFF] px-3 py-3 text-xs font-bold text-[#64748B] flex items-center justify-center gap-2">
                        <Clipboard className="w-4 h-4" /> Pegar screenshot (Ctrl+V)
                    </div>
                ) : <div />}
            </div>

            {showNativeCapture && nativeCaptureSupported && (
                <div className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 space-y-2">
                    <p className="text-xs font-black text-[#166534]">
                        Modo captura celular: sesion {nativeSessionActive ? 'activa' : 'inactiva'} · cola {nativeQueueCount}
                    </p>
                    <div className="grid md:grid-cols-4 gap-2">
                        <button type="button" onClick={startNativeSession} className="rounded-xl bg-[#166534] text-white px-3 py-2 text-xs font-black">
                            Iniciar sesion
                        </button>
                        <button type="button" onClick={nativeCaptureNow} disabled={!nativeSessionActive} className={`rounded-xl px-3 py-2 text-xs font-black ${nativeSessionActive ? 'bg-[#15803D] text-white' : 'bg-gray-200 text-gray-500'}`}>
                            Capturar ahora
                        </button>
                        <button type="button" onClick={importNativeQueue} disabled={nativeQueueCount <= 0} className={`rounded-xl px-3 py-2 text-xs font-black ${nativeQueueCount > 0 ? 'bg-[#4D96FF] text-white' : 'bg-gray-200 text-gray-500'}`}>
                            Importar cola
                        </button>
                        <button type="button" onClick={stopNativeSession} className="rounded-xl bg-[#334155] text-white px-3 py-2 text-xs font-black">
                            Cerrar sesion
                        </button>
                    </div>
                </div>
            )}

            {isCameraOpen && (
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-3 space-y-3">
                    <video ref={videoRef} className="w-full rounded-xl bg-black max-h-72 object-contain" playsInline muted />
                    <div className="flex gap-3">
                        <button type="button" onClick={captureFromCamera} className="px-4 py-2 rounded-xl bg-[#4D96FF] text-white text-sm font-black">
                            Capturar
                        </button>
                        <button type="button" onClick={stopCamera} className="px-4 py-2 rounded-xl bg-gray-200 text-[#334155] text-sm font-black">
                            Cerrar camara
                        </button>
                    </div>
                </div>
            )}

            {items.length > 0 && (
                <div className="space-y-3">
                    <div className="grid md:grid-cols-3 gap-3">
                        {items.map((page, index) => (
                            <div key={page.id} className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white">
                                <img src={page.previewUrl} alt={`captura-${page.pageNumber}`} className="w-full h-28 object-cover" />
                                <div className="absolute top-2 left-2 rounded-lg bg-black/70 text-white text-[10px] px-2 py-1 font-black">
                                    {index + 1}/{maxEvidence}
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => moveItem(page.id, 'up')}
                                        className="text-xs bg-black/70 text-white px-2 py-1 rounded-lg"
                                        disabled={index === 0}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveItem(page.id, 'down')}
                                        className="text-xs bg-black/70 text-white px-2 py-1 rounded-lg"
                                        disabled={index === items.length - 1}
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(page.id)}
                                        className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-[#64748B] font-bold">Evidencias: {items.length}/{maxEvidence}</p>
                </div>
            )}

            {!nativeCaptureSupported && showNativeCapture && (
                <p className="text-xs text-[#64748B] font-bold">
                    En celular web usa "Subir archivo" (screenshot de galeria). La captura de pantalla celular funciona en app movil nativa.
                </p>
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

export default EvidenceIntake;
