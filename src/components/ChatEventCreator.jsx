import React, { useState, useRef, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import {
    Send, Mic, MicOff, Image, Camera, X, Calendar,
    CheckCircle, Loader, Sparkles, Clock, AlertTriangle,
    ChevronDown, Monitor, UploadCloud, Smartphone
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

const EVENT_TYPE_CONFIG = {
    prueba: { label: 'Prueba', color: '#EF4444', emoji: '📝' },
    tarea: { label: 'Tarea', color: '#F59E0B', emoji: '📚' },
    estudio: { label: 'Estudio', color: '#3B82F6', emoji: '🧠' },
    repaso: { label: 'Repaso', color: '#8B5CF6', emoji: '🔄' },
    otro: { label: 'Otro', color: '#6B7280', emoji: '📌' }
};

const MAX_EVENT_IMAGES = 10;

const getWelcomeMessage = (intent, studentName) => {
    const name = studentName || 'el estudiante';

    if (intent === 'prueba') {
        return `Vamos a crear una prueba para ${name}. Sube una foto o captura de pantalla del aviso del colegio y yo intento sacar fecha, materia, contenidos y hora. Tambien puedes escribirlo o dictarlo.`;
    }

    return `Hola! Soy tu asistente para crear eventos de ${name}. Puedes enviarme una foto o captura de una comunicacion del colegio, tarea o prueba, y yo extraigo la informacion automaticamente. Tambien puedes escribir o dictar por voz.`;
};

const ChatEventCreator = ({ isOpen, onClose, userId, userRole, studentUserId, studentName, intent = 'evento', onEventCreated }) => {
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            type: 'bot',
            text: '¡Hola! Soy tu asistente para crear eventos. Puedes enviarme una foto de una comunicación del colegio, tarea o prueba, y yo extraigo toda la información automáticamente. También puedes escribir o dictar por voz.',
            timestamp: new Date()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastCreatedEvent, setLastCreatedEvent] = useState(null);
    const [eventReviews, setEventReviews] = useState({});

    // Native screen capture state
    const [nativeCaptureSupported, setNativeCaptureSupported] = useState(false);
    const [nativeSessionActive, setNativeSessionActive] = useState(false);
    const [nativeQueueCount, setNativeQueueCount] = useState(0);
    const isNativePlatform = Boolean(window?.Capacitor?.isNativePlatform?.());
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const importNativeQueueRef = useRef(() => {});

    // Refresh native capture session state
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

    // Detect native capture support on mount
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

    // Poll native state while session active
    useEffect(() => {
        if (!nativeSessionActive) return undefined;
        const interval = setInterval(() => refreshNativeState(), 2500);
        return () => clearInterval(interval);
    }, [nativeSessionActive]);

    // Auto-import on native "Finalizar" event
    useEffect(() => {
        if (!nativeCaptureSupported) return undefined;
        const unsubscribe = onNativeCaptureSessionFinalized(() => {
            importNativeQueueRef.current?.();
        });
        return () => { unsubscribe?.(); };
    }, [nativeCaptureSupported]);

    useEffect(() => {
        if (!isOpen) return;

        setMessages([
            {
                id: 'welcome',
                type: 'bot',
                text: getWelcomeMessage(intent, studentName),
                timestamp: new Date()
            }
        ]);
        setInputText('');
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedImages([]);
        setImagePreviews([]);
        setLastCreatedEvent(null);
        setEventReviews({});
    }, [isOpen, intent, studentName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputText]);

    // Speech recognition
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addBotMessage('Tu navegador no soporta reconocimiento de voz. Intenta escribir o subir una foto.');
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

        recognition.onerror = (event) => {
            console.error('[VOICE] Error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
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
            addBotMessage('No agendé nada. Si quieres, marca al menos un evento de la lista.');
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
            console.error('[CHAT-EVENT] Error confirmando eventos:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImageSelect = (e) => {
        const rawFiles = Array.from(e.target.files || []).filter(file => file.type?.startsWith('image/'));
        const files = rawFiles.slice(0, MAX_EVENT_IMAGES);
        if (!files.length) return;
        if (rawFiles.length > MAX_EVENT_IMAGES) {
            addBotMessage(`Puedes subir hasta ${MAX_EVENT_IMAGES} imagenes por evento. Tome las primeras ${MAX_EVENT_IMAGES}.`);
        }
        setSelectedImages(files);
        setSelectedImage(files[0]);
        Promise.all(files.map(file => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        }))).then((previews) => {
            setImagePreviews(previews.filter(Boolean));
            setImagePreview(previews[0] || null);
        });
    };

    // Abre camara nativa en movil, getUserMedia en desktop
    const openCamera = async () => {
        // Mobile: usar input nativo con capture=environment
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
            }
            return;
        }
        // Desktop: getUserMedia preview
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
                    setSelectedImages([file]);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        setImagePreview(ev.target.result);
                        setImagePreviews([ev.target.result]);
                    };
                    reader.readAsDataURL(file);
                }
            }, 'image/png');
        } catch (err) {
            // Fallback: abrir input con capture
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
            }
        }
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedImages([]);
        setImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    // --- Captura nativa (APK): iniciar sesion → marco azul → capturar → importar cola ---
    const captureFromNativeApp = async () => {
        try {
            if (!nativeSessionActive) {
                await startNativeCaptureSession();
                await refreshNativeState();
                addBotMessage('Sesion de captura iniciada. Navega con el marco azul y usa el boton inferior "Capturar pantalla". Cuando termines, toca "Finalizar".');
                return;
            }
            await captureNowNativeSession();
            await refreshNativeState();
            addBotMessage('Captura guardada en cola. Sigue capturando o toca "Finalizar" en el overlay.');
        } catch (error) {
            const msg = String(error?.message || '');
            if (msg.includes('overlay_permission_required')) {
                addBotMessage('Debes activar "mostrar sobre otras apps" para ver el marco azul y el boton de captura.');
            } else if (msg.includes('native_not_available')) {
                addBotMessage('La captura nativa requiere la app Matico instalada. Usa "Subir fotos" o "Tomar foto".');
            } else {
                addBotMessage('No se pudo iniciar la captura. Intenta de nuevo.');
            }
        }
    };

    const stopNativeSession = async () => {
        try {
            await stopNativeCaptureSession();
            await refreshNativeState();
        } catch { /* ignore */ }
    };

    const importNativeQueue = async () => {
        try {
            const queued = await listNativeQueuedCaptures();
            const rows = Array.isArray(queued?.items) ? queued.items : [];
            if (!rows.length) {
                addBotMessage('No hay capturas en cola para importar.');
                return;
            }
            const importedFiles = [];
            const importedPreviews = [];
            for (let i = 0; i < Math.min(rows.length, MAX_EVENT_IMAGES); i += 1) {
                const row = rows[i];
                const base64 = String(row?.imageBase64 || row?.image_base64 || '').trim();
                const mimeType = String(row?.imageMimeType || row?.image_mime_type || 'image/jpeg').trim() || 'image/jpeg';
                if (!base64) continue;
                const dataUrl = `data:${mimeType};base64,${base64}`;
                const resp = await fetch(dataUrl);
                const blob = await resp.blob();
                importedFiles.push(new File([blob], `captura-nativa-${i + 1}.png`, { type: mimeType }));
                importedPreviews.push(dataUrl);
            }
            if (importedFiles.length) {
                setSelectedImages(importedFiles);
                setSelectedImage(importedFiles[0]);
                setImagePreviews(importedPreviews);
                setImagePreview(importedPreviews[0] || null);
                addBotMessage(`Se importo ${importedFiles.length} captura(s). Estan listas para enviar.`);
            }
            await clearNativeQueuedCaptures();
            await refreshNativeState();
        } catch (error) {
            addBotMessage('No se pudo importar la cola de capturas.');
        }
    };

    importNativeQueueRef.current = importNativeQueue;

    // Captura de pantalla web (desktop): getDisplayMedia
    const captureScreenWeb = async () => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            addBotMessage('La captura de pantalla no esta disponible en este navegador. Usa "Subir fotos" o "Tomar foto".');
            return;
        }
        try {
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
                    setSelectedImages([file]);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        setImagePreview(ev.target.result);
                        setImagePreviews([ev.target.result]);
                    };
                    reader.readAsDataURL(file);
                }
            }, 'image/png');
        } catch (err) {
            console.error('[SCREEN-CAPTURE] Error:', err);
        }
    };

    const handleSend = async () => {
        if (isProcessing) return;
        if (!inputText.trim() && selectedImages.length === 0 && !selectedImage) return;

        // Stop listening if active
        if (isListening) stopListening();

        const userText = inputText.trim();
        const userImages = selectedImages.length ? selectedImages : (selectedImage ? [selectedImage] : []);
        const userImagePreview = imagePreviews[0] || imagePreview;

        // Add user message
        addUserMessage(
            userText || (userImages.length ? (intent === 'prueba' ? `${userImages.length} imagen(es) de prueba enviadas` : `${userImages.length} imagen(es) enviadas`) : ''),
            userImagePreview
        );

        // Clear inputs
        setInputText('');
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedImages([]);
        setImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Processing
        setIsProcessing(true);
        setMessages(prev => [...prev, {
            id: 'processing',
            type: 'processing',
            timestamp: new Date()
        }]);

        try {
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('role', userRole || 'estudiante');
            if (studentUserId) formData.append('student_user_id', studentUserId);
            const directedText = intent === 'prueba'
                ? `Crear una prueba para ${studentName || 'el estudiante'}. ${userText}`.trim()
                : userText;
            if (directedText) formData.append('text_input', directedText);
            userImages.slice(0, MAX_EVENT_IMAGES).forEach((imageFile) => formData.append('images', imageFile));
            formData.append('dry_run', 'true');

            const res = await authFetch('/api/calendar/smart-create', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            // Remove processing message
            setMessages(prev => prev.filter(m => m.id !== 'processing'));

            if (data.success && data.events?.length > 0) {
                addBotMessage(`Encontré **${data.events.length} evento(s)**. Te los dejo marcados en verde; desmarca lo que no quieras agendar y confirma.`);
                addEventReviewMessage(data.events);
            } else {
                addBotMessage(`No pude interpretar bien eso. ${data.error || 'Intenta con otra foto mas clara o describe el evento con mas detalle.'}`);
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== 'processing'));
            addBotMessage('Hubo un error al procesar. Intenta de nuevo.');
            console.error('[CHAT-EVENT] Error:', err);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#4D96FF] to-[#7C3AED] px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">{intent === 'prueba' ? 'Crear prueba' : 'Crear evento'}</h3>
                            <p className="text-white/70 text-xs font-bold">{intent === 'prueba' ? 'Foto, captura o detalles' : 'Sube una foto o escribe'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white font-bold text-2xl hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                        ✕
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                    {messages.map(msg => {
                        if (msg.type === 'processing') {
                            return (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-[#4D96FF] to-[#7C3AED] rounded-xl flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader className="w-4 h-4 text-[#7C3AED] animate-spin" />
                                            <span className="text-sm text-gray-500 font-bold">Analizando...</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (msg.type === 'event-review') {
                            const reviewItems = eventReviews[msg.reviewId] || [];
                            const selectedCount = reviewItems.filter(item => item.selected).length;
                            const locked = reviewItems.some(item => item.locked);

                            return (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-[#4D96FF] to-[#7C3AED] rounded-xl flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[90%] w-full">
                                        <p className="text-sm font-black text-[#2B2E4A] mb-2">Revisa antes de agendar</p>
                                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                                    <div className="w-8 h-8 bg-gradient-to-br from-[#4D96FF] to-[#7C3AED] rounded-xl flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm max-w-[85%]">
                                        <div className="text-sm text-[#2B2E4A] whitespace-pre-wrap leading-relaxed">
                                            {msg.text.split('**').map((part, i) =>
                                                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                            )}
                                        </div>
                                        {msg.eventData && (
                                            <div className="mt-2 flex items-center gap-2">
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
                                                alt="Foto enviada"
                                                className="rounded-xl mb-2 max-h-48 w-full object-cover"
                                            />
                                        )}
                                        {msg.text && msg.text !== 'Imagen enviada' && (
                                            <p className="text-sm text-white">{msg.text}</p>
                                        )}
                                        {msg.text === 'Imagen enviada' && !msg.imageUrl && (
                                            <p className="text-sm text-white/70">Imagen enviada</p>
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
                {(imagePreviews.length > 0 || imagePreview) && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 overflow-x-auto">
                            {(imagePreviews.length ? imagePreviews : [imagePreview]).slice(0, MAX_EVENT_IMAGES).map((preview, index) => (
                                <img key={`${preview}-${index}`} src={preview} alt={`Preview ${index + 1}`} className="h-20 w-16 rounded-xl object-cover bg-gray-100" />
                            ))}
                            <button
                                onClick={removeImage}
                                className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md shrink-0"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black text-[#64748B] shrink-0">{(imagePreviews.length || 1)}/{MAX_EVENT_IMAGES}</span>
                        </div>
                    </div>
                )}

                {/* Input area */}
                <div className="px-3 py-3 bg-white border-t border-gray-100 shrink-0 space-y-2">
                    {/* Hidden file inputs */}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onClick={(e) => { e.currentTarget.value = ''; }} onChange={handleImageSelect} className="hidden" />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />

                    {/* Capture buttons row - estilo Oraculo */}
                    <div className={`grid gap-2 ${isNativePlatform ? 'grid-cols-2' : (isMobile ? 'grid-cols-2' : 'grid-cols-3')}`}>
                        <button
                            type="button"
                            onClick={openCamera}
                            className="rounded-2xl border-2 border-gray-200 bg-white px-2 py-2.5 text-xs font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Camera className="w-4 h-4" /> Tomar foto
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-2xl border-2 border-[#4D96FF] bg-[#EEF4FF] px-2 py-2.5 text-xs font-black text-[#1D4ED8] hover:border-[#1D4ED8] flex items-center justify-center gap-1.5 transition-all"
                        >
                            <UploadCloud className="w-4 h-4" /> Subir fotos
                        </button>
                        {/* Desktop: captura pantalla web */}
                        {!isNativePlatform && !isMobile && (
                            <button
                                type="button"
                                onClick={captureScreenWeb}
                                className="rounded-2xl border-2 border-gray-200 bg-white px-2 py-2.5 text-xs font-black text-[#2B2E4A] hover:border-[#7C3AED]/50 flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Monitor className="w-4 h-4" /> Captura pantalla
                            </button>
                        )}
                        {/* APK nativo: boton captura celular (marco azul) */}
                        {isNativePlatform && (
                            <button
                                type="button"
                                onClick={nativeCaptureSupported ? captureFromNativeApp : () => addBotMessage('La captura nativa no se inicializo. Cierra y vuelve a abrir la app.')}
                                className={nativeCaptureSupported
                                    ? 'rounded-2xl border-2 border-[#16A34A] bg-[#ECFDF3] px-2 py-2.5 text-xs font-black text-[#166534] hover:border-[#15803D] flex items-center justify-center gap-1.5 transition-all col-span-2'
                                    : 'rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-2 py-2.5 text-xs font-black text-gray-500 flex items-center justify-center gap-1.5 col-span-2'
                                }
                            >
                                <Smartphone className="w-4 h-4" />
                                {nativeSessionActive ? 'Capturar ahora' : 'Captura pantalla celular'}
                            </button>
                        )}
                    </div>

                    {/* Native session controls: stop + import queue */}
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

                    {/* Text input + voice + send */}
                    <div className="flex items-end gap-1.5">
                        <div className="flex-1">
                            <textarea
                                ref={textareaRef}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={intent === 'prueba' ? 'O escribe los detalles de la prueba...' : 'O escribe los detalles...'}
                                rows={1}
                                className="w-full px-3 py-2.5 rounded-2xl bg-gray-100 text-sm text-[#2B2E4A] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 max-h-[100px]"
                                disabled={isProcessing}
                            />
                        </div>

                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={`p-2.5 rounded-xl transition-all shrink-0 ${
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
                            disabled={isProcessing || (!inputText.trim() && selectedImages.length === 0 && !selectedImage)}
                            className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                (inputText.trim() || selectedImages.length > 0 || selectedImage) && !isProcessing
                                    ? 'bg-[#7C3AED] text-white shadow-lg shadow-purple-500/30 hover:bg-[#6D28D9]'
                                    : 'bg-gray-100 text-gray-300'
                            }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
   