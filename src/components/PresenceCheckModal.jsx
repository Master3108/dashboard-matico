import { useEffect, useState } from 'react';

/**
 * Modal "¿Sigues ahí?" — aparece cuando el alumno lleva 25 min sin interactuar.
 * El propio modal tiene un timer interno de 60 seg: si el alumno NO responde
 * en ese lapso, se considera "presencia no confirmada" y se llama onTimeout
 * (lo que en el padre va a disparar pauseStudySession).
 */
export default function PresenceCheckModal({
    open,
    autoCloseSeconds = 60,
    onConfirm,
    onTimeout
}) {
    const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);

    useEffect(() => {
        if (!open) return undefined;
        setSecondsLeft(autoCloseSeconds);
        const tickId = setInterval(() => {
            setSecondsLeft((s) => {
                if (s <= 1) {
                    clearInterval(tickId);
                    try { onTimeout && onTimeout(); } catch { /* noop */ }
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(tickId);
    }, [open, autoCloseSeconds, onTimeout]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar presencia"
        >
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-2xl font-black text-[#2B2E4A] mb-3">
                    ¿Sigues estudiando?
                </h2>
                <p className="text-sm font-bold text-[#6B7280] mb-6">
                    Pasaron 25 minutos sin acción en la pantalla. Toca el botón
                    para confirmar que sigues acá (puedes estar copiando en tu cuaderno).
                </p>

                <button
                    type="button"
                    onClick={onConfirm}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black py-5 rounded-2xl text-lg shadow-lg active:scale-95 transition mb-3"
                >
                    Sí, sigo estudiando ✨
                </button>

                <p className="text-xs font-bold text-[#9094A6]">
                    Si no respondes en <span className="text-rose-500">{secondsLeft}s</span> el
                    cronómetro se pausa automáticamente.
                </p>
            </div>
        </div>
    );
}
