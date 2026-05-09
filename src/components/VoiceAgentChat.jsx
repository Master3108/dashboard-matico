import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, MessageCircle, ChevronDown } from 'lucide-react';

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
        <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#0a0a1a] via-[#0d1033] to-[#0a0a1a] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                    <X className="w-5 h-5 text-white" />
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setTtsEnabled(!ttsEnabled)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                    >
                        {ttsEnabled ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-white/50" />}
                    </button>
                    <button
                        onClick={() => setShowMessages(!showMessages)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                    >
                        <MessageCircle className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Sphere Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                {/* Animated Sphere */}
                <div className={`relative w-64 h-64 md:w-80 md:h-80 transition-all duration-500 ${sphereClasses[sphereState] || ''}`}>
                    {/* Outer glow */}
                    <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
                        sphereState === 'listening' ? 'bg-blue-500/30 shadow-[0_0_80px_40px_rgba(59,130,246,0.3)]' :
                        sphereState === 'thinking' ? 'bg-purple-500/20 shadow-[0_0_60px_30px_rgba(147,51,234,0.2)]' :
                        sphereState === 'speaking' ? 'bg-cyan-500/25 shadow-[0_0_80px_40px_rgba(6,182,212,0.3)]' :
                        'bg-blue-500/10 shadow-[0_0_40px_20px_rgba(59,130,246,0.15)]'
                    }`} />

                    {/* Inner sphere layers */}
                    <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600/40 via-cyan-500/30 to-blue-800/40 backdrop-blur-sm border border-white/10" />
                    <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-cyan-400/30 via-blue-500/20 to-purple-500/30 backdrop-blur-md" />
                    <div className="absolute inset-12 rounded-full bg-gradient-to-br from-white/10 via-cyan-300/20 to-blue-400/10 backdrop-blur-lg" />

                    {/* Core */}
                    <div className={`absolute inset-16 rounded-full transition-all duration-500 ${
                        sphereState === 'listening' ? 'bg-gradient-to-br from-blue-400/60 to-cyan-300/40 shadow-[inset_0_0_30px_rgba(59,130,246,0.5)]' :
                        sphereState === 'thinking' ? 'bg-gradient-to-br from-purple-400/50 to-blue-500/40 shadow-[inset_0_0_30px_rgba(147,51,234,0.4)]' :
                        sphereState === 'speaking' ? 'bg-gradient-to-br from-cyan-300/60 to-blue-400/40 shadow-[inset_0_0_40px_rgba(6,182,212,0.5)]' :
                        'bg-gradient-to-br from-blue-400/30 to-cyan-300/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.3)]'
                    }`} />

                    {/* Floating particles */}
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-1 h-1 bg-cyan-300/60 rounded-full"
                                style={{
                                    top: `${30 + Math.sin(i * 1.05) * 25}%`,
                                    left: `${30 + Math.cos(i * 1.05) * 25}%`,
                                    animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite alternate`,
                                    animationDelay: `${i * 0.3}s`
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Status text */}
                <div className="mt-6 text-center">
                    <p className={`text-lg font-medium transition-colors duration-300 ${
                        sphereState === 'listening' ? 'text-blue-300' :
                        sphereState === 'thinking' ? 'text-purple-300' :
                        sphereState === 'speaking' ? 'text-cyan-300' :
                        'text-white/60'
                    }`}>
                        {sphereState === 'listening' ? (currentTranscript || 'Escuchando...') :
                         sphereState === 'thinking' ? 'Pensando...' :
                         sphereState === 'speaking' ? 'Hablando...' :
                         'Matico'}
                    </p>
                    {messages.length > 0 && !showMessages && sphereState === 'idle' && (
                        <p className="text-sm text-white/40 mt-2 max-w-xs mx-auto line-clamp-2">
                            {messages[messages.length - 1]?.content}
                        </p>
                    )}
                </div>

                {/* Quick questions (only show at start) */}
                {messages.length <= 1 && !isProcessing && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                        {quickQuestions.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(q)}
                                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium transition border border-white/10"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Messages panel (collapsible) */}
            {showMessages && (
                <div className="absolute inset-x-0 bottom-32 top-16 bg-black/80 backdrop-blur-lg rounded-t-3xl p-4 overflow-y-auto z-10">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-white/60 text-sm font-bold">Conversacion</p>
                        <button onClick={() => setShowMessages(false)} className="p-1 rounded-full bg-white/10">
                            <ChevronDown className="w-4 h-4 text-white/60" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/10 text-white/90'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* Bottom controls */}
            <div className="px-4 pb-6 pt-2">
                {/* Text input */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        disabled={isProcessing}
                        className="flex-1 bg-white/10 border border-white/20 rounded-full px-5 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isProcessing}
                        className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:text-white/30 text-white transition"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>

                {/* Voice buttons */}
                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={toggleListening}
                        disabled={isProcessing}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isListening
                                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        } ${isProcessing ? 'opacity-50' : ''}`}
                    >
                        {isListening ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
                    </button>
                </div>

                <p className="text-center text-white/30 text-xs mt-3">
                    {isListening ? 'Toca para dejar de escuchar' : 'Toca el microfono para hablar'}
                </p>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes float-particle {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
                    100% { transform: translateY(-20px) translateX(10px) scale(1.5); opacity: 0.2; }
                }
                .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
                .animate-pulse-medium { animation: pulse-medium 2s ease-in-out infinite; }
                .animate-pulse-fast { animation: pulse-fast 1s ease-in-out infinite; }
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.03); }
                }
                @keyframes pulse-medium {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                }
                @keyframes pulse-fast {
                    0%, 100% { transform: scale(1.05); }
                    50% { transform: scale(1.12); }
                }
                @keyframes spin-slow {
                    0% { transform: rotate(0deg) scale(1); }
                    50% { transform: rotate(180deg) scale(1.02); }
                    100% { transform: rotate(360deg) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
