/**
 * AlarmScreen.jsx — Pantalla fullscreen de alarma tipo despertador
 *
 * 3 diseños según tipo:
 * - parent_alert (13:30) → Rojo/naranja: alertar mamá sobre pruebas y materias sin estudiar
 * - student_reminder (17:00) → Azul: recordar al estudiante qué estudiar
 * - parent_report (21:00) → Verde/morado: reporte nocturno de resultados del día
 */
import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, Clock, BookOpen, AlertTriangle, TrendingUp, TrendingDown, Minus,
         CheckCircle, XCircle, Volume2, VolumeX, ChevronRight, X, Timer } from 'lucide-react';

// =====================================================================
// Mapeo de nombres de materia a español legible
// =====================================================================
const SUBJECT_NAMES = {
    MATEMATICA: 'Matemática', LENGUAJE: 'Lenguaje', COMPETENCIA_LECTORA: 'Comp. Lectora',
    FISICA: 'Física', QUIMICA: 'Química', BIOLOGIA: 'Biología', HISTORIA: 'Historia',
};
const friendlySubject = (s) => SUBJECT_NAMES[s?.toUpperCase()] || s || 'General';

// =====================================================================
// Generador de tonos con Web Audio API
// =====================================================================
let audioCtx = null;
let currentOscillators = [];

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function stopAllSounds() {
    currentOscillators.forEach(osc => { try { osc.stop(); } catch(e) {} });
    currentOscillators = [];
}

function playTone(type = 'urgente', loop = true) {
    stopAllSounds();
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = 0.3;

    const patterns = {
        urgente: { freqs: [880, 1100, 880, 1100], duration: 0.15, gap: 0.08, repeat: 4, pause: 0.6 },
        alegre: { freqs: [523, 659, 784, 1047], duration: 0.2, gap: 0.05, repeat: 2, pause: 1.0 },
        suave: { freqs: [440, 523], duration: 0.4, gap: 0.2, repeat: 2, pause: 1.5 },
    };
    const pat = patterns[type] || patterns.urgente;

    let cancelled = false;
    const controller = { stop: () => { cancelled = true; stopAllSounds(); } };

    function playSequence() {
        if (cancelled) return;
        let time = ctx.currentTime;
        for (let r = 0; r < pat.repeat; r++) {
            for (const freq of pat.freqs) {
                if (cancelled) return;
                const osc = ctx.createOscillator();
                osc.type = type === 'suave' ? 'sine' : type === 'alegre' ? 'triangle' : 'square';
                osc.frequency.value = freq;
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + pat.duration);
                currentOscillators.push(osc);
                time += pat.duration + pat.gap;
            }
            time += pat.pause;
        }
        if (loop && !cancelled) {
            const totalDuration = (pat.repeat * (pat.freqs.length * (pat.duration + pat.gap) + pat.pause)) * 1000;
            setTimeout(() => playSequence(), totalDuration);
        }
    }
    playSequence();

    // Vibración
    if (navigator.vibrate) {
        const vibratePattern = type === 'urgente' ? [200, 100, 200, 100, 400] : [200, 200, 200];
        navigator.vibrate(vibratePattern);
        if (loop) {
            controller._vibrateInterval = setInterval(() => {
                if (!cancelled) navigator.vibrate(vibratePattern);
            }, 3000);
        }
    }

    return controller;
}

