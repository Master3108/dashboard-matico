import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { getAlarmService } from '../services/AlarmService';
import { Bell, Clock, Save, Check, AlarmClock, Volume2 } from 'lucide-react';

// Metadatos por tipo de alarma
const ALARM_META = {
    parent_alert: {
        label: 'Alerta para apoderado',
        desc: 'Te avisa si tu hijo tiene materias o pruebas pendientes.',
        color: '#EF4444', bg: '#FEF2F2', icon: AlarmClock,
    },
    student_reminder: {
        label: 'Recordatorio de estudio',
        desc: 'Le recuerda al estudiante que tiene materias por estudiar.',
        color: '#3B82F6', bg: '#EFF6FF', icon: Bell,
    },
    parent_report: {
        label: 'Reporte del día',
        desc: 'Resumen de las actividades del día.',
        color: '#8B5CF6', bg: '#F5F3FF', icon: Clock,
    },
};

// Días en orden de visualización (clave usada en BD: dom..sab)
const DAYS = [
    { key: 'lun', label: 'L' },
    { key: 'mar', label: 'M' },
    { key: 'mie', label: 'Mi' },
    { key: 'jue', label: 'J' },
    { key: 'vie', label: 'V' },
    { key: 'sab', label: 'S' },
    { key: 'dom', label: 'D' },
];

const SOUNDS = [
    { key: 'urgente', label: 'Urgente' },
    { key: 'alegre', label: 'Alegre' },
    { key: 'suave', label: 'Suave' },
];

const parseDays = (d) => {
    if (Array.isArray(d)) return d;
    if (typeof d === 'string') { try { return JSON.parse(d); } catch { return ['lun','mar','mie','jue','vie']; } }
    return ['lun','mar','mie','jue','vie'];
};

// Parseo seguro para arrays opcionales (subjects_monitor): default [] si falla
const parseArr = (d) => {
    if (Array.isArray(d)) return d;
    if (typeof d === 'string') { try { const v = JSON.parse(d); return Array.isArray(v) ? v : []; } catch { return []; } }
    return [];
};

const pad = (n) => String(n).padStart(2, '0');

