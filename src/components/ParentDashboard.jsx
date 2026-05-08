import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Clock, BookOpen, CheckCircle, AlertTriangle, Trash2,
    ChevronLeft, ChevronRight, Bell, User, LogOut, TrendingUp,
    Award, Target, BarChart3, Plus, Mic, Send, Image, Camera,
    MessageCircle, Sparkles, RefreshCw, Shield, FileText
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
    const [yearOffset, setYearOffset] = useState(0);
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [creatorIntent, setCreatorIntent] = useState('evento');
    const [showCalendarView, setShowCalendarView] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [maticoMood, setMaticoMood] = useState('happy');
    const [studySessions, setStudySessions] = useState([]);
    const [activeStudy, setActiveStudy] = useState(null);
    const [studentHistory, setStudentHistory] = useState({ summary: {}, items: [] });
    const [dailyReport, setDailyReport] = useState(null);
    const [timelineRange, setTimelineRange] = useState('7d');
    const [timelineSubject, setTimelineSubject] = useState('TODAS');
    const [timelineType, setTimelineType] = useState('todos');
    const [summaryRangeFilter, setSummaryRangeFilter] = useState('today');
    const [summarySubjectFilter, setSummarySubjectFilter] = useState('TODAS');
    const [summaryFromDate, setSummaryFromDate] = useState('');
    const [summaryToDate, setSummaryToDate] = useState('');
    const [customFromDate, setCustomFromDate] = useState('');
    const [customToDate, setCustomToDate] = useState('');
    const [historySubjectFilter, setHistorySubjectFilter] = useState('TODAS');
    const [historyTypeFilter, setHistoryTypeFilter] = useState('todos');
    const [historyRangeFilter, setHistoryRangeFilter] = useState('30d');
    const [historyOnlyErrors, setHistoryOnlyErrors] = useState(false);
    const [historyOnlyEvidence, setHistoryOnlyEvidence] = useState(false);
    const [expandedHistoryItems, setExpandedHistoryItems] = useState({});

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
            const year = new Date().getFullYear() + yearOffset;
            const from_date = `${year}-01-01`;
            const to_date = `${year}-12-31`;

            // If no child linked, query as apoderado to see events created by this user
            const queryRole = selectedChild?.user_id ? 'estudiante' : 'apoderado';
            const params = new URLSearchParams({
                user_id: targetUserId,
                role: queryRole,
                from_date,
                to_date,
                limit: '500'
            });

            const res = await fetch(`/api/calendar/events?${params}`);
            const data = await res.json();
            if (data.success) setEvents(data.events || []);
        } catch (err) {
            console.error('[PARENT] Error cargando eventos:', err);
        }
    }, [selectedChild?.user_id, currentUser?.user_id, yearOffset]);

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

    // Fetch study sessions
    const fetchStudySessions = useCallback(async () => {
        const targetUserId = selectedChild?.user_id || currentUser?.user_id;
        const targetEmail = selectedChild?.email || currentUser?.email || '';
        const parentEmail = currentUser?.email || '';
        if (!targetUserId && !targetEmail) return;
        try {
            const fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
            fromDate.setDate(fromDate.getDate() - 6);
            const params = new URLSearchParams({ from_date: fromDate.toISOString() });
            if (targetUserId) params.set('student_user_id', targetUserId);
            if (targetEmail) params.set('student_email', targetEmail);
            if (parentEmail) params.set('parent_email', parentEmail);
            const res = await fetch(`/api/study-sessions?${params}`);
            const data = await res.json();
            if (data.success) setStudySessions(data.sessions || []);
        } catch (err) {
            console.error('[PARENT] Error cargando study sessions:', err);
        }
        // Check active session
        try {
            const res2 = await fetch(`/api/study-sessions/active?student_user_id=${targetUserId}`);
            const data2 = await res2.json();
            setActiveStudy(data2.success && data2.is_studying ? data2.session : null);
        } catch (_) {}
    }, [selectedChild?.user_id, selectedChild?.email, currentUser?.user_id, currentUser?.email]);

    const fetchStudentHistory = useCallback(async () => {
        const targetUserId = selectedChild?.user_id || currentUser?.user_id;
        const targetEmail = selectedChild?.email || currentUser?.email || '';
        const parentEmail = currentUser?.email || '';
        if (!targetUserId && !targetEmail) return;

        try {
            const params = new URLSearchParams({ limit: '120' });
            if (targetUserId) params.set('student_user_id', targetUserId);
            if (targetEmail) params.set('student_email', targetEmail);
            if (parentEmail) params.set('parent_email', parentEmail);

            const res = await fetch(`/api/parent/student-history?${params}`);
            const data = await res.json();
            if (data.success) {
                setStudentHistory({
                    summary: data.summary || {},
                    items: data.items || []
                });
            }
        } catch (err) {
            console.error('[PARENT] Error cargando antecedentes:', err);
        }
    }, [selectedChild?.user_id, selectedChild?.email, currentUser?.user_id, currentUser?.email]);

    const fetchDailyReport = useCallback(async () => {
        const targetUserId = selectedChild?.user_id || currentUser?.user_id;
        if (!targetUserId) return;
        try {
            const params = new URLSearchParams({ student_user_id: targetUserId });
            const res = await fetch(`/api/parent/daily-report?${params}`);
            const data = await res.json();
            if (data.success) setDailyReport(data.report || null);
        } catch (err) {
            console.error('[PARENT] Error cargando reporte diario:', err);
        }
    }, [selectedChild?.user_id, currentUser?.user_id]);

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
            fetchStudySessions();
            fetchStudentHistory();
            fetchDailyReport();
        } else if (currentUser?.user_id) {
            fetchChildEvents();
            fetchStudySessions();
            fetchStudentHistory();
            fetchDailyReport();
        }
    }, [selectedChild, currentUser?.user_id, fetchChildEvents, fetchChildProgress, fetchStudySessions, fetchStudentHistory, fetchDailyReport]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchChildEvents(), fetchChildProgress(), fetchNotifications(), fetchStudentHistory(), fetchDailyReport()]);
        setRefreshing(false);
    };

    const openSmartCreator = (intent = 'evento') => {
        setCreatorIntent(intent);
        setShowCreateEventModal(true);
    };

    const handleDeleteEvent = async (event) => {
        const title = event?.title || 'este evento';
        if (!confirm(`Eliminar "${title}" del calendario?`)) return;

        try {
            const res = await fetch(`/api/calendar/events/${event.event_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setEvents(prev => prev.filter(item => item.event_id !== event.event_id));
            } else {
                alert(data.error || 'No se pudo eliminar el evento.');
            }
        } catch (err) {
            console.error('[PARENT] Error eliminando evento:', err);
            alert('No se pudo eliminar el evento.');
        }
    };

    const handleCleanDuplicates = async () => {
        const targetUserId = selectedChild?.user_id || currentUser?.user_id;
        if (!targetUserId) return;
        if (!confirm('Limpiar eventos duplicados del año escolar mostrado? Se conservará un solo registro de cada evento.')) return;

        const year = new Date().getFullYear() + yearOffset;
        try {
            const res = await fetch('/api/calendar/dedupe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: targetUserId,
                    role: selectedChild?.user_id ? 'estudiante' : 'apoderado',
                    from_date: `${year}-01-01`,
                    to_date: `${year}-12-31`
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Listo: se eliminaron ${data.deleted || 0} duplicado(s).`);
                await fetchChildEvents();
            } else {
                alert(data.error || 'No se pudieron limpiar duplicados.');
            }
        } catch (err) {
            console.error('[PARENT] Error limpiando duplicados:', err);
            alert('No se pudieron limpiar duplicados.');
        }
    };

    // --- Compute stats ---
    const historyItems = studentHistory.items || [];

    // Quizzes: solo contar evaluaciones realmente completadas
    const completedQuizTypes = new Set(['session_completed', 'prep_exam_completed', 'prep_exam_reviewed']);
    const totalQuizzes = historyItems.filter(item =>
        item.source === 'quiz' ||
        completedQuizTypes.has(item.type)
    ).length || progress.filter(p =>
        p.event_type === 'session_completed' || p.event_type === 'prep_exam_completed'
    ).length;

    // Promedio: calcular porcentaje real (correctas/total*100)
    const computeAvgScore = () => {
        const pctValues = [];
        for (const item of historyItems) {
            if (!completedQuizTypes.has(item.type) && item.source !== 'quiz') continue;

            // Prioridad 1: campos directos total_questions y correct_answers
            if (item.total_questions > 0 && item.correct_answers != null) {
                pctValues.push(Math.round((Number(item.correct_answers) / Number(item.total_questions)) * 100));
                continue;
            }
            // Prioridad 2: detail con formato "X/Y correctas"
            const match = String(item.detail || '').match(/(\d+)\/(\d+)/);
            if (match) {
                const correct = Number(match[1]);
                const total = Number(match[2]);
                if (total > 0) { pctValues.push(Math.round((correct / total) * 100)); continue; }
            }
            // Prioridad 3: score que parece porcentaje (solo si no hay total_questions)
            if ((item.score_percent != null || item.score != null) && !item.total_questions) {
                const s = Number(item.score_percent ?? item.score);
                if (Number.isFinite(s) && s > 0 && s <= 100) pctValues.push(s);
            }
        }
        // Fallback: progress_log de Supabase
        if (pctValues.length === 0) {
            for (const p of progress) {
                if (!completedQuizTypes.has(p.event_type)) continue;
                const correct = Number(p.correct_answers || 0);
                const total = Number(p.total_questions || 0);
                if (total > 0) pctValues.push(Math.round((correct / total) * 100));
            }
        }
        return pctValues.length > 0
            ? Math.round(pctValues.reduce((s, v) => s + v, 0) / pctValues.length)
            : 0;
    };
    const avgScore = computeAvgScore();

    const totalXPFromHistory = historyItems.reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
    const totalXP = totalXPFromHistory || progress.reduce((sum, p) => sum + (p.xp || 0), 0);
    const completedEvents = events.filter(e => e.status === 'completado').length;
    const totalAntecedentes = studentHistory.summary?.total || studentHistory.items.length || 0;
    const parseHistoryList = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return [value];
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            } catch {
                return value.trim() ? [value] : [];
            }
        }
        return [];
    };
    const stringifyHistoryText = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value); } catch { return String(value); }
    };
    const getSantiagoDateKey = (date = new Date()) => {
        try {
            return date.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        } catch {
            return date.toISOString().split('T')[0];
        }
    };
    const today = getSantiagoDateKey();
    const getDateKey = (value) => {
        if (!value) return '';
        try { return getSantiagoDateKey(new Date(value)); } catch { return ''; }
    };
    const getStudyDate = (session) => session?.start_time || session?.completed_at || session?.created_at || '';
    const daysBetween = (fromDateKey, toDateKey = today) => {
        if (!fromDateKey) return null;
        const from = new Date(`${fromDateKey}T12:00:00`);
        const to = new Date(`${toDateKey}T12:00:00`);
        return Math.max(0, Math.floor((to - from) / 86400000));
    };
    const normalizeSubject = (subject = '') => String(subject || '').trim().toUpperCase();
    const matchesSummarySubject = (subject) => {
        if (summarySubjectFilter === 'TODAS') return true;
        return normalizeSubject(subject) === normalizeSubject(summarySubjectFilter);
    };
    const getSummaryRangeStart = () => {
        if (summaryRangeFilter === 'custom') return summaryFromDate || '';
        const days = summaryRangeFilter === 'today' ? 0 : (summaryRangeFilter === '30d' ? 29 : 6);
        const d = new Date(`${today}T12:00:00`);
        d.setDate(d.getDate() - days);
        return getSantiagoDateKey(d);
    };
    const getSummaryRangeEnd = () => {
        if (summaryRangeFilter === 'custom') return summaryToDate || '';
        return today;
    };
    const isWithinSummaryRange = (dateKey) => {
        if (!dateKey) return false;
        const start = getSummaryRangeStart();
        const end = getSummaryRangeEnd();
        if (start && dateKey < start) return false;
        if (end && dateKey > end) return false;
        return true;
    };
    const getHistoryScore = (item) => {
        if (item?.score_percent != null) return Number(item.score_percent);
        if (item?.total_questions > 0 && item?.correct_answers != null) {
            return Math.round((Number(item.correct_answers || 0) / Number(item.total_questions)) * 100);
        }
        if (['calendar', 'reminder', 'study'].includes(String(item?.source || ''))) return null;
        return item?.score != null ? Number(item.score) : null;
    };
    const getHistoryKind = (item) => {
        const source = String(item.source || '');
        const type = String(item.type || '');
        if (type.includes('prep_exam')) return 'ensayo';
        if (type.includes('cuaderno') || source.includes('notebook')) return 'cuaderno';
        if (source === 'study') return 'estudio';
        if (source === 'calendar' || source === 'reminder') return 'evento';
        if (type.includes('alert')) return 'alerta';
        if (type.includes('quiz') || type.includes('session_completed') || source === 'quiz') return 'quiz';
        return 'progreso';
    };
    const getActivityTotal = (item) => {
        const total = Number(item?.total_questions || 0);
        if (total > 0) return total;
        const match = String(item?.detail || '').match(/(\d+)\/(\d+)/);
        return match ? Number(match[2]) : 0;
    };
    const getActivityCorrect = (item) => {
        if (item?.correct_answers != null) return Number(item.correct_answers || 0);
        const match = String(item?.detail || '').match(/(\d+)\/(\d+)/);
        return match ? Number(match[1]) : 0;
    };
    const getActivityWrong = (item) => {
        if (item?.wrong_answers != null) return Number(item.wrong_answers || 0);
        const total = getActivityTotal(item);
        const correct = getActivityCorrect(item);
        return total > 0 ? Math.max(0, total - correct) : 0;
    };
    const historySubjects = ['TODAS', ...Array.from(new Set(historyItems.map(item => item.subject).filter(Boolean))).sort()];
    const summarySubjects = ['TODAS', ...Array.from(new Set([
        ...historyItems.map(item => item.subject).filter(Boolean),
        ...studySessions.map(item => item.subject).filter(Boolean),
        ...events.map(item => item.subject).filter(Boolean),
        'MATEMATICA', 'QUIMICA', 'FISICA', 'BIOLOGIA', 'HISTORIA', 'LENGUAJE'
    ].map(normalizeSubject).filter(Boolean))).sort()];
    const summaryHistoryItems = historyItems.filter(item => {
        const dateKey = getDateKey(item.date);
        return isWithinSummaryRange(dateKey) && matchesSummarySubject(item.subject);
    });
    const summaryStudySessions = studySessions.filter(session => {
        const dateKey = getDateKey(getStudyDate(session));
        return isWithinSummaryRange(dateKey) && matchesSummarySubject(session.subject);
    });
    const summaryResultItems = summaryHistoryItems.filter(item => {
        const kind = getHistoryKind(item);
        return ['quiz', 'ensayo'].includes(kind) && getActivityTotal(item) > 0;
    });
    const summaryCorrectAnswers = summaryResultItems.reduce((sum, item) => sum + getActivityCorrect(item), 0);
    const summaryWrongAnswers = summaryResultItems.reduce((sum, item) => sum + getActivityWrong(item), 0);
    const summaryTotalQuestions = summaryResultItems.reduce((sum, item) => sum + getActivityTotal(item), 0);
    const summaryScorePercent = summaryTotalQuestions > 0 ? Math.round((summaryCorrectAnswers / summaryTotalQuestions) * 100) : 0;
    const summaryTotalMinutes = summaryStudySessions.reduce((sum, item) => sum + (Number(item.total_minutes) || 0), 0);
    const summaryIncompleteItems = summaryHistoryItems.filter(item =>
        String(item.status || '').toLowerCase().includes('iniciado') ||
        String(item.incomplete_reason || '').trim()
    );
    const summaryEvidenceItems = summaryHistoryItems.filter(item =>
        item.has_evidence || item.image_url || item.ocr_text || item.evidence_summary
    );
    const summaryRecentActivities = summaryHistoryItems.filter(item =>
        !['calendar', 'reminder'].includes(String(item.source || ''))
    ).slice(0, 5);
    const summaryLastActivity = historyItems.find(item =>
        !['calendar', 'reminder', 'daily_report'].includes(String(item.source || '')) &&
        String(item.type || '') !== 'reporte_diario' &&
        matchesSummarySubject(item.subject)
    );
    const summaryLastActivityDate = getDateKey(summaryLastActivity?.date);
    const summaryDaysWithoutSession = summaryLastActivityDate ? daysBetween(summaryLastActivityDate) : null;
    const summaryLastActivityLabel = summaryLastActivityDate
        ? new Date(`${summaryLastActivityDate}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';
    const summaryLastActivityMinutes = summaryLastActivityDate
        ? studySessions.filter(s => getDateKey(getStudyDate(s)) === summaryLastActivityDate).reduce((sum, s) => sum + (Number(s.total_minutes) || 0), 0)
        : 0;
    const summaryHasTodayActivity = historyItems.some(item =>
        getDateKey(item.date) === today &&
        !['calendar', 'reminder', 'daily_report'].includes(String(item.source || '')) &&
        String(item.type || '') !== 'reporte_diario' &&
        matchesSummarySubject(item.subject)
    ) || studySessions.some(session =>
        getDateKey(getStudyDate(session)) === today &&
        matchesSummarySubject(session.subject)
    ) || Boolean(activeStudy && matchesSummarySubject(activeStudy.subject));
    const futurePendingEvents = events
        .filter(event =>
            String(event.status || '').toLowerCase() === 'pendiente' &&
            getDateKey(event.event_date) >= today &&
            matchesSummarySubject(event.subject)
        )
        .sort((a, b) => getDateKey(a.event_date).localeCompare(getDateKey(b.event_date)));
    const pendingEvents = futurePendingEvents.length;
    const filteredHistoryItems = historyItems.filter(item => {
        if (historySubjectFilter !== 'TODAS' && item.subject !== historySubjectFilter) return false;
        if (historyTypeFilter !== 'todos' && getHistoryKind(item) !== historyTypeFilter) return false;
        if (historyOnlyErrors && !(Number(item.wrong_answers || 0) > 0 || parseHistoryList(item.wrong_question_details).length > 0)) return false;
        if (historyOnlyEvidence && !(item.has_evidence || item.image_url || item.ocr_text || item.evidence_summary)) return false;
        if (historyRangeFilter !== 'todos') {
            const days = historyRangeFilter === 'hoy' ? 1 : Number(historyRangeFilter.replace('d', '')) || 30;
            const itemTime = item.date ? new Date(item.date).getTime() : 0;
            if (!itemTime) return false;
            const since = Date.now() - days * 86400000;
            if (itemTime < since) return false;
        }
        return true;
    });
    const toggleHistoryItem = (id) => {
        setExpandedHistoryItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- Study time stats ---
    const todaySessions = studySessions.filter(s => getDateKey(getStudyDate(s)) === today && matchesSummarySubject(s.subject));
    const todayMinutes = todaySessions.reduce((sum, s) => sum + (Number(s.total_minutes) || 0), 0);
    const studyGoalMinutes = 45;
    const studyProgress = Math.min(100, Math.round((todayMinutes / studyGoalMinutes) * 100));
    let totalStudyMinutes = studySessions.reduce((sum, s) => sum + (Number(s.total_minutes) || 0), 0);
    let totalStudyDays = new Set(studySessions.map(s => getDateKey(getStudyDate(s))).filter(Boolean)).size;

    // Weekly data: if no recent data, show last 7 days with activity
    const hasRecentActivity = studySessions.some(s => {
        const diff = Date.now() - new Date(s.start_time).getTime();
        return diff < 7 * 86400000;
    });

    let weeklyStudy;
    let weekLabel;
    if (hasRecentActivity) {
        weekLabel = 'ÚLTIMOS 7 DÍAS';
        weeklyStudy = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const mins = studySessions
                .filter(s => getDateKey(getStudyDate(s)) === dateStr)
                .reduce((sum, s) => sum + (s.total_minutes || 0), 0);
            return { day: dayLabel, date: dateStr, minutes: mins };
        });
    } else {
        // Show the most active period — group by day, take last 7 unique days
        const dayMap = {};
        for (const s of studySessions) {
            const d = getDateKey(getStudyDate(s));
            if (!d) continue;
            dayMap[d] = (dayMap[d] || 0) + (s.total_minutes || 0);
        }
        const activeDays = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
        weekLabel = activeDays.length > 0
            ? `ACTIVIDAD RECIENTE (${activeDays.length} días)`
            : 'ÚLTIMOS 7 DÍAS';
        weeklyStudy = activeDays.map(([dateStr, mins]) => {
            const d = new Date(dateStr + 'T12:00:00');
            const dayLabel = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const shortDate = `${d.getDate()}/${d.getMonth() + 1}`;
            return { day: `${dayLabel} ${shortDate}`, date: dateStr, minutes: mins };
        });
    }
    weekLabel = 'ULTIMOS 7 DIAS';
    weeklyStudy = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][d.getDay()];
        const mins = studySessions
            .filter(s => getDateKey(getStudyDate(s)) === dateStr && matchesSummarySubject(s.subject))
            .reduce((sum, s) => sum + (Number(s.total_minutes) || 0), 0);
        return { day: dayLabel, date: dateStr, minutes: mins };
    });
    const weekTotalMinutes = weeklyStudy.reduce((s, d) => s + d.minutes, 0);
    const weekMaxMinutes = Math.max(...weeklyStudy.map(d => d.minutes), 1);
    totalStudyMinutes = weekTotalMinutes;
    totalStudyDays = weeklyStudy.filter(d => d.minutes > 0).length;
    const totalStudyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;
    const avgStudyMinutes = totalStudyDays > 0 ? Math.round(totalStudyMinutes / totalStudyDays) : 0;

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
    const timelineItems = (studentHistory.items || []).map(item => ({
        ...item,
        dateKey: item.date ? String(item.date).slice(0, 10) : '',
        subjectKey: item.subject || '',
        typeKey: item.source || item.type || 'otro'
    }));
    const timelineSubjects = ['TODAS', ...Array.from(new Set(timelineItems.map(item => item.subjectKey).filter(Boolean))).sort()];
    const timelineTypes = [
        { value: 'todos', label: 'Todos' },
        { value: 'study', label: 'Estudio' },
        { value: 'progress', label: 'Quiz' },
        { value: 'notebook_ocr', label: 'Cuaderno' },
        { value: 'calendar', label: 'Eventos' },
        { value: 'study_alert', label: 'Alertas' },
        { value: 'daily_report', label: 'Reportes' }
    ];
    const getRangeStart = () => {
        if (timelineRange === 'custom') return customFromDate || '';
        const days = timelineRange === 'today' ? 0 : (timelineRange === '30d' ? 29 : 6);
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    };
    const getRangeEnd = () => {
        if (timelineRange === 'custom') return customToDate || '';
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        return d.toISOString().split('T')[0];
    };
    const rangeStart = getRangeStart();
    const rangeEnd = getRangeEnd();
    const filteredTimeline = timelineItems.filter(item => {
        if (rangeStart && item.dateKey && item.dateKey < rangeStart) return false;
        if (rangeEnd && item.dateKey && item.dateKey > rangeEnd) return false;
        if (timelineSubject !== 'TODAS' && item.subjectKey !== timelineSubject) return false;
        if (timelineType !== 'todos' && item.typeKey !== timelineType && item.type !== timelineType) return false;
        return true;
    });
    const lastRealActivity = timelineItems.find(item => !['calendar', 'reminder'].includes(item.source));
    const lastActivityDate = lastRealActivity?.dateKey || '';
    const isLastActivityToday = lastActivityDate === today;
    const lastActivityLabel = lastActivityDate
        ? new Date(`${lastActivityDate}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';

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
                            <div className={`rounded-2xl p-3 text-center ${summaryHasTodayActivity ? 'bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5]' : 'bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2]'}`}>
                                {summaryHasTodayActivity ? (
                                    <CheckCircle className="w-6 h-6 text-[#10B981] mx-auto mb-1" />
                                ) : (
                                    <AlertTriangle className="w-6 h-6 text-[#EF4444] mx-auto mb-1" />
                                )}
                                <p className={`text-xl font-black ${summaryHasTodayActivity ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                    {summaryHasTodayActivity ? 'Estudio hoy' : 'Sin sesion hoy'}
                                </p>
                                <p className="text-xs font-bold text-[#9094A6]">Estado de sesion</p>
                                <p className="text-[10px] text-[#9094A6]/70 mt-0.5">
                                    {summaryDaysWithoutSession === 0 ? 'Actividad registrada hoy' : summaryDaysWithoutSession != null ? `Hace ${summaryDaysWithoutSession} dia(s)` : 'Sin registro real'}
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl p-3 text-center">
                                <Clock className="w-6 h-6 text-[#3B82F6] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#3B82F6]">{todayMinutes}</p>
                                <p className="text-xs font-bold text-[#9094A6]">Min hoy</p>
                                <p className="text-[10px] text-[#9094A6]/70 mt-0.5">{summaryTotalMinutes} min en filtro</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl p-3 text-center">
                                <Target className="w-6 h-6 text-[#7C3AED] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#7C3AED]">{summaryScorePercent}%</p>
                                <p className="text-xs font-bold text-[#9094A6]">Resultados</p>
                                <p className="text-[10px] text-[#9094A6]/70 mt-0.5">{summaryCorrectAnswers}/{summaryTotalQuestions} buenas</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FFEDD5] rounded-2xl p-3 text-center">
                                <Calendar className="w-6 h-6 text-[#F59E0B] mx-auto mb-1" />
                                <p className="text-2xl font-black text-[#F59E0B]">{pendingEvents}</p>
                                <p className="text-xs font-bold text-[#9094A6]">Proximas pruebas</p>
                                <p className="text-[10px] text-[#9094A6]/70 mt-0.5">Solo futuras</p>
                            </div>
                            <div className="bg-gradient-to-br from-[#F0F4FF] to-[#E0E7FF] rounded-2xl p-4 col-span-2 md:col-span-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-6 h-6 text-[#6366F1]" />
                                        <div>
                                            <p className="text-sm font-black text-[#6366F1]">
                                                {summaryLastActivity ? `${summaryLastActivity.subject || 'General'}: ${summaryLastActivity.title || summaryLastActivity.type || 'Actividad'}` : 'Sin ultima sesion'}
                                            </p>
                                            <p className="text-[10px] font-bold text-[#9094A6]">
                                                Ultima sesion real · {summaryLastActivityLabel || 'Sin fecha'}
                                            </p>
                                        </div>
                                    </div>
                                    {summaryLastActivity && (
                                        <div className="flex items-center gap-3">
                                            {summaryLastActivity.detail && (
                                                <span className="text-xs font-black text-[#6366F1] bg-white/60 px-2 py-1 rounded-lg">{summaryLastActivity.detail}</span>
                                            )}
                                            {summaryLastActivity.score != null && (
                                                <span className="text-xs font-black text-[#6366F1] bg-white/60 px-2 py-1 rounded-lg">Score: {summaryLastActivity.score}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
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
                        { key: 'timeline', label: 'Timeline', icon: FileText },
                        { key: 'calendario', label: 'Calendario', icon: Calendar },
                        { key: 'antecedentes', label: 'Antecedentes', icon: FileText },
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
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-[#7C3AED]">Seguimiento del apoderado</p>
                                    <h3 className="font-black text-[#2B2E4A] text-xl">Resumen filtrable</h3>
                                    <p className="text-sm text-[#64748B] font-bold">Estado diario, ultima sesion, resultados y pruebas futuras.</p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <select
                                        value={summaryRangeFilter}
                                        onChange={(e) => setSummaryRangeFilter(e.target.value)}
                                        className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]"
                                    >
                                        <option value="today">Hoy</option>
                                        <option value="7d">7 dias</option>
                                        <option value="30d">30 dias</option>
                                        <option value="custom">Rango</option>
                                    </select>
                                    <select
                                        value={summarySubjectFilter}
                                        onChange={(e) => setSummarySubjectFilter(e.target.value)}
                                        className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]"
                                    >
                                        {summarySubjects.map(subject => (
                                            <option key={subject} value={subject}>{subject === 'TODAS' ? 'Todas' : subject}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => { fetchStudentHistory(); fetchDailyReport(); fetchStudySessions(); fetchChildEvents(); }}
                                        className="col-span-2 md:col-span-1 rounded-2xl bg-[#F5F3FF] text-[#7C3AED] px-3 py-2 text-sm font-black hover:bg-[#EDE9FE] transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Actualizar
                                    </button>
                                </div>
                            </div>
                            {summaryRangeFilter === 'custom' && (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <input type="date" value={summaryFromDate} onChange={(e) => setSummaryFromDate(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]" />
                                    <input type="date" value={summaryToDate} onChange={(e) => setSummaryToDate(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]" />
                                </div>
                            )}

                            <div className={`rounded-2xl p-4 border ${summaryHasTodayActivity ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
                                <div className="flex items-start gap-3">
                                    {summaryHasTodayActivity ? (
                                        <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                                    )}
                                    <div>
                                        <h4 className={`font-black text-lg ${summaryHasTodayActivity ? 'text-green-800' : 'text-red-800'}`}>
                                            {summaryHasTodayActivity ? 'Matias realizo actividad hoy' : 'Matias no ha realizado sesion hoy'}
                                        </h4>
                                        <p className={`text-sm font-bold ${summaryHasTodayActivity ? 'text-green-700' : 'text-red-700'}`}>
                                            {summaryLastActivityDate
                                                ? `Ultima sesion real: ${summaryLastActivityLabel}${summaryDaysWithoutSession > 0 ? `, hace ${summaryDaysWithoutSession} dia(s)` : ''}.`
                                                : 'No existe una sesion real registrada todavia.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-white/80 rounded-xl px-3 py-2">
                                        <p className="text-lg font-black text-[#2B2E4A]">{summaryTotalMinutes}</p>
                                        <p className="text-[10px] font-bold text-[#64748B]">min</p>
                                    </div>
                                    <div className="bg-white/80 rounded-xl px-3 py-2">
                                        <p className="text-lg font-black text-[#10B981]">{summaryCorrectAnswers}</p>
                                        <p className="text-[10px] font-bold text-[#64748B]">buenas</p>
                                    </div>
                                    <div className="bg-white/80 rounded-xl px-3 py-2">
                                        <p className="text-lg font-black text-[#EF4444]">{summaryWrongAnswers}</p>
                                        <p className="text-[10px] font-bold text-[#64748B]">malas</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">Resultados</p>
                                <h3 className="font-black text-[#2B2E4A] text-lg mb-3">Pruebas y quizzes</h3>
                                <div className="flex items-end gap-2 mb-2">
                                    <p className="text-4xl font-black text-[#7C3AED]">{summaryScorePercent}%</p>
                                    <p className="text-sm font-bold text-[#64748B] pb-1">{summaryCorrectAnswers}/{summaryTotalQuestions} correctas</p>
                                </div>
                                <p className="text-sm font-bold text-[#EF4444]">{summaryWrongAnswers} incorrectas en el filtro</p>
                                {summaryResultItems.length === 0 && (
                                    <p className="mt-3 text-xs font-bold text-[#9094A6]">No hay quiz o prueba terminada para este filtro.</p>
                                )}
                            </div>

                            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-[#EF4444]">Pendiente</p>
                                <h3 className="font-black text-[#2B2E4A] text-lg mb-3">Que falta revisar</h3>
                                <div className="space-y-2 text-sm font-bold">
                                    <p className={summaryWrongAnswers > 0 ? 'text-red-700' : 'text-[#64748B]'}>
                                        {summaryWrongAnswers > 0 ? `${summaryWrongAnswers} respuesta(s) malas por corregir.` : 'Sin respuestas malas registradas en el filtro.'}
                                    </p>
                                    <p className={summaryIncompleteItems.length > 0 ? 'text-amber-700' : 'text-[#64748B]'}>
                                        {summaryIncompleteItems.length > 0 ? `${summaryIncompleteItems.length} actividad(es) iniciadas sin resultado final.` : 'Sin quizzes iniciados pendientes.'}
                                    </p>
                                    <p className={summaryEvidenceItems.length > 0 ? 'text-green-700' : 'text-amber-700'}>
                                        {summaryEvidenceItems.length > 0 ? `${summaryEvidenceItems.length} evidencia(s) o cuaderno(s) asociados.` : 'Sin evidencia o cuaderno en el filtro.'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-[#6366F1] to-[#7C3AED] rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-bl-full"></div>
                                <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-2">Ultima sesion</p>
                                {summaryLastActivity ? (
                                    <>
                                        <h2 className="font-black text-3xl leading-tight mb-1">{summaryLastActivity.subject || 'General'}</h2>
                                        <p className="font-bold text-xl text-white/90 mb-3">{summaryLastActivity.title || summaryLastActivity.topic || summaryLastActivity.type || 'Actividad registrada'}</p>
                                        <p className="font-bold text-base text-white/80 capitalize mb-4">{summaryLastActivityLabel}{summaryDaysWithoutSession > 0 ? ` · hace ${summaryDaysWithoutSession} dia(s)` : ''}</p>
                                        <div className="flex flex-wrap gap-3">
                                            {summaryLastActivityMinutes > 0 && (
                                                <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2">
                                                    <p className="text-2xl font-black">{summaryLastActivityMinutes} min</p>
                                                    <p className="text-[10px] font-bold text-white/70 uppercase">Tiempo estudio</p>
                                                </div>
                                            )}
                                            {getActivityTotal(summaryLastActivity) > 0 && (
                                                <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2">
                                                    <p className="text-2xl font-black">{getActivityCorrect(summaryLastActivity)}/{getActivityTotal(summaryLastActivity)}</p>
                                                    <p className="text-[10px] font-bold text-white/70 uppercase">Correctas</p>
                                                </div>
                                            )}
                                            {getActivityTotal(summaryLastActivity) > 0 && (
                                                <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2">
                                                    <p className="text-2xl font-black">{Math.round((getActivityCorrect(summaryLastActivity) / getActivityTotal(summaryLastActivity)) * 100)}%</p>
                                                    <p className="text-[10px] font-bold text-white/70 uppercase">Rendimiento</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <h2 className="font-black text-2xl text-white/60">No hay sesion registrada</h2>
                                )}
                            </div>
                        </div>

                        {/* STUDY TIME CARD - Hora de Estudio */}
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 relative overflow-hidden">
                            {/* Background accent */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#7C3AED]/10 to-transparent rounded-bl-full"></div>

                            <div className="flex items-center justify-between mb-4 relative">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#7C3AED] to-[#4D96FF] rounded-2xl flex items-center justify-center shadow-lg">
                                        <Clock className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-[#2B2E4A] text-lg">Hora de Estudio</h3>
                                        {activeStudy ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                                <span className="text-xs font-bold text-green-600">Estudiando ahora</span>
                                            </div>
                                        ) : todayMinutes > 0 ? (
                                            <p className="text-xs font-bold text-[#9094A6]">Hoy: {todayMinutes} min</p>
                                        ) : totalStudyMinutes > 0 ? (
                                            <p className="text-xs font-bold text-[#9094A6]">{totalStudyDays} días de estudio registrados</p>
                                        ) : (
                                            <p className="text-xs font-bold text-[#9094A6]">Sin actividad registrada</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-[#7C3AED]">
                                        {totalStudyMinutes >= 60 ? totalStudyHours : totalStudyMinutes}
                                        <span className="text-base font-bold text-[#9094A6]">{totalStudyMinutes >= 60 ? ' hrs' : ' min'}</span>
                                    </p>
                                    <p className="text-xs font-bold text-[#9094A6]">Tiempo acumulado</p>
                                </div>
                            </div>

                            {/* Progress bar — solo si hay actividad hoy */}
                            {todayMinutes > 0 && (
                                <div className="mb-4">
                                    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out relative"
                                            style={{
                                                width: `${studyProgress}%`,
                                                background: studyProgress >= 100
                                                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                                                    : studyProgress >= 50
                                                        ? 'linear-gradient(90deg, #7C3AED, #4D96FF)'
                                                        : 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] font-bold text-[#9094A6]">{studyProgress}%</span>
                                        <span className="text-[10px] font-bold text-[#9094A6]">
                                            {studyProgress >= 100 ? 'Meta cumplida!' : `Faltan ${studyGoalMinutes - todayMinutes} min`}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {/* Resumen acumulado cuando no hay actividad hoy */}
                            {totalStudyMinutes > 0 && (
                                <div className="mb-4 flex items-center gap-3 bg-[#F5F3FF] rounded-xl p-3">
                                    <div className="flex-1 text-center border-r border-[#E5E7EB]">
                                        <p className="text-lg font-black text-[#7C3AED]">{totalStudyDays}</p>
                                        <p className="text-[10px] font-bold text-[#9094A6]">Días activos</p>
                                    </div>
                                    <div className="flex-1 text-center border-r border-[#E5E7EB]">
                                        <p className="text-lg font-black text-[#7C3AED]">{totalStudyHours}</p>
                                        <p className="text-[10px] font-bold text-[#9094A6]">Horas totales</p>
                                    </div>
                                    <div className="flex-1 text-center">
                                        <p className="text-lg font-black text-[#7C3AED]">{avgStudyMinutes}</p>
                                        <p className="text-[10px] font-bold text-[#9094A6]">Min/día promedio</p>
                                    </div>
                                </div>
                            )}

                            {/* Weekly chart */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-black text-[#2B2E4A] uppercase tracking-wider">{weekLabel}</p>
                                    <p className="text-xs font-bold text-[#9094A6]">{weekTotalMinutes} min total</p>
                                </div>
                                <div className="flex items-end gap-1.5 h-20">
                                    {weeklyStudy.map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <div className="w-full relative" style={{ height: '56px' }}>
                                                <div
                                                    className="absolute bottom-0 w-full rounded-t-lg transition-all duration-500"
                                                    style={{
                                                        height: `${Math.max(4, (d.minutes / weekMaxMinutes) * 56)}px`,
                                                        background: d.date === today
                                                            ? 'linear-gradient(to top, #7C3AED, #A78BFA)'
                                                            : d.minutes >= studyGoalMinutes
                                                                ? 'linear-gradient(to top, #10B981, #6EE7B7)'
                                                                : d.minutes > 0
                                                                    ? 'linear-gradient(to top, #CBD5E1, #E2E8F0)'
                                                                    : '#F1F5F9'
                                                    }}
                                                ></div>
                                            </div>
                                            <span className={`text-[9px] font-bold ${d.date === today ? 'text-[#7C3AED]' : 'text-[#9094A6]'}`}>{d.day}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Today's sessions detail */}
                            {todaySessions.length > 0 && (
                                <div className="border-t border-gray-100 pt-3 space-y-2">
                                    {todaySessions.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${s.type === 'oracle' ? 'bg-[#F59E0B]' : 'bg-[#7C3AED]'}`}></span>
                                                <span className="font-bold text-[#2B2E4A]">{s.subject || 'General'}</span>
                                                <span className="text-[#9094A6]">({s.type === 'oracle' ? 'Prueba Oracle' : 'Sesión diaria'})</span>
                                            </div>
                                            <span className="font-black text-[#2B2E4A]">{s.total_minutes || '...'} min</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

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
                            {futurePendingEvents.length === 0 ? (
                                <div className="text-center py-6 text-gray-300">
                                    <Calendar className="w-10 h-10 mx-auto mb-2" />
                                    <p className="font-bold text-sm">No hay pruebas futuras pendientes</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {futurePendingEvents
                                        .slice(0, 5)
                                        .map(event => {
                                            const typeConf = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.otro;
                                            const daysToEvent = daysBetween(today, getDateKey(event.event_date));
                                            const isPriority = daysToEvent === 2;
                                            return (
                                                <div key={event.event_id} className={`flex items-center gap-3 p-3 rounded-2xl border ${isPriority ? 'border-red-200' : 'border-transparent'}`} style={{ backgroundColor: typeConf.bg }}>
                                                    <span className="text-xl">{typeConf.emoji}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-[#2B2E4A] text-sm truncate">{event.title}</p>
                                                        <p className="text-xs text-gray-500 font-bold">
                                                            {formatDate(event.event_date)}
                                                            {event.start_time ? ` · ${formatTime(event.start_time)}` : ''}
                                                            {event.subject ? ` · ${event.subject}` : ''}
                                                        </p>
                                                        {isPriority && (
                                                            <p className="text-xs font-black text-red-600 mt-1">Faltan 2 dias: preparar estudio hoy</p>
                                                        )}
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
                            <h3 className="font-black text-[#2B2E4A] mb-4">Actividad del filtro</h3>
                            {summaryRecentActivities.length === 0 ? (
                                <div className="text-center py-6 text-gray-300">
                                    <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                                    <p className="font-bold text-sm">Sin actividad real para este filtro</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {summaryRecentActivities.map((p, i) => (
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
                                                    {p.title || p.topic || p.subject || p.type || 'Actividad'}
                                                </p>
                                                <p className="text-xs text-gray-400 font-bold">
                                                    {p.subject || 'General'} - {p.date ? new Date(p.date).toLocaleDateString('es-CL') : ''}
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

                {/* TIMELINE */}
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        {!isLastActivityToday && lastActivityDate && (
                            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-black text-amber-800">Ultima informacion disponible: {lastActivityLabel}</p>
                                    <p className="text-sm font-bold text-amber-700">
                                        {selectedChild?.display_name || 'Matias'} no ha hecho otra sesion registrada despues de esa fecha.
                                    </p>
                                </div>
                            </div>
                        )}

                        {dailyReport && (
                            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-[#7C3AED]">Reporte de hoy</p>
                                        <h3 className="font-black text-[#2B2E4A]">{dailyReport.studied_today ? 'Con estudio registrado' : 'Sin estudio registrado'}</h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-xl text-xs font-black ${dailyReport.studied_today ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {dailyReport.total_minutes || 0} min
                                    </span>
                                </div>
                                <p className="text-sm text-[#64748B] font-bold">{dailyReport.summary_text}</p>
                                {dailyReport.stale_subjects?.length > 0 && (
                                    <p className="mt-2 text-xs font-bold text-amber-700">
                                        Sin estudio reciente: {dailyReport.stale_subjects.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="font-black text-[#2B2E4A]">Linea de tiempo</h3>
                                    <p className="text-xs font-bold text-[#9094A6]">Tarjetas conectadas por fecha, materia y tipo.</p>
                                </div>
                                <button
                                    onClick={() => { fetchStudentHistory(); fetchDailyReport(); }}
                                    className="p-2 rounded-xl bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#EDE9FE] transition-all"
                                    title="Actualizar timeline"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid md:grid-cols-4 gap-2 mb-4">
                                <select value={timelineRange} onChange={(e) => setTimelineRange(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]">
                                    <option value="today">Hoy</option>
                                    <option value="7d">7 dias</option>
                                    <option value="30d">30 dias</option>
                                    <option value="custom">Rango</option>
                                </select>
                                <select value={timelineSubject} onChange={(e) => setTimelineSubject(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]">
                                    {timelineSubjects.map(subject => <option key={subject} value={subject}>{subject === 'TODAS' ? 'Todas las materias' : subject}</option>)}
                                </select>
                                <select value={timelineType} onChange={(e) => setTimelineType(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]">
                                    {timelineTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </select>
                                <div className="text-xs font-bold text-[#9094A6] flex items-center justify-end">
                                    {filteredTimeline.length} tarjeta(s)
                                </div>
                            </div>

                            {timelineRange === 'custom' && (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]" />
                                    <input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} className="rounded-2xl border-2 border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#2B2E4A]" />
                                </div>
                            )}

                            {filteredTimeline.length === 0 ? (
                                <div className="text-center py-8 text-gray-300">
                                    <FileText className="w-12 h-12 mx-auto mb-3" />
                                    <p className="font-bold">No hay tarjetas para estos filtros</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredTimeline.map(item => {
                                        const isAlert = item.source === 'study_alert';
                                        const isNotebook = item.source === 'notebook_ocr';
                                        const isReport = item.source === 'daily_report';
                                        return (
                                            <div key={item.id} className={`rounded-2xl border p-4 ${isAlert ? 'bg-amber-50 border-amber-200' : isReport ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${isAlert ? 'bg-amber-500 text-white' : isNotebook ? 'bg-green-600 text-white' : isReport ? 'bg-indigo-600 text-white' : 'bg-[#7C3AED] text-white'}`}>
                                                                {item.type || item.source}
                                                            </span>
                                                            {item.subject && <span className="text-[10px] font-bold text-gray-500">{item.subject}</span>}
                                                            {item.status && <span className="text-[10px] font-bold text-gray-500">{item.status}</span>}
                                                        </div>
                                                        <p className="font-black text-sm text-[#2B2E4A] truncate">{item.title}</p>
                                                        {item.detail && <p className="text-xs text-gray-500 mt-1 line-clamp-3">{item.detail}</p>}
                                                        {item.image_url && (
                                                            <img src={item.image_url} alt="Cuaderno" className="mt-3 h-32 w-full max-w-xs rounded-xl object-cover border border-gray-200 bg-white" />
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {item.score != null && <p className="text-sm font-black text-[#7C3AED]">{item.score}%</p>}
                                                        <p className="text-[10px] font-bold text-[#9094A6]">{item.date ? new Date(item.date).toLocaleDateString('es-CL') : ''}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CALENDARIO */}
                {activeTab === 'calendario' && (
                    <div className="space-y-4">
                        {/* Year navigation */}
                        <div className="bg-white rounded-3xl p-4 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
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

                            <div className="flex justify-end gap-2 mb-3">
                                <button
                                    onClick={handleCleanDuplicates}
                                    className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                                >
                                    <Trash2 className="w-3 h-3" /> Limpiar duplicados
                                </button>
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
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteEvent(event)}
                                                                        className="p-1.5 rounded-lg bg-white/70 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all"
                                                                        title="Eliminar evento"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
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
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ANTECEDENTES */}
                {activeTab === 'antecedentes' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="font-black text-[#2B2E4A]">Historial de antecedentes</h3>
                                    <p className="text-xs font-bold text-[#9094A6]">
                                        Información encontrada en calendario, progreso, evidencias y sesiones.
                                    </p>
                                </div>
                                <button
                                    onClick={fetchStudentHistory}
                                    className="p-2 rounded-xl bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#EDE9FE] transition-all"
                                    title="Actualizar antecedentes"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                                {[
                                    ['Eventos', studentHistory.summary?.calendar_events || 0],
                                    ['Progreso', (studentHistory.summary?.progress || 0) + (studentHistory.summary?.legacy_progress || 0)],
                                    ['Quizzes', studentHistory.summary?.quizzes || 0],
                                    ['Evidencias', studentHistory.summary?.evidences || 0],
                                    ['Estudio', studentHistory.summary?.study_sessions || 0],
                                    ['Recordatorios', studentHistory.summary?.reminders || 0],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-2xl bg-gray-50 p-3 text-center">
                                        <p className="text-xl font-black text-[#2B2E4A]">{value}</p>
                                        <p className="text-[10px] font-bold text-[#9094A6]">{label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                                <select
                                    value={historySubjectFilter}
                                    onChange={(e) => setHistorySubjectFilter(e.target.value)}
                                    className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-black text-[#2B2E4A] outline-none"
                                >
                                    {historySubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                                </select>
                                <select
                                    value={historyTypeFilter}
                                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                                    className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-black text-[#2B2E4A] outline-none"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="ensayo">Ensayos</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="cuaderno">Cuaderno</option>
                                    <option value="estudio">Estudio</option>
                                    <option value="evento">Eventos</option>
                                </select>
                                <select
                                    value={historyRangeFilter}
                                    onChange={(e) => setHistoryRangeFilter(e.target.value)}
                                    className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-black text-[#2B2E4A] outline-none"
                                >
                                    <option value="hoy">Hoy</option>
                                    <option value="7d">7 dias</option>
                                    <option value="30d">30 dias</option>
                                    <option value="todos">Todo</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setHistoryOnlyErrors(prev => !prev)}
                                    className={`rounded-2xl px-3 py-2 text-xs font-black border ${historyOnlyErrors ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                                >
                                    Solo errores
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHistoryOnlyEvidence(prev => !prev)}
                                    className={`rounded-2xl px-3 py-2 text-xs font-black border ${historyOnlyEvidence ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                                >
                                    Con evidencia
                                </button>
                            </div>

                            {filteredHistoryItems.length === 0 ? (
                                <div className="text-center py-8 text-gray-300">
                                    <FileText className="w-12 h-12 mx-auto mb-3" />
                                    <p className="font-bold">No hay antecedentes visibles para este estudiante</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredHistoryItems.map(item => {
                                        const kind = getHistoryKind(item);
                                        const score = getHistoryScore(item);
                                        const wrongDetails = parseHistoryList(item.wrong_question_details);
                                        const weakness = stringifyHistoryText(item.weakness);
                                        const improvementPlan = stringifyHistoryText(item.improvement_plan);
                                        const detectedConcepts = parseHistoryList(item.metadata?.detected_concepts);
                                        const missingConcepts = parseHistoryList(item.metadata?.missing_concepts);
                                        const attempts = parseHistoryList(item.attempts);
                                        const sourceLabel = stringifyHistoryText(item.metadata?.source_label);
                                        const incompleteReason = stringifyHistoryText(item.incomplete_reason || item.metadata?.incomplete_reason);
                                        const isExternalSource = Boolean(item.metadata?.is_external_source);
                                        const isExpanded = Boolean(expandedHistoryItems[item.id]);
                                        const hasMore = attempts.length > 1 || wrongDetails.length > 0 || weakness || improvementPlan || sourceLabel || incompleteReason || item.ocr_text || item.image_url || item.evidence_summary || detectedConcepts.length || missingConcepts.length;
                                        return (
                                        <div key={item.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#7C3AED] text-white uppercase">
                                                            {kind}
                                                        </span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-white text-gray-500 uppercase">
                                                            {item.type}
                                                        </span>
                                                        {item.subject && (
                                                            <span className="text-[10px] font-bold text-gray-500">{item.subject}</span>
                                                        )}
                                                        {item.status && (
                                                            <span className="text-[10px] font-bold text-[#10B981] bg-green-50 px-2 py-0.5 rounded-lg">{item.status}</span>
                                                        )}
                                                        {item.has_evidence && (
                                                            <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-lg">evidencia</span>
                                                        )}
                                                        {isExternalSource && (
                                                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">externa</span>
                                                        )}
                                                    </div>
                                                    <p className="font-black text-sm text-[#2B2E4A] truncate">{item.title}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {attempts.length > 1 && (
                                                            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                                                                {attempts.length} registros agrupados
                                                            </span>
                                                        )}
                                                        {item.total_questions > 0 && (
                                                            <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded-lg">
                                                                {item.correct_answers || 0}/{item.total_questions} correctas
                                                            </span>
                                                        )}
                                                        {item.wrong_answers != null && (
                                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                                                {item.wrong_answers} malas
                                                            </span>
                                                        )}
                                                        {item.duration_minutes > 0 && (
                                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                                {item.duration_minutes} min
                                                            </span>
                                                        )}
                                                        {incompleteReason && (
                                                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                                                                sin resultado final
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.detail && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{item.detail}</p>}
                                                    {incompleteReason && (
                                                        <p className="text-xs font-bold text-amber-700 mt-2">{incompleteReason}</p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    {score != null && (
                                                        <p className={`text-sm font-black ${score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{score}%</p>
                                                    )}
                                                    <p className="text-[10px] font-bold text-[#9094A6]">
                                                        {item.date ? new Date(item.date).toLocaleDateString('es-CL') : ''}
                                                    </p>
                                                    {hasMore && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleHistoryItem(item.id)}
                                                            className="mt-2 text-[10px] font-black text-[#7C3AED] bg-white px-2 py-1 rounded-lg border border-purple-100"
                                                        >
                                                            {isExpanded ? 'Ocultar' : 'Ver detalle'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="mt-4 space-y-3 border-t border-gray-200 pt-3">
                                                    {sourceLabel && (
                                                        <div className="rounded-xl bg-orange-50 p-3">
                                                            <p className="text-[10px] font-black uppercase text-orange-600">Origen de la prueba</p>
                                                            <p className="text-xs font-bold text-[#2B2E4A] mt-1">{sourceLabel}</p>
                                                        </div>
                                                    )}
                                                    {incompleteReason && (
                                                        <div className="rounded-xl bg-amber-50 p-3">
                                                            <p className="text-[10px] font-black uppercase text-amber-700">Dónde quedó</p>
                                                            <p className="text-xs font-bold text-[#2B2E4A] mt-1">{incompleteReason}</p>
                                                            {item.total_questions > 0 && (
                                                                <p className="text-xs text-gray-600 mt-1">Tenía {item.total_questions} preguntas programadas, pero no existe cierre con correctas/malas.</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {attempts.length > 1 && (
                                                        <div className="rounded-xl bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase text-purple-500 mb-2">Intentos del mismo flujo</p>
                                                            <div className="space-y-1">
                                                                {attempts.slice(0, 10).map((attempt, index) => {
                                                                    const attemptScore = getHistoryScore(attempt);
                                                                    return (
                                                                        <div key={`${attempt.id || index}`} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                                                                            <span className="text-[11px] font-bold text-gray-600 truncate">{attempt.type} · {attempt.title}</span>
                                                                            <span className="text-[11px] font-black text-[#2B2E4A] shrink-0">
                                                                                {attempt.total_questions ? `${attempt.correct_answers || 0}/${attempt.total_questions}` : ''}
                                                                                {attemptScore != null ? ` · ${attemptScore}%` : ''}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.evidence_summary && (
                                                        <div className="rounded-xl bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase text-blue-500">Evidencia</p>
                                                            <p className="text-xs font-bold text-[#2B2E4A] mt-1">{item.evidence_summary}</p>
                                                        </div>
                                                    )}
                                                    {item.image_url && (
                                                        <img src={item.image_url} alt="Evidencia" className="max-h-64 w-full rounded-xl object-contain bg-white border border-gray-100" />
                                                    )}
                                                    {wrongDetails.length > 0 ? (
                                                        <div className="rounded-xl bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase text-red-500 mb-2">Errores registrados</p>
                                                            <div className="space-y-2">
                                                                {wrongDetails.slice(0, 8).map((wrong, index) => (
                                                                    <div key={index} className="rounded-lg bg-red-50 p-2">
                                                                        <p className="text-xs font-black text-[#2B2E4A]">{typeof wrong === 'string' ? wrong : (wrong.question || `Error ${index + 1}`)}</p>
                                                                        {typeof wrong !== 'string' && (
                                                                            <p className="text-[11px] text-gray-600 mt-1">
                                                                                Niño: {wrong.user_answer || wrong.selected_answer || 'sin dato'} · Correcta: {wrong.correct_answer || 'sin dato'}
                                                                            </p>
                                                                        )}
                                                                        {typeof wrong !== 'string' && wrong.explanation && (
                                                                            <p className="text-[11px] text-gray-500 mt-1">{wrong.explanation}</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (Number(item.wrong_answers || 0) > 0 && (
                                                        <div className="rounded-xl bg-white p-3 text-xs font-bold text-gray-500">
                                                            Sin detalle de errores registrado para esta actividad antigua.
                                                        </div>
                                                    ))}
                                                    {weakness && (
                                                        <div className="rounded-xl bg-yellow-50 p-3">
                                                            <p className="text-[10px] font-black uppercase text-yellow-600">Falencia</p>
                                                            <p className="text-xs font-bold text-[#2B2E4A] mt-1">{weakness}</p>
                                                        </div>
                                                    )}
                                                    {improvementPlan && (
                                                        <div className="rounded-xl bg-green-50 p-3">
                                                            <p className="text-[10px] font-black uppercase text-green-600">Próximo paso sugerido</p>
                                                            <p className="text-xs font-bold text-[#2B2E4A] mt-1">{improvementPlan}</p>
                                                        </div>
                                                    )}
                                                    {(detectedConcepts.length > 0 || missingConcepts.length > 0) && (
                                                        <div className="grid md:grid-cols-2 gap-2">
                                                            <div className="rounded-xl bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-green-600">Conceptos detectados</p>
                                                                <p className="text-xs text-gray-600 mt-1">{detectedConcepts.join(', ') || 'Sin datos'}</p>
                                                            </div>
                                                            <div className="rounded-xl bg-white p-3">
                                                                <p className="text-[10px] font-black uppercase text-red-500">Conceptos faltantes</p>
                                                                <p className="text-xs text-gray-600 mt-1">{missingConcepts.join(', ') || 'Sin datos'}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {item.ocr_text && (
                                                        <div className="rounded-xl bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase text-purple-500">OCR cuaderno</p>
                                                            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-6">{item.ocr_text}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
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
