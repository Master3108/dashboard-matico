import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { Camera, UploadCloud, X, Loader2, CheckCircle2, Send } from 'lucide-react';

/**
 * PhoneCaptureNotifier — Multi-page capture banner on phone.
 * Gallery allows MULTIPLE selection. Camera allows sequential shots.
 * Photos queue locally → "Enviar X" uploads batch → "Finalizar" closes session.
 * Polls /api/capture/pending every 5s.
 */
export default function PhoneCaptureNotifier({ userId }) {
    const [pending, setPending] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [sentCount, setSentCount] = useState(0);
    const [done, setDone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [queue, setQueue] = useState([]); // [{file, preview}]
    const pollRef = useRef(null);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const sourceRef = useRef('phone_app');

    const checkPending = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await authFetch(`/api/capture/pending?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data.success && data.pending) {
                setPending(prev => {
                    if (prev && prev.token === data.pending.token) return prev;
                    setSentCount(0);
                    setQueue([]);
                    return data.pending;
                });
                setDismissed(false);
                setDone(false);
            } else {
                if (pending && sentCount > 0) {
                    setDone(true);
                    setTimeout(() => { setDone(false); setDismissed(true); setPending(null); setSentCount(0); setQueue([]); }, 3000);
                } else {
                    setPending(null);
                }
            }
        } catch { /* retry next cycle */ }
    }, [userId, pending, sentCount]);

    useEffect(() => {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (!isMobile || !userId) return;
        checkPending();
        pollRef.current = setInterval(checkPending, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [userId, checkPending]);

    const handleCamera = () => {
        sourceRef.current = 'phone_camera';
        if (cameraInputRef.current) { cameraInputRef.current.value = ''; cameraInputRef.current.click(); }
    };

    const handleGallery = () => {
        sourceRef.current = 'phone_gallery';
        if (galleryInputRef.current) { galleryInputRef.current.value = ''; galleryInputRef.current.click(); }
    };

    // Camera: single → add to queue
    const handleCameraFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setQueue(prev => [...prev, { file, preview: URL.createObjectURL(file) }]);
    };

    // Gallery: MULTIPLE → add all to queue
    const handleGalleryFiles = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setQueue(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
    };

    const removeFromQueue = (idx) => {
        setQueue(prev => {
            const copy = [...prev];
            URL.revokeObjectURL(copy[idx].preview);
            copy.splice(idx, 1);
            return copy;
        });
    };

    // Upload all queued photos sequentially
    const uploadAll = async () => {
        if (!pending || queue.length === 0) return;
        setUploading(true);
        const toUpload = [...queue];
        setQueue([]);
        let uploaded = 0;
        let lastCount = sentCount;

        for (const item of toUpload) {
            if (lastCount >= 10) break;
            setUploadProgress(`${uploaded + 1}/${toUpload.length}`);
            try {
                const fd = new FormData();
                fd.append('token', pending.token);
                fd.append('captured_from', sourceRef.current || 'phone_app');
                fd.append('image', item.file); // server converts to JPEG via sharp
                const res = await authFetch('/api/capture/upload', { method: 'POST', body: fd });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                uploaded++;
                lastCount = data.image_count || (lastCount + 1);
                setSentCount(lastCount);
            } catch (err) {
                console.error('[PhoneCaptureNotifier] Upload error:', err);
            }
            URL.revokeObjectURL(item.preview);
        }

        setUploading(false);
        setUploadProgress('');
        if (lastCount >= 10) await finishSession();
    };

    const finishSession = async () => {
        if (!pending) return;
        setFinishing(true);
        try {
            await authFetch('/api/capture/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: pending.token })
            });
        } catch { /* best effort */ }
        setFinishing(false);
        setDone(true);
        setPending(null);
        setQueue([]);
        setTimeout(() => { setDone(false); setDismissed(true); setSentCount(0); }, 3000);
    };

    const dismiss = () => setDismissed(true);

    if (dismissed && !done) return null;
    if (!pending && !done) return null;

    // Done state
    if (done) {
        return (
            <div className="fixed top-4 left-4 right-4 z-[9999] bg-green-600 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-pulse">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div className="font-bold text-sm">
                    {sentCount > 1 ? `${sentCount} fotos enviadas al computador` : 'Foto enviada al computador'}
                </div>
            </div>
        );
    }

    const contextLabel = {
        quiz_correction: 'Correccion de quiz',
        theory_ludic: 'Teoria ludica',
        evidence: 'Evidencia',
        exam: 'Prueba',
        general: 'Foto solicitada'
    }[pending?.context] || 'Foto solicitada';

    const totalUsed = sentCount + queue.length;
    const canAddMore = totalUsed < 10;
    const remaining = 10 - sentCount;

    return (
        <>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraFile} />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryFiles} />

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
                        <div className="text-xs text-blue-200 mt-0.5 flex items-center gap-1.5">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">{pending?.token}</span>
                            {sentCount === 0 && queue.length === 0
                                ? 'El computador solicita imagenes'
                                : queue.length > 0
                                    ? `${queue.length} en cola${sentCount > 0 ? `, ${sentCount} enviada${sentCount > 1 ? 's' : ''}` : ''}`
                                    : `${sentCount} enviada${sentCount > 1 ? 's' : ''} — puedes agregar ${remaining} mas`
                            }
                        </div>

                        {/* Queue thumbnails */}
                        {queue.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {queue.map((item, i) => (
                                    <div key={i} className="relative">
                                        <img src={item.preview} alt={`Cola ${i + 1}`}
                                            className="w-12 h-12 rounded-lg object-cover border-2 border-white/40" />
                                        {!uploading && (
                                            <button onClick={() => removeFromQueue(i)}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload progress */}
                        {uploading && (
                            <div className="flex items-center gap-2 mt-2 bg-white/10 rounded-lg px-3 py-1.5">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-medium">Enviando {uploadProgress}...</span>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-3">
                            {/* Add more: camera + gallery */}
                            {!uploading && canAddMore && (
                                <>
                                    <button onClick={handleCamera}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg">
                                        <Camera className="w-4 h-4" />
                                        {queue.length > 0 ? 'Otra foto' : 'Tomar foto'}
                                    </button>
                                    <button onClick={handleGallery}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg">
                                        <UploadCloud className="w-4 h-4" />
                                        Galeria
                                    </button>
                                </>
                            )}

                            {/* Send queued */}
                            {!uploading && queue.length > 0 && (
                                <button onClick={uploadAll}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-xl text-sm font-bold shadow-lg animate-pulse">
                                    <Send className="w-4 h-4" />
                                    Enviar {queue.length}
                                </button>
                            )}

                            {/* Finalize */}
                            {!uploading && sentCount > 0 && queue.length === 0 && (
                                <button onClick={finishSession} disabled={finishing}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                                    {finishing ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
                                    ) : (
                                        <><CheckCircle2 className="w-4 h-4" /> Finalizar</>
                                    )}
                                </button>
                            )}

                            {/* Dismiss */}
                            {sentCount === 0 && queue.length === 0 && !uploading && (
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