// =====================================================================
// Componente principal AlarmScreen
// =====================================================================
export default function AlarmScreen({ digest, alarmConfig, onDismiss, onSnooze, onOpenDetail }) {
    const [muted, setMuted] = useState(false);
    const [snoozeCount, setSnoozedCount] = useState(0);
    const soundRef = useRef(null);
    const type = digest?.alarm_type || 'parent_alert';

    // Tocar sonido al montar
    useEffect(() => {
        const sound = alarmConfig?.sound || 'urgente';
        soundRef.current = playTone(sound, true);
        return () => {
            if (soundRef.current) soundRef.current.stop();
            if (soundRef.current?._vibrateInterval) clearInterval(soundRef.current._vibrateInterval);
            navigator.vibrate?.(0);
        };
    }, []);

    const toggleMute = () => {
        if (muted) {
            soundRef.current = playTone(alarmConfig?.sound || 'urgente', true);
        } else {
            if (soundRef.current) soundRef.current.stop();
            navigator.vibrate?.(0);
        }
        setMuted(!muted);
    };

    const handleDismiss = () => {
        if (soundRef.current) soundRef.current.stop();
        navigator.vibrate?.(0);
        onDismiss?.();
    };

    const handleSnooze = () => {
        if (soundRef.current) soundRef.current.stop();
        navigator.vibrate?.(0);
        setSnoozedCount(s => s + 1);
        onSnooze?.(5); // 5 minutos
    };

    // =====================================================================
    // Colores y gradientes por tipo
    // =====================================================================
    const themes = {
        parent_alert: {
            bg: 'linear-gradient(135deg, #ff6b35 0%, #d32f2f 100%)',
            icon: <AlertTriangle size={48} />,
            title: '⚠️ Alerta de Estudio',
            subtitle: 'Atención requerida',
            accentBg: 'rgba(255,255,255,0.15)',
            textColor: '#fff',
        },
        student_reminder: {
            bg: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
            icon: <BookOpen size={48} />,
            title: '📚 Hora de Estudiar',
            subtitle: '¡Vamos, tú puedes!',
            accentBg: 'rgba(255,255,255,0.15)',
            textColor: '#fff',
        },
        parent_report: {
            bg: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
            icon: <TrendingUp size={48} />,
            title: '📊 Reporte del Día',
            subtitle: 'Resumen de actividad',
            accentBg: 'rgba(255,255,255,0.12)',
            textColor: '#fff',
        },
    };
    const theme = themes[type] || themes.parent_alert;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: theme.bg, color: theme.textColor,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px', overflowY: 'auto',
            animation: 'alarmFadeIn 0.4s ease-out',
        }}>
            {/* Estilos de animación */}
            <style>{`
                @keyframes alarmFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes alarmPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
                @keyframes alarmBell { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(15deg); } 75% { transform: rotate(-15deg); } }
                .alarm-pulse { animation: alarmPulse 1.5s ease-in-out infinite; }
                .alarm-bell { animation: alarmBell 0.5s ease-in-out infinite; }
                .alarm-card { background: ${theme.accentBg}; border-radius: 16px; padding: 16px; margin: 8px 0; width: 100%; backdrop-filter: blur(10px); }
                .alarm-btn { border: none; border-radius: 50px; padding: 16px 32px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; justify-content: center; }
                .alarm-btn:active { transform: scale(0.95); }
                .alarm-dismiss { background: #fff; color: #333; }
                .alarm-snooze { background: rgba(255,255,255,0.2); color: #fff; border: 2px solid rgba(255,255,255,0.4) !important; }
                .alarm-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                .alarm-badge-red { background: rgba(244,67,54,0.3); }
                .alarm-badge-green { background: rgba(76,175,80,0.3); }
                .alarm-badge-yellow { background: rgba(255,193,7,0.3); }
                .alarm-badge-blue { background: rgba(33,150,243,0.3); }
            `}</style>

            {/* Header: mute + hora */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 8 }}>
                    {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <span style={{ fontSize: 14, opacity: 0.8 }}>
                    {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 8 }}>
                    <X size={24} />
                </button>
            </div>

            {/* Icono animado */}
            <div className="alarm-pulse" style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="alarm-bell">{theme.icon}</div>
            </div>

            {/* Título */}
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '12px 0 4px', textAlign: 'center' }}>{theme.title}</h1>
            <p style={{ fontSize: 16, opacity: 0.8, marginBottom: 20 }}>{theme.subtitle}</p>

            {/* Contenido según tipo */}
            <div style={{ width: '100%', maxWidth: 400, flex: 1 }}>
                {type === 'parent_alert' && <ParentAlertContent digest={digest} />}
                {type === 'student_reminder' && <StudentReminderContent digest={digest} />}
                {type === 'parent_report' && <ParentReportContent digest={digest} />}
            </div>

            {/* Botones */}
            <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, paddingBottom: 20 }}>
                <button className="alarm-btn alarm-dismiss" onClick={handleDismiss}>
                    <BellOff size={20} /> Entendido
                </button>
                <button className="alarm-btn alarm-snooze" onClick={handleSnooze}>
                    <Timer size={20} /> Posponer 5 min
                </button>
                {onOpenDetail && (
                    <button className="alarm-btn alarm-snooze" onClick={() => { handleDismiss(); onOpenDetail?.(); }}>
                        <ChevronRight size={20} /> Ver detalle
                    </button>
                )}
            </div>
        </div>
    );
}

// =====================================================================
// PARENT ALERT (13:30) — Alertar a mamá
// =====================================================================
function ParentAlertContent({ digest }) {
    if (!digest) return null;
    const { upcoming_events = [], stale_subjects = [], recent_activity_count = 0 } = digest;

    return (
        <>
            {/* Eventos próximos */}
            {upcoming_events.length > 0 && (
                <div className="alarm-card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>
                        📅 Próximos eventos ({upcoming_events.length})
                    </h3>
                    {upcoming_events.slice(0, 5).map((ev, i) => {
                        const evDate = new Date(ev.event_date + 'T12:00:00');
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diffDays = Math.round((evDate - today) / 86400000);
                        const urgency = diffDays === 0 ? 'HOY' : diffDays === 1 ? 'MAÑANA' : `${diffDays} días`;
                        const urgencyClass = diffDays <= 1 ? 'alarm-badge-red' : diffDays <= 3 ? 'alarm-badge-yellow' : 'alarm-badge-blue';

                        return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < upcoming_events.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title || ev.event_type}</div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>{friendlySubject(ev.subject)}</div>
                                </div>
                                <span className={`alarm-badge ${urgencyClass}`}>{urgency}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Materias sin estudiar */}
            {stale_subjects.length > 0 && (
                <div className="alarm-card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>
                        🚨 Materias sin estudiar
                    </h3>
                    {stale_subjects.map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                            <span style={{ fontWeight: 600 }}>{friendlySubject(s.subject)}</span>
                            <span className={`alarm-badge ${s.days_inactive > 7 ? 'alarm-badge-red' : 'alarm-badge-yellow'}`}>
                                {s.never_studied ? 'Nunca estudiada' : `${s.days_inactive} días`}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Resumen actividad */}
            <div className="alarm-card" style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>{recent_activity_count}</span>
                <div style={{ fontSize: 13, opacity: 0.8 }}>actividades en los últimos 3 días</div>
            </div>
        </>
    );
}

// =====================================================================
// STUDENT REMINDER (17:00) — Recordar al estudiante
// =====================================================================
function StudentReminderContent({ digest }) {
    if (!digest) return null;
    const { upcoming_events = [], priority_subjects = [], studied_today, studied_today_subjects = [] } = digest;

    return (
        <>
            {/* Estado de hoy */}
            <div className="alarm-card" style={{ textAlign: 'center' }}>
                {studied_today ? (
                    <>
                        <CheckCircle size={32} style={{ color: '#4CAF50', marginBottom: 8 }} />
                        <div style={{ fontWeight: 700 }}>¡Ya estudiaste hoy!</div>
                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                            {studied_today_subjects.map(friendlySubject).join(', ')}
                        </div>
                    </>
                ) : (
                    <>
                        <XCircle size={32} style={{ color: '#FF9800', marginBottom: 8 }} />
                        <div style={{ fontWeight: 700 }}>Aún no has estudiado hoy</div>
                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>¡Es momento de empezar!</div>
                    </>
                )}
            </div>

            {/* Materias prioritarias */}
            {priority_subjects.length > 0 && (
                <div className="alarm-card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>
                        🎯 Hoy debes estudiar
                    </h3>
                    {priority_subjects.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                            <BookOpen size={16} />
                            <span style={{ fontWeight: 600 }}>{friendlySubject(s)}</span>
                            <span className="alarm-badge alarm-badge-red" style={{ marginLeft: 'auto' }}>Tiene evento</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Eventos próximos */}
            {upcoming_events.length > 0 && (
                <div className="alarm-card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>
                        📅 Próximos ({upcoming_events.length})
                    </h3>
                    {upcoming_events.slice(0, 4).map((ev, i) => {
                        const evDate = new Date(ev.event_date + 'T12:00:00');
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diffDays = Math.round((evDate - today) / 86400000);
                        const label = diffDays === 0 ? 'HOY' : diffDays === 1 ? 'MAÑANA' : `en ${diffDays} días`;

                        return (
                            <div key={i} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.title || friendlySubject(ev.subject)}</span>
                                <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

// =====================================================================
// PARENT REPORT (21:00) — Reporte nocturno para mamá
// =====================================================================
function ParentReportContent({ digest }) {
    if (!digest) return null;
    const {
        total_study_minutes = 0, quizzes = [], cuaderno_uploaded = {},
        theory_ludica_completed = false, theory_ludica_count = 0,
        streak = 0, trend = 'same', total_activities_today = 0,
        total_activities_yesterday = 0, subjects_studied_today = []
    } = digest;

    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? '#4CAF50' : trend === 'down' ? '#f44336' : '#FF9800';

    return (
        <>
            {/* KPIs principales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="alarm-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800 }}>{total_study_minutes}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>minutos estudiados</div>
                </div>
                <div className="alarm-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800 }}>🔥 {streak}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>días de racha</div>
                </div>
            </div>

            {/* Tendencia */}
            <div className="alarm-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <TrendIcon size={24} style={{ color: trendColor }} />
                <div>
                    <span style={{ fontWeight: 700 }}>Hoy: {total_activities_today}</span>
                    <span style={{ opacity: 0.7, margin: '0 6px' }}>vs</span>
                    <span style={{ fontWeight: 700 }}>Ayer: {total_activities_yesterday}</span>
                </div>
            </div>

            {/* Quizzes del día */}
            {quizzes.length > 0 && (
                <div className="alarm-card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>📝 Quizzes del día</h3>
                    {quizzes.map((q, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < quizzes.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{friendlySubject(q.subject)}</div>
                                <div style={{ fontSize: 11, opacity: 0.7 }}>
                                    Fuente: {q.source === 'cuaderno' ? '📓 Cuaderno' : '🤖 Banco IA'}
                                </div>
                            </div>
                            <span className={`alarm-badge ${q.score >= 60 ? 'alarm-badge-green' : 'alarm-badge-red'}`}>
                                {q.score != null ? `${Math.round(q.score)}%` : `${q.correct || 0}/${q.total || 0}`}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Checklist */}
            <div className="alarm-card">
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 }}>✅ Checklist</h3>
                <CheckItem label="Cuaderno subido" done={Object.keys(cuaderno_uploaded).length > 0} detail={Object.keys(cuaderno_uploaded).length > 0 ? Object.keys(cuaderno_uploaded).map(friendlySubject).join(', ') : null} />
                <CheckItem label="Teoría lúdica" done={theory_ludica_completed} detail={theory_ludica_count > 0 ? `${theory_ludica_count} completadas` : null} />
                <CheckItem label="Quiz realizado" done={quizzes.length > 0} detail={quizzes.length > 0 ? `${quizzes.length} quiz${quizzes.length > 1 ? 'zes' : ''}` : null} />
            </div>

            {/* Materias estudiadas */}
            {subjects_studied_today.length > 0 && (
                <div className="alarm-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Materias estudiadas hoy</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                        {subjects_studied_today.map((s, i) => (
                            <span key={i} className="alarm-badge alarm-badge-green">{friendlySubject(s)}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Sin actividad */}
            {total_activities_today === 0 && (
                <div className="alarm-card" style={{ textAlign: 'center' }}>
                    <XCircle size={32} style={{ color: '#f44336', marginBottom: 8 }} />
                    <div style={{ fontWeight: 700 }}>Sin actividad hoy</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>No realizó ninguna actividad de estudio</div>
                </div>
            )}
        </>
    );
}

function CheckItem({ label, done, detail }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            {done ? <CheckCircle size={18} style={{ color: '#4CAF50' }} /> : <XCircle size={18} style={{ color: '#f44336' }} />}
            <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                {detail && <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 6 }}>({detail})</span>}
            </div>
        </div>
    );
}
