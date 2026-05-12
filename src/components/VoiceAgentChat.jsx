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

    // TTS via OpenAI — with timeout fallback
    const speakText = async (text) => {
        if (!ttsEnabled || !text) return;
        const shouldResumeListening = listeningDesiredRef.current;
        stopListening({ preserveDesired: shouldResumeListening });
        stopAllAudio();
        const runId = ttsRunRef.current;
        speakingRef.current = true;
        setIsSpeaking(true);
        setSphereState('speaking');

        // Safety timeout: if TTS hangs for 15s, reset state
        const safetyTimer = setTimeout(() => {
            if (runId === ttsRunRef.current && speakingRef.current) {
                console.warn('[TTS] Safety timeout — resetting from speaking');
                speakingRef.current = false;
                setIsSpeaking(false);
                setSphereState('idle');
                restartListeningSoon();
            }
        }, 15000);

        try {
            const controller = new AbortController();
            const fetchTimer = setTimeout(() => controller.abort(), 10000);

            const res = await fetch('/api/agent/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: 'onyx' }),
                signal: controller.signal
            });
            clearTimeout(fetchTimer);

            if (!res.ok) throw new Error('TTS failed: ' + res.status);

            const blob = await res.blob();
            if (runId !== ttsRunRef.current) { clearTimeout(safetyTimer); return; }
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audioUrlRef.current = url;

            const cleanup = () => {
                clearTimeout(safetyTimer);
                if (runId !== ttsRunRef.current) return;
                speakingRef.current = false;
                setIsSpeaking(false);
                setSphereState('idle');
                try { URL.revokeObjectURL(url); } catch {}
                audioRef.current = null;
                audioUrlRef.current = null;
                restartListeningSoon();
            };

            audio.onended = cleanup;
            audio.onerror = cleanup;

            await audio.play();
        } catch (err) {
            clearTimeout(safetyTimer);
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

    // === Lightning bolt generation (stable, not in render body) ===
    const boltsRef = useRef(null);
    if (!boltsRef.current) {
        const makeBolt = (x1, y1, x2, y2, segments = 6) => {
            const dx = (x2 - x1) / segments;
            const dy = (y2 - y1) / segments;
            let path = `M${x1},${y1}`;
            for (let i = 1; i < segments; i++) {
                path += ` L${x1 + dx * i + (Math.random() - 0.5) * 18},${y1 + dy * i + (Math.random() - 0.5) * 22}`;
            }
            return path + ` L${x2},${y2}`;
        };
        boltsRef.current = {
            left: Array.from({ length: 8 }, (_, i) => ({
                d: makeBolt(280, 150 + (i - 3.5) * 8, -20 - i * 30, 140 + (Math.random() - 0.5) * 60, 5 + Math.floor(Math.random() * 3)),
                w: 1.5 + Math.random() * 2, op: 0.5 + Math.random() * 0.5, delay: i * 0.12, dur: 0.4 + Math.random() * 0.4
            })),
            right: Array.from({ length: 8 }, (_, i) => ({
                d: makeBolt(420, 150 + (i - 3.5) * 8, 720 + i * 30, 140 + (Math.random() - 0.5) * 60, 5 + Math.floor(Math.random() * 3)),
                w: 1.5 + Math.random() * 2, op: 0.5 + Math.random() * 0.5, delay: i * 0.12 + 0.06, dur: 0.4 + Math.random() * 0.4
            })),
            bottom: Array.from({ length: 6 }, (_, i) => ({
                d: makeBolt(340 + (i - 2.5) * 16, 190, 320 + (i - 2.5) * 35, 320 + Math.random() * 40, 4 + Math.floor(Math.random() * 2)),
                w: 1 + Math.random() * 1.5, op: 0.4 + Math.random() * 0.5, delay: i * 0.1, dur: 0.5 + Math.random() * 0.3
            }))
        };
    }
    const { left: leftBolts, right: rightBolts, bottom: bottomBolts } = boltsRef.current;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col vt-scene" data-state={sphereState}>
            {/* Dark background */}
            <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 130% 90% at 50% 38%, #0a1628 0%, #050a15 55%, #020408 100%)'}} />
            {/* Atmospheric haze */}
            <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 80% 50% at 50% 42%, rgba(30,64,175,0.12) 0%, transparent 70%)'}} />

            {/* Top controls */}
            <div className="relative z-20 flex items-center justify-end px-4 pt-4 pb-2 gap-2">
                <button onClick={() => setTtsEnabled(!ttsEnabled)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-sm border border-white/10">
                    {ttsEnabled ? <Volume2 className="w-5 h-5 text-blue-300" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
                </button>
                <button onClick={() => setShowMessages(!showMessages)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-sm border border-white/10">
                    <MessageCircle className="w-5 h-5 text-blue-300" />
                </button>
            </div>

            {/* Messages panel */}
            {showMessages && (
                <div className="absolute inset-x-0 bottom-48 top-16 bg-[#060c1a]/95 backdrop-blur-lg rounded-t-3xl p-4 overflow-y-auto z-30 shadow-2xl border border-blue-900/30">
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
                                    msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-100'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* === TOROID + LIGHTNING SVG === */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10">
                <div className="vt-wrap relative" style={{width:'min(92vw, 520px)', aspectRatio:'700/420'}} data-state={sphereState}>
                    <svg viewBox="0 0 700 420" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            {/* Glow filters */}
                            <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="8" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="14" result="b"/>
                                <feGaussianBlur stdDeviation="4" in="SourceGraphic" result="s"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <filter id="glow-bolt" x="-80%" y="-80%" width="260%" height="260%">
                                <feGaussianBlur stdDeviation="6" result="b"/>
                                <feGaussianBlur stdDeviation="2" in="SourceGraphic" result="s"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <filter id="glow-listen" x="-60%" y="-60%" width="220%" height="220%">
                                <feGaussianBlur stdDeviation="5" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>

                            {/* Toroid gradient */}
                            <radialGradient id="toroid-fill" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0"/>
                                <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0"/>
                                <stop offset="62%" stopColor="#1e40af" stopOpacity="0.4"/>
                                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.85"/>
                                <stop offset="78%" stopColor="#22d3ee" stopOpacity="0.7"/>
                                <stop offset="84%" stopColor="#3b82f6" stopOpacity="0.6"/>
                                <stop offset="90%" stopColor="#1e3a8a" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#0c1a3a" stopOpacity="0"/>
                            </radialGradient>

                            {/* Toroid 3D shading */}
                            <radialGradient id="toroid-shade" cx="42%" cy="35%" r="55%">
                                <stop offset="0%" stopColor="#fff" stopOpacity="0.25"/>
                                <stop offset="40%" stopColor="#7dd3fc" stopOpacity="0.1"/>
                                <stop offset="100%" stopColor="#000" stopOpacity="0"/>
                            </radialGradient>

                            {/* Inner hole darkness */}
                            <radialGradient id="hole-dark" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#020408" stopOpacity="0.98"/>
                                <stop offset="70%" stopColor="#040810" stopOpacity="0.9"/>
                                <stop offset="100%" stopColor="#0a1628" stopOpacity="0"/>
                            </radialGradient>
                        </defs>

                        {/* Ambient glow */}
                        <ellipse cx="350" cy="155" rx="260" ry="120" fill="rgba(59,130,246,0.12)" filter="url(#glow-soft)" className="vt-ambient"/>

                        {/* Main toroid — outer ring */}
                        <g transform="translate(350,155)" className="vt-toroid-g">
                            {/* Outer glow ring */}
                            <ellipse cx="0" cy="0" rx="195" ry="105" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="48" filter="url(#glow-soft)" className="vt-outer-glow"/>
                            {/* Main ring body */}
                            <ellipse cx="0" cy="0" rx="185" ry="95" fill="url(#toroid-fill)" filter="url(#glow-soft)"/>
                            {/* Ring tube stroke — the bright visible tube */}
                            <ellipse cx="0" cy="0" rx="175" ry="88" fill="none" stroke="url(#toroid-fill)" strokeWidth="38"/>
                            {/* Highlight stroke */}
                            <ellipse cx="0" cy="0" rx="172" ry="86" fill="none" stroke="rgba(125,211,252,0.35)" strokeWidth="2"/>
                            <ellipse cx="0" cy="0" rx="178" ry="90" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                            {/* 3D shading overlay */}
                            <ellipse cx="0" cy="0" rx="185" ry="95" fill="url(#toroid-shade)"/>
                            {/* Top highlight arc */}
                            <path d="M-120,-72 Q-60,-95 0,-98 Q60,-95 120,-72" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round" filter="url(#glow-soft)"/>
                            {/* Inner hole */}
                            <ellipse cx="0" cy="0" rx="138" ry="52" fill="url(#hole-dark)"/>
                            {/* Inner edge glow */}
                            <ellipse cx="0" cy="0" rx="140" ry="54" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="2" filter="url(#glow-soft)"/>
                            {/* Rotating energy band */}
                            <ellipse cx="0" cy="0" rx="176" ry="89" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="3" strokeDasharray="40 80 20 120" className="vt-band-1"/>
                            <ellipse cx="0" cy="0" rx="174" ry="87" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="30 100 50 80" className="vt-band-2"/>
                        </g>

                        {/* === LIGHTNING BOLTS — LEFT === */}
                        <g className="vt-bolts-left" filter="url(#glow-bolt)">
                            {leftBolts.map((b, i) => (
                                <path key={`lb${i}`} d={b.d} fill="none" stroke="rgba(125,211,252,0.9)" strokeWidth={b.w} strokeLinecap="round" opacity={b.op}
                                    style={{animation: `vt-bolt-flash ${b.dur}s ease-in-out infinite`, animationDelay: `${b.delay}s`}} />
                            ))}
                            {/* Core bright line through center */}
                            <line x1="280" y1="150" x2="20" y2="148" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"
                                style={{animation:'vt-core-ray 0.6s ease-in-out infinite'}} />
                        </g>

                        {/* === LIGHTNING BOLTS — RIGHT === */}
                        <g className="vt-bolts-right" filter="url(#glow-bolt)">
                            {rightBolts.map((b, i) => (
                                <path key={`rb${i}`} d={b.d} fill="none" stroke="rgba(125,211,252,0.9)" strokeWidth={b.w} strokeLinecap="round" opacity={b.op}
                                    style={{animation: `vt-bolt-flash ${b.dur}s ease-in-out infinite`, animationDelay: `${b.delay}s`}} />
                            ))}
                            <line x1="420" y1="150" x2="680" y2="148" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"
                                style={{animation:'vt-core-ray 0.6s ease-in-out infinite', animationDelay:'0.15s'}} />
                        </g>

                        {/* === LISTENING — bolts below === */}
                        <g className="vt-listen-bolts" filter="url(#glow-listen)">
                            {bottomBolts.map((b, i) => (
                                <path key={`bb${i}`} d={b.d} fill="none" stroke="rgba(96,165,250,0.85)" strokeWidth={b.w} strokeLinecap="round" opacity={b.op}
                                    style={{animation: `vt-bolt-flash ${b.dur}s ease-in-out infinite`, animationDelay: `${b.delay}s`}} />
                            ))}
                            {/* Ripple ellipses below */}
                            <ellipse cx="350" cy="240" rx="80" ry="12" fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" className="vt-listen-ripple-1"/>
                            <ellipse cx="350" cy="260" rx="100" ry="14" fill="none" stroke="rgba(125,211,252,0.3)" strokeWidth="1" className="vt-listen-ripple-2"/>
                            <ellipse cx="350" cy="280" rx="120" ry="16" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="1" className="vt-listen-ripple-3"/>
                        </g>

                        {/* Floating particles */}
                        {[
                            {cx:180,cy:90,r:3},{cx:520,cy:100,r:2.5},{cx:140,cy:180,r:2},{cx:560,cy:170,r:3},
                            {cx:250,cy:60,r:2},{cx:460,cy:55,r:2.5},{cx:300,cy:220,r:2},{cx:400,cy:230,r:2.5},
                            {cx:100,cy:140,r:2},{cx:600,cy:135,r:2}
                        ].map((p, i) => (
                            <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="rgba(186,230,253,0.7)" className="vt-particle"
                                style={{animationDelay:`${i*0.3}s`}} />
                        ))}
                    </svg>
                </div>

                {/* Status text */}
                <div className="mt-2 text-center relative z-10">
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

                <div className="flex items-center justify-center gap-4">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFilesSelected} />
                    <button onClick={() => fileInputRef.current?.click()}
                        className="w-14 h-14 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition border border-white/10 backdrop-blur-sm"
                        title="Subir fotos, archivos o capturas">
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
                    <button onClick={() => { listeningDesiredRef.current = false; stopListening(); stopAllAudio(); onClose?.(); }}
                        className="w-14 h-14 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition border border-white/10 backdrop-blur-sm">
                        <X className="w-6 h-6 text-blue-400" />
                    </button>
                </div>
                <p className="text-center text-blue-600/50 text-xs mt-3">
                    {isListening ? 'Modo manos libres activo: habla cuando quieras' : 'Toca una vez el microfono para dejar a Matico escuchando'}
                </p>
            </div>

            <style>{`
                /* ===== State-based visibility ===== */
                .vt-scene { overflow: hidden; }

                /* --- Toroid pulse per state --- */
                .vt-toroid-g { transition: filter 0.4s, transform 0.4s; }
                .vt-scene[data-state="idle"] .vt-toroid-g { animation: vt-breathe 5s ease-in-out infinite; }
                .vt-scene[data-state="speaking"] .vt-toroid-g { animation: vt-speak-pulse 0.7s ease-in-out infinite; filter: drop-shadow(0 0 30px rgba(34,211,238,0.6)); }
                .vt-scene[data-state="listening"] .vt-toroid-g { animation: vt-listen-pulse 1.3s ease-in-out infinite; filter: drop-shadow(0 0 20px rgba(59,130,246,0.5)); }
                .vt-scene[data-state="thinking"] .vt-toroid-g { animation: vt-think-rotate 3s ease-in-out infinite; }

                .vt-scene[data-state="idle"] .vt-outer-glow { stroke-opacity: 0.15; }
                .vt-scene[data-state="speaking"] .vt-outer-glow { stroke: rgba(34,211,238,0.5); stroke-opacity: 1; }
                .vt-scene[data-state="listening"] .vt-outer-glow { stroke: rgba(59,130,246,0.4); stroke-opacity: 0.8; }

                /* --- Ambient glow --- */
                .vt-ambient { transition: all 0.5s; }
                .vt-scene[data-state="speaking"] .vt-ambient { rx: 320; ry: 160; fill: rgba(34,211,238,0.18); }
                .vt-scene[data-state="listening"] .vt-ambient { fill: rgba(59,130,246,0.15); }

                /* --- Lightning bolts visibility --- */
                .vt-bolts-left, .vt-bolts-right { transition: opacity 0.35s; }
                .vt-scene[data-state="idle"] .vt-bolts-left,
                .vt-scene[data-state="idle"] .vt-bolts-right { opacity: 0.08; }
                .vt-scene[data-state="thinking"] .vt-bolts-left,
                .vt-scene[data-state="thinking"] .vt-bolts-right { opacity: 0.12; }
                .vt-scene[data-state="speaking"] .vt-bolts-left,
                .vt-scene[data-state="speaking"] .vt-bolts-right { opacity: 1; }
                .vt-scene[data-state="listening"] .vt-bolts-left,
                .vt-scene[data-state="listening"] .vt-bolts-right { opacity: 0.25; }

                /* --- Listening zone below toroid --- */
                .vt-listen-bolts { transition: opacity 0.4s; }
                .vt-scene[data-state="idle"] .vt-listen-bolts,
                .vt-scene[data-state="speaking"] .vt-listen-bolts,
                .vt-scene[data-state="thinking"] .vt-listen-bolts { opacity: 0; }
                .vt-scene[data-state="listening"] .vt-listen-bolts { opacity: 1; }

                /* Listening ripples */
                .vt-listen-ripple-1, .vt-listen-ripple-2, .vt-listen-ripple-3 { opacity: 0; }
                .vt-scene[data-state="listening"] .vt-listen-ripple-1 { animation: vt-ripple 1.5s ease-out infinite; }
                .vt-scene[data-state="listening"] .vt-listen-ripple-2 { animation: vt-ripple 1.5s ease-out infinite 0.3s; }
                .vt-scene[data-state="listening"] .vt-listen-ripple-3 { animation: vt-ripple 1.5s ease-out infinite 0.6s; }

                /* --- Energy bands rotation --- */
                .vt-band-1 { animation: vt-band-spin 8s linear infinite; transform-origin: center; }
                .vt-band-2 { animation: vt-band-spin 12s linear infinite reverse; transform-origin: center; }
                .vt-scene[data-state="speaking"] .vt-band-1 { animation-duration: 2s; stroke: rgba(34,211,238,0.7); }
                .vt-scene[data-state="speaking"] .vt-band-2 { animation-duration: 3s; stroke: rgba(255,255,255,0.35); }

                /* --- Particles --- */
                .vt-particle { animation: vt-particle-float 3.5s ease-in-out infinite alternate; }
                .vt-scene[data-state="speaking"] .vt-particle { fill: rgba(255,255,255,0.9); animation-duration: 1.2s; }
                .vt-scene[data-state="listening"] .vt-particle { fill: rgba(147,197,253,0.8); }

                /* ===== KEYFRAMES ===== */
                @keyframes vt-breathe {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.015); }
                }
                @keyframes vt-speak-pulse {
                    0%, 100% { transform: scale(1.01); }
                    50% { transform: scale(1.05); }
                }
                @keyframes vt-listen-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.025); }
                }
                @keyframes vt-think-rotate {
                    0%, 100% { transform: scale(1) rotate(-1deg); filter: hue-rotate(0deg); }
                    50% { transform: scale(1.02) rotate(1deg); filter: hue-rotate(15deg); }
                }
                @keyframes vt-bolt-flash {
                    0%, 100% { opacity: 0; }
                    10% { opacity: 1; }
                    25% { opacity: 0.15; }
                    40% { opacity: 0.9; }
                    55% { opacity: 0.05; }
                    70% { opacity: 0.7; }
                    85% { opacity: 0; }
                }
                @keyframes vt-core-ray {
                    0%, 100% { opacity: 0.1; }
                    20% { opacity: 0.85; }
                    40% { opacity: 0.15; }
                    60% { opacity: 0.7; }
                    80% { opacity: 0.05; }
                }
                @keyframes vt-ripple {
                    0% { opacity: 0.7; transform: scale(0.8); }
                    100% { opacity: 0; transform: scale(1.6); }
                }
                @keyframes vt-band-spin {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: 600; }
                }
                @keyframes vt-particle-float {
                    0% { transform: translate(0,0) scale(0.7); opacity: 0.3; }
                    100% { transform: translate(6px,-10px) scale(1.4); opacity: 0.85; }
                }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
