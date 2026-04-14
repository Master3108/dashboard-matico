import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle, Clipboard, Monitor, UploadCloud, X } from 'lucide-react';

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
        id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        previewUrl: dataUrl,
        imageBase64: dataUrl.split(',')[1],
        imageMimeType: 'image/jpeg',
        pageNumber
    };
};

const ExamCaptureModal = ({ isOpen, onClose, userId, userEmail }) => {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [eventPreview, setEventPreview] = useState(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [eventId, setEventId] = useState('');
    const [formData, setFormData] = useState({ subject: '', exam_date: '', title: '', notes: '' });
    const [events, setEvents] = useState([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const streamRef = useRef(null);
    const videoRef = useRef(null);

    const resetState = () => {
        setPages([]);
        setStatus('idle');
        setErrorMsg('');
        setEventPreview(null);
        setNeedsConfirmation(false);
        setEventId('');
        setFormData({ subject: '', exam_date: '', title: '', notes: '' });
    };

    const closeModal = () => {
        stopCamera();
        resetState();
        onClose?.();
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const loadEvents = async () => {
        if (!userId) return;
        try {
            const response = await fetch(`/api/exams/list?user_id=${encodeURIComponent(userId)}`);
            const data = await response.json();
            if (response.ok && data.success) setEvents(data.events || []);
        } catch {
            // silent
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadEvents();
    }, [isOpen]);

    useEffect(() => () => stopCamera(), []);

    const addPageAsset = (asset) => {
        setErrorMsg('');
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
            setErrorMsg('Falta user_id para registrar la prueba.');
            return;
        }
        setStatus('submitting');
        setErrorMsg('');
        try {
            const firstPage = pages[0];
            const response = await fetch('/api/exams/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    email: userEmail || '',
                    source_type: 'screenshot',
                    image_base64: firstPage.imageBase64,
                    image_mime_type: firstPage.imageMimeType
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo registrar');

            setEventId(data.event_id);
            setNeedsConfirmation(Boolean(data.needs_confirmation));
            setEventPreview(data.event_preview || null);
            setFormData({
                subject: data.event_preview?.subject || '',
                exam_date: data.event_preview?.exam_date || '',
                title: data.event_preview?.title || '',
                notes: data.event_preview?.notes || ''
            });
            setStatus('done');
            await loadEvents();
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo registrar la prueba');
            setStatus('idle');
        }
    };

    const confirmEvent = async () => {
        if (!eventId) return;
        try {
            const response = await fetch('/api/exams/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: eventId,
                    confirm: true,
                    confirmed_data: formData
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo confirmar');
            setNeedsConfirmation(false);
            await loadEvents();
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo confirmar la prueba');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-[#2B2E4A]">Registrar prueba (foto/screenshot)</h3>
                    <button onClick={closeModal} className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={openCamera} className="px-3 py-2 rounded-xl bg-[#2B2E4A] text-white text-sm font-bold flex items-center gap-2"><Camera className="w-4 h-4" /> Tomar foto</button>
                            <label className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
                                <UploadCloud className="w-4 h-4" /> Subir archivo
                                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                            <button onClick={captureScreen} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-2"><Monitor className="w-4 h-4" /> Capturar pantalla</button>
                        </div>

                        <div onPaste={handlePaste} className="border-2 border-dashed border-gray-300 rounded-2xl p-4 min-h-24 text-sm text-gray-600 flex items-center gap-2">
                            <Clipboard className="w-4 h-4" />
                            Pega aqui tu screenshot con Ctrl+V
                        </div>

                        {isCameraOpen && (
                            <div className="rounded-2xl overflow-hidden border border-gray-200">
                                <video ref={videoRef} className="w-full max-h-64 object-cover bg-black" autoPlay playsInline muted />
                                <div className="p-3 flex justify-end">
                                    <button onClick={captureFromCamera} className="px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold">Capturar</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            {pages.map((page) => (
                                <div key={page.id} className="relative border rounded-xl overflow-hidden">
                                    <img src={page.previewUrl} alt="capture" className="w-full h-32 object-cover" />
                                    <button onClick={() => removePage(page.id)} className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>

                        <button onClick={submitIntake} disabled={status === 'submitting'} className="w-full py-3 rounded-xl bg-[#4D96FF] text-white font-black">
                            {status === 'submitting' ? 'Analizando...' : 'Analizar y registrar prueba'}
                        </button>

                        {errorMsg && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {eventPreview && (
                            <div className="border rounded-2xl p-4 bg-slate-50">
                                <h4 className="font-black text-[#2B2E4A] mb-2">Resultado OCR</h4>
                                <p className="text-sm"><strong>Materia:</strong> {eventPreview.subject || '-'}</p>
                                <p className="text-sm"><strong>Fecha:</strong> {eventPreview.exam_date || '-'}</p>
                                <p className="text-sm"><strong>Prueba:</strong> {eventPreview.title || '-'}</p>
                                <p className="text-sm"><strong>Email apoderado:</strong> {eventPreview.guardian_email || '-'}</p>
                            </div>
                        )}

                        {needsConfirmation && (
                            <div className="border rounded-2xl p-4 bg-amber-50 border-amber-200">
                                <h4 className="font-black text-amber-800 mb-2">Confirmación requerida</h4>
                                <div className="space-y-2">
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Materia" value={formData.subject} onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))} />
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Fecha YYYY-MM-DD" value={formData.exam_date} onChange={(e) => setFormData((prev) => ({ ...prev, exam_date: e.target.value }))} />
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre prueba" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} />
                                    <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notas" value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} />
                                    <button onClick={confirmEvent} className="w-full py-2 rounded-xl bg-amber-600 text-white font-bold">Confirmar y programar recordatorios</button>
                                </div>
                            </div>
                        )}

                        <div className="border rounded-2xl p-4">
                            <h4 className="font-black text-[#2B2E4A] mb-2">Próximos recordatorios</h4>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {events.length === 0 && <p className="text-sm text-gray-500">Sin eventos registrados.</p>}
                                {events.map((event) => (
                                    <div key={event.event_id} className="border rounded-xl p-3 text-sm">
                                        <p><strong>{event.subject || 'MATERIA'}</strong> - {event.title || 'Prueba'}</p>
                                        <p>Fecha: {event.exam_date || '-'}</p>
                                        <p>Estado: {event.status}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> D-7:{event.sent_d7 ? 'ok' : 'pend'} | D-2:{event.sent_d2 ? 'ok' : 'pend'} | D-1:{event.sent_d1 ? 'ok' : 'pend'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExamCaptureModal;
