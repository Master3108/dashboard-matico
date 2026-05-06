import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Clock, BookOpen, CheckCircle, AlertTriangle, Trash2,
    ChevronLeft, ChevronRight, Bell, User, LogOut, TrendingUp,
    Award, Target, BarChart3, Plus, Mic, Send, Image, Camera,
    MessageCircle, Sparkles, RefreshCw, Shield
} from 'lucide-react';
import ChatEventCreator from './ChatEventCreator';
import CalendarView from './CalendarView';
import MaticoAgent from './MaticoAgent';

const EVENT_TYPE_CONFIG = {
    prueba: { label: 'Prueba', color: '#EF4444', bg: '#FEF2F2', emoji: '📝' },
    tarea: { label: 'Tarea', color: '#F59E0B', bg: '#FFFBEB', emoji: '📚' },
    estudio: { label: 'Estudio', color: '#3B82F6', bg: '#EFF6FF', emoji: '🧠' },
    repaso: { label: 'Repaso', color: '#8B5CF6', bg: '#F5F3FF', emoji: '🔄' },
    otro: { label: 'Otro', color: '#6B7280', bg: '#F9FAFB', emoji: '📌' }
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

const ParentDashboard = ({ currentUser, onLogout, isAdmin = false, onSwitchToAdmin = null }) => {
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [events, setEvents] = useState([]);
    const [progress, setProgress] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('resumen');
    const [weekOffset, setWeekOffset] = useState(0);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [creatorIntent, setCreatorIntent] = useState('evento');
    const [showCalendarView, setShowCalendarView] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [maticoMood, setMaticoMood] = useState('happy');

    // Fetch profile + children
    const fetchProfile = useCallback(async () => {
        if (!currentUser?.user_id) return;
        try {
            const res = await fetch(`/api/profile?user_id=${currentUser.user_id}`);
            const data = await res.json();
            if (data.success && data.children?.length > 0) {
                setChildren(data.children);
                if (!selectedChild) setSelectedChild(data.children[0]);
            }
        } catch (err) {
            console.error('[PARENT] Error cargando perfil:', err);
        }
    }, [currentUser?.user_id]);

    // Fetch child events (or own events if no child linked)
    const fetchChildEvents = useCallback(async () => {
        const targetUserId = selectedChild?.user_id || currentUser?.user_id;
        if (!targetUserId) return;
        try {
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1 + (weekOffset * 7));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 13);

            const from_date = startOfWeek.toISOString().split('T')[0];
            const to_date = endOfWeek.toISOString().split('T')[0];

            // If no child linked, query as apoderado to see events created by this user
            const queryRole = selectedChild?.user_id ? 'estudiante' : 'apoderado';
            const params = new URLSearchParams({
                user_id: targetUserId,
                role: queryRole,
                from_date,
                to_date,
                limit: '100'
            });

            const res = await fetch(`/api/calendar/events?${params}`);
            const data = await res.json();
            if (data.success) setEvents(data.events || []);
        } catch (err) {
            console.error('[PARENT] Error cargando eventos:', err);
        }
    }, [selectedChild?.user_id, currentUser?.user_id, weekOffset]);

    // Fetch child progress
    const fetchChildProgress = useCallback(async () => {
        if (!selectedChild?.user_id) return;
        try {
            const res = await fetch(`/api/progress/child?child_user_id=${selectedChild.user_id}&limit=50`);
            const data = await res.json();
            if (data.success) setProgress(data.progress || []);
        } catch (err) {
            console.error('[PARENT] Error cargando progreso:', err);
        }
    }, [selectedChild?.user_id]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!currentUser?.user_id) return;
        try {
            const res = await fetch(`/api/notifications?user_id=${currentUser.user_id}&limit=20`);
            const data = await res.json();
            if (data.success) setNotifications(data.notifications || []);
        } catch (err) {
            console.error('[PARENT] Error cargando notificaciones:', err);
        }
    }, [currentUser?.user_id]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await fetchProfile();
            setLoading(false);
        };
        load();
    }, [fetchProfile]);

    useEffect(() => {
        if (selectedChild) {
            fetchChildEvents();
            fetchChildProgress();
        }
    }, [selectedChild, fetchChildEvents, fetchChildProgress]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchChildEvents(), fetchChildProgress(), fetchNotifications()]);
        setRefreshing(false);
    };

    const openSmartCreator = (intent = 'evento') => {
        setCreatorIntent(intent);
        setShowCreateEventModal(true);
    };

    // --- Compute stats ---
    const totalQuizzes = progress.filter(p => p.event_type === 'quiz_completed' || p.event_type === 'session_completed').length;
    const avgScore = totalQuizzes > 0
        ? Math.round(progress.filter(p => p.score != null).reduce((sum, p) => sum + (p.score || 0), 0) / Math.max(progress.filter(p => p.score != null).length, 1))
        : 0;
    const totalXP = progress.reduce((sum, p) => sum + (p.xp || 0), 0);
    const pendingEvents = events.filter(e => e.status === 'pendiente').length;
    const completedEvents = events.filter(e => e.status === 'completado').length;

    // Group events by date
    const groupedEvents = {};
    events.forEach(e => {
        const key = e.event_date;
        if (!groupedEvents[key]) groupedEvents[key] = [];
        groupedEvents[key].push(e);
    });
    const sortedDates = Object.keys(groupedEvents).sort();

    // Recent progress (last 10)
    const recentProgress = progress.slice(0, 10);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#F0F4FF] to-[#E8ECF5] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#9094A6] font-bold">Cargando panel de apoderado...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F0F4FF] to-[#E8ECF5]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#7C3AED] to-[#4D96FF] px-4 py-4 shadow-lg">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Mini Matico in header */}
                        <div className="w-11 h-11 relative flex items-center justify-center">
                            <div className="absolute top-0 -left-0.5 w-3 h-4 bg-[#FFD93D] rounded-b-[20px] rounded-t-[6px] rotate-[-10deg]"></div>
                            <div className="absolute top-0 -right-0.5 w-3 h-4 bg-[#FFD93D] rounded-b-[20px] rounded-t-[6px] rotate-[10deg]"></div>
                            <div className="absolute inset-[8%] bg-[#FFD93D] rounded-[45%] shadow-md"></div>
                            <div className="relative flex flex-col items-center justify-center z-10 translate-y-0.5">
                                <div className="flex gap-2 mb-0.5">
                                    <div className="w-1.5 h-2 bg-[#2B2E4A] rounded-full"></div>
                                    <div className="w-1.5 h-2 bg-[#2B2E4A] rounded-full"></div>
                                </div>
                                <div className="w-2 h-1 bg-[#2B2E4A] rounded-t-full rounded-b-[50%]"></div>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-white font-black text-lg">Hola, {(currentUser?.username || 'Apoderado').split(' ')[0]}</h1>
                            <p className="text-white/70 text-xs font-bold">Panel de seguimiento</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5 text-white" />
                        </button>
                        <div className="relative">
                            <Bell className="w-5 h-5 text-white" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                                    {notifications.length}
                                </span>
                            )}
                        </div>
                        {isAdmin && onSwitchToAdmin && (
                            <button
                                onClick={onSwitchToAdmin}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/90 hover:bg-amber-300 text-[#2B2E4A] font-bold text-xs transition-all shadow-md"
                                title="Cambiar a vista Admin"
                            >
                                <Shield className="w-4 h-4" />
                                Admin
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                        >
                            <LogOut className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Child selector (if multiple) */}
            {children.length > 1 && (
                <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
                    {children.map(child => (
                        <button
                            key={child.user_id}
                            onClick={() => setSelectedChild(child)}
                            className={`px-4 py-2 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                                selectedChild?.user_id === child.user_id
                                    ? 'bg-[#7C3AED] text-white shadow-lg'
                                    : 'bg-white text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {child.display_name || child.email}
                        </button>
                    ))}
                </div>
            )}

            {/* Child info card */}
            {selectedChild && (
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-[#7C3AED] to-[#4D96FF] rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl">👦</span>
                            </div>
                            <div>
                                <h2 className="font-black text-[#2B2E4A] text-xl">{selectedChild.display_name || 'Estudiante'}</h2>
                                <p className="text-[#9094A6] text-sm font-bold">{selectedChild.email}</p>
                            </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-3 text-center">
                                <Award className="w-6 h-6 text-[#7C3AED] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#7C3AED]">{totalXP}</p>
                                <p className="text-xs font-bold text-[#9094A6]">XP Total</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl p-3 text-center">
                                <Target className="w-6 h-6 text-[#3B82F6] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#3B82F6]">{totalQuizzes}</p>
                                <p className="text-xs font-bold text-[#9094A6]">Quizzes</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] rounded-2xl p-3 text-center">
                                <TrendingUp className="w-6 h-6 text-[#10B981] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#10B981]">{avgScore}%</p>
                                <p className="text-xs font-bold text-[#9094A6]">Promedio</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FFEDD5] rounded-2xl p-3 text-center">
                                <Calendar className="w-6 h-6 text-[#F59E0B] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#F59E0B]">{pendingEvents}</p>
                                <p className="text-xs font-bold text-[#9094A6]">Pendientes</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="max-w-5xl mx-auto px-4 py-2">
                <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm">
                    {[
                        { key: 'resumen', label: 'Resumen', icon: BarChart3 },
                        { key: 'calendario', label: 'Calendario', icon: Calendar },
                        { key: 'progreso', label: 'Progreso', icon: TrendingUp },
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-[#7C3AED] text-white shadow-md'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab content */}
            <div className="max-w-5xl mx-auto px-4 py-3 pb-24">
                {/* RESUMEN */}
                {activeTab === 'resumen' && (
                    <div className="space-y-4">
                        {/* Upcoming events */}
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-[#2B2E4A]">Próximos eventos</h3>
                                <button
                                    onClick={() => openSmartCreator('evento')}
                                    className="flex items-center gap-1 bg-[#4D96FF] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#3B82F6] transition-all"
                                >
                                    <Plus className="w-3 h-3" /> Crear
                                </button>
                            </div>
                            {events.filter(e => e.status === 'pendiente').length === 0 ? (
                                <div className="text-center py-6 text-gray-300">
                                    <Calendar className="w-10 h-10 mx-auto mb-2" />
                                    <p className="font-bold text-sm">No hay eventos pendientes</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {events
                                        .filter(e => e.status === 'pendiente')
                                        .sort((a, b) => a.event_date.localeCompare(b.event_date))
                                        .slice(0, 5)
                                        .map(event => {
                                            const typeConf = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.otro;
                                            return (
                                                <div key={event.event_id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ backgroundColor: typeConf.bg }}>
                                                    <span className="text-xl">{typeConf.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-[#2B2E4A] text-sm truncate">{event.title}</p>
                                                        <p className="text-xs text-gray-500 font-bold">
                                                            {formatDate(event.event_date)}
                                                            {event.start_time ? ` · ${formatTime(event.start_time)}` : ''}
                                                            {event.subject ? ` · ${event.subject}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-black px-2 py-0.5 rounded-lg text-white" style={{ backgroundColor: typeConf.color }}>
                                                        {typeConf.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Recent activity */}
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <h3 className="font-black text-[#2B2E4A] mb-4">Actividad reciente</h3>
                            {recentProgress.length === 0 ? (
                                <div className="text-center py-6 text-gray-300">
                                    <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                                    <p className="font-bold text-sm">Sin actividad reciente</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentProgress.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                (p.score || 0) >= 70 ? 'bg-green-100' : (p.score || 0) >= 40 ? 'bg-yellow-100' : 'bg-red-100'
                                            }`}>
                                                {(p.score || 0) >= 70 ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                                                 (p.score || 0) >= 40 ? <Clock className="w-4 h-4 text-yellow-500" /> :
                                                 <AlertTriangle className="w-4 h-4 text-red-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-[#2B2E4A] truncate">
                                                    {p.topic || p.subject || p.event_type || 'Actividad'}
                                                </p>
                                                <p className="text-xs text-gray-400 font-bold">
                                                    {p.subject} · {p.created_at ? new Date(p.created_at).toLocaleDateString('es-CL') : ''}
                                                </p>
                                            </div>
                                            {p.score != null && (
                                                <span className={`text-sm font-black ${
                                                    p.score >= 70 ? 'text-green-500' : p.score >= 40 ? 'text-yellow-500' : 'text-red-500'
                                                }`}>
                                                    {p.score}%
                                                </span>
                                            )}
                                            {p.xp > 0 && (
                                                <span className="text-xs font-bold text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-lg">
                                                    +{p.xp} XP
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        {notifications.length > 0 && (
                            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                                <h3 className="font-black text-[#2B2E4A] mb-4 flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-[#F59E0B]" />
                                    Notificaciones
                                </h3>
                                <div className="space-y-2">
                                    {notifications.slice(0, 5).map(n => (
                                        <div key={n.notif_id} className="p-3 bg-yellow-50 rounded-2xl border border-yellow-100">
                                            <p className="font-bold text-sm text-[#2B2E4A]">{n.title}</p>
                                            <p className="text-xs text-gray-500">{n.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CALENDARIO */}
                {activeTab === 'calendario' && (
                    <div className="space-y-4">
                        {/* Week navigation */}
                        <div className="bg-white rounded-3xl p-4 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-gray-100 rounded-xl">
                                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                                </button>
                                <button
                                    onClick={() => setWeekOffset(0)}
                                    className="text-sm font-bold text-[#7C3AED] hover:underline"
                                >
                                    {weekOffset === 0 ? 'Esta semana' : 'Volver a hoy'}
                                </button>
                                <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 hover:bg-gray-100 rounded-xl">
                                    <ChevronRight className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={() => openSmartCreator('evento')}
                                    className="flex items-center gap-1 bg-[#4D96FF] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#3B82F6] transition-all"
                                >
                                    <Plus className="w-3 h-3" /> Crear evento
                                </button>
                            </div>

                            {sortedDates.length === 0 ? (
                                <div className="text-center py-8 text-gray-300">
                                    <Calendar className="w-12 h-12 mx-auto mb-3" />
                                    <p className="font-bold">No hay eventos para este periodo</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {sortedDates.map(date => (
                                        <div key={date}>
                                            <div className={`text-sm font-black uppercase tracking-widest mb-2 ${
                                                isToday(date) ? 'text-[#7C3AED]' : isPast(date) ? 'text-gray-400' : 'text-[#9094A6]'
                                            }`}>
                                                {isToday(date) ? '● HOY — ' : ''}{formatDate(date)}
                                            </div>
                                            <div className="space-y-2">
                                                {groupedEvents[date].map(event => {
                                                    const typeConf = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.otro;
                                                    const statusConf = STATUS_CONFIG[event.status] || STATUS_CONFIG.pendiente;
                                                    return (
                                                        <div
                                                            key={event.event_id}
                                                            className="rounded-2xl border-2 p-4 transition-all hover:shadow-md"
                                                            style={{ borderColor: typeConf.color + '40', backgroundColor: typeConf.bg }}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                        <span className="text-xs font-black px-2 py-0.5 rounded-lg text-white" style={{ backgroundColor: typeConf.color }}>
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
                                                                    </div>
                                                                    <h4 className="font-black text-[#2B2E4A] truncate">{event.title}</h4>
                                                                    {event.description && (
                                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: statusConf.color + '20', color: statusConf.color }}>
                                                                        {statusConf.label}
                                                                    </span>
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
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PROGRESO */}
                {activeTab === 'progreso' && (
                    <div className="space-y-4">
                        {/* Score distribution */}
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <h3 className="font-black text-[#2B2E4A] mb-4">Historial de evaluaciones</h3>
                            {progress.filter(p => p.score != null).length === 0 ? (
                                <div className="text-center py-8 text-gray-300">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-3" />
                                    <p className="font-bold">Sin evaluaciones registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {progress.filter(p => p.score != null).map((p, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                                                p.score >= 70 ? 'bg-green-100 text-green-600' :
                                                p.score >= 40 ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-red-100 text-red-600'
                                            }`}>
                                                {p.score}%
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-[#2B2E4A] truncate">
                                                    {p.topic || p.event_type || 'Quiz'}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {p.subject} · {p.total_questions ? `${p.correct_answers || 0}/${p.total_questions} correctas` : ''}
                                                    {p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString('es-CL')}` : ''}
                                                </p>
                                            </div>
                                            {p.xp > 0 && (
                                                <span className="text-xs font-bold text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-lg">
                                                    +{p.xp} XP
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Weaknesses */}
                        {progress.filter(p => p.weakness).length > 0 && (
                            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                                <h3 className="font-black text-[#2B2E4A] mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                                    Áreas a reforzar
                                </h3>
                                <div className="space-y-2">
                                    {progress.filter(p => p.weakness).slice(0, 5).map((p, i) => {
                                        const weakness = typeof p.weakness === 'string' ? p.weakness : JSON.stringify(p.weakness);
                                        return (
                                            <div key={i} className="p-3 bg-yellow-50 rounded-2xl border border-yellow-100">
                                                <p className="text-xs font-bold text-gray-500">{p.subject} · {p.topic}</p>
                                                <p className="text-sm text-[#2B2E4A] mt-1">{weakness}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Matico Agent - Agente conversacional con perrito */}
            <MaticoAgent
                userId={currentUser?.user_id}
                userRole="apoderado"
                studentUserId={selectedChild?.user_id}
                studentName={selectedChild?.display_name || 'tu hijo'}
                onEventCreated={(event) => {
                    console.log('[PARENT] Evento creado via Matico:', event);
                    fetchChildEvents();
                }}
            />

            {/* Floating buttons (right side) */}
            <div className="fixed bottom-6 right-4 z-[200] flex flex-col gap-3">
                <button
                    onClick={() => openSmartCreator('evento')}
                    className="bg-[#4D96FF] text-white px-4 py-3 rounded-2xl font-black text-sm shadow-[0_10px_25px_rgba(77,150,255,0.35)] hover:bg-[#3B82F6] hover:scale-105 transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Crear evento
                </button>
                <button
                    onClick={() => openSmartCreator('prueba')}
                    className="bg-[#EF4444] text-white px-4 py-3 rounded-2xl font-black text-sm shadow-[0_10px_25px_rgba(239,68,68,0.35)] hover:bg-[#DC2626] hover:scale-105 transition-all flex items-center gap-2"
                >
                    <BookOpen className="w-4 h-4" />
                    Crear prueba
                </button>
                <button
                    onClick={() => setShowCalendarView(true)}
                    className="bg-[#10B981] text-white px-4 py-3 rounded-2xl font-black text-sm shadow-[0_10px_25px_rgba(16,185,129,0.45)] hover:bg-[#059669] hover:scale-105 transition-all flex items-center gap-2"
                >
                    <Calendar className="w-4 h-4" />
                    Calendario
                </button>
            </div>

            {/* Calendar View Modal */}
            <CalendarView
                isOpen={showCalendarView}
                onClose={() => setShowCalendarView(false)}
                userId={selectedChild?.user_id || currentUser?.user_id}
                userRole="apoderado"
            />

            <ChatEventCreator
                isOpen={showCreateEventModal}
                onClose={() => setShowCreateEventModal(false)}
                userId={currentUser?.user_id}
                userRole="apoderado"
                studentUserId={selectedChild?.user_id || currentUser?.user_id}
                studentName={selectedChild?.display_name || 'tu hijo'}
                intent={creatorIntent}
                onEventCreated={() => {
                    fetchChildEvents();
                    fetchNotifications();
                }}
            />
        </div>
    );
};

export default ParentDashboard;
