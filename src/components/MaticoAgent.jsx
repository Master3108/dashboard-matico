import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/authFetch';
import {
    Send, Mic, MicOff, Image, Camera, X, Calendar,
    CheckCircle, Loader, Sparkles, Clock, MessageCircle,
    ChevronDown, ChevronUp, Plus, BookOpen, Monitor, UploadCloud, Smartphone
} from 'lucide-react';
import {
    isNativeScreenCaptureAvailable,
    startNativeCaptureSession,
    stopNativeCaptureSession,
    getNativeCaptureSessionState,
    captureNowNativeSession,
    listNativeQueuedCaptures,
    clearNativeQueuedCaptures,
    onNativeCaptureSessionFinalized,
    waitForNativeScreenCapture
} from '../mobile/screenCaptureBridge';

const GREETING_MESSAGES = [
    'Hola! Soy Matico, tu asistente escolar inteligente.',
    'Puedes preguntarme sobre el progreso de tu hijo: "Estudio hoy?", "Como le fue en quimica?", "Que materias tiene abandonadas?"',
    'Tambien puedo agendar pruebas y tareas: envia una foto del comunicado o escribe "prueba de matematicas el jueves".',
    'En que te puedo ayudar?'
];

const QUICK_ACTIONS = [
    { label: 'Estudio hoy?', icon: Sparkles, action: 'query', query: 'Estudio hoy mi hijo?' },
    { label: 'Como le fue esta semana?', icon: BookOpen, action: 'query', query: 'Como le fue esta semana en sus quizzes?' },
    { label: 'Proximas pruebas', icon: Calendar, action: 'query', query: 'Cuales son las proximas pruebas?' },
    { label: 'Subir foto del colegio', icon: Camera, action: 'foto', highlight: true },
];

const EVENT_TYPE_CONFIG = {
    prueba: { label: 'Prueba', color: '#EF4444', emoji: '📝' },
    tarea: { label: 'Tarea', color: '#F59E0B', emoji: '📚' },
    estudio: { label: 'Estudio', color: '#3B82F6', emoji: '🧠' },
    repaso: { label: 'Repaso', color: '#8B5CF6', emoji: '🔄' },
    otro: { label: 'Otro', color: '#6B7280', emoji: '📌' }
};

