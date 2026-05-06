import React, { useState, useRef, useEffect } from 'react';
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
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastCreatedEvent, setLastCreatedEvent] = useState(null);

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
        setLastCreatedEvent(null);
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

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
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
                    const reader = new FileReader();
                    reader.onload = (ev) => setImagePreview(ev.target.result);
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
            // Tomar la primera captura de la cola como imagen seleccionada
            const row = rows[0];
            const base64 = String(row?.imageBase64 || row?.image_base64 || '').trim();
            const mimeType = String(row?.imageMimeType || row?.image_mime_type || 'image/jpeg').trim() || 'image/jpeg';
            if (base64) {
                const dataUrl = `data:${mimeType};base64,${base64}`;
                const resp = await fetch(dataUrl);
                const blob = await resp.blob();
                const file = new File([blob], 'captura-nativa.png', { type: mimeType });
                setSelectedImage(file);
                setImagePreview(dataUrl);
                addBotMessage(`Se importo ${rows.length} captura(s). La primera esta lista para enviar.`);
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
                    const reader = new FileReader();
                    reader.onload = (ev) => setImagePreview(ev.target.result);
                    reader.readAsDataURL(file);
                }
            }, 'image/png');
        } catch (err) {
            console.error('[SCREEN-CAPTURE] Error:', err);
        }
    };

    const handleSend = async () => {
        if (isProcessing) return;
        if (!inputText.trim() && !selectedImage) return;

        // Stop listening if active
        if (isListening) stopListening();

        const userText = inputText.trim();
        const userImage = selectedImage;
        const userImagePreview = imagePreview;

        // Add user message
        addUserMessage(userText || (userImage ? (intent === 'prueba' ? 'Imagen de prueba enviada' : 'Imagen enviada') : ''), userImagePreview);

        // Clear inputs
        setInputText('');
        setSelectedImage(null);
        setImagePreview(null);
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
            if (userImage) formData.append('image', userImage);

            const res = await fetch('/api/calendar/smart-create', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            // Remove processing message
            setMessages(prev => prev.filter(m => m.id !== 'processing'));

            if (data.success && (data.events?.length > 0 || data.extracted || data.total_skipped_duplicates > 0)) {
                const events = data.events || [data.extracted];
                setLastCreatedEvent(data.event);

                if (events.length === 0 && data.total_skipped_duplicates > 0) {
                    addBotMessage(
                        `No dupliqué nada: ${data.total_skipped_duplicates} evento(s) de esta imagen ya estaban registrados para este estudiante.`,
                        null
                    );
                } else if (events.length === 1) {
                    const ev = events[0];
                    const typeConf = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.otro;
                    addBotMessage(
                        `${typeConf.emoji} Evento creado:\n\n**${ev.title}**\nTipo: ${typeConf.label}\nFecha: ${ev.event_date}${ev.start_time ? ` a las ${ev.start_time}` : ''}\nMateria: ${ev.subject || 'No especificada'}\n${ev.description ? `\n${ev.description}` : ''}\n\nConfianza: ${ev.confidence || 'media'}`,
                        ev
                    );
                } else {
                    const summary = events.map(ev => {
                        const tc = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.otro;
                        return `${tc.emoji} **${ev.title}** - ${ev.event_date} (${ev.subject || 'Sin materia'})`;
                    }).join('\n');
                    addBotMessage(
                        `Se crearon **${events.length} eventos** desde la imagen:\n\n${summary}${data.total_skipped_duplicates ? `\n\nOmití ${data.total_skipped_duplicates} duplicado(s) que ya estaban registrados.` : ''}${data.errors?.length ? `\n\nErrores: ${data.errors.join(', ')}` : ''}`,
                        events[0]
                    );
                }

                if (onEventCreated) onEventCreated(data.event);
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
                {imagePreview && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
                        <div className="relative inline-block">
                            <img src={imagePreview} alt="Preview" className="h-20 rounded-xl object-cover" />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Input area */}
                <div className="px-3 py-3 bg-white border-t border-gray-100 shrink-0 space-y-2">
                    {/* Hidden file inputs */}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
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
                            disabled={isProcessing || (!inputText.trim() && !selectedImage)}
                            className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                (inputText.trim() || selectedImage) && !isProcessing
                                    ? 'bg-[#7C3AED] text-white shadow-lg shadow-purple-500/30 hover:bg-[#6D28D9]'
                                    : 'bg-gray-100 text-gray-300'
                            }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatEventCreator;