const AlarmSettings = ({ currentUser, selectedChild }) => {
    const [alarms, setAlarms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [error, setError] = useState('');

    const parentId = currentUser?.user_id;
    const studentId = selectedChild?.user_id;

    const load = useCallback(async () => {
        if (!studentId) { setLoading(false); return; }
        setLoading(true);
        setError('');
        try {
            const res = await authFetch(`/api/alarms/manage?parent_user_id=${parentId}&student_user_id=${studentId}`);
            const data = await res.json();
            if (data.success) {
                setAlarms((data.alarms || []).map(a => ({ ...a, days_active: parseDays(a.days_active) })));
            } else {
                setError(data.error || 'No se pudieron cargar las alarmas');
            }
        } catch (e) {
            setError('Error de conexión al cargar alarmas');
        } finally {
            setLoading(false);
        }
    }, [parentId, studentId]);

    useEffect(() => { load(); }, [load]);

    const updateLocal = (alarm_id, patch) => {
        setAlarms(prev => prev.map(a => a.alarm_id === alarm_id ? { ...a, ...patch } : a));
        setSavedId(null);
    };

    const toggleDay = (alarm, dayKey) => {
        const has = alarm.days_active.includes(dayKey);
        const next = has ? alarm.days_active.filter(d => d !== dayKey) : [...alarm.days_active, dayKey];
        updateLocal(alarm.alarm_id, { days_active: next });
    };

    const saveAlarm = async (alarm) => {
        setSavingId(alarm.alarm_id);
        setError('');
        try {
            const body = {
                alarm_id: alarm.alarm_id,
                user_id: alarm.user_id,
                student_user_id: alarm.student_user_id,
                role: alarm.role,
                alarm_type: alarm.alarm_type,
                hour: Number(alarm.hour),
                minute: Number(alarm.minute),
                days_active: alarm.days_active,
                subjects_monitor: parseArr(alarm.subjects_monitor),
                stale_threshold_days: alarm.stale_threshold_days || 3,
                sound: alarm.sound || 'urgente',
                enabled: alarm.enabled !== false,
            };
            const res = await authFetch('/api/alarms/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setSavedId(alarm.alarm_id);
                // Re-programar alarmas nativas inmediatamente
                try { await getAlarmService().reload(); } catch (_) {}
                setTimeout(() => setSavedId(null), 2500);
            } else {
                setError(data.error || 'No se pudo guardar');
            }
        } catch (e) {
            setError('Error de conexión al guardar');
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-100 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-400 font-bold mt-3 text-sm">Cargando alarmas…</p>
            </div>
        );
    }

    if (!studentId) {
        return (
            <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-100 text-center">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-bold">Selecciona un estudiante para configurar sus alarmas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                <p className="text-xs font-black uppercase tracking-widest text-[#7C3AED]">Configuración</p>
                <h3 className="font-black text-[#2B2E4A] text-xl">Alarmas inteligentes</h3>
                <p className="text-[#9094A6] text-sm font-bold mt-1">
                    Ajusta hora, días y sonido. Los cambios se aplican al instante en la app.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-3 text-sm font-bold">{error}</div>
            )}

            {alarms.length === 0 && !error && (
                <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-100 text-center">
                    <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-bold">No hay alarmas configuradas todavía.</p>
                    <p className="text-gray-400 text-sm mt-1">Se crean automáticamente al abrir la app del estudiante.</p>
                </div>
            )}

            {alarms.map(alarm => {
                const meta = ALARM_META[alarm.alarm_type] || { label: alarm.alarm_type, desc: '', color: '#6B7280', bg: '#F9FAFB', icon: Bell };
                const Icon = meta.icon;
                const isSaving = savingId === alarm.alarm_id;
                const isSaved = savedId === alarm.alarm_id;
                const disabled = alarm.enabled === false;
                return (
                    <div key={alarm.alarm_id} className={`bg-white rounded-3xl p-5 shadow-md border transition-all ${disabled ? 'border-gray-100 opacity-70' : 'border-gray-100'}`}>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg }}>
                                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                                </div>
                                <div>
                                    <h4 className="font-black text-[#2B2E4A]">{meta.label}</h4>
                                    <p className="text-[#9094A6] text-xs font-bold mt-0.5">{meta.desc}</p>
                                </div>
                            </div>
                            {/* Toggle activar */}
                            <button
                                onClick={() => updateLocal(alarm.alarm_id, { enabled: disabled })}
                                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${disabled ? 'bg-gray-300' : 'bg-[#7C3AED]'}`}
                                aria-label="Activar alarma"
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${disabled ? 'left-1' : 'left-6'}`} />
                            </button>
                        </div>

                        {/* Hora */}
                        <div className="flex items-center gap-3 mb-4">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <input
                                type="time"
                                value={`${pad(alarm.hour)}:${pad(alarm.minute)}`}
                                onChange={(e) => {
                                    const [h, m] = e.target.value.split(':');
                                    updateLocal(alarm.alarm_id, { hour: Number(h), minute: Number(m) });
                                }}
                                className="font-black text-lg text-[#2B2E4A] bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:border-[#7C3AED] outline-none"
                            />
                        </div>

                        {/* Días */}
                        <div className="mb-4">
                            <p className="text-xs font-black uppercase tracking-wide text-gray-400 mb-2">Días</p>
                            <div className="flex gap-1.5 flex-wrap">
                                {DAYS.map(d => {
                                    const active = alarm.days_active.includes(d.key);
                                    return (
                                        <button
                                            key={d.key}
                                            onClick={() => toggleDay(alarm, d.key)}
                                            className={`w-9 h-9 rounded-xl font-black text-sm transition-all ${active ? 'bg-[#7C3AED] text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                        >
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sonido */}
                        <div className="mb-4">
                            <p className="text-xs font-black uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                                <Volume2 className="w-3.5 h-3.5" /> Sonido
                            </p>
                            <div className="flex gap-1.5">
                                {SOUNDS.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => updateLocal(alarm.alarm_id, { sound: s.key })}
                                        className={`px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${(alarm.sound || 'urgente') === s.key ? 'bg-[#2B2E4A] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Guardar */}
                        <button
                            onClick={() => saveAlarm(alarm)}
                            disabled={isSaving}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black transition-all ${isSaved ? 'bg-green-500 text-white' : 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'} ${isSaving ? 'opacity-60' : ''}`}
                        >
                            {isSaving ? (
                                <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Guardando…</>
                            ) : isSaved ? (
                                <><Check className="w-4 h-4" /> Guardado</>
                            ) : (
                                <><Save className="w-4 h-4" /> Guardar cambios</>
                            )}
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default AlarmSettings;