const MaticoAgent = ({ userId, userRole, studentUserId, studentName, onEventCreated }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [greetingStep, setGreetingStep] = useState(0);
    const [showBubble, setShowBubble] = useState(false);
    const [bubbleText, setBubbleText] = useState('');
    const [hasGreeted, setHasGreeted] = useState(false);
    const [eventReviews, setEventReviews] = useState({});

    // Native screen capture state
    const [nativeCaptureSupported, setNativeCaptureSupported] = useState(false);
    const [nativeSessionActive, setNativeSessionActive] = useState(false);
    const [nativeQueueCount, setNativeQueueCount] = useState(0);
    const isNativePlatform = Boolean(window?.Capacitor?.isNativePlatform?.());
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const importNativeQueueRef = useRef(() => {});

    const refreshNativeState = async () => {
        try {
            const state = await getNativeCaptureSessionState();
            setNativeSessionActive(Boolean(state?.active));
            setNativeQueueCount(Number(state?.queueCount || 0) || 0);
        } catch {
            setNativeSessionActive(false);
            setNativeQueueCount(0);
        }
    };

    useEffect(() => {
        let cancelled = false;
        if (isNativeScreenCaptureAvailable()) {
            setNativeCaptureSupported(true);
            refreshNativeState();
        } else {
            waitForNativeScreenCapture().then((ok) => {
                if (cancelled) return;
                setNativeCaptureSupported(Boolean(ok));
                if (ok) refreshNativeState();
            });
        }
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!nativeSessionActive) return undefined;
        const interval = setInterval(() => refreshNativeState(), 2500);
        return () => clearInterval(interval);
    }, [nativeSessionActive]);

    useEffect(() => {
        if (!nativeCaptureSupported) return undefined;
        const unsubscribe = onNativeCaptureSessionFinalized(() => {
            importNativeQueueRef.current?.();
        });
        return () => { unsubscribe?.(); };
    }, [nativeCaptureSupported]);

    // Auto greeting sequence
    useEffect(() => {
        if (hasGreeted) return;
        const timer1 = setTimeout(() => {
            setShowBubble(true);
            setBubbleText('Hola! Soy Matico');
        }, 1500);

        const timer2 = setTimeout(() => {
            setBubbleText('Sube una foto para agendar');
        }, 4000);

        const timer3 = setTimeout(() => {
            setBubbleText('Toca aqui!');
        }, 7000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [hasGreeted]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
        }
    }, [inputText]);

    const openChat = () => {
        setHasGreeted(true);
        setShowBubble(false);
        setIsChatOpen(true);

        // Start greeting sequence
        if (messages.length === 0) {
            const name = studentName || 'tu hijo';
            const greetings = [
                `Hola! Soy Matico, tu asistente escolar. Voy a ayudarte a organizar las pruebas y tareas de ${name}.`,
                'Lo mas facil es sacarle una FOTO o CAPTURA DE PANTALLA a la comunicacion del colegio, al cuaderno, o al grupo de WhatsApp donde avisan las pruebas. Yo leo la imagen y creo el evento automaticamente!',
                'Tambien puedes hablarme por voz o escribir. Prueba subiendo una foto ahora!'
            ];

            greetings.forEach((text, i) => {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: `greeting-${i}`,
                        type: 'bot',
                        text,
                        timestamp: new Date()
                    }]);
                }, (i + 1) * 800);
            });

            // Show quick actions after greetings
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: 'quick-actions',
                    type: 'quick-actions',
                    timestamp: new Date()
                }]);
            }, 3500);
        }
    };

    const addBotMessage = (text, eventData = null) => {
        setMessages(prev => [...prev, {
            id: `bot-${Date.now()}`,
            type: 'bot',
            text,
            eventData,
            timestamp: new Date()
        }]);
    };

    const addUserMessage = (text, imageUrl = null) => {
        setMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            type: 'user',
            text,
            imageUrl,
            timestamp: new Date()
        }]);
    };

    const addEventReviewMessage = (events = []) => {
        const reviewId = `review-${Date.now()}`;
        const items = events.map((event, index) => ({
            ...event,
            reviewItemId: `${reviewId}-${index}`,
            selected: true
        }));
        setEventReviews(prev => ({ ...prev, [reviewId]: items }));
        setMessages(prev => [...prev, {
            id: reviewId,
            type: 'event-review',
            reviewId,
            timestamp: new Date()
        }]);
    };

    const toggleReviewItem = (reviewId, reviewItemId) => {
        setEventReviews(prev => ({
            ...prev,
            [reviewId]: (prev[reviewId] || []).map(item =>
                item.reviewItemId === reviewItemId ? { ...item, selected: !item.selected } : item
            )
        }));
    };

    const confirmReviewEvents = async (reviewId) => {
        const selectedEvents = (eventReviews[reviewId] || []).filter(item => item.selected);
        if (selectedEvents.length === 0) {
            addBotMessage('No agendé nada. Marca al menos un evento si quieres guardarlo.');
            return;
        }

        setIsProcessing(true);
        setMessages(prev => [...prev, { id: 'processing', type: 'processing', timestamp: new Date() }]);

        try {
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('role', userRole || 'estudiante');
            if (studentUserId) formData.append('student_user_id', studentUserId);
            formData.append('events_json', JSON.stringify(selectedEvents.map(({ reviewItemId, selected, ...event }) => event)));

            const res = await authFetch('/api/calendar/smart-create', { method: 'POST', body: formData });
            const data = await res.json();
            setMessages(prev => prev.filter(m => m.id !== 'processing'));

            if (data.success) {
                const created = data.events || [];
                if (created.length === 0 && data.total_skipped_duplicates > 0) {
                    addBotMessage(`No dupliqué nada: ${data.total_skipped_duplicates} evento(s) ya estaban registrados.`);
                } else {
                    const summary = created.map(ev => {
                        const tc = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.otro;
                        return `${tc.emoji} **${ev.title}** - ${ev.event_date} (${ev.subject || 'Sin materia'})`;
                    }).join('\n');
                    addBotMessage(
                        `Agendé **${created.length} evento(s)**:\n\n${summary}${data.total_skipped_duplicates ? `\n\nOmití ${data.total_skipped_duplicates} duplicado(s).` : ''}`,
                        created[0] || null
                    );
                }
                setEventReviews(prev => ({
                    ...prev,
                    [reviewId]: (prev[reviewId] || []).map(item => ({ ...item, locked: true }))
                }));
                onEventCreated?.(data.event || data.events?.[0]);
            } else {
                addBotMessage(data.error || 'No pude agendar esos eventos. Intenta de nuevo.');
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== 'processing'));
            addBotMessage('Hubo un error al agendar. Intenta de nuevo.');
            console.error('[MATICO-AGENT] Error confirmando eventos:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleQuickAction = (actionOrObj, quickItem) => {
        // Remove quick actions message
        setMessages(prev => prev.filter(m => m.id !== 'quick-actions'));

        if (actionOrObj === 'foto') {
            if (isNativePlatform) {
                captureFromNativeApp();
            } else {
                fileInputRef.current?.click();
            }
        } else if (actionOrObj === 'query' && quickItem?.query) {
            // Enviar query directamente sin pasar por inputText
            sendAgentQuery(quickItem.query);
        } else if (actionOrObj === 'prueba') {
            addUserMessage('Quiero agendar una prueba');
            setTimeout(() => {
                addBotMessage('Dale! Sacale una foto al aviso del colegio y mandamela aqui, o escribe los detalles.');
            }, 600);
        } else if (actionOrObj === 'tarea') {
            addUserMessage('Quiero agendar una tarea');
            setTimeout(() => {
                addBotMessage('Mandame una foto de la tarea o escribe los detalles.');
            }, 600);
        }
    };

    // Speech recognition
    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addBotMessage('Tu navegador no soporta voz. Intenta escribir o subir una foto.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-CL';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setInputText(transcript);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const captureFromNativeApp = async () => {
        try {
            if (!nativeSessionActive) {
                await startNativeCaptureSession();
                await refreshNativeState();
                addBotMessage('Listo, se activo la captura celular. Navega con el marco azul, usa "Capturar pantalla" y cuando termines toca "Finalizar". Yo importo la captura al volver.');
                return;
            }
            await captureNowNativeSession();
            await refreshNativeState();
            addBotMessage('Captura guardada en cola. Puedes capturar otra pantalla o tocar "Finalizar" en el overlay.');
        } catch (error) {
            const msg = String(error?.message || '');
            if (msg.includes('overlay_permission_required')) {
                addBotMessage('Debes activar "mostrar sobre otras apps" para ver el marco azul y el boton de captura.');
            } else if (msg.includes('screen_capture_permission_denied')) {
                addBotMessage('Permiso denegado. Debes aceptar "grabar o compartir pantalla" para usar la captura celular.');
            } else if (msg.includes('native_not_available')) {
                addBotMessage('La captura celular con marco azul requiere la app Matico instalada. En web usa "Subir fotos" o "Tomar foto".');
            } else {
                addBotMessage('No se pudo iniciar la captura celular. Intenta de nuevo.');
            }
        }
    };

    const stopNativeSession = async () => {
        try {
            await stopNativeCaptureSession();
            await refreshNativeState();
        } catch {
            addBotMessage('No se pudo detener la sesion de captura.');
        }
    };

    const importNativeQueue = async () => {
        try {
            const queued = await listNativeQueuedCaptures();
            const rows = Array.isArray(queued?.items) ? queued.items : [];
            if (!rows.length) {
                addBotMessage('No hay capturas en cola para importar.');
                return;
            }

            const row = rows[0];
            const base64 = String(row?.imageBase64 || row?.image_base64 || '').trim();
            const mimeType = String(row?.imageMimeType || row?.image_mime_type || 'image/jpeg').trim() || 'image/jpeg';
            if (!base64) {
                addBotMessage('No pude leer la captura guardada. Intenta capturar otra vez.');
                return;
            }

            const dataUrl = `data:${mimeType};base64,${base64}`;
            const resp = await fetch(dataUrl);
            const blob = await resp.blob();
            const file = new File([blob], 'captura-nativa.png', { type: mimeType });
            setSelectedImage(file);
            setImagePreview(dataUrl);
            addBotMessage(`Se importo ${rows.length} captura(s). La primera quedo lista para enviar y agendar.`);
            await clearNativeQueuedCaptures();
            await refreshNativeState();
        } catch {
            addBotMessage('No se pudo importar la cola de capturas.');
        }
    };

    importNativeQueueRef.current = importNativeQueue;

    const captureScreenWeb = async () => {
        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                addBotMessage('Captura no disponible en este navegador. Usa "Subir fotos" o "Tomar foto".');
                return;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            track.stop();
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'captura-pantalla.png', { type: 'image/png' });
                    setSelectedImage(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => setImagePreview(ev.target.result);
                    reader.readAsDataURL(file);
                }
            }, 'image/png');
        } catch (err) {
            console.error('[SCREEN-CAPTURE] Error:', err);
        }
    };

    const openCamera = async () => {
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
            }
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } }
            });
            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            track.stop();
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'foto-camara.png', { type: 'image/png' });
                    setSelectedImage(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => setImagePreview(ev.target.result);
                    reader.readAsDataURL(file);
                }
            }, 'image/png');
        } catch (err) {
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
            }
        }
    };

    const conversationHistoryRef = useRef([]);

    const sendAgentQuery = async (queryText) => {
        if (isProcessing || !queryText) return;
        addUserMessage(queryText);
        setIsProcessing(true);
        setMessages(prev => [...prev, { id: 'processing', type: 'processing', timestamp: new Date() }]);
        try {
            conversationHistoryRef.current.push({ role: 'user', content: queryText });
            const res = await authFetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: queryText,
                    student_id: studentUserId || userId,
                    user_type: userRole === 'apoderado' ? 'parent' : 'student',
                    conversation_history: conversationHistoryRef.current.slice(-10)
                })
            });
            const data = await res.json();
            setMessages(prev => prev.filter(m => m.id !== 'processing'));
            if (data.success && data.reply) {
                addBotMessage(data.reply);
                conversationHistoryRef.current.push({ role: 'assistant', content: data.reply });
            } else {
                addBotMessage('No pude obtener una respuesta. Intenta de nuevo.');
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== 'processing'));
            addBotMessage('Ups, hubo un error. Intenta de nuevo.');
            console.error('[AGENT] Error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const isCalendarIntent = (text) => {
        if (!text) return false;
        const keywords = /\b(agendar|prueba el|tarea el|tarea para|evento|recordar que|anotar|registrar|tiene prueba|tiene tarea|examen el)\b/i;
        return keywords.test(text);
    };

    const handleSend = async () => {
        if (isProcessing) return;
        if (!inputText.trim() && !selectedImage) return;
        if (isListening) toggleListening();

        const userText = inputText.trim();
        const userImage = selectedImage;
        const userImagePreview = imagePreview;

        addUserMessage(userText || (userImage ? 'Foto enviada' : ''), userImagePreview);
        setInputText('');
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setIsProcessing(true);
        setMessages(prev => [...prev, {
            id: 'processing',
            type: 'processing',
            timestamp: new Date()
        }]);

        try {
            // Si tiene imagen o es intención de calendario → flujo calendar
            if (userImage || isCalendarIntent(userText)) {
                const formData = new FormData();
                formData.append('user_id', userId);
                formData.append('role', userRole || 'estudiante');
                if (studentUserId) formData.append('student_user_id', studentUserId);
                if (userText) formData.append('text_input', userText);
                if (userImage) formData.append('image', userImage);
                formData.append('dry_run', 'true');

                const res = await authFetch('/api/calendar/smart-create', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                setMessages(prev => prev.filter(m => m.id !== 'processing'));

                if (data.success && data.events?.length > 0) {
                    addBotMessage(`Encontre ${data.events.length} evento(s). Los deje marcados en verde; desmarca lo que no quieras agendar y confirma.`);
                    addEventReviewMessage(data.events);
                } else {
                    addBotMessage(
                        'Mmm, no pude interpretar bien eso. ' +
                        (data.error || '') +
                        '\n\nIntenta con mas detalle o envia una foto mas clara.'
                    );
                }
            } else {
                // Flujo agente inteligente → consulta Supabase
                conversationHistoryRef.current.push({ role: 'user', content: userText });

                const res = await authFetch('/api/agent/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userText,
                        student_id: studentUserId || userId,
                        user_type: userRole === 'apoderado' ? 'parent' : 'student',
                        conversation_history: conversationHistoryRef.current.slice(-10)
                    })
                });
                const data = await res.json();

                setMessages(prev => prev.filter(m => m.id !== 'processing'));

                if (data.success && data.reply) {
                    addBotMessage(data.reply);
                    conversationHistoryRef.current.push({ role: 'assistant', content: data.reply });
                } else {
                    addBotMessage('No pude obtener una respuesta. Intenta de nuevo.');
                }
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== 'processing'));
            addBotMessage('Ups, hubo un error. Intenta de nuevo en unos segundos.');
            console.error('[MATICO-AGENT] Error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // --- RENDER ---

    // Minimized: floating dog with bubble
    if (!isChatOpen) {
        return (
            <div className="fixed bottom-6 left-4 z-[200]">
                {/* Speech bubble */}
                {showBubble && (
                    <div
                        className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-lg border border-gray-100 animate-fade-in cursor-pointer"
                        onClick={openChat}
                        style={{ animation: 'maticoBubbleFadeInUp 0.3s ease-out' }}
                    >
                        <p className="text-sm font-bold text-[#2B2E4A] whitespace-nowrap">{bubbleText}</p>
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45"></div>
                    </div>
                )}

                {/* Dog avatar */}
                <button
                    onClick={openChat}
                    className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(124,58,237,0.4)] hover:scale-110 transition-transform duration-300 border-3 border-white"
                    style={{ animation: 'bounceIn 0.5s ease-out' }}
                >
                    <img
                        src="/matico-avatar.jpeg"
                        alt="Matico"
                        className="w-full h-full object-cover"
                    />
                </button>

                {/* Notification dot */}
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#7C3AED] rounded-full flex items-center justify-center animate-pulse">
                    <MessageCircle className="w-3 h-3 text-white" />
                </div>

                <style>{`
                    @keyframes maticoBubbleFadeInUp {
                        from { opacity: 0; transform: translate(-50%, 10px); }
                        to { opacity: 1; transform: translate(-50%, 0); }
                    }
                    @keyframes bounceIn {
                        0% { transform: scale(0); }
                        60% { transform: scale(1.15); }
                        100% { transform: scale(1); }
                    }
                `}</style>
            </div>
        );
    }

    // Expanded: full chat
    return (
        <div className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
                style={{ animation: 'slideUp 0.3s ease-out' }}>

                {/* Header with dog */}
                <div className="bg-gradient-to-r from-[#FFD93D] to-[#FFC107] px-4 py-3 flex items-center justify-between shrink-0 relative overflow-hidden">
                    {/* Subtle pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-2 left-8 w-4 h-4 border-2 border-white rounded-full"></div>
                        <div className="absolute top-4 right-16 w-3 h-3 border-2 border-white rounded-full"></div>
                        <div className="absolute bottom-2 left-24 w-2 h-2 bg-white rounded-full"></div>
                    </div>

                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border-2 border-white">
                            <img src="/matico-avatar.jpeg" alt="Matico" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="font-black text-[#2B2E4A] text-base">Matico</h3>
                            <p className="text-[#2B2E4A]/60 text-xs font-bold flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                                Asistente escolar
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsChatOpen(false)}
                        className="relative z-10 w-8 h-8 bg-[#2B2E4A]/10 hover:bg-[#2B2E4A]/20 rounded-xl flex items-center justify-center transition-colors"
                    >
                        <ChevronDown className="w-5 h-5 text-[#2B2E4A]" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F8F9FE]">
                    {messages.map(msg => {
                        if (msg.type === 'processing') {
                            return (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm">
                                        <img src="/matico-avatar.jpeg" alt="M" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                            <span className="text-xs text-gray-400 font-bold">Analizando...</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === 'quick-actions') {
                            return (
                                <div key={msg.id} className="flex flex-col gap-2 pl-10">
                                    {QUICK_ACTIONS.map((qa, i) => {
                                        const Icon = qa.icon;
                                        const isHighlight = qa.highlight;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleQuickAction(qa.action, qa)}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-sm border transition-all text-left ${
                                                    isHighlight
                                                        ? 'bg-[#7C3AED] border-[#7C3AED] hover:bg-[#6D28D9] shadow-[0_4px_15px_rgba(124,58,237,0.3)]'
                                                        : 'bg-white border-[#7C3AED]/20 hover:border-[#7C3AED]/50 hover:shadow-md'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isHighlight ? 'bg-white/20' : 'bg-[#7C3AED]/10'}`}>
                                                    <Icon className={`w-4 h-4 ${isHighlight ? 'text-white' : 'text-[#7C3AED]'}`} />
                                                </div>
                                                <span className={`text-sm font-bold ${isHighlight ? 'text-white' : 'text-[#2B2E4A]'}`}>{qa.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        }

                        if (msg.type === 'event-review') {
                            const reviewItems = eventReviews[msg.reviewId] || [];
                            const selectedCount = reviewItems.filter(item => item.selected).length;
                            const locked = reviewItems.some(item => item.locked);

                            return (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm">
                                        <img src="/matico-avatar.jpeg" alt="M" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[90%] w-full">
                                        <p className="text-sm font-black text-[#2B2E4A] mb-2">Revisa antes de agendar</p>
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {reviewItems.map(item => {
                                                const typeConf = EVENT_TYPE_CONFIG[item.event_type] || EVENT_TYPE_CONFIG.otro;
                                                return (
                                                    <button
                                                        key={item.reviewItemId}
                                                        type="button"
                                                        onClick={() => !locked && toggleReviewItem(msg.reviewId, item.reviewItemId)}
                                                        className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${
                                                            item.selected
                                                                ? 'bg-green-50 border-green-200'
                                                                : 'bg-gray-50 border-gray-200 opacity-70'
                                                        }`}
                                                    >
                                                        <div className="flex gap-2">
                                                            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                                                item.selected ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-transparent'
                                                            }`}>
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-[#2B2E4A]">{typeConf.emoji} {item.title}</p>
                                                                <p className="text-[11px] text-gray-500 font-bold">
                                                                    {item.event_date} · {item.subject || 'Sin materia'} · {typeConf.label}
                                                                </p>
                                                                {item.description && (
                                                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {!locked && (
                                            <button
                                                type="button"
                                                onClick={() => confirmReviewEvents(msg.reviewId)}
                                                disabled={isProcessing || selectedCount === 0}
                                                className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-black transition-all ${
                                                    selectedCount > 0 && !isProcessing
                                                        ? 'bg-[#10B981] text-white hover:bg-[#059669]'
                                                        : 'bg-gray-100 text-gray-400'
                                                }`}
                                            >
                                                Agendar seleccionados ({selectedCount})
                                            </button>
                                        )}
                                        {locked && (
                                            <p className="mt-3 text-xs font-bold text-green-600">Lista procesada</p>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === 'bot') {
                            return (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm">
                                        <img src="/matico-avatar.jpeg" alt="M" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[85%]">
                                        <div className="text-sm text-[#2B2E4A] whitespace-pre-wrap leading-relaxed">
                                            {msg.text.split('**').map((part, i) =>
                                                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                            )}
                                        </div>
                                        {msg.eventData && (
                                            <div className="mt-2 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-xl">
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                <span className="text-xs font-bold text-green-600">Guardado en calendario</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === 'user') {
                            return (
                                <div key={msg.id} className="flex items-start gap-2 justify-end">
                                    <div className="bg-[#7C3AED] rounded-2xl rounded-tr-md px-4 py-3 shadow-sm max-w-[85%]">
                                        {msg.imageUrl && (
                                            <img
                                                src={msg.imageUrl}
                                                alt="Foto"
                                                className="rounded-xl mb-2 max-h-40 w-full object-cover"
                                            />
                                        )}
                                        {msg.text && msg.text !== 'Foto enviada' && (
                                            <p className="text-sm text-white">{msg.text}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Image preview */}
                {imagePreview && (
                    <div className="px-4 py-2 bg-[#F8F9FE] border-t border-gray-100 shrink-0">
                        <div className="relative inline-block">
                            <img src={imagePreview} alt="Preview" className="h-16 rounded-xl object-cover" />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="px-3 py-3 bg-white border-t border-gray-100 shrink-0 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />

                    {/* Capture buttons - estilo Oraculo */}
                    <div className={`grid gap-2 ${isNativePlatform ? 'grid-cols-2' : (isMobileUA ? 'grid-cols-2' : 'grid-cols-3')}`}>
                        <button
                            type="button"
                            onClick={openCamera}
                            className="rounded-2xl border-2 border-gray-200 bg-white px-2 py-2 text-xs font-black text-[#2B2E4A] hover:border-[#FFD93D] flex items-center justify-center gap-1 transition-all"
                        >
                            <Camera className="w-3.5 h-3.5" /> Tomar foto
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-2xl border-2 border-[#4D96FF] bg-[#EEF4FF] px-2 py-2 text-xs font-black text-[#1D4ED8] hover:border-[#1D4ED8] flex items-center justify-center gap-1 transition-all"
                        >
                            <UploadCloud className="w-3.5 h-3.5" /> Subir fotos
                        </button>
                        {!isNativePlatform && !isMobileUA && (
                            <button
                                type="button"
                                onClick={captureScreenWeb}
                                className="rounded-2xl border-2 border-gray-200 bg-white px-2 py-2 text-xs font-black text-[#2B2E4A] hover:border-[#FFD93D] flex items-center justify-center gap-1 transition-all"
                            >
                                <Monitor className="w-3.5 h-3.5" /> Captura
                            </button>
                        )}
                        {isNativePlatform && (
                            <button
                                type="button"
                                onClick={nativeCaptureSupported ? captureFromNativeApp : () => addBotMessage('La captura nativa no se inicializo. Cierra y vuelve a abrir la app Matico.')}
                                className={nativeCaptureSupported
                                    ? 'rounded-2xl border-2 border-[#16A34A] bg-[#ECFDF3] px-2 py-2 text-xs font-black text-[#166534] hover:border-[#15803D] flex items-center justify-center gap-1 transition-all col-span-2'
                                    : 'rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-2 py-2 text-xs font-black text-gray-500 flex items-center justify-center gap-1 col-span-2'
                                }
                            >
                                <Smartphone className="w-3.5 h-3.5" />
                                {nativeSessionActive ? 'Capturar ahora' : 'Captura pantalla celular'}
                            </button>
                        )}
                    </div>

                    {nativeCaptureSupported && nativeSessionActive && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={stopNativeSession}
                                className="flex-1 rounded-xl bg-red-100 text-red-700 px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                            >
                                <X className="w-3.5 h-3.5" /> Detener sesion
                            </button>
                            {nativeQueueCount > 0 && (
                                <button
                                    type="button"
                                    onClick={importNativeQueue}
                                    className="flex-1 rounded-xl bg-[#4D96FF] text-white px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                                >
                                    Importar cola ({nativeQueueCount})
                                </button>
                            )}
                        </div>
                    )}
                    {nativeCaptureSupported && !nativeSessionActive && nativeQueueCount > 0 && (
                        <button
                            type="button"
                            onClick={importNativeQueue}
                            className="w-full rounded-xl bg-[#4D96FF] text-white px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                        >
                            Importar cola ({nativeQueueCount})
                        </button>
                    )}

                    {/* Text + voice + send */}
                    <div className="flex items-end gap-1.5">
                        <div className="flex-1">
                            <textarea
                                ref={textareaRef}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="O escribe los detalles..."
                                rows={1}
                                className="w-full px-3 py-2 rounded-2xl bg-gray-100 text-sm text-[#2B2E4A] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD93D]/50 max-h-[100px]"
                                disabled={isProcessing}
                            />
                        </div>

                        <button
                            onClick={toggleListening}
                            className={`p-2 rounded-xl transition-all shrink-0 ${
                                isListening
                                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            disabled={isProcessing}
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={handleSend}
                            disabled={isProcessing || (!inputText.trim() && !selectedImage)}
                            className={`p-2 rounded-xl transition-all shrink-0 ${
                                (inputText.trim() || selectedImage) && !isProcessing
                                    ? 'bg-[#FFD93D] text-[#2B2E4A] shadow-md hover:bg-[#FFC107]'
                                    : 'bg-gray-100 text-gray-300'
                            }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(100px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `