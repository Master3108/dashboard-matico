import React, { useState, useRef, useCallback } from 'react';
import { X, Calendar, Clock, Bell, BookOpen, Mic, MicOff } from 'lucide-react';
import EvidenceIntake, { DEFAULT_MAX_EVIDENCE } from './EvidenceIntake';

const EVENT_TYPES = [
    { value: 'prueba', label: 'Prueba', color: '#EF4444' },
    { value: 'tarea', label: 'Tarea', color: '#F59E0B' },
    { value: 'estudio', label: 'Estudio', color: '#3B82F6' },
    { value: 'repaso', label: 'Repaso', color: '#8B5CF6' },
    { value: 'otro', label: 'Otro', color: '#6B7280' }
];

const SUBJECT_OPTIONS = [
    { value: 'MATEMATICA', label: 'Matemática' },
    { value: 'LENGUAJE', label: 'Lenguaje' },
    { value: 'FISICA', label: 'Física' },
    { value: 'QUIMICA', label: 'Química' },
    { value: 'BIOLOGIA', label: 'Biología' },
    { value: 'HISTORIA', label: 'Historia' },
    { value: 'INGLES', label: 'Inglés' }
];

const CreateEventModal = ({ isOpen, onClose, userId, userRole = 'estudiante', studentUserId, onEventCreated }) => {
    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState('estudio');
    const [subject, setSubject] = useState('MATEMATICA');
    const [eventDate, setEventDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    const [reminderMinutes, setReminderMinutes] = useState(15);
    const [alarmSound, setAlarmSound] = useState(true);
    const [evidences, setEvidences] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [listeningField, setListeningField] = useState(null); // 'title' | 'description' | null
    const recognitionRef = useRef(null);

    // Speech-to-Text
    const startListening = useCallback((field) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMsg('Tu navegador no soporta reconocimiento de voz');
            return;
        }

        // Stop if already listening
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
            setListeningField(null);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-CL';
        recognition.continuous = true;
        recognition.interimResults = true;

        let finalTranscript = '';

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interim = transcript;
                }
            }
            const combined = finalTranscript + interim;
            if (field === 'title') {
                setTitle(prev => {
                    const base = prev && !prev.endsWith(' ') ? prev + ' ' : prev;
                    return (base + combined).trimStart();
                });
            } else if (field === 'description') {
                setDescription(prev => {
                    const base = prev && !prev.endsWith(' ') ? prev + ' ' : prev;
                    return (base + combined).trimStart();
                });
            }
        };

        recognition.onerror = () => {
            setListeningField(null);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            setListeningField(null);
            recognitionRef.current = null;
        };

        recognition.start();
        recognitionRef.current = recognition;
        setListeningField(field);
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setListeningField(null);
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!title.trim()) { setErrorMsg('Escribe un título para el evento'); return; }
        if (!eventDate) { setErrorMsg('Selecciona una fecha'); return; }

        setIsSubmitting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const payload = {
                created_by: userId,
                student_user_id: studentUserId || userId,
                event_type: eventType,
                title: title.trim(),
                description: description.trim() || null,
                subject,
                event_date: eventDate,
                start_time: startTime || null,
                end_time: endTime || null,
                all_day: !startTime,
                notify_guardian: true,
                notify_student: true,
                reminder_minutes: reminderMinutes,
                alarm_sound: alarmSound,
                evidences: evidences.map((ev, i) => ({
                    image_base64: ev.imageBase64,
                    mime_type: ev.imageMimeType || 'image/jpeg',
                    source_type: ev.sourceType || 'evento',
                    page_number: i + 1
                }))
            };

            const response = await fetch('/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Error al crear evento');

            setSuccessMsg('Evento creado correctamente');
            onEventCreated?.(data.event);

            // Reset form
            setTimeout(() => {
                setTitle('');
                setDescription('');
                setEvidences([]);
                setSuccessMsg('');
                onClose?.();
            }, 1200);
        } catch (err) {
            setErrorMsg(err.message || 'Error al crear evento');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Fecha mínima: hoy
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#4D96FF] to-[#7C3AED] px-6 py-5 rounded-t-3xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-white" />
                        <h3 className="text-xl font-black text-white">Crear evento</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Tipo de evento */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                            Tipo de evento
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {EVENT_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setEventType(t.value)}
                                    className={`rounded-xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                                        eventType === t.value
                                            ? 'text-white shadow-md'
                                            : 'bg-white text-[#64748B] border-gray-200'
                                    }`}
                                    style={eventType === t.value ? { backgroundColor: t.color, borderColor: t.color } : {}}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Título */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                            Título
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => { stopListening(); setTitle(e.target.value); }}
                                placeholder="Ej: Prueba de fracciones, Tarea de Lenguaje..."
                                className="flex-1 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            />
                            <button
                                type="button"
                                onClick={() => listeningField === 'title' ? stopListening() : startListening('title')}
                                className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                    listeningField === 'title'
                                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                                title={listeningField === 'title' ? 'Detener' : 'Dictar título'}
                            >
                                {listeningField === 'title' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Materia */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                            Materia
                        </label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                        >
                            {SUBJECT_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha y hora */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                                Fecha
                            </label>
                            <input
                                type="date"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                min={today}
                                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                                Hora inicio
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                                Hora fin
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            />
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6]">
                                Descripción (opcional)
                            </label>
                            <button
                                type="button"
                                onClick={() => listeningField === 'description' ? stopListening() : startListening('description')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                    listeningField === 'description'
                                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {listeningField === 'description' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                {listeningField === 'description' ? 'Detener' : 'Dictar'}
                            </button>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => { stopListening(); setDescription(e.target.value); }}
                            rows={3}
                            placeholder="Detalles del evento, páginas del libro, temas a estudiar... También puedes dictar con el micrófono."
                            className={`w-full rounded-2xl border-2 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none resize-none ${
                                listeningField === 'description' ? 'border-red-400 bg-red-50/30' : 'border-gray-200 focus:border-[#7C3AED]'
                            }`}
                        />
                    </div>

                    {/* Alarma */}
                    <div className="bg-[#F8FAFF] rounded-2xl p-4 border border-[#E5ECFF]">
                        <div className="flex items-center gap-3 mb-3">
                            <Bell className="w-5 h-5 text-[#7C3AED]" />
                            <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6]">Recordatorio</h4>
                        </div>
                        <div className="flex items-center gap-4">
                            <select
                                value={reminderMinutes}
                                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                                className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 font-bold text-sm text-[#2B2E4A] outline-none"
                            >
                                <option value={5}>5 min antes</option>
                                <option value={15}>15 min antes</option>
                                <option value={30}>30 min antes</option>
                                <option value={60}>1 hora antes</option>
                                <option value={1440}>1 día antes</option>
                            </select>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={alarmSound}
                                    onChange={(e) => setAlarmSound(e.target.checked)}
                                    className="w-5 h-5 rounded accent-[#7C3AED]"
                                />
                                <span className="text-sm font-bold text-[#64748B]">Alarma con sonido</span>
                            </label>
                        </div>
                    </div>

                    {/* Evidencias (fotos) */}
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <BookOpen className="w-5 h-5 text-[#4D96FF]" />
                            <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6]">
                                Adjuntar fotos (opcional)
                            </h4>
                        </div>
                        <EvidenceIntake
                            maxEvidence={DEFAULT_MAX_EVIDENCE}
                            value={evidences}
                            onChange={setEvidences}
                            onError={setErrorMsg}
                            showNativeCapture
                            showPasteHint={false}
                            nativeQueueOnly
                        />
                    </div>

                    {/* Mensajes */}
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm font-bold text-red-600">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-sm font-bold text-green-600">
                            {successMsg}
                        </div>
                    )}

                    {/* Botón crear */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all ${
                            isSubmitting
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[#4D96FF] to-[#7C3AED] hover:shadow-lg hover:scale-[1.02]'
                        }`}
                    >
                        {isSubmitting ? 'Creando evento...' : 'CREAR EVENTO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateEventModal;
