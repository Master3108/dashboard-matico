import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/authFetch';
import { Calendar, Clock, BookOpen, CheckCircle, AlertTriangle, Trash2, ChevronLeft, ChevronRight, History } from 'lucide-react';

const EVENT_TYPE_CONFIG = {
    prueba: { label: 'Prueba', color: '#EF4444', bg: '#FEF2F2' },
    tarea: { label: 'Tarea', color: '#F59E0B', bg: '#FFFBEB' },
    estudio: { label: 'Estudio', color: '#3B82F6', bg: '#EFF6FF' },
    repaso: { label: 'Repaso', color: '#8B5CF6', bg: '#F5F3FF' },
    otro: { label: 'Otro', color: '#6B7280', bg: '#F9FAFB' }
};

const STATUS_CONFIG = {
    pendiente: { label: 'Pendiente', color: '#F59E0B', icon: Clock },
    en_progreso: { label: 'En progreso', color: '#3B82F6', icon: BookOpen },
    completado: { label: 'Completado', color: '#10B981', icon: CheckCircle },
    cancelado: { label: 'Cancelado', color: '#EF4444', icon: AlertTriangle }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
};

const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
};

const isPast = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
};

const EventCard = ({ event, onStatusChange, onDelete }) => {
    const typeConf = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.otro;
    const statusConf = STATUS_CONFIG[event.status] || STATUS_CONFIG.pendiente;
    const StatusIcon = statusConf.icon;

    return (
        <div
            className="rounded-2xl border-2 p-4 transition-all hover:shadow-md"
            style={{ borderColor: typeConf.color + '40', backgroundColor: typeConf.bg }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                            className="text-xs font-black px-2 py-0.5 rounded-lg text-white"
                            style={{ backgroundColor: typeConf.color }}
                        >
                            {typeConf.label}
                        </span>
                        {event.subject && (
                            <span className="text-xs font-bold text-gray-500">{event.subject}</span>
                        )}
                        {event.start_time && (
                            <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(event.start_time)}
                                {event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
                            </span>
                        )}
                        <span
                            className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={{ color: statusConf.color, backgroundColor: statusConf.color + '15' }}
                        >
                            {statusConf.label}
                        </span>
                    </div>
                    <h4 className="font-black text-[#2B2E4A] truncate">{event.title}</h4>
                    {event.description && event.description !== event.title && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {event.status === 'pendiente' && (
                        <button
                            onClick={() => onStatusChange(event.event_id, 'completado')}
                            className="p-2 rounded-xl hover:bg-green-100 transition-colors"
                            title="Marcar completado"
                        >
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </button>
                    )}
                    {event.status === 'completado' && (
                        <button
                            onClick={() => onStatusChange(event.event_id, 'pendiente')}
                            className="p-2 rounded-xl hover:bg-yellow-100 transition-colors"
                            title="Volver a pendiente"
                        >
                            <StatusIcon className="w-5 h-5" style={{ color: statusConf.color }} />
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(event.event_id)}
                        className="p-2 rounded-xl hover:bg-red-100 transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            </div>

            {event.status === 'completado' && event.result_score != null && (
                <div className="mt-2 bg-white/60 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">Resultado:</span>
                    <span className="text-sm font-black text-[#2B2E4A]">{event.result_score}%</span>
                </div>
            )}
        </div>
    );
};

const CalendarView = ({ userId, userRole = 'estudiante', isOpen, onClose }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('todos'); // todos, pendiente, completado
    const [yearOffset, setYearOffset] = useState(0);
    const [showPast, setShowPast] = useState(false);
    const todayRef = useRef(null);

    const fetchEvents = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const year = new Date().getFullYear() + yearOffset;
            const from_date = `${year}-01-01`;
            const to_date = `${year}-12-31`;

            const params = new URLSearchParams({
                user_id: userId,
                role: userRole,
                from_date,
                to_date,
                limit: '500'
            });

            const res = await authFetch(`/api/calendar/events?${params}`);
            const data = await res.json();
            if (data.success) setEvents(data.events || []);
        } catch (err) {
            console.error('[CALENDAR] Error cargando eventos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchEvents();
    }, [isOpen, userId, yearOffset]);

    const handleStatusChange = async (eventId, newStatus) => {
        try {
            const res = await authFetch(`/api/calendar/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setEvents(prev => prev.map(e => e.event_id === eventId ? { ...e, status: newStatus } : e));
            }
        } catch (err) {
            console.error('[CALENDAR] Error actualizando estado:', err);
        }
    };

    const handleDelete = async (eventId) => {
        if (!confirm('¿Eliminar este evento?')) return;
        try {
            const res = await authFetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setEvents(prev => prev.filter(e => e.event_id !== eventId));
            }
        } catch (err) {
            console.error('[CALENDAR] Error eliminando evento:', err);
        }
    };

    if (!isOpen) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const filtered = filter === 'todos' ? events : events.filter(e => e.status === filter);

    // Separar pasados y futuros (hoy incluido en futuros)
    const futureEvents = filtered.filter(e => e.event_date >= todayStr);
    const pastEvents = filtered.filter(e => e.event_date < todayStr);
    const pastCount = pastEvents.length;

    // Agrupar futuros
    const groupedFuture = {};
    futureEvents.forEach(e => {
        const key = e.event_date;
        if (!groupedFuture[key]) groupedFuture[key] = [];
        groupedFuture[key].push(e);
    });
    const sortedFutureDates = Object.keys(groupedFuture).sort();

    // Agrupar pasados (orden cronológico inverso — más reciente primero)
    const groupedPast = {};
    pastEvents.forEach(e => {
        const key = e.event_date;
        if (!groupedPast[key]) groupedPast[key] = [];
        groupedPast[key].push(e);
    });
    const sortedPastDates = Object.keys(groupedPast).sort().reverse();

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#4D96FF] to-[#7C3AED] px-6 py-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-white" />
                        <h3 className="text-xl font-black text-white">Calendario</h3>
                    </div>
                    <button onClick={onClose} className="text-white font-bold text-2xl hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                        ✕
                    </button>
                </div>

                {/* Navegación semana */}
                <div className="px-6 py-3 flex items-center justify-between border-b border-gray-100 shrink-0">
                    <button onClick={() => setYearOffset(y => y - 1)} className="p-2 hover:bg-gray-100 rounded-xl">
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                        onClick={() => setYearOffset(0)}
                        className="text-sm font-bold text-[#7C3AED] hover:underline"
                    >
                        Año escolar {new Date().getFullYear() + yearOffset}
                    </button>
                    <button onClick={() => setYearOffset(y => y + 1)} className="p-2 hover:bg-gray-100 rounded-xl">
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Filtros */}
                <div className="px-6 py-3 flex items-center justify-between shrink-0">
                    <div className="flex gap-2">
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'pendiente', label: 'Pendientes' },
                            { key: 'completado', label: 'Completados' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                    filter === f.key
                                        ? 'bg-[#7C3AED] text-white'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {pastCount > 0 && (
                        <button
                            onClick={() => setShowPast(p => !p)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                                showPast
                                    ? 'bg-gray-700 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            <History className="w-3.5 h-3.5" />
                            Pasados ({pastCount})
                        </button>
                    )}
                </div>

                {/* Lista de eventos */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400 font-bold">Cargando eventos...</div>
                    ) : sortedFutureDates.length === 0 && !showPast ? (
                        <div className="text-center py-12">
                            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold">No hay eventos próximos</p>
                            {pastCount > 0 && (
                                <button
                                    onClick={() => setShowPast(true)}
                                    className="mt-3 text-sm text-[#7C3AED] font-bold hover:underline"
                                >
                                    Ver {pastCount} evento(s) pasado(s)
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Eventos próximos (desde hoy) */}
                            {sortedFutureDates.map(date => (
                                <div key={date} ref={isToday(date) ? todayRef : null}>
                                    <div className={`text-sm font-black uppercase tracking-widest mb-2 ${
                                        isToday(date) ? 'text-[#7C3AED]' : 'text-[#9094A6]'
                                    }`}>
                                        {isToday(date) ? '● HOY — ' : ''}{formatDate(date)}
                                    </div>
                                    <div className="space-y-2">
                                        {groupedFuture[date].map(event => (
                                            <EventCard
                                                key={event.event_id}
                                                event={event}
                                                onStatusChange={handleStatusChange}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Sección de eventos pasados (colapsable) */}
                            {showPast && sortedPastDates.length > 0 && (
                                <>
                                    <div className="flex items-center gap-3 pt-4 pb-1">
                                        <div className="flex-1 h-px bg-gray-200" />
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Eventos pasados</span>
                                        <div className="flex-1 h-px bg-gray-200" />
                                    </div>
                                    {sortedPastDates.map(date => (
                                        <div key={date} className="opacity-60">
                                            <div className="text-sm font-black uppercase tracking-widest mb-2 text-gray-400">
                                                {formatDate(date)}
                                            </div>
                                            <div className="space-y-2">
                                                {groupedPast[date].map(event => (
                                                    <EventCard
                                                        key={event.event_id}
                                                        event={event}
                                                        onStatusChange={handleStatusChange}
                                                        onDelete={handleDelete}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>
            </