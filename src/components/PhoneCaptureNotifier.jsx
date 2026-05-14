import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, UploadCloud, X, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * PhoneCaptureNotifier — Multi-page capture banner on phone.
 * Stays open after first photo. Shows count. "Finalizar" to close session.
 * Polls /api/capture/pending every 5s.
 */
export default function PhoneCaptureNotifier({ userId }) {
    const [pending, setPending] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [sentCount, setSentCount] = useState(0);
    const [done, setDone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const pollRef = useRef(null);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const sourceRef = useRef('phone_app');

    const checkPending = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/capture/pending?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data.success && data.pending) {
                setPending(prev => {
                    // Keep sentCount if same capture session
                    if (prev && prev.token === data.pending.token) return prev;
                    setSentCount(0);
                    return data.pending;
                });
                setDismissed(false);
                setDone(false);
            } else {
                // No pending — if we had one open with images, it was finalized elsewhere
                if (pending && sentCount > 0) {
                    setDone(true);
                    setTimeout(() => { setDone(false); setDismissed(true); setPending(null); setSentCount(0); }, 3000);
                } else {
                    setPending(null);
                }
            }
        } catch { /* network error, retry next cycle */ }
    }, [userId, pending, sentCount]);

    useEffect(() => {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (!isMobile || !userId) return;

        checkPending();
        pollRef.current = setInterval(checkPending, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [userId, checkPending]);

    const handleCapture = () => {
        sourceRef.current = 'phone_camera';
        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
            cameraInputRef.current.click();
        }
    };

    const handleGallery = () => {
        sourceRef.current = 'phone_gallery';
        if (galleryInputRef.current) {
            galleryInputRef.current.value = '';
            galleryInputRef.current.click();
        }
    };

    // Convert any image (including HEIC) to JPG via canvas
    const convertToJpeg = (file) => new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file);
            }, 'image/jpeg', 0.92);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !pending) return;

        setUploading(true);
        try {
            // Convert HEIC/HEIF or any format to JPEG
            const jpegFile = await convertToJpeg(file);
            const fd = new FormData();
            fd.append('token', pending.token);
            fd.append('captured_from', sourceRef.current || 'phone_app');
            fd.append('image', jpegFile);

            const res = await fetch('/api/capture/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const newCount = data.image_count || (sentCount + 1);
            setSentCount(newCount);

            // If max reached, auto-finalize
            if (newCount >= 10) {
                await finishSession();
            }
        } catch (err) {
            console.error('[PhoneCaptureNotifier] Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const finishSession = async () => {
        if (!pending) return;
        setFinishing(true);
        try {
            await fetch('/api/capture/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: pending.token })
            });
        } catch { /* best effort */ }
        setFinishing(false);
        setDone(true);
        setPending(null);
        setTimeout(() => { setDone(false); setDismissed(true); setSentCount(0); }, 3000);
    };

    const dismiss = () => {
        setDismissed(true);
    };

    // Nothing to show
    if (dismissed && !done) return null;
    if (!pending && !done) return null;

    // Done state
    if (done) {
        return (
            <div className="fixed top-4 left-4 right-4 z-[9999] bg-green-600 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-pulse">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                    <div className="font-bold text-sm">
                        {sentCount > 1 ? `${sentCount} fotos enviadas al computador` : 'Foto enviada al computador'}
                    </div>
                </div>
            </div>
        );
    }

    // Pending capture request
    const contextLabel = {
        quiz_correction: 'Correccion de quiz',
        theory_ludic: 'Teoria ludica',
        evidence: 'Evidencia',
        exam: 'Prueba',
        general: 'Foto solicitada'
    }[pending?.context] || 'Foto solicitada';

    const remaining = 10 - sentCount;

    return (
        <>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="fixed top-4 left-4 right-4 z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        {sentCount > 0 ? (
                            <span className="text-lg font-bold">{sentCount}</span>
                        ) : (
                            <Camera className="w-5 h-5 animate-pulse" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{contextLabel}</div>
                        <div className="text-xs text-blue-200 mt-0.5">
                            {sentCount === 0
                                ? 'El computador solicita imagenes'
                                : `${sentCount} enviada${sentCount > 1 ? 's' : ''} — puedes enviar ${remaining} mas`
                            }
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <button
                                onClick={handleCapture}
                                disabled={uploading || remaining <= 0}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50"
                            >
                                {uploading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                ) : (
                                    <><Camera className="w-4 h-4" /> Tomar foto</>
                                )}
                            </button>
                            <button
                                onClick={handleGallery}
                                disabled={uploading || remaining <= 0}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50"
                            >
                                {uploading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                ) : (
                                    <><UploadCloud className="w-4 h-4" /> Subir imagen</>
                                )}
                            </button>
                            {sentCount > 0 && (
                                <button
                                    onClick={finishSession}
                                    disabled={finishing}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50"
                                >
                                    {finishing ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
                                    ) : (
                                        <><CheckCircle2 className="w-4 h-4" /> Finalizar</>
                                    )}
                                </button>
                            )}
                            {sentCount === 0 && (
                                <button onClick={dismiss} className="px-3 py-2 bg-white/20 rounded-xl text-sm font-medium">
                                    Ignorar
                                </button>
                            )}
                        </div>
                    </div>
                    <button onClick={dismiss} className="text-white/60 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </>
    );
}
