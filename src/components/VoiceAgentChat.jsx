import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, MessageCircle, ChevronDown, Camera } from 'lucide-react';

const VoiceAgentChat = ({ studentUserId, userId, userRole = 'apoderado', studentName = '', onClose }) => {
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
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Greeting on mount
    useEffect(() => {
        const greeting = `Hola${studentName ? `, soy Matico. Preguntame lo que quieras sobre ${studentName}` : '! Soy Matico, tu asistente escolar'}. Puedes hablarme o escribirme.`;
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        if (ttsEnabled) speakText(greeting);
    }, []);

    // Speech-to-Text via Web Speech API (fallback) or Whisper
    const startListening = useCallback(() => {
        // Stop any playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsSpeaking(false);
        }

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
                    sendMessage(transcript.trim());
                }
            };

            recognition.onerror = (e) => {
                console.error('[STT] Error:', e.error);
                // Auto-restart on non-fatal errors
                if (e.error === 'no-speech' || e.error === 'aborted') {
                    try { recognition.start(); } catch {}
                    return;
                }
                setIsListening(false);
                setSphereState('idle');
                setCurrentTranscript('');
            };

            recognition.onend = () => {
                // Auto-restart if still supposed to be listening
                if (recognitionRef.current === recognition) {
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
    }, [sphereState]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
        setCurrentTranscript('');
        if (sphereState === 'listening') setSphereState('idle');
    }, [sphereState]);

    const toggleListening = () => {
        if (isListening) stopListening();
        else startListening();
    };

    // TTS via OpenAI
    const speakText = async (text) => {
        if (!ttsEnabled || !text) return;
        setIsSpeaking(true);
        setSphereState('speaking');

        try {
            const res = await fetch('/api/agent/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: 'nova' })
            });

            if (!res.ok) throw new Error('TTS failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                setIsSpeaking(false);
                setSphereState('idle');
                URL.revokeObjectURL(url);
                audioRef.current = null;
            };

            audio.onerror = () => {
                setIsSpeaking(false);
                setSphereState('idle');
                URL.revokeObjectURL(url);
                audioRef.current = null;
            };

            await audio.play();
        } catch (err) {
            console.error('[TTS] Error:', err);
            setIsSpeaking(false);
            setSphereState('idle');
        }
    };

    // Send message to agent
    const sendMessage = async (text) => {
        if (!text || isProcessing) return;

        const userMsg = { role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        conversationRef.current.push({ role: 'user', content: text });
        setInputText('');
        setIsProcessing(true);
        setSphereState('thinking');

        try {
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
            const botMsg = { role: 'assistant', content: reply, timestamp: new Date() };
            setMessages(prev => [...prev, botMsg]);
            conversationRef.current.push({ role: 'assistant', content: reply });

            if (ttsEnabled) await speakText(reply);
            else setSphereState('idle');
        } catch (err) {
            console.error('[AGENT] Error:', err);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.', timestamp: new Date() }]);
            setSphereState('idle');
        } finally {
            setIsProcessing(false);
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

    // Sphere animation classes
    const sphereClasses = {
        idle: 'animate-pulse-slow',
        listening: 'animate-pulse-fast scale-110',
        thinking: 'animate-spin-slow',
        speaking: 'animate-pulse-medium scale-105'
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
                <div className={`relative w-72 h-72 md:w-96 md:h-96 transition-all duration-500 ${sphereClasses[sphereState] || ''}`}>
                    {/* Wave background */}
                    <div className="absolute -inset-16 opacity-40">
                        <div className="absolute inset-0" style={{
                            background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)',
                        }} />
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="absolute inset-0" style={{
                                background: `radial-gradient(ellipse at ${50 + (i-1)*20}% 50%, rgba(6,182,212,0.1) 0%, transparent 60%)`,
                                animation: `wave-drift ${4 + i}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.7}s`
                            }} />
                        ))}
                    </div>

                    {/* Outer glow ring */}
                    <div className={`absolute -inset-4 rounded-full transition-all duration-700 ${
                        sphereState === 'listening' ? 'shadow-[0_0_100px_50px_rgba(59,130,246,0.25)]' :
                        sphereState === 'thinking' ? 'shadow-[0_0_80px_40px_rgba(147,51,234,0.2)]' :
                        sphereState === 'speaking' ? 'shadow-[0_0_100px_50px_rgba(6,182,212,0.25)]' :
                        'shadow-[0_0_60px_30px_rgba(59,130,246,0.1)]'
                    }`} />

                    {/* Main sphere */}
                    <div className="absolute inset-0 rounded-full overflow-hidden" style={{
                        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.8) 0%, rgba(147,197,253,0.6) 20%, rgba(59,130,246,0.7) 40%, rgba(30,64,175,0.8) 60%, rgba(15,23,42,0.6) 80%)',
                        boxShadow: 'inset 0 0 60px rgba(6,182,212,0.4), inset -20px -20px 60px rgba(30,64,175,0.3), 0 0 40px rgba(59,130,246,0.2)'
                    }}>
                        {/* Energy veins */}
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="absolute" style={{
                                width: '120%', height: '2px',
                                background: `linear-gradient(90deg, transparent, rgba(6,182,212,${0.3 + Math.random()*0.3}), transparent)`,
                                top: `${20 + i * 8}%`, left: '-10%',
                                transform: `rotate(${i * 22}deg)`,
                                animation: `vein-pulse ${2 + i * 0.4}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.2}s`,
                                filter: 'blur(1px)'
                            }} />
                        ))}

                        {/* Inner light spots */}
                        <div className="absolute w-1/3 h-1/3 top-[15%] left-[20%] rounded-full bg-white/40 blur-xl" style={{
                            animation: 'light-drift 5s ease-in-out infinite alternate'
                        }} />
                        <div className="absolute w-1/4 h-1/4 bottom-[25%] right-[20%] rounded-full bg-cyan-300/30 blur-lg" style={{
                            animation: 'light-drift 4s ease-in-out infinite alternate-reverse'
                        }} />
                    </div>

                    {/* Floating particles around sphere */}
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="absolute w-1.5 h-1.5 bg-blue-400/50 rounded-full" style={{
                            top: `${10 + Math.sin(i * 0.52) * 40 + 40}%`,
                            left: `${10 + Math.cos(i * 0.52) * 40 + 40}%`,
                            animation: `float-particle ${3 + i * 0.3}s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.25}s`
                        }} />
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
                    {/* Camera button */}
                    <button className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition shadow-sm border border-gray-200">
                        <Camera className="w-6 h-6 text-gray-600" />
                    </button>

                    {/* Mic button (main, larger) */}
                    <button onClick={toggleListening} disabled={isProcessing}
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
                    <button onClick={onClose}
                        className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition shadow-sm border border-gray-200">
                        <X className="w-6 h-6 text-gray-600" />
                    </button>
                </div>

                <p className="text-center text-gray-400 text-xs mt-3">
                    {isListening ? 'Escuchando... toca para detener' : 'Toca el microfono para hablar'}
                </p>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes float-particle {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.5; }
                    100% { transform: translateY(-15px) translateX(8px) scale(1.3); opacity: 0.15; }
                }
                @keyframes vein-pulse {
                    0% { opacity: 0.3; transform: rotate(var(--r, 0deg)) scaleX(0.8); }
                    100% { opacity: 0.7; transform: rotate(var(--r, 0deg)) scaleX(1.1); }
                }
                @keyframes wave-drift {
                    0% { transform: translateX(-10px) translateY(5px); }
                    100% { transform: translateX(10px) translateY(-5px); }
                }
                @keyframes light-drift {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(10px, -10px) scale(1.2); }
                }
                .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
                .animate-pulse-medium { animation: pulse-medium 2s ease-in-out infinite; }
                .animate-pulse-fast { animation: pulse-fast 1s ease-in-out infinite; }
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
                @keyframes pulse-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
                @keyframes pulse-medium { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
                @keyframes pulse-fast { 0%, 100% { transform: scale(1.05); } 50% { transform: scale(1.12); } }
                @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
