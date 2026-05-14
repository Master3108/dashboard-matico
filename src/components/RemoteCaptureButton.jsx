import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, Camera, X, Check, Loader2, QrCode, Copy, RefreshCw } from 'lucide-react';

/**
 * RemoteCaptureButton — Allows PC to request a photo from the phone.
 *
 * Usage:
 *   <RemoteCaptureButton
 *     userId="abc123"
 *     studentId="xyz456"
 *     context="quiz_correction"  // quiz_correction | theory_ludic | evidence | general
 *     contextData={{ quizId: '...', questionIndex: 3 }}
 *     onImageReceived={(imageUrl) => { ... }}
 *     onCancel={() => { ... }}
 *     label="Capturar desde celular"
 *     compact={false}
 *   />
 */
export default function RemoteCaptureButton({
    userId,
    studentId,
    context = 'general',
    contextData = {},
    onImageReceived,
    onCancel,
    label = 'Capturar desde celular',
    compact = false,
    className = ''
}) {
    const [state, setState] = useState('idle'); // idle | waiting | completed | error | expired
    const [token, setToken] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [error, setError] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);
    const pollRef = useRef(null);
    const timerRef = useRef(null);
    const captureIdRef = useRef(null);

    const cleanup = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    const startCapture = async () => {
        try {
            setState('waiting');
            setError('');
            setImageUrl('');

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

            // Poll every 2 seconds
            pollRef.current = setInterval(async () => {
                try {
                    const pollRes = await fetch(`/api/capture/poll?token=${data.token}`);
                    const pollData = await pollRes.json();
                    if (pollData.status === 'completed' && pollData.image_url) {
                        cleanup();
                        setImageUrl(pollData.image_url);
                        setState('completed');
                        onImageReceived?.(pollData.image_url);
                    } else if (pollData.status === 'expired' || pollData.status === 'cancelled') {
                        cleanup();
                        setState('expired');
                    }
                } catch { /* network error, keep polling */ }
            }, 2000);

        } catch (err) {
            setState('error');
            setError(err.message);
            cleanup();
        }
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
                    <div className="text-xs text-blue-200">Toma foto con tu celular</div>
                </div>
            </button>
        );
    }

    // WAITING — Show code + countdown
    if (state === 'waiting') {
        return (
            <div className={`bg-white rounded-2xl shadow-xl border border-blue-100 p-5 max-w-sm mx-auto ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-600">
                        <Smartphone className="w-5 h-5" />
                        <span className="font-semibold text-sm">Esperando foto del celular</span>
                    </div>
                    <button onClick={cancelCapture} className="text-gray-400 hover:text-gray-600 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Animated waiting indicator */}
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center">
                            <Camera className="w-7 h-7 text-blue-500 animate-pulse" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                            <span className="text-xs font-bold text-yellow-900">!</span>
                        </div>
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

                {/* Instructions */}
                <div className="text-xs text-gray-500 space-y-1 mb-3">
                    <p>1. Abre Matico en tu celular</p>
                    <p>2. Verás la solicitud de foto automáticamente</p>
                    <p>3. Toma la foto y se enviará sola</p>
                </div>

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

    // COMPLETED — Show received image
    if (state === 'completed') {
        return (
            <div className={`bg-white rounded-2xl shadow-xl border border-green-200 p-4 max-w-sm mx-auto ${className}`}>
                <div className="flex items-center gap-2 text-green-600 mb-3">
                    <Check className="w-5 h-5" />
                    <span className="font-semibold text-sm">Imagen recibida</span>
                </div>
                {imageUrl && (
                    <img src={imageUrl} alt="Captura recibida" className="w-full rounded-lg border border-gray-200 mb-3 max-h-48 object-contain" />
                )}
                <button onClick={() => { setState('idle'); setToken(''); setImageUrl(''); }}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Tomar otra
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
