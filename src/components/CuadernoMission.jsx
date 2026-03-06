import React, { useState } from 'react';
import { Camera, CheckCircle, UploadCloud, AlertTriangle, RotateCcw, Award, Star, Sparkles } from 'lucide-react';

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
    }
};

const CuadernoMission = ({ sessionId, subject, topic, readingContent, onComplete, onSkip }) => {
    const [status, setStatus] = useState('idle'); // idle, uploading, success, retry, error
    const [feedback, setFeedback] = useState('');
    const [tier, setTier] = useState(null); // 'oro', 'plata', 'insuficiente'
    const [suggestion, setSuggestion] = useState('');
    const [retryCount, setRetryCount] = useState(0);

    const handleCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tamaño (máximo 10MB para base64)
        if (file.size > 10 * 1024 * 1024) {
            setStatus('error');
            setFeedback('La imagen es muy grande. Intenta con una foto más pequeña (máximo 10MB).');
            return;
        }

        setStatus('uploading');
        const reader = new FileReader();

        reader.onloadend = async () => {
            try {
                const base64Image = reader.result.split(',')[1];

                const response = await fetch('/webhook/MATICO', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'verify_handwriting',
                        image: base64Image,
                        sessionId,
                        subject,
                        topic,
                        readingContent: readingContent?.substring(0, 3000) || ''
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const resultTier = data.tier || 'plata';
                    setTier(resultTier);
                    setFeedback(data.feedback || '¡Buen trabajo!');
                    setSuggestion(data.suggestion || '');

                    if (resultTier === 'insuficiente') {
                        setStatus('retry');
                        setRetryCount(prev => prev + 1);
                    } else {
                        setStatus('success');
                        const xpReward = TIER_CONFIG[resultTier]?.xp || 30;
                        if (onComplete) onComplete(xpReward, resultTier);
                    }
                } else {
                    // IA no pudo procesar pero no es error de red
                    setTier('insuficiente');
                    setFeedback(data.feedback || data.error || 'Matico no pudo leer bien la imagen. ¡Intenta con más luz!');
                    setSuggestion(data.suggestion || '');
                    setStatus('retry');
                    setRetryCount(prev => prev + 1);
                }
            } catch (err) {
                console.error('[CUADERNO] Error:', err);
                setStatus('error');
                setFeedback('Error de conexión. Verifica tu internet e intenta de nuevo.');
            }
        };

        reader.readAsDataURL(file);
    };

    const handleRetry = () => {
        setStatus('idle');
        setFeedback('');
        setTier(null);
        setSuggestion('');
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

                            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-600">
                                <p className="font-semibold text-slate-700 mb-2">🎯 Rúbrica de Matico:</p>
                                <ul className="space-y-1">
                                    <li>🏅 <strong>Oro (+50 XP):</strong> Conceptos clave con palabras propias + esquemas o flechas</li>
                                    <li>🥈 <strong>Plata (+30 XP):</strong> Conceptos clave pero parecido al texto original</li>
                                    <li>🔄 <strong>Reintentar:</strong> Copia literal o contenido no relacionado</li>
                                </ul>
                            </div>

                            <label className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-4 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                                <UploadCloud size={22} />
                                📸 Tomar Foto / Subir imagen
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleCapture}
                                />
                            </label>

                            {onSkip && (
                                <button
                                    onClick={onSkip}
                                    className="w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
                                >
                                    Saltar por ahora (sin XP)
                                </button>
                            )}
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
                                Matico está analizando tus notas...
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                Verificando escritura a mano, conceptos clave y paráfrasis
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
                            </div>

                            <div className="mt-4 text-center">
                                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold text-lg">
                                    <Star size={20} className="text-yellow-500" />
                                    +{tierConfig.xp} XP
                                    {tierConfig.badge && <span className="text-sm ml-1">| {tierConfig.badge}</span>}
                                </div>
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CuadernoMission;
