import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, MessageCircle, ChevronDown, UploadCloud } from 'lucide-react';

const VoiceAgentChat = ({ studentUserId, userId, userRole = 'apoderado', studentName = '', onClose, onCalendarChanged }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [showMessages, setShowMessages] = useState(false);
    const [sphereState, setSphereState] = useState('idle'); // idle, listening, thinking, speaking
    const [currentTranscript, setCurrentTranscript] = useState('');

    const conversationRef = useRef([]);
    const recognitionRef = useRef(null);
    const audioRef = useRef(null);
    const audioUrlRef = useRef(null);
    const ttsRunRef = useRef(0);
    const greetedRef = useRef(false);
    const fileInputRef = useRef(null);
    const listeningDesiredRef = useRef(false);
    const processingRef = useRef(false);
    const speakingRef = useRef(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        processingRef.current = isProcessing;
    }, [isProcessing]);

    useEffect(() => {
        speakingRef.current = isSpeaking;
    }, [isSpeaking]);

    const stopAllAudio = useCallback(() => {
        ttsRunRef.current += 1;
        if (audioRef.current) {
            try {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            } catch {}
            audioRef.current = null;
        }
        if (audioUrlRef.current) {
            try { URL.revokeObjectURL(audioUrlRef.current); } catch {}
            audioUrlRef.current = null;
        }
        setIsSpeaking(false);
    }, []);

    // Greeting on mount
    useEffect(() => {
        if (greetedRef.current) return;
        greetedRef.current = true;
        const greeting = `Hola${studentName ? `, soy Matico. Preguntame lo que quieras sobre ${studentName}` : '! Soy Matico, tu asistente escolar'}. Puedes hablarme o escribirme.`;
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        if (ttsEnabled) speakText(greeting);
    }, []);

    useEffect(() => {
        return () => {
            listeningDesiredRef.current = false;
            stopAllAudio();
            if (recognitionRef.current) {
                const recognition = recognitionRef.current;
                recognitionRef.current = null;
                try { recognition.onend = null; } catch {}
                try { recognition.stop(); } catch {}
            }
        };
    }, [stopAllAudio]);

    const restartListeningSoon = useCallback(() => {
        if (!listeningDesiredRef.current || processingRef.current || speakingRef.current || recognitionRef.current) return;
        window.setTimeout(() => {
            if (!listeningDesiredRef.current || processingRef.current || speakingRef.current || recognitionRef.current) return;
            startListening({ preserveAudio: true });
        }, 260);
    }, []);

    // Speech-to-Text via Web Speech API (fallback) or Whisper
    const startListening = useCallback(({ preserveAudio = false } = {}) => {
        listeningDesiredRef.current = true;
        if (recognitionRef.current || isSpeaking || isProcessing) return;
        // Stop any playing audio
        if (!preserveAudio) stopAllAudio();

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-CL';
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let transcript = '';
                let isFinal = false;
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                    if (event.results[i].isFinal) isFinal = true;
                }
                setCurrentTranscript(transcript);
                if (isFinal && transcript.trim()) {
                    setCurrentTranscript('');
                    stopListening({ preserveDesired: true });
                    sendMessage(transcript.trim());
                }
            };

            recognition.onerror = (e) => {
                console.error('[STT] Error:', e.error);
                // Auto-restart on non-fatal errors
                if (e.error === 'no-speech' || e.error === 'aborted') {
                    if (listeningDesiredRef.current) try { recognition.start(); } catch {}
                    return;
                }
                setIsListening(false);
                setSphereState('idle');
                setCurrentTranscript('');
            };

            recognition.onend = () => {
                // Auto-restart if still supposed to be listening
                if (recognitionRef.current === recognition && listeningDesiredRef.current && !processingRef.current && !speakingRef.current) {
                    try { recognition.start(); } catch {}
                    return;
                }
                setIsListening(false);
                if (sphereState === 'listening') setSphereState('idle');
                setCurrentTranscript('');
            };

            recognition.start();
            recognitionRef.current = recognition;
            setIsListening(true);
            setSphereState('listening');
        } else {
            alert('Tu navegador no soporta reconocimiento de voz');
        }
    }, [sphereState, stopAllAudio, isSpeaking, isProcessing]);

    const stopListening = useCallback(({ preserveDesired = false } = {}) => {
        if (!preserveDesired) listeningDesiredRef.current = false;
        if (recognitionRef.current) {
            const recognition = recognitionRef.current;
            recognitionRef.current = null;
            try { recognition.onend = null; } catch {}
            try { recognition.stop(); } catch {}
        }
        setIsListening(false);
        setCurrentTranscript('');
        if (sphereState === 'listening') setSphereState('idle');
    }, [sphereState]);

    const toggleListening = () => {
        if (isListening || listeningDesiredRef.current) stopListening();
        else startListening();
    };

    // TTS via OpenAI
    const speakText = async (text) => {
        if (!ttsEnabled || !text) return;
        const shouldResumeListening = listeningDesiredRef.current;
        stopListening({ preserveDesired: shouldResumeListening });
        stopAllAudio();
        const runId = ttsRunRef.current;
        speakingRef.current = true;
        setIsSpeaking(true);
        setSphereState('speaking');

        try {
            const res = await fetch('/api/agent/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: 'onyx' })
            });

            if (!res.ok) throw new Error('TTS failed');

            const blob = await res.blob();
            if (runId !== ttsRunRef.current) return;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audioUrlRef.current = url;

            audio.onended = () => {
                if (runId !== ttsRunRef.current) return;
                speakingRef.current = false;
                setIsSpeaking(false);
                setSphereState('idle');
                URL.revokeObjectURL(url);
                audioRef.current = null;
                audioUrlRef.current = null;
                restartListeningSoon();
            };

            audio.onerror = () => {
                if (runId !== ttsRunRef.current) return;
                speakingRef.current = false;
                setIsSpeaking(false);
                setSphereState('idle');
                URL.revokeObjectURL(url);
                audioRef.current = null;
                audioUrlRef.current = null;
                restartListeningSoon();
            };

            await audio.play();
        } catch (err) {
            console.error('[TTS] Error:', err);
            speakingRef.current = false;
            setIsSpeaking(false);
            setSphereState('idle');
            restartListeningSoon();
        }
    };

    const addAssistantMessage = async (text, { speak = true } = {}) => {
        const botMsg = { role: 'assistant', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, botMsg]);
        conversationRef.current.push({ role: 'assistant', content: text });
        if (speak && ttsEnabled) {
            // Fire TTS without blocking — sphere already shows 'speaking'
            speakText(text);
        } else {
            setSphereState('idle');
            restartListeningSoon();
        }
    };

    const isCloseIntent = (text = '') => /\b(cierra|cerrar|salir|terminar|finaliza|finalizar)\b.*\b(conversacion|chat|matico|ventana)?\b/i.test(text);

    const isCalendarIntent = (text = '') => /\b(agenda|agendar|crear evento|crea un evento|registrar|anotar|recordar|recordatorio|tiene prueba|tiene evaluacion|tiene evaluación|prueba el|prueba para|evaluacion el|evaluación el|examen el|tarea el|tarea para|disertacion el|disertación el|evento el|materiales el)\b/i.test(text);

    const createEventsFromTextOrImages = async ({ text = '', files = [] } = {}) => {
        const limitedFiles = Array.from(files || []).slice(0, 10);
        const formData = new FormData();
        formData.append('user_id', userId || studentUserId || '');
        formData.append('role', userRole || 'apoderado');
        if (studentUserId) formData.append('student_user_id', studentUserId);
        if (text) formData.append('text_input', text);
        limitedFiles.forEach(file => formData.append('images', file));

        const res = await fetch('/api/calendar/smart-create', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!data.success) {
            return data.error || 'No pude interpretar eso para crear un evento.';
        }
        const created = data.events || [];
        const skipped = data.total_skipped_duplicates || 0;
        if (created.length === 0 && skipped > 0) {
            return `No dupliqué nada: ${skipped} evento(s) ya estaban registrados.`;
        }
        if (created.length === 0) {
            return 'No encontré eventos claros para agendar.';
        }
        onCalendarChanged?.(created);
        const summary = created.slice(0, 5).map(ev =>
            `${ev.title || 'Evento'}: ${ev.event_date || 'sin fecha'}${ev.subject ? `, ${ev.subject}` : ''}`
        ).join('. ');
        return `Listo, agendé ${created.length} evento(s). ${summary}${created.length > 5 ? '. Hay más eventos guardados en calendario.' : ''}`;
    };

    const handleFilesSelected = async (event) => {
        const files = Array.from(event.target.files || []).slice(0, 10);
        event.target.value = '';
        if (!files.length || isProcessing) return;

        stopListening();
        stopAllAudio();
        const label = files.length === 1 ? 'Subí una imagen para revisar.' : `Subí ${files.length} imágenes para revisar.`;
        setMessages(prev => [...prev, { role: 'user', content: label, timestamp: new Date() }]);
        processingRef.current = true;
        setIsProcessing(true);
        setSphereState('thinking');

        try {
            const reply = await createEventsFromTextOrImages({ files });
            await addAssistantMessage(reply);
        } catch (err) {
            console.error('[VOICE-AGENT] Upload error:', err);
            await addAssistantMessage('No pude procesar las imágenes. Intenta de nuevo con fotos más claras.');
        } finally {
            processingRef.current = false;
            setIsProcessing(false);
            restartListeningSoon();
        }
    };

    // Send message to agent
    const sendMessage = async (text) => {
        if (!text || isProcessing) return;
        const shouldResumeListening = listeningDesiredRef.current;
        stopListening({ preserveDesired: shouldResumeListening });
        stopAllAudio();

        const userMsg = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        conversationRef.current.push({ role: 'user', content: text });
        setInputText('');
        processingRef.current = true;
        setIsProcessing(true);
        setSphereState('thinking');

        try {
            if (isCloseIntent(text)) {
                listeningDesiredRef.current = false;
                await addAssistantMessage('Listo, cierro la conversación.');
                setTimeout(() => onClose?.(), 450);
                return;
            }

            if (isCalendarIntent(text)) {
                const reply = await createEventsFromTextOrImages({ text });
                await addAssistantMessage(reply);
                return;
            }

            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    student_id: studentUserId || userId,
                    user_type: userRole === 'apoderado' ? 'parent' : 'student',
                    conversation_history: conversationRef.current.slice(-6)
                })
            });
            const data = await res.json();

            const reply = data.success && data.reply ? data.reply : 'No pude obtener una respuesta.';
            await addAssistantMessage(reply);
        } catch (err) {
            console.error('[AGENT] Error:', err);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.', timestamp: new Date() }]);
            setSphereState('idle');
            restartListeningSoon();
        } finally {
            setIsProcessing(false);
            processingRef.current = false;
            restartListeningSoon();
        }
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (inputText.trim()) sendMessage(inputText.trim());
    };

    const quickQuestions = [
        'Estudio hoy?',
        'Como le fue esta semana?',
        'Proximas pruebas?',
        'Que materias tiene abandonadas?'
    ];

    const energyVeins = [
        { top: '18%', left: '-12%', rotate: -10, width: '126%', delay: '0s', duration: '2.8s', opacity: 0.52 },
        { top: '28%', left: '-8%', rotate: 18, width: '116%', delay: '0.25s', duration: '3.1s', opacity: 0.45 },
        { top: '38%', left: '-14%', rotate: -30, width: '132%', delay: '0.5s', duration: '2.6s', opacity: 0.62 },
        { top: '48%', left: '-10%', rotate: 8, width: '128%', delay: '0.1s', duration: '2.4s', opacity: 0.7 },
        { top: '58%', left: '-15%', rotate: 35, width: '135%', delay: '0.7s', duration: '3.2s', opacity: 0.5 },
        { top: '68%', left: '-9%', rotate: -18, width: '118%', delay: '0.45s', duration: '2.9s', opacity: 0.58 },
        { top: '78%', left: '-12%', rotate: 24, width: '124%', delay: '0.9s', duration: '3.4s', opacity: 0.42 }
    ];
    const particles = [
        { top: '8%', left: '44%', size: 5, delay: '0s' },
        { top: '15%', left: '73%', size: 4, delay: '0.25s' },
        { top: '34%', left: '94%', size: 3, delay: '0.5s' },
        { top: '62%', left: '91%', size: 5, delay: '0.75s' },
        { top: '84%', left: '67%', size: 4, delay: '1s' },
        { top: '89%', left: '36%', size: 3, delay: '1.25s' },
        { top: '72%', left: '9%', size: 5, delay: '1.5s' },
        { top: '42%', left: '3%', size: 4, delay: '1.75s' },
        { top: '20%', left: '20%', size: 3, delay: '2s' },
        { top: '50%', left: '102%', size: 3, delay: '2.25s' },
        { top: '96%', left: '50%', size: 4, delay: '2.5s' },
        { top: '2%', left: '60%', size: 3, delay: '2.75s' }
    ];

    // Sphere animation classes
    const sphereClasses = {
        idle: 'sphere-breathe',
        listening: 'sphere-listening scale-105',
        thinking: 'sphere-thinking',
        speaking: 'sphere-speaking scale-105'
    };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col toroid-scene" data-state={sphereState}>
            {/* Dark storm background */}
            <div className="absolute inset-0 toroid-bg" />
            <div className="storm-cloud storm-cloud-1" />
            <div className="storm-cloud storm-cloud-2" />
            <div className="storm-cloud storm-cloud-3" />

            {/* Top right controls */}
            <div className="relative z-20 flex items-center justify-end px-4 pt-4 pb-2 gap-2">
                <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-sm border border-white/10"
                >
                    {ttsEnabled ? <Volume2 className="w-5 h-5 text-blue-300" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
                </button>
                <button
                    onClick={() => setShowMessages(!showMessages)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-sm border border-white/10"
                >
                    <MessageCircle className="w-5 h-5 text-blue-300" />
                </button>
            </div>

            {/* Messages panel (collapsible overlay) */}
            {showMessages && (
                <div className="absolute inset-x-0 bottom-48 top-16 bg-[#0a0e1a]/95 backdrop-blur-lg rounded-t-3xl p-4 overflow-y-auto z-30 shadow-2xl border border-blue-900/30">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-blue-400 text-sm font-bold">Conversacion</p>
                        <button onClick={() => setShowMessages(false)} className="p-1 rounded-full bg-white/10">
                            <ChevronDown className="w-4 h-4 text-blue-400" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/10 text-blue-100'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* Toroid Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10">
                {/* Toroid container */}
                <div className="voice-toroid relative w-72 h-52 md:w-[420px] md:h-[280px]" data-state={sphereState}>
                    {/* Ambient glow behind toroid */}
                    <div className="toroid-glow" />

                    {/* The toroid shape */}
                    <div className="toroid-body">
                        <div className="toroid-ring" />
                        <div className="toroid-inner-shadow" />
                        <div className="toroid-surface-light" />
                        <div className="toroid-energy-band toroid-energy-band-1" />
                        <div className="toroid-energy-band toroid-energy-band-2" />
                        <div className="toroid-energy-band toroid-energy-band-3" />
                        <div className="toroid-highlight" />
                    </div>

                    {/* Lightning rays — extend from sides, animate on speaking */}
                    <div className="lightning-container">
                        {[...Array(6)].map((_, i) => (
                            <div key={`ray-l-${i}`} className={`electric-ray ray-left ray-left-${i + 1}`} />
                        ))}
                        {[...Array(6)].map((_, i) => (
                            <div key={`ray-r-${i}`} className={`electric-ray ray-right ray-right-${i + 1}`} />
                        ))}
                    </div>

                    {/* Floating particles around toroid */}
                    {[...Array(10)].map((_, i) => (
                        <div key={`tp-${i}`} className={`toroid-particle tp-${i + 1}`} />
                    ))}

                    {/* Listening indicator — energy below toroid */}
                    <div className="listen-zone">
                        <div className="listen-wave listen-wave-1" />
                        <div className="listen-wave listen-wave-2" />
                        <div className="listen-wave listen-wave-3" />
                        <div className="listen-bolt listen-bolt-1" />
                        <div className="listen-bolt listen-bolt-2" />
                        <div className="listen-bolt listen-bolt-3" />
                        <div className="listen-bolt listen-bolt-4" />
                        <div className="listen-bolt listen-bolt-5" />
                        <div className="listen-ripple listen-ripple-1" />
                        <div className="listen-ripple listen-ripple-2" />
                    </div>
                </div>

                {/* Status text */}
                <div className="mt-6 text-center relative z-10">
                    <p className={`text-base font-semibold transition-colors duration-300 ${
                        sphereState === 'listening' ? 'text-blue-400' :
                        sphereState === 'thinking' ? 'text-purple-400' :
                        sphereState === 'speaking' ? 'text-cyan-400' :
                        'text-gray-500'
                    }`}>
                        {sphereState === 'listening' ? (currentTranscript || 'Escuchando...') :
                         sphereState === 'thinking' ? 'Pensando...' :
                         sphereState === 'speaking' ? 'Hablando...' :
                         ''}
                    </p>
                    {messages.length > 0 && !showMessages && sphereState === 'idle' && (
                        <p className="text-sm text-blue-300/60 mt-2 max-w-sm mx-auto line-clamp-3 leading-relaxed">
                            {messages[messages.length - 1]?.content}
                        </p>
                    )}
                </div>

                {/* Quick questions */}
                {messages.length <= 1 && !isProcessing && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md relative z-10">
                        {quickQuestions.map((q, i) => (
                            <button key={i} onClick={() => sendMessage(q)}
                                className="px-4 py-2 rounded-full bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 text-sm font-medium transition border border-blue-700/40 backdrop-blur-sm">
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom: Input + Buttons */}
            <div className="relative z-20 px-4 pb-6 pt-2">
                {/* Text input */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4">
                    <div className="flex-1 relative">
                        <input ref={inputRef} type="text" value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Escribe tu mensaje..."
                            disabled={isProcessing}
                            className="w-full bg-[#0d1225]/80 border border-blue-800/40 rounded-full px-5 py-3.5 text-blue-100 placeholder-blue-600/50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900/50 text-sm backdrop-blur-sm"
                        />
                        <button type="submit" disabled={!inputText.trim() || isProcessing}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-600 text-white transition">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>

                {/* Action buttons row */}
                <div className="flex items-center justify-center gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-14 h-14 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition border border-white/10 backdrop-blur-sm"
                        title="Subir fotos, archivos o capturas"
                    >
                        <UploadCloud className="w-6 h-6 text-blue-400" />
                    </button>

                    <button onClick={toggleListening}
                        className={`w-18 h-18 p-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isListening
                                ? 'bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.5)] scale-110 border-4 border-red-400/50'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)] border-4 border-blue-400/40'
                        } ${isProcessing ? 'opacity-50' : ''}`}>
                        {isListening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
                    </button>

                    <button onClick={() => setShowMessages(!showMessages)}
                        className="w-14 h-14 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition border border-white/10 backdrop-blur-sm">
                        <MessageCircle className="w-6 h-6 text-blue-400" />
                    </button>

                    <button onClick={() => {
                        listeningDesiredRef.current = false;
                        stopListening();
                        stopAllAudio();
                        onClose?.();
                    }}
                        className="w-14 h-14 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition border border-white/10 backdrop-blur-sm">
                        <X className="w-6 h-6 text-blue-400" />
                    </button>
                </div>

                <p className="text-center text-blue-600/50 text-xs mt-3">
                    {isListening ? 'Modo manos libres activo: habla cuando quieras' : 'Toca una vez el microfono para dejar a Matico escuchando'}
                </p>
            </div>

            {/* CSS — Toroid Design */}
            <style>{`
                /* ===== Background ===== */
                .toroid-scene { overflow: hidden; }
                .toroid-bg {
                    background: radial-gradient(ellipse 120% 80% at 50% 40%, #0c1a3a 0%, #070d1f 50%, #030508 100%);
                    z-index: 0;
                }
                .storm-cloud {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(60px);
                    opacity: 0.15;
                    z-index: 1;
                    pointer-events: none;
                }
                .storm-cloud-1 {
                    width: 500px; height: 200px;
                    top: 5%; left: -10%;
                    background: radial-gradient(ellipse, rgba(30,58,138,0.5), transparent);
                    animation: cloud-float 12s ease-in-out infinite alternate;
                }
                .storm-cloud-2 {
                    width: 400px; height: 180px;
                    top: 15%; right: -8%;
                    background: radial-gradient(ellipse, rgba(59,130,246,0.3), transparent);
                    animation: cloud-float 15s ease-in-out infinite alternate-reverse;
                }
                .storm-cloud-3 {
                    width: 600px; height: 160px;
                    bottom: 25%; left: 10%;
                    background: radial-gradient(ellipse, rgba(14,165,233,0.2), transparent);
                    animation: cloud-float 18s ease-in-out infinite alternate;
                }

                /* ===== Toroid Container ===== */
                .voice-toroid {
                    perspective: 800px;
                    isolation: isolate;
                }

                /* ===== Ambient Glow ===== */
                .toroid-glow {
                    position: absolute;
                    left: 50%; top: 50%;
                    width: 140%; height: 120%;
                    transform: translate(-50%, -50%);
                    background: radial-gradient(ellipse 60% 40% at center,
                        rgba(59,130,246,0.25) 0%,
                        rgba(14,165,233,0.12) 30%,
                        rgba(6,182,212,0.05) 55%,
                        transparent 75%);
                    filter: blur(20px);
                    animation: glow-pulse 4s ease-in-out infinite;
                    z-index: 0;
                }
                .voice-toroid[data-state="speaking"] .toroid-glow {
                    width: 180%; height: 150%;
                    filter: blur(16px);
                    background: radial-gradient(ellipse 60% 40% at center,
                        rgba(34,211,238,0.45) 0%,
                        rgba(59,130,246,0.25) 30%,
                        rgba(14,165,233,0.1) 55%,
                        transparent 75%);
                }
                .voice-toroid[data-state="listening"] .toroid-glow {
                    background: radial-gradient(ellipse 60% 40% at center,
                        rgba(59,130,246,0.35) 0%,
                        rgba(37,99,235,0.18) 30%,
                        transparent 65%);
                }

                /* ===== Toroid Body ===== */
                .toroid-body {
                    position: absolute;
                    inset: 0;
                    transform: rotateX(24deg);
                    transform-style: preserve-3d;
                    z-index: 2;
                }
                .toroid-ring {
                    position: absolute;
                    inset: 8% 4%;
                    border-radius: 50%;
                    background: radial-gradient(ellipse 100% 100% at 50% 50%,
                        transparent 36%,
                        rgba(8,27,75,0.9) 37%,
                        rgba(15,45,120,0.95) 42%,
                        rgba(30,80,180,0.8) 48%,
                        rgba(59,130,246,0.7) 52%,
                        rgba(34,211,238,0.5) 56%,
                        rgba(30,80,180,0.6) 60%,
                        rgba(15,45,120,0.7) 65%,
                        rgba(8,20,60,0.85) 72%,
                        transparent 73%);
                    box-shadow:
                        0 0 60px rgba(59,130,246,0.4),
                        0 0 120px rgba(14,165,233,0.2),
                        inset 0 0 40px rgba(59,130,246,0.3);
                    animation: toroid-breathe 4.5s ease-in-out infinite;
                }
                .voice-toroid[data-state="speaking"] .toroid-ring {
                    box-shadow:
                        0 0 100px rgba(34,211,238,0.6),
                        0 0 200px rgba(59,130,246,0.35),
                        inset 0 0 60px rgba(34,211,238,0.4);
                    animation: toroid-speaking 0.8s ease-in-out infinite;
                }
                .voice-toroid[data-state="listening"] .toroid-ring {
                    box-shadow:
                        0 0 80px rgba(59,130,246,0.5),
                        0 0 160px rgba(37,99,235,0.3),
                        inset 0 0 50px rgba(59,130,246,0.35);
                    animation: toroid-listening 1.2s ease-in-out infinite;
                }
                .voice-toroid[data-state="thinking"] .toroid-ring {
                    animation: toroid-thinking 3s ease-in-out infinite;
                }

                .toroid-inner-shadow {
                    position: absolute;
                    inset: 20% 18%;
                    border-radius: 50%;
                    background: radial-gradient(ellipse at center,
                        rgba(3,5,15,0.95) 0%,
                        rgba(5,10,30,0.9) 55%,
                        rgba(15,30,80,0.4) 80%,
                        transparent 100%);
                    z-index: 2;
                }

                .toroid-surface-light {
                    position: absolute;
                    inset: 5% 2%;
                    border-radius: 50%;
                    background: conic-gradient(from 200deg,
                        transparent 0deg,
                        rgba(125,211,252,0.15) 40deg,
                        rgba(255,255,255,0.2) 80deg,
                        rgba(125,211,252,0.1) 120deg,
                        transparent 180deg,
                        rgba(59,130,246,0.08) 240deg,
                        transparent 360deg);
                    mask-image: radial-gradient(ellipse, transparent 34%, black 40%, black 70%, transparent 76%);
                    animation: surface-rotate 12s linear infinite;
                    z-index: 3;
                }

                .toroid-energy-band {
                    position: absolute;
                    inset: 6% 3%;
                    border-radius: 50%;
                    mask-image: radial-gradient(ellipse, transparent 35%, black 39%, black 69%, transparent 73%);
                    z-index: 4;
                    opacity: 0.6;
                }
                .toroid-energy-band-1 {
                    background: conic-gradient(from 0deg, transparent, rgba(34,211,238,0.5) 15%, transparent 30%, transparent 50%, rgba(59,130,246,0.4) 65%, transparent 80%);
                    animation: band-rotate-1 6s linear infinite;
                }
                .toroid-energy-band-2 {
                    background: conic-gradient(from 120deg, transparent, rgba(255,255,255,0.3) 10%, transparent 20%, transparent 60%, rgba(125,211,252,0.35) 70%, transparent 80%);
                    animation: band-rotate-2 8s linear infinite reverse;
                }
                .toroid-energy-band-3 {
                    background: conic-gradient(from 240deg, transparent, rgba(14,165,233,0.4) 12%, transparent 24%);
                    animation: band-rotate-1 10s linear infinite;
                }
                .voice-toroid[data-state="speaking"] .toroid-energy-band {
                    opacity: 1;
                    animation-duration: 2s !important;
                }

                .toroid-highlight {
                    position: absolute;
                    top: 12%; left: 20%; width: 40%; height: 20%;
                    border-radius: 50%;
                    background: radial-gradient(ellipse, rgba(255,255,255,0.2), transparent 70%);
                    filter: blur(6px);
                    z-index: 5;
                    animation: highlight-drift 5s ease-in-out infinite alternate;
                }

                /* ===== Lightning Rays ===== */
                .lightning-container {
                    position: absolute;
                    inset: 0;
                    z-index: 6;
                    pointer-events: none;
                }
                .electric-ray {
                    position: absolute;
                    top: 50%;
                    height: 3px;
                    border-radius: 9999px;
                    transform-origin: center;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .ray-left { right: 50%; }
                .ray-right { left: 50%; }

                .ray-left-1 { width: 42%; transform: translateY(-8px) rotate(2deg); background: linear-gradient(270deg, rgba(34,211,238,0.9), rgba(59,130,246,0.5) 40%, transparent); animation: ray-flash 1.8s ease-in-out infinite; animation-delay: 0s; }
                .ray-left-2 { width: 55%; transform: translateY(-2px) rotate(-5deg); background: linear-gradient(270deg, rgba(255,255,255,0.8), rgba(125,211,252,0.4) 50%, transparent); animation: ray-flash 2.1s ease-in-out infinite; animation-delay: 0.3s; }
                .ray-left-3 { width: 38%; transform: translateY(6px) rotate(8deg); background: linear-gradient(270deg, rgba(14,165,233,0.85), rgba(37,99,235,0.3) 45%, transparent); animation: ray-flash 1.6s ease-in-out infinite; animation-delay: 0.6s; }
                .ray-left-4 { width: 48%; transform: translateY(-14px) rotate(-3deg); height: 2px; background: linear-gradient(270deg, rgba(125,211,252,0.7), transparent 55%); animation: ray-flash 2.4s ease-in-out infinite; animation-delay: 0.15s; }
                .ray-left-5 { width: 35%; transform: translateY(12px) rotate(6deg); height: 4px; background: linear-gradient(270deg, rgba(34,211,238,0.6), transparent 50%); animation: ray-flash 1.9s ease-in-out infinite; animation-delay: 0.45s; }
                .ray-left-6 { width: 60%; transform: translateY(0) rotate(-1deg); height: 2px; background: linear-gradient(270deg, rgba(255,255,255,0.5), rgba(59,130,246,0.2) 60%, transparent); animation: ray-flash 2.6s ease-in-out infinite; animation-delay: 0.8s; }

                .ray-right-1 { width: 45%; transform: translateY(-6px) rotate(-2deg); background: linear-gradient(90deg, rgba(34,211,238,0.9), rgba(59,130,246,0.5) 40%, transparent); animation: ray-flash 1.7s ease-in-out infinite; animation-delay: 0.1s; }
                .ray-right-2 { width: 52%; transform: translateY(3px) rotate(4deg); background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(125,211,252,0.4) 50%, transparent); animation: ray-flash 2.2s ease-in-out infinite; animation-delay: 0.4s; }
                .ray-right-3 { width: 40%; transform: translateY(-10px) rotate(-7deg); background: linear-gradient(90deg, rgba(14,165,233,0.85), rgba(37,99,235,0.3) 45%, transparent); animation: ray-flash 1.5s ease-in-out infinite; animation-delay: 0.7s; }
                .ray-right-4 { width: 50%; transform: translateY(10px) rotate(3deg); height: 2px; background: linear-gradient(90deg, rgba(125,211,252,0.7), transparent 55%); animation: ray-flash 2.3s ease-in-out infinite; animation-delay: 0.2s; }
                .ray-right-5 { width: 33%; transform: translateY(-16px) rotate(-5deg); height: 4px; background: linear-gradient(90deg, rgba(34,211,238,0.6), transparent 50%); animation: ray-flash 2s ease-in-out infinite; animation-delay: 0.55s; }
                .ray-right-6 { width: 58%; transform: translateY(1px) rotate(1deg); height: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.5), rgba(59,130,246,0.2) 60%, transparent); animation: ray-flash 2.5s ease-in-out infinite; animation-delay: 0.9s; }

                /* Idle: rays barely visible */
                .voice-toroid[data-state="idle"] .electric-ray {
                    opacity: 0;
                    animation-play-state: paused;
                }
                /* Speaking: rays fully active and intense */
                .voice-toroid[data-state="speaking"] .electric-ray {
                    opacity: 1;
                    animation-duration: 0.5s !important;
                    filter: drop-shadow(0 0 8px rgba(34,211,238,0.9)) drop-shadow(0 0 20px rgba(59,130,246,0.6));
                    height: 5px !important;
                }
                /* Listening: rays subtle glow */
                .voice-toroid[data-state="listening"] .electric-ray {
                    opacity: 0.3;
                    filter: drop-shadow(0 0 4px rgba(59,130,246,0.5));
                }
                /* Thinking: rays dim pulse */
                .voice-toroid[data-state="thinking"] .electric-ray {
                    opacity: 0.15;
                    animation-duration: 3s !important;
                }

                /* ===== Particles ===== */
                .toroid-particle {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(125,211,252,0.8);
                    box-shadow: 0 0 8px rgba(34,211,238,0.7);
                    z-index: 7;
                    animation: tp-float 4s ease-in-out infinite alternate;
                }
                .tp-1 { width: 4px; height: 4px; top: 20%; left: 15%; animation-delay: 0s; }
                .tp-2 { width: 3px; height: 3px; top: 25%; right: 12%; animation-delay: 0.4s; }
                .tp-3 { width: 5px; height: 5px; top: 40%; left: 5%; animation-delay: 0.8s; }
                .tp-4 { width: 3px; height: 3px; top: 55%; right: 8%; animation-delay: 1.2s; }
                .tp-5 { width: 4px; height: 4px; top: 65%; left: 20%; animation-delay: 1.6s; }
                .tp-6 { width: 3px; height: 3px; top: 30%; left: 45%; animation-delay: 2s; }
                .tp-7 { width: 5px; height: 5px; top: 15%; right: 25%; animation-delay: 2.4s; }
                .tp-8 { width: 4px; height: 4px; top: 70%; right: 18%; animation-delay: 2.8s; }
                .tp-9 { width: 3px; height: 3px; top: 48%; left: 90%; animation-delay: 3.2s; }
                .tp-10 { width: 4px; height: 4px; top: 35%; left: 8%; animation-delay: 3.6s; }

                .voice-toroid[data-state="speaking"] .toroid-particle {
                    background: rgba(255,255,255,0.95);
                    box-shadow: 0 0 14px rgba(34,211,238,1);
                    animation-duration: 1.5s;
                }

                /* ===== Listening Zone (below toroid) ===== */
                .listen-zone {
                    position: absolute;
                    bottom: -30%;
                    left: 10%;
                    right: 10%;
                    height: 60%;
                    z-index: 1;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.4s;
                }
                .voice-toroid[data-state="listening"] .listen-zone {
                    opacity: 1;
                }

                .listen-wave {
                    position: absolute;
                    left: 50%;
                    top: 10%;
                    width: 70%;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid rgba(59,130,246,0.4);
                    transform: translateX(-50%) scale(0.5);
                    opacity: 0;
                    animation: listen-wave-expand 1.4s ease-out infinite;
                }
                .listen-wave-2 { animation-delay: 0.35s; border-color: rgba(34,211,238,0.35); }
                .listen-wave-3 { animation-delay: 0.7s; border-color: rgba(125,211,252,0.3); }

                .listen-bolt {
                    position: absolute;
                    left: 50%;
                    top: 0;
                    width: 3px;
                    height: 50px;
                    border-radius: 9999px;
                    background: linear-gradient(180deg, rgba(59,130,246,0.8), rgba(125,211,252,0.5), transparent);
                    transform-origin: top center;
                    opacity: 0;
                    filter: drop-shadow(0 0 10px rgba(59,130,246,0.8));
                    animation: listen-bolt-fire 0.8s ease-in-out infinite;
                }
                .listen-bolt-1 { transform: translateX(-50%) rotate(0deg); animation-delay: 0s; }
                .listen-bolt-2 { transform: translateX(-50%) rotate(-18deg); height: 40px; animation-delay: 0.12s; }
                .listen-bolt-3 { transform: translateX(-50%) rotate(20deg); height: 45px; animation-delay: 0.24s; }
                .listen-bolt-4 { transform: translateX(-50%) rotate(-10deg); height: 35px; animation-delay: 0.36s; }
                .listen-bolt-5 { transform: translateX(-50%) rotate(12deg); height: 42px; animation-delay: 0.48s; }

                .listen-ripple {
                    position: absolute;
                    left: 50%;
                    top: 30%;
                    width: 100px;
                    height: 16px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(125,211,252,0.5);
                    transform: translateX(-50%) scale(0.4);
                    opacity: 0;
                    animation: listen-ripple-out 1.6s ease-out infinite;
                    filter: drop-shadow(0 0 6px rgba(59,130,246,0.4));
                }
                .listen-ripple-2 { animation-delay: 0.5s; }

                /* ===== KEYFRAMES ===== */
                @keyframes cloud-float {
                    0% { transform: translateX(0) translateY(0); }
                    100% { transform: translateX(40px) translateY(-15px); }
                }
                @keyframes glow-pulse {
                    0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
                    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
                }
                @keyframes toroid-breathe {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
                @keyframes toroid-speaking {
                    0%, 100% { transform: scale(1.02); filter: brightness(1.1); }
                    50% { transform: scale(1.06); filter: brightness(1.3); }
                }
                @keyframes toroid-listening {
                    0%, 100% { transform: scale(1.01); }
                    50% { transform: scale(1.04); }
                }
                @keyframes toroid-thinking {
                    0%, 100% { transform: scale(1); filter: hue-rotate(0deg); }
                    50% { transform: scale(1.02); filter: hue-rotate(20deg); }
                }
                @keyframes surface-rotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes band-rotate-1 {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes band-rotate-2 {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(-360deg); }
                }
                @keyframes highlight-drift {
                    0% { transform: translate(0, 0); opacity: 0.6; }
                    100% { transform: translate(10px, 3px); opacity: 0.9; }
                }
                @keyframes ray-flash {
                    0%, 100% { opacity: 0; transform: translateY(var(--ty, 0)) rotate(var(--rot, 0)) scaleX(0.5); }
                    15% { opacity: 0.9; }
                    30% { opacity: 0.2; transform: translateY(var(--ty, 0)) rotate(var(--rot, 0)) scaleX(1.1); }
                    50% { opacity: 0.8; }
                    70% { opacity: 0.1; }
                    85% { opacity: 0.6; transform: translateY(var(--ty, 0)) rotate(var(--rot, 0)) scaleX(0.8); }
                }
                @keyframes tp-float {
                    0% { transform: translate(0, 0) scale(0.7); opacity: 0.3; }
                    100% { transform: translate(8px, -12px) scale(1.3); opacity: 0.85; }
                }
                @keyframes listen-wave-expand {
                    0% { transform: translateX(-50%) scale(0.5); opacity: 0.7; }
                    100% { transform: translateX(-50%) scale(1.5); opacity: 0; }
                }
                @keyframes listen-bolt-fire {
                    0%, 100% { opacity: 0.1; }
                    30% { opacity: 1; filter: drop-shadow(0 0 14px rgba(255,255,255,0.9)) drop-shadow(0 0 28px rgba(59,130,246,0.8)); }
                    60% { opacity: 0.4; }
                }
                @keyframes listen-ripple-out {
                    0% { transform: translateX(-50%) scale(0.4); opacity: 0.6; }
                    100% { transform: translateX(-50%) scale(2); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
