import React, { useState, useRef, useEffect } from 'react';
import {
    Send, Mic, MicOff, Image, Camera, X, Calendar,
    CheckCircle, Loader, Sparkles, Clock, AlertTriangle,
    ChevronDown
} from 'lucide-react';

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

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

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

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
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

            if (data.success && data.extracted) {
                const ev = data.extracted;
                const typeConf = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.otro;

                setLastCreatedEvent(data.event);
                addBotMessage(
                    `${typeConf.emoji} Evento creado:\n\n**${ev.title}**\nTipo: ${typeConf.label}\nFecha: ${ev.event_date}${ev.start_time ? ` a las ${ev.start_time}` : ''}\nMateria: ${ev.subject || 'No especificada'}\n${ev.description ? `\n${ev.description}` : ''}\n\nConfianza: ${ev.confidence || 'media'}`,
                    ev
                );

                if (onEventCreated) onEventCreated(data.event);
            } else {
                addBotMessage(`No pude interpretar bien eso. ${data.error || 'Intenta con otra foto o describe el evento con más detalle.'}`);
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
                <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
                    <div className="flex items-end gap-2">
                        {/* Image buttons */}
                        <div className="flex gap-1 shrink-0">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Subir foto"
                            >
                                <Image className="w-5 h-5 text-gray-500" />
                            </button>
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Tomar foto"
                            >
                                <Camera className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Text input */}
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={intent === 'prueba' ? 'Sube una captura o escribe la prueba...' : 'Escribe o sube una foto...'}
                                rows={1}
                                className="w-full px-4 py-2.5 rounded-2xl bg-gray-100 text-sm text-[#2B2E4A] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 max-h-[120px]"
                                disabled={isProcessing}
                            />
                        </div>

                        {/* Voice button */}
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                isListening
                                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={isListening ? 'Detener' : 'Hablar'}
                            disabled={isProcessing}
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        {/* Send button */}
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
