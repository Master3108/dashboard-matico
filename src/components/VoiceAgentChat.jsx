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

    // === Canvas lightning refs ===
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const stateRef = useRef(sphereState);
    useEffect(() => { stateRef.current = sphereState; }, [sphereState]);

    // Canvas lightning animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let lastTime = 0;
        const FPS_INTERVAL = 80; // regenerate bolts every 80ms

        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        // Draw a jagged lightning bolt with branches
        const drawBolt = (x1, y1, x2, y2, width, branchChance, depth) => {
            const segments = 6 + Math.floor(Math.random() * 4);
            const dx = (x2 - x1) / segments;
            const dy = (y2 - y1) / segments;
            const jitter = Math.sqrt(dx * dx + dy * dy) * 0.4;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            let px = x1, py = y1;
            for (let i = 1; i <= segments; i++) {
                const nx = i === segments ? x2 : x1 + dx * i + (Math.random() - 0.5) * jitter;
                const ny = i === segments ? y2 : y1 + dy * i + (Math.random() - 0.5) * jitter;
                ctx.lineTo(nx, ny);
                // Branch
                if (depth > 0 && i > 1 && i < segments - 1 && Math.random() < branchChance) {
                    const bLen = 0.3 + Math.random() * 0.4;
                    const bx = nx + (dx * bLen) + (Math.random() - 0.5) * jitter * 1.5;
                    const by = ny + (dy * bLen) + (Math.random() - 0.5) * jitter * 1.5;
                    const oldWidth = ctx.lineWidth;
                    const oldAlpha = ctx.globalAlpha;
                    ctx.stroke();
                    ctx.lineWidth = width * 0.5;
                    ctx.globalAlpha = oldAlpha * 0.6;
                    drawBolt(nx, ny, bx, by, width * 0.4, branchChance * 0.4, depth - 1);
                    ctx.lineWidth = oldWidth;
                    ctx.globalAlpha = oldAlpha;
                    ctx.beginPath();
                    ctx.moveTo(nx, ny);
                }
                px = nx; py = ny;
            }
            ctx.stroke();
        };

        const animate = (ts) => {
            animRef.current = requestAnimationFrame(animate);
            if (ts - lastTime < FPS_INTERVAL) return;
            lastTime = ts;

            const W = canvas.style.width ? parseFloat(canvas.style.width) : 400;
            const H = canvas.style.height ? parseFloat(canvas.style.height) : 300;
            ctx.clearRect(0, 0, W, H);

            const st = stateRef.current;
            const cx = W / 2;
            const cy = H * 0.42; // toroid center
            const rx = W * 0.26; // toroid horizontal radius
            const ry = H * 0.18;

            // Speaking: intense side lightning
            if (st === 'speaking') {
                const count = 5 + Math.floor(Math.random() * 4);
                for (let i = 0; i < count; i++) {
                    const isLeft = i % 2 === 0;
                    const startX = isLeft ? cx - rx - 5 : cx + rx + 5;
                    const startY = cy + (Math.random() - 0.5) * ry * 1.2;
                    const endX = isLeft ? -10 - Math.random() * W * 0.15 : W + 10 + Math.random() * W * 0.15;
                    const endY = startY + (Math.random() - 0.5) * H * 0.2;
                    const w = 1.5 + Math.random() * 2.5;

                    // Glow layer
                    ctx.save();
                    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
                    ctx.lineWidth = w + 6;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = 0.4 + Math.random() * 0.3;
                    ctx.shadowColor = 'rgba(59,130,246,0.8)';
                    ctx.shadowBlur = 20;
                    drawBolt(startX, startY, endX, endY, w + 6, 0.35, 2);
                    ctx.restore();

                    // Core white layer
                    ctx.save();
                    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
                    ctx.lineWidth = w;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
                    ctx.shadowColor = 'rgba(125,211,252,0.9)';
                    ctx.shadowBlur = 12;
                    drawBolt(startX, startY, endX, endY, w, 0.3, 1);
                    ctx.restore();
                }
            }

            // Idle / thinking: very subtle side wisps
            if (st === 'idle' || st === 'thinking') {
                const count = st === 'thinking' ? 2 : 1;
                for (let i = 0; i < count; i++) {
                    if (Math.random() > 0.6) continue;
                    const isLeft = Math.random() > 0.5;
                    const startX = isLeft ? cx - rx : cx + rx;
                    const startY = cy + (Math.random() - 0.5) * ry * 0.6;
                    const endX = isLeft ? startX - 30 - Math.random() * 60 : startX + 30 + Math.random() * 60;
                    const endY = startY + (Math.random() - 0.5) * 30;
                    ctx.save();
                    ctx.strokeStyle = 'rgba(125,211,252,0.4)';
                    ctx.lineWidth = 1;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 0.15 + Math.random() * 0.15;
                    ctx.shadowColor = 'rgba(59,130,246,0.5)';
                    ctx.shadowBlur = 8;
                    drawBolt(startX, startY, endX, endY, 1, 0.1, 0);
                    ctx.restore();
                }
            }

            // Listening: bolts below + subtle side
            if (st === 'listening') {
                // Bottom bolts
                const bCount = 4 + Math.floor(Math.random() * 3);
                for (let i = 0; i < bCount; i++) {
                    const startX = cx + (Math.random() - 0.5) * rx * 1.2;
                    const startY = cy + ry * 0.6 + Math.random() * 10;
                    const endX = startX + (Math.random() - 0.5) * 60;
                    const endY = startY + 40 + Math.random() * H * 0.2;
                    const w = 1 + Math.random() * 1.5;

                    ctx.save();
                    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
                    ctx.lineWidth = w + 4;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 0.3 + Math.random() * 0.3;
                    ctx.shadowColor = 'rgba(59,130,246,0.7)';
                    ctx.shadowBlur = 14;
                    drawBolt(startX, startY, endX, endY, w + 4, 0.2, 1);
                    ctx.restore();

                    ctx.save();
                    ctx.strokeStyle = 'rgba(186,230,253,0.8)';
                    ctx.lineWidth = w;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 0.5 + Math.random() * 0.4;
                    ctx.shadowColor = 'rgba(125,211,252,0.8)';
                    ctx.shadowBlur = 8;
                    drawBolt(startX, startY, endX, endY, w, 0.15, 0);
                    ctx.restore();
                }

                // Subtle side wisps
                for (let i = 0; i < 2; i++) {
                    const isLeft = i === 0;
                    const startX = isLeft ? cx - rx : cx + rx;
                    const startY = cy + (Math.random() - 0.5) * ry;
                    const endX = isLeft ? startX - 40 - Math.random() * 40 : startX + 40 + Math.random() * 40;
                    const endY = startY + (Math.random() - 0.5) * 20;
                    ctx.save();
                    ctx.strokeStyle = 'rgba(125,211,252,0.5)';
                    ctx.lineWidth = 1.2;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 0.2 + Math.random() * 0.2;
                    ctx.shadowColor = 'rgba(59,130,246,0.6)';
                    ctx.shadowBlur = 10;
                    drawBolt(startX, startY, endX, endY, 1.2, 0.15, 0);
                    ctx.restore();
                }
            }
        };

        animRef.current = requestAnimationFrame(animate);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{background:'radial-gradient(ellipse 130% 90% at 50% 38%, #0a1628 0%, #050a15 55%, #020408 100%)'}}>
            {/* Stormy atmosphere */}
            <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 70% 45% at 50% 40%, rgba(30,58,138,0.1) 0%, transparent 70%)'}} />

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

            {/* === TOROID + CANVAS LIGHTNING === */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10">
                <div className="relative" style={{width:'min(94vw, 540px)', aspectRatio:'5/3.5'}}>
                    {/* Canvas for animated lightning — sits on top */}
                    <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />

                    {/* SVG Toroid — 3D glossy donut */}
                    <svg viewBox="0 0 540 380" className="absolute inset-0 w-full h-full z-5" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <filter id="tg" x="-40%" y="-40%" width="180%" height="180%">
                                <feGaussianBlur stdDeviation="12" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <filter id="tg2" x="-30%" y="-30%" width="160%" height="160%">
                                <feGaussianBlur stdDeviation="6" result="b"/>
                                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            {/* Tube cross-section gradient: light on top, dark bottom */}
                            <linearGradient id="tube3d" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                                <stop offset="15%" stopColor="#7dd3fc" stopOpacity="0.9"/>
                                <stop offset="30%" stopColor="#38bdf8" stopOpacity="0.85"/>
                                <stop offset="50%" stopColor="#0284c7" stopOpacity="0.8"/>
                                <stop offset="70%" stopColor="#1e40af" stopOpacity="0.75"/>
                                <stop offset="85%" stopColor="#1e3a8a" stopOpacity="0.6"/>
                                <stop offset="100%" stopColor="#0c1a3a" stopOpacity="0.4"/>
                            </linearGradient>
                            <linearGradient id="tube-inner" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.5"/>
                                <stop offset="30%" stopColor="#0ea5e9" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#0c1a3a" stopOpacity="0.1"/>
                            </linearGradient>
                        </defs>

                        <g transform="translate(270,160)">
                            {/* Outer ambient glow */}
                            <ellipse cx="0" cy="0" rx="180" ry="95" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="60" filter="url(#tg)" className="vt-glow-ring"/>

                            {/* Main torus tube — outer edge */}
                            <ellipse cx="0" cy="0" rx="155" ry="80" fill="none" stroke="url(#tube3d)" strokeWidth="52" filter="url(#tg2)"/>

                            {/* Bright rim highlight on top */}
                            <ellipse cx="0" cy="0" rx="155" ry="80" fill="none" stroke="rgba(186,230,253,0.5)" strokeWidth="2" strokeDasharray="180 400"/>
                            <path d="M-130,-68 Q-70,-88 0,-92 Q70,-88 130,-68" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="4" strokeLinecap="round" filter="url(#tg2)"/>
                            <path d="M-100,-62 Q-50,-78 0,-80 Q50,-78 100,-62" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" strokeLinecap="round" filter="url(#tg)"/>

                            {/* Inner hole — very dark */}
                            <ellipse cx="0" cy="0" rx="105" ry="38" fill="#020408"/>
                            <ellipse cx="0" cy="0" rx="108" ry="40" fill="none" stroke="rgba(30,64,175,0.3)" strokeWidth="3" filter="url(#tg2)"/>

                            {/* Inner bottom rim light (reflected light on inner bottom) */}
                            <path d="M-90,20 Q-45,38 0,40 Q45,38 90,20" fill="none" stroke="url(#tube-inner)" strokeWidth="6" strokeLinecap="round" filter="url(#tg2)"/>

                            {/* Specular hotspot — top center */}
                            <ellipse cx="-20" cy="-72" rx="50" ry="12" fill="rgba(255,255,255,0.2)" filter="url(#tg)"/>
                        </g>

                        {/* Small bright particles */}
                        {[{x:110,y:95},{x:430,y:100},{x:90,y:190},{x:455,y:180},{x:200,y:60},{x:350,y:55},{x:160,y:250},{x:380,y:245}].map((p,i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgba(186,230,253,0.8)" filter="url(#tg2)">
                                <animate attributeName="opacity" values="0.3;0.9;0.3" dur={`${2+i*0.4}s`} repeatCount="indefinite"/>
                                <animate attributeName="cy" values={`${p.y};${p.y-8};${p.y}`} dur={`${3+i*0.3}s`} repeatCount="indefinite"/>
                            </circle>
                        ))}
                    </svg>
                </div>

                {/* Status text */}
                <div className="mt-2 text-center relative z-20">
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

                {messages.length <= 1 && !isProcessing && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md relative z-20">
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
                .vt-glow-ring { transition: all 0.4s; }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
