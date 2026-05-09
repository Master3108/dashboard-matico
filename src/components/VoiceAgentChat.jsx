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
        if (speak && ttsEnabled) await speakText(text);
        else {
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
                    conversation_history: conversationRef.current.slice(-10)
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
        <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-white via-[#f0f4ff] to-white flex flex-col">
            {/* Top right controls */}
            <div className="flex items-center justify-end px-4 pt-4 pb-2 gap-2">
                <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition shadow-sm"
                >
                    {ttsEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                </button>
                <button
                    onClick={() => setShowMessages(!showMessages)}
                    className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition shadow-sm"
                >
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Messages panel (collapsible overlay) */}
            {showMessages && (
                <div className="absolute inset-x-0 bottom-48 top-16 bg-white/95 backdrop-blur-lg rounded-t-3xl p-4 overflow-y-auto z-10 shadow-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-gray-500 text-sm font-bold">Conversacion</p>
                        <button onClick={() => setShowMessages(false)} className="p-1 rounded-full bg-gray-100">
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* Sphere Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                {/* Animated Sphere */}
                <div className={`voice-orb relative w-72 h-72 md:w-96 md:h-96 transition-all duration-500 ${sphereClasses[sphereState] || ''}`} data-state={sphereState}>
                    <div className="energy-field absolute left-1/2 top-1/2 h-40 w-[150vw] max-w-[760px] -translate-x-1/2 -translate-y-1/2 overflow-hidden opacity-70">
                        <div className="energy-wave energy-wave-one" />
                        <div className="energy-wave energy-wave-two" />
                        <div className="energy-wave energy-wave-three" />
                    </div>

                    {sphereState === 'listening' && (
                        <div className="listening-ray-wrap absolute inset-0 pointer-events-none">
                            <div className="listening-ray listening-ray-left" />
                            <div className="listening-ray listening-ray-right" />
                            <div className="listening-scan" />
                            <div className="bottom-energy bottom-energy-one" />
                            <div className="bottom-energy bottom-energy-two" />
                            <div className="bottom-energy bottom-energy-three" />
                            <div className="bottom-energy bottom-energy-four" />
                            <div className="bottom-wave bottom-wave-one" />
                            <div className="bottom-wave bottom-wave-two" />
                        </div>
                    )}

                    <div className="orb-halo absolute -inset-8 rounded-full" />
                    <div className="orb-ring absolute -inset-3 rounded-full" />

                    <div className="orb-core absolute inset-0 rounded-full overflow-hidden">
                        <div className="orb-depth absolute inset-0 rounded-full" />
                        <div className="orb-cloud orb-cloud-one" />
                        <div className="orb-cloud orb-cloud-two" />
                        <div className="orb-cloud orb-cloud-three" />

                        {energyVeins.map((vein, i) => (
                            <div
                                key={i}
                                className="energy-vein"
                                style={{
                                    '--vein-top': vein.top,
                                    '--vein-left': vein.left,
                                    '--vein-rotate': `${vein.rotate}deg`,
                                    '--vein-width': vein.width,
                                    '--vein-delay': vein.delay,
                                    '--vein-duration': vein.duration,
                                    '--vein-opacity': vein.opacity
                                }}
                            />
                        ))}

                        <div className="lightning-knot lightning-knot-one" />
                        <div className="lightning-knot lightning-knot-two" />
                        <div className="lightning-knot lightning-knot-three" />
                        <div className="orb-highlight" />
                    </div>

                    {particles.map((particle, i) => (
                        <div
                            key={i}
                            className="orb-particle"
                            style={{
                                top: particle.top,
                                left: particle.left,
                                width: `${particle.size}px`,
                                height: `${particle.size}px`,
                                animationDelay: particle.delay
                            }}
                        />
                    ))}
                </div>

                {/* Status text below sphere */}
                <div className="mt-4 text-center">
                    <p className={`text-base font-semibold transition-colors duration-300 ${
                        sphereState === 'listening' ? 'text-blue-600' :
                        sphereState === 'thinking' ? 'text-purple-600' :
                        sphereState === 'speaking' ? 'text-cyan-600' :
                        'text-gray-400'
                    }`}>
                        {sphereState === 'listening' ? (currentTranscript || 'Escuchando...') :
                         sphereState === 'thinking' ? 'Pensando...' :
                         sphereState === 'speaking' ? 'Hablando...' :
                         ''}
                    </p>
                    {messages.length > 0 && !showMessages && sphereState === 'idle' && (
                        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto line-clamp-3 leading-relaxed">
                            {messages[messages.length - 1]?.content}
                        </p>
                    )}
                </div>

                {/* Quick questions */}
                {messages.length <= 1 && !isProcessing && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
                        {quickQuestions.map((q, i) => (
                            <button key={i} onClick={() => sendMessage(q)}
                                className="px-4 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium transition border border-blue-200">
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom: Input + Buttons */}
            <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
                {/* Text input */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4">
                    <div className="flex-1 relative">
                        <input ref={inputRef} type="text" value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Escribe tu mensaje..."
                            disabled={isProcessing}
                            className="w-full bg-gray-50 border border-blue-200 rounded-full px-5 py-3.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm shadow-sm"
                        />
                        <button type="submit" disabled={!inputText.trim() || isProcessing}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white transition">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>

                {/* Action buttons row — like the image */}
                <div className="flex items-center justify-center gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                    />
                    {/* Camera button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition shadow-sm border border-gray-200"
                        title="Subir fotos, archivos o capturas"
                    >
                        <UploadCloud className="w-6 h-6 text-gray-600" />
                    </button>

                    {/* Mic button (main, larger) */}
                    <button onClick={toggleListening}
                        className={`w-18 h-18 p-5 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                            isListening
                                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-110 border-4 border-red-300'
                                : 'bg-blue-500 hover:bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] border-4 border-blue-300'
                        } ${isProcessing ? 'opacity-50' : ''}`}>
                        {isListening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
                    </button>

                    {/* Menu / more options */}
                    <button onClick={() => setShowMessages(!showMessages)}
                        className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition shadow-sm border border-gray-200">
                        <MessageCircle className="w-6 h-6 text-gray-600" />
                    </button>

                    {/* Close */}
                    <button onClick={() => {
                        listeningDesiredRef.current = false;
                        stopListening();
                        stopAllAudio();
                        onClose?.();
                    }}
                        className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition shadow-sm border border-gray-200">
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                <p className="text-center text-gray-400 text-xs mt-3">
                    {isListening ? 'Modo manos libres activo: habla cuando quieras' : 'Toca una vez el microfono para dejar a Matico escuchando'}
                </p>
            </div>

            {/* CSS Animations */}
            <style>{`
                .voice-orb {
                    isolation: isolate;
                    transform-origin: center;
                }
                .energy-field {
                    filter: blur(0.1px);
                    transform-style: preserve-3d;
                    z-index: 0;
                }
                .energy-wave {
                    position: absolute;
                    inset: 0;
                    background:
                        repeating-radial-gradient(ellipse at center, transparent 0 10px, rgba(14,165,233,0.24) 11px 12px, transparent 13px 22px),
                        linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.12) 12%, rgba(6,182,212,0.56) 50%, rgba(125,211,252,0.12) 88%, transparent 100%);
                    clip-path: polygon(0 45%, 8% 38%, 18% 47%, 30% 36%, 43% 46%, 56% 35%, 70% 45%, 84% 37%, 100% 46%, 100% 62%, 84% 55%, 70% 66%, 56% 55%, 43% 65%, 30% 54%, 18% 66%, 8% 55%, 0 63%);
                    mask-image: linear-gradient(90deg, transparent, black 15%, black 85%, transparent);
                    animation: energy-wave-flow 4.5s ease-in-out infinite alternate;
                }
                .energy-wave-two {
                    opacity: 0.65;
                    transform: translateY(18px) scaleY(0.72);
                    animation-duration: 5.6s;
                    animation-direction: alternate-reverse;
                }
                .energy-wave-three {
                    opacity: 0.42;
                    transform: translateY(-16px) scaleY(0.58);
                    animation-duration: 6.2s;
                }
                .voice-orb[data-state="idle"] .energy-field,
                .voice-orb[data-state="thinking"] .energy-field {
                    opacity: 0.34;
                }
                .voice-orb[data-state="speaking"] .energy-field {
                    opacity: 1;
                    filter: drop-shadow(0 0 24px rgba(34,211,238,0.88)) drop-shadow(0 0 48px rgba(59,130,246,0.45));
                }
                .voice-orb[data-state="listening"] .energy-field {
                    opacity: 1;
                    filter: drop-shadow(0 0 22px rgba(59,130,246,0.82)) drop-shadow(0 0 42px rgba(14,165,233,0.45));
                }
                .orb-halo {
                    z-index: 1;
                    background: radial-gradient(circle, rgba(186,230,253,0.42) 0%, rgba(59,130,246,0.18) 43%, transparent 72%);
                    filter: blur(8px);
                    animation: sphere-breathe 4s ease-in-out infinite;
                }
                .orb-ring {
                    z-index: 2;
                    border: 1px solid rgba(186,230,253,0.5);
                    box-shadow: 0 0 45px rgba(14,165,233,0.28), inset 0 0 28px rgba(255,255,255,0.2);
                }
                .voice-orb[data-state="speaking"] .orb-ring {
                    box-shadow: 0 0 90px rgba(34,211,238,0.58), inset 0 0 42px rgba(255,255,255,0.34);
                }
                .voice-orb[data-state="listening"] .orb-ring {
                    box-shadow: 0 0 78px rgba(59,130,246,0.5), inset 0 0 36px rgba(191,219,254,0.32);
                }
                .orb-core {
                    z-index: 3;
                    background:
                        radial-gradient(circle at 31% 28%, rgba(255,255,255,0.92) 0%, rgba(186,230,253,0.72) 12%, transparent 28%),
                        radial-gradient(circle at 65% 64%, rgba(34,211,238,0.48) 0%, transparent 30%),
                        radial-gradient(circle at 42% 55%, rgba(15,23,42,0.86) 0%, rgba(29,78,216,0.76) 38%, rgba(8,47,73,0.82) 72%, rgba(15,23,42,0.7) 100%);
                    box-shadow:
                        inset 0 0 55px rgba(255,255,255,0.36),
                        inset -28px -30px 70px rgba(15,23,42,0.48),
                        0 0 46px rgba(6,182,212,0.34);
                }
                .orb-depth {
                    background:
                        radial-gradient(circle at 50% 50%, transparent 0 38%, rgba(34,211,238,0.22) 44%, transparent 52%),
                        conic-gradient(from 30deg, rgba(255,255,255,0.18), transparent, rgba(34,211,238,0.22), transparent, rgba(255,255,255,0.24));
                    mix-blend-mode: screen;
                    animation: orb-depth-rotate 14s linear infinite;
                }
                .orb-cloud {
                    position: absolute;
                    border-radius: 9999px;
                    filter: blur(16px);
                    mix-blend-mode: screen;
                }
                .orb-cloud-one {
                    width: 48%;
                    height: 34%;
                    left: 12%;
                    top: 22%;
                    background: rgba(255,255,255,0.36);
                    animation: cloud-drift 6s ease-in-out infinite alternate;
                }
                .orb-cloud-two {
                    width: 40%;
                    height: 30%;
                    right: 12%;
                    bottom: 24%;
                    background: rgba(103,232,249,0.28);
                    animation: cloud-drift 5.2s ease-in-out infinite alternate-reverse;
                }
                .orb-cloud-three {
                    width: 34%;
                    height: 26%;
                    left: 34%;
                    bottom: 10%;
                    background: rgba(147,197,253,0.24);
                    animation: cloud-drift 7s ease-in-out infinite alternate;
                }
                .energy-vein {
                    position: absolute;
                    top: var(--vein-top);
                    left: var(--vein-left);
                    width: var(--vein-width);
                    height: 3px;
                    opacity: var(--vein-opacity);
                    transform: rotate(var(--vein-rotate));
                    transform-origin: center;
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 18%, rgba(125,211,252,0.95) 42%, rgba(255,255,255,0.98) 58%, rgba(34,211,238,0.7) 78%, transparent 100%);
                    border-radius: 9999px;
                    filter: blur(0.6px) drop-shadow(0 0 8px rgba(125,211,252,0.9));
                    animation: lightning-flow var(--vein-duration) ease-in-out infinite alternate;
                    animation-delay: var(--vein-delay);
                    z-index: 4;
                }
                .voice-orb[data-state="idle"] .energy-vein {
                    opacity: calc(var(--vein-opacity) * 0.45);
                }
                .voice-orb[data-state="speaking"] .energy-vein {
                    height: 5px;
                    filter: blur(0.1px) drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 28px rgba(34,211,238,0.95));
                    animation-duration: 0.85s;
                }
                .voice-orb[data-state="listening"] .energy-vein {
                    height: 4px;
                    filter: blur(0.2px) drop-shadow(0 0 14px rgba(96,165,250,0.95)) drop-shadow(0 0 26px rgba(37,99,235,0.7));
                    animation-duration: 1.05s;
                }
                .lightning-knot {
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    border-radius: 9999px;
                    background: white;
                    box-shadow: 0 0 16px rgba(255,255,255,0.95), 0 0 28px rgba(34,211,238,0.9);
                    z-index: 5;
                    animation: lightning-knot 2.2s ease-in-out infinite alternate;
                }
                .lightning-knot-one { left: 30%; top: 28%; animation-delay: 0s; }
                .lightning-knot-two { right: 25%; top: 43%; animation-delay: 0.35s; }
                .lightning-knot-three { left: 47%; bottom: 26%; animation-delay: 0.75s; }
                .orb-highlight {
                    position: absolute;
                    left: 16%;
                    top: 12%;
                    width: 30%;
                    height: 22%;
                    border-radius: 9999px;
                    background: radial-gradient(circle, rgba(255,255,255,0.78), transparent 72%);
                    filter: blur(8px);
                    z-index: 6;
                    animation: highlight-glide 5s ease-in-out infinite alternate;
                }
                .orb-particle {
                    position: absolute;
                    border-radius: 9999px;
                    background: rgba(125,211,252,0.8);
                    box-shadow: 0 0 10px rgba(14,165,233,0.8);
                    z-index: 6;
                    animation: particle-orbit 4s ease-in-out infinite alternate;
                }
                .voice-orb[data-state="speaking"] .orb-particle,
                .voice-orb[data-state="listening"] .orb-particle {
                    background: rgba(255,255,255,0.92);
                    box-shadow: 0 0 14px rgba(34,211,238,0.95);
                }
                .listening-ray-wrap {
                    z-index: 7;
                }
                .listening-ray {
                    position: absolute;
                    top: 50%;
                    width: 54%;
                    height: 8px;
                    background: linear-gradient(90deg, transparent, rgba(59,130,246,0.12), rgba(255,255,255,1), rgba(125,211,252,0.98), rgba(37,99,235,0.78), transparent);
                    border-radius: 9999px;
                    filter: drop-shadow(0 0 16px rgba(59,130,246,0.98)) drop-shadow(0 0 28px rgba(34,211,238,0.72));
                    animation: listening-ray 0.62s ease-in-out infinite;
                }
                .listening-ray-left {
                    left: -34%;
                    transform: translateY(-50%) rotate(4deg);
                }
                .listening-ray-right {
                    right: -34%;
                    transform: translateY(-50%) rotate(-4deg);
                    animation-delay: 0.18s;
                }
                .listening-scan {
                    position: absolute;
                    left: -18%;
                    right: -18%;
                    top: 46%;
                    height: 34px;
                    border-radius: 9999px;
                    border-top: 1px solid rgba(59,130,246,0.4);
                    border-bottom: 1px solid rgba(59,130,246,0.25);
                    filter: blur(0.2px);
                    animation: listening-scan 1.4s ease-in-out infinite;
                }
                .bottom-energy {
                    position: absolute;
                    left: 50%;
                    top: 86%;
                    width: 8px;
                    height: 76px;
                    border-radius: 9999px;
                    background: linear-gradient(180deg, rgba(255,255,255,1), rgba(125,211,252,0.95), rgba(59,130,246,0.15), transparent);
                    transform-origin: top center;
                    filter: drop-shadow(0 0 14px rgba(255,255,255,0.95)) drop-shadow(0 0 30px rgba(14,165,233,0.88));
                    opacity: 0;
                    z-index: 8;
                    animation: bottom-lightning 0.9s ease-in-out infinite;
                }
                .bottom-energy-one {
                    --bolt-rotate: 0deg;
                    transform: translateX(-50%) rotate(0deg);
                    animation-delay: 0s;
                }
                .bottom-energy-two {
                    --bolt-rotate: -24deg;
                    height: 66px;
                    transform: translateX(-50%) rotate(-24deg);
                    animation-delay: 0.14s;
                }
                .bottom-energy-three {
                    --bolt-rotate: 25deg;
                    height: 70px;
                    transform: translateX(-50%) rotate(25deg);
                    animation-delay: 0.28s;
                }
                .bottom-energy-four {
                    --bolt-rotate: 10deg;
                    height: 54px;
                    transform: translateX(-50%) rotate(10deg);
                    animation-delay: 0.42s;
                }
                .bottom-wave {
                    position: absolute;
                    left: 50%;
                    top: 91%;
                    width: 150px;
                    height: 26px;
                    border-radius: 50%;
                    border: 2px solid rgba(125,211,252,0.58);
                    transform: translateX(-50%) scale(0.7);
                    filter: drop-shadow(0 0 12px rgba(14,165,233,0.7));
                    opacity: 0;
                    animation: bottom-wave-pulse 1.1s ease-out infinite;
                    z-index: 7;
                }
                .bottom-wave-two {
                    animation-delay: 0.38s;
                    border-color: rgba(255,255,255,0.55);
                }
                .sphere-breathe { animation: sphere-breathe 4.5s ease-in-out infinite; }
                .sphere-listening { animation: sphere-listening 1.15s ease-in-out infinite; }
                .sphere-speaking { animation: speaking-rays 0.95s ease-in-out infinite; }
                .sphere-thinking { animation: sphere-thinking 3.2s ease-in-out infinite; }
                @keyframes energy-wave-flow {
                    0% { transform: translateX(-24px) translateY(0) scaleX(0.98); opacity: 0.55; }
                    100% { transform: translateX(24px) translateY(-4px) scaleX(1.04); opacity: 1; }
                }
                @keyframes lightning-flow {
                    0% { transform: rotate(var(--vein-rotate)) translateX(-5px) scaleX(0.72); opacity: calc(var(--vein-opacity) * 0.6); }
                    48% { transform: rotate(var(--vein-rotate)) translateX(3px) scaleX(1.08); opacity: var(--vein-opacity); }
                    100% { transform: rotate(var(--vein-rotate)) translateX(7px) scaleX(0.9); opacity: calc(var(--vein-opacity) * 1.25); }
                }
                @keyframes listening-ray {
                    0% { opacity: 0; clip-path: inset(0 100% 0 0); }
                    35% { opacity: 1; clip-path: inset(0 18% 0 0); }
                    100% { opacity: 0.25; clip-path: inset(0 0 0 70%); }
                }
                @keyframes listening-scan {
                    0%, 100% { transform: scaleX(0.82) translateY(-7px); opacity: 0.22; }
                    50% { transform: scaleX(1.08) translateY(8px); opacity: 0.62; }
                }
                @keyframes bottom-lightning {
                    0%, 100% { opacity: 0.18; clip-path: polygon(40% 0, 62% 0, 52% 28%, 72% 30%, 45% 100%, 51% 48%, 31% 46%); }
                    35% { opacity: 1; filter: drop-shadow(0 0 18px rgba(255,255,255,1)) drop-shadow(0 0 38px rgba(14,165,233,1)); }
                    65% { opacity: 0.62; transform: translateX(-50%) rotate(var(--bolt-rotate, 0deg)) scaleY(1.16); }
                }
                @keyframes bottom-wave-pulse {
                    0% { opacity: 0.75; transform: translateX(-50%) scale(0.55); }
                    80% { opacity: 0.12; transform: translateX(-50%) scale(1.55); }
                    100% { opacity: 0; transform: translateX(-50%) scale(1.7); }
                }
                @keyframes speaking-rays {
                    0%, 100% { transform: scale(1.03); filter: saturate(1.08); }
                    50% { transform: scale(1.08); filter: saturate(1.35) brightness(1.08); }
                }
                @keyframes sphere-breathe {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.025); }
                }
                @keyframes sphere-listening {
                    0%, 100% { transform: scale(1.04); }
                    50% { transform: scale(1.1); }
                }
                @keyframes sphere-thinking {
                    0%, 100% { transform: rotate(-2deg) scale(1.01); filter: hue-rotate(0deg); }
                    50% { transform: rotate(2deg) scale(1.04); filter: hue-rotate(28deg); }
                }
                @keyframes particle-orbit {
                    0% { transform: translate3d(0, 0, 0) scale(0.8); opacity: 0.35; }
                    100% { transform: translate3d(10px, -16px, 0) scale(1.35); opacity: 0.88; }
                }
                @keyframes cloud-drift {
                    0% { transform: translate(0, 0) scale(0.95); opacity: 0.4; }
                    100% { transform: translate(12px, -10px) scale(1.12); opacity: 0.78; }
                }
                @keyframes orb-depth-rotate {
                    0% { transform: rotate(0deg) scale(1); }
                    100% { transform: rotate(360deg) scale(1.03); }
                }
                @keyframes lightning-knot {
                    0% { transform: scale(0.6); opacity: 0.25; }
                    100% { transform: scale(1.15); opacity: 0.9; }
                }
                @keyframes highlight-glide {
                    0% { transform: translate(0, 0) scale(1); opacity: 0.72; }
                    100% { transform: translate(16px, 8px) scale(1.1); opacity: 0.95; }
                }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
