import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';

/**
 * PhoneCaptureNotifier — Shows a floating banner on the phone when
 * the PC has requested a remote photo capture.
 *
 * Polls /api/capture/pending every 5s. When a pending request exists,
 * shows a banner with "Tomar foto" that opens the camera.
 *
 * Usage:
 *   <PhoneCaptureNotifier userId="abc123" />
 */
export default function PhoneCaptureNotifier({ userId }) {
    const [pending, setPending] = useState(null); // { capture_id, token, context, ... }
    const [uploading, setUploading] = useState(false);
    const [done, setDone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const pollRef = useRef(null);
    const fileInputRef = useRef(null);

    const checkPending = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/capture/pending?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data.success && data.pending) {
                setPending(data.pending);
                setDismissed(false);
                setDone(false);
            } else {
                setPending(null);
            }
        } catch { /* network error, retry next cycle */ }
    }, [userId]);

    useEffect(() => {
        // Only poll on mobile devices
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (!isMobile || !userId) return;

        checkPending();
        pollRef.current = setInterval(checkPending, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [userId, checkPending]);

    const handleCapture = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !pending) return;

        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('token', pending.token);
            fd.append('captured_from', 'phone_app');
            fd.append('image', file);

            const res = await fetch('/api/capture/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setDone(true);
            setPending(null);
            // Auto-hide after 3 seconds
            setTimeout(() => { setDone(false); setDismissed(true); }, 3000);
        } catch (err) {
            console.error('[PhoneCaptureNotifier] Upload error:', err);
        } finally {
            setUploading(false);
        }
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
                <Camera className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                    <div className="font-bold text-sm">Foto enviada al computador</div>
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

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
            />
            <div className="fixed top-4 left-4 right-4 z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-2xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <Camera className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{contextLabel}</div>
                        <div className="text-xs text-blue-200 mt-0.5">El computador solicita una foto</div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleCapture}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50"
                            >
                                {uploading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                ) : (
                                    <><Camera className="w-4 h-4" /> Tomar foto</>
                                )}
                            </button>
                            <button
                                onClick={dismiss}
                                className="px-3 py-2 bg-white/20 rounded-xl text-sm font-medium"
                            >
                                Ignorar
                            </button>
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
