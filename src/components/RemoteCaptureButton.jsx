import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, Camera, X, Check, Loader2, Copy, RefreshCw, CheckCircle2 } from 'lucide-react';

/**
 * RemoteCaptureButton — Multi-page remote capture from phone.
 * Each image received calls onImageReceived incrementally.
 * Session stays open until Finalizar, expire, or cancel.
 *
 * Props:
 *   userId, studentId, context, contextData,
 *   onImageReceived(imageUrl, index, total)  — called per new image
 *   onFinish(imageUrls)                      — called when session finalized
 *   onCancel()
 *   maxImages        — default 10
 *   existingCount    — pages already loaded (e.g. from gallery), reduces max
 *   label, compact, className
 */
export default function RemoteCaptureButton({
    userId,
    studentId,
    context = 'general',
    contextData = {},
    onImageReceived,
    onFinish,
    onCancel,
    maxImages = 10,
    existingCount = 0,
    label = 'Capturar desde celular',
    compact = false,
    className = ''
}) {
    const [state, setState] = useState('idle'); // idle | waiting | completed | error | expired
    const [token, setToken] = useState('');
    const [receivedUrls, setReceivedUrls] = useState([]);
    const [error, setError] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [finishing, setFinishing] = useState(false);
    const pollRef = useRef(null);
    const timerRef = useRef(null);
    const captureIdRef = useRef(null);
    const lastCountRef = useRef(0); // track how many we've already processed

    const effectiveMax = Math.max(1, maxImages - existingCount);

    const cleanup = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    const startCapture = async () => {
        try {
            setState('waiting');
            setError('');
            setReceivedUrls([]);
            lastCountRef.current = 0;

            const res = await fetch('/api/capture/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, student_id: studentId || userId, context, context_data: contextData })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setToken(data.token);
            captureIdRef.current = data.capture_id;

            // Countdown timer
            const expiresAt = new Date(data.expires_at).getTime();
            setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
            timerRef.current = setInterval(() => {
                const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
                setSecondsLeft(left);
                if (left <= 0) {
                    setState('expired');
                    cleanup();
                }
            }, 1000);

            // Poll every 2 seconds for new images
            pollRef.current = setInterval(async () => {
                try {
                    const pollRes = await fetch(`/api/capture/poll?token=${data.token}`);
                    const pollData = await pollRes.json();

                    if (pollData.status === 'completed') {
                        // Session finalized (by phone or server)
                        cleanup();
                        const urls = pollData.image_urls || [];
                        // Process remaining new images SEQUENTIALLY (await each)
                        for (let i = lastCountRef.current; i < urls.length; i++) {
                            await onImageReceived?.(urls[i], i, urls.length);
                        }
                        setReceivedUrls(urls);
                        lastCountRef.current = urls.length;
                        setState('completed');
                        onFinish?.(urls);
                        return;
                    }

                    if (pollData.status === 'expired' || pollData.status === 'cancelled') {
                        cleanup();
                        setState('expired');
                        return;
                    }

                    // Still waiting — check for new images
                    const urls = pollData.image_urls || [];
                    if (urls.length > lastCountRef.current) {
                        // New images arrived — process SEQUENTIALLY (await each to avoid stale closure)
                        for (let i = lastCountRef.current; i < urls.length; i++) {
                            await onImageReceived?.(urls[i], i, urls.length);
                        }
                        setReceivedUrls([...urls]);
                        lastCountRef.current = urls.length;
                    }
                } catch { /* network error, keep polling */ }
            }, 2000);

        } catch (err) {
            setState('error');
            setError(err.message);
            cleanup();
        }
    };

    const finishCapture = async () => {
        setFinishing(true);
        cleanup();
        try {
            await fetch('/api/capture/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        } catch { /* best effort */ }
        setState('completed');
        onFinish?.(receivedUrls);
        setFinishing(false);
    };

    const cancelCapture = async () => {
        cleanup();
        try {
            await fetch('/api/capture/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        } catch { /* best effort */ }
        setState('idle');
        setToken('');
        setReceivedUrls([]);
        lastCountRef.current = 0;
        onCancel?.();
    };

    const copyToken = () => {
        navigator.clipboard?.writeText(token).catch(() => {});
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Compact mode: just a button
    if (compact && state === 'idle') {
        return (
            <button onClick={startCapture}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition ${className}`}>
                <Smartphone className="w-4 h-4" />
                <span>{label}</span>
            </button>
        );
    }

    // IDLE — Show trigger button
    if (state === 'idle') {
        return (
            <button onClick={startCapture}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-xl transition-all ${className}`}>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-blue-200">Toma fotos con tu celular (hasta {effectiveMax})</div>
                </div>
            </button>
        );
    }

    // WAITING — Show code + countdown + received count
    if (state === 'waiting') {
        const count = receivedUrls.length;
        return (
            <div className={`bg-white rounded-2xl shadow-xl border border-blue-100 p-5 max-w-sm mx-auto ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-600">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-semibold text-sm">
                            {count > 0 ? `Recibidas ${count}/${effectiveMax}` : 'Esperando foto del celular'}
                        </span>
                    </div>
                    <button onClick={cancelCapture} className="text-gray-400 hover:text-gray-600 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Animated waiting indicator */}
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center">
                            {count > 0 ? (
                                <span className="text-xl font-bold text-blue-600">{count}</span>
                            ) : (
                                <Camera className="w-7 h-7 text-blue-500 animate-pulse" />
                            )}
                        </div>
                        {count === 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                                <span className="text-xs font-bold text-yellow-900">!</span>
                            </div>
                        )}
                        {count > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Code display */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">Código de captura</div>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-mono font-bold tracking-widest text-blue-700">{token}</span>
                        <button onClick={copyToken} className="text-gray-400 hover:text-blue-600 transition" title="Copiar">
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Received thumbnails */}
                {count > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {receivedUrls.map((url, i) => (
                            <img key={i} src={url} alt={`Pag ${i + 1}`}
                                className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                        ))}
                    </div>
                )}

                {/* Instructions */}
                <div className="text-xs text-gray-500 space-y-1 mb-3">
                    {count === 0 ? (
                        <>
                            <p>1. Abre Matico en tu celular</p>
                            <p>2. Verás la solicitud de foto automáticamente</p>
                            <p>3. Toma las fotos que necesites (hasta {effectiveMax})</p>
                        </>
                    ) : (
                        <p className="text-green-600 font-medium">Puedes seguir enviando fotos desde el celular o finalizar aquí.</p>
                    )}
                </div>

                {/* Finalizar button (only when at least 1 image received) */}
                {count > 0 && (
                    <button onClick={finishCapture} disabled={finishing}
                        className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition mb-2 disabled:opacity-50">
                        {finishing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
                        ) : (
                            <><CheckCircle2 className="w-4 h-4" /> Finalizar ({count} {count === 1 ? 'imagen' : 'imágenes'})</>
                        )}
                    </button>
                )}

                {/* Timer */}
                <div className="flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-1 ${secondsLeft < 60 ? 'text-red-500' : 'text-gray-400'}`}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Expira en {formatTime(secondsLeft)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span>Escuchando...</span>
                    </div>
                </div>
            </div>
        );
    }

    // COMPLETED
    if (state === 'completed') {
        const count = receivedUrls.length;
        return (
            <div className={`bg-white rounded-2xl shadow-xl border border-green-200 p-4 max-w-sm mx-auto ${className}`}>
                <div className="flex items-center gap-2 text-green-600 mb-3">
                    <Check className="w-5 h-5" />
                    <span className="font-semibold text-sm">{count} {count === 1 ? 'imagen recibida' : 'imágenes recibidas'}</span>
                </div>
                {count > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {receivedUrls.map((url, i) => (
                            <img key={i} src={url} alt={`Pag ${i + 1}`}
                                className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                        ))}
                    </div>
                )}
                <button onClick={() => { setState('idle'); setToken(''); setReceivedUrls([]); lastCountRef.current = 0; }}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Nueva sesión
                </button>
            </div>
        );
    }

    // EXPIRED
    if (state === 'expired') {
        return (
            <div className={`bg-white rounded-2xl shadow-xl border border-orange-200 p-4 max-w-sm mx-auto ${className}`}>
                <div className="text-center">
                    <div className="text-orange-500 font-medium text-sm mb-2">Solicitud expirada</div>
                    <button onClick={startCapture}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition flex items-center gap-2 mx-auto">
                        <RefreshCw className="w-4 h-4" /> Intentar de nuevo
                    </button>
                </div>
            </div>
        );
    }

    // ERROR
    return (
        <div className={`bg-white rounded-2xl shadow-xl border border-red-200 p-4 max-w-sm mx-auto ${className}`}>
            <div className="text-center">
                <div className="text-red-500 font-medium text-sm mb-1">Error</div>
                <div className="text-xs text-gray-500 mb-2">{error}</div>
                <button onClick={startCapture}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition">
                    Reintentar
                </button>
            </div>
        </div>
    );
}
