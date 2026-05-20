import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Mic, MicOff, Send, MessageCircle, Trash2, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react';

// ─── JARVIS Visual Core (SVG concentric rings, audio-reactive) ───
function JarvisCore({ state, audioLevel, size = 300 }) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let raf, t0 = performance.now();
        const loop = () => { setTick((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
        loop();
        return () => cancelAnimationFrame(raf);
    }, []);

    const speaking = state === 'speaking';
    const listening = state === 'listening';
    const thinking = state === 'thinking';
    const error = state === 'error';
    const color = error ? '#ff5a5a' : thinking ? '#c8a4ff' : listening ? '#7ad6c0' : '#5ad7ff';
    const lvl = Math.min(1, audioLevel);

    const wavePath = useMemo(() => {
        let d = ''; const N = 96;
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2 - Math.PI / 2;
            const wobble = Math.sin(a * 5 + tick * 3) * 6 + Math.sin(a * 11 + tick * 5) * 4;
            const audio = speaking ? lvl * 22 * (1 + Math.sin(a * 3 + tick * 8) * 0.4) : listening ? lvl * 10 : 0;
            const r = 80 + wobble * (.6 + lvl * .6) + audio;
            d += (i === 0 ? 'M' : 'L') + (150 + Math.cos(a) * r).toFixed(2) + ' ' + (150 + Math.sin(a) * r).toFixed(2);
        }
        return d + ' Z';
    }, [tick, speaking, listening, lvl]);

    const arcPath = (rad, fromDeg, span) => {
        const a1 = (fromDeg - 90) * Math.PI / 180, a2 = (fromDeg + span - 90) * Math.PI / 180;
        return `M ${150 + Math.cos(a1) * rad} ${150 + Math.sin(a1) * rad} A ${rad} ${rad} 0 ${span > 180 ? 1 : 0} 1 ${150 + Math.cos(a2) * rad} ${150 + Math.sin(a2) * rad}`;
    };

    return (
        <div className="relative flex items-center justify-center pointer-events-none select-none" style={{ width: size, height: size }}>
            <div className="absolute rounded-full blur-3xl" style={{
                width: size, height: size, background: color,
                opacity: 0.08 + lvl * 0.25 + (speaking ? 0.1 : 0),
                transform: `scale(${1 + lvl * 0.35})`, transition: 'opacity .25s, background .8s'
            }} />
            <div className="absolute rounded-full blur-2xl" style={{
                width: size * 0.6, height: size * 0.6, background: color, opacity: 0.18 + lvl * 0.4
            }} />

            <svg width={size} height={size} viewBox="0 0 300 300" style={{ overflow: 'visible' }}>
                <defs>
                    <radialGradient id="jcore" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
                        <stop offset="30%" stopColor={color} stopOpacity=".85" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                    <filter id="jglow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>

                <g transform={`rotate(${tick * 18} 150 150)`} filter="url(#jglow)">
                    {[[0, 60], [100, 30], [160, 80], [280, 40]].map(([f, s], i) =>
                        <path key={i} d={arcPath(140, f, s)} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".85" />)}
                    {Array.from({ length: 36 }).map((_, i) => {
                        const a = (i * 10 - 90) * Math.PI / 180, r1 = 144, r2 = i % 3 === 0 ? 150 : 147;
                        return <line key={i} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1}
                            x2={150 + Math.cos(a) * r2} y2={150 + Math.sin(a) * r2}
                            stroke={color} strokeWidth={i % 3 === 0 ? 1.4 : .8} opacity={i % 3 === 0 ? .7 : .35} />;
                    })}
                </g>

                <g transform={`rotate(${-tick * 32} 150 150)`} filter="url(#jglow)">
                    {[[0, 25], [50, 90], [180, 35], [240, 70]].map(([f, s], i) =>
                        <path key={i} d={arcPath(128, f, s)} stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".7" />)}
                </g>

                <g opacity=".22">
                    {[60, 75, 90, 105].map((r, i) => {
                        const pts = [];
                        for (let k = 0; k < 6; k++) { const a = (k * 60 + (i % 2 ? 30 : 0)) * Math.PI / 180; pts.push(`${150 + Math.cos(a) * r},${150 + Math.sin(a) * r}`); }
                        return <polygon key={i} points={pts.join(' ')} stroke={color} strokeWidth=".8" fill="none" />;
                    })}
                </g>

                <g filter="url(#jglow)">
                    <path d={wavePath} stroke={color} strokeWidth="2" fill={color}
                        fillOpacity={speaking ? 0.18 + lvl * 0.25 : 0.08} />
                </g>

                {(speaking || listening) && Array.from({ length: 64 }).map((_, i) => {
                    const a = (i / 64) * Math.PI * 2;
                    const seed = Math.sin(i * 1.3 + tick * 8) * 0.5 + 0.5;
                    const h = 20 + seed * (40 + lvl * 60);
                    const r1 = 60, r2 = r1 + h * (speaking ? lvl + 0.3 : 0.4);
                    return <line key={i} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1}
                        x2={150 + Math.cos(a) * r2} y2={150 + Math.sin(a) * r2}
                        stroke={color} strokeWidth="1.2" opacity={.4 + seed * .5} strokeLinecap="round" />;
                })}

                <circle cx="150" cy="150" r="50" stroke={color} strokeWidth=".6" fill="none" opacity=".4" />
                <circle cx="150" cy="150" r="40" stroke={color} strokeWidth=".6" fill="none" opacity=".4" />
                <circle cx="150" cy="150"
                    r={20 + lvl * 12 + (speaking ? Math.sin(tick * 9) * 1.5 : Math.sin(tick * 2) * 0.8)}
                    fill="url(#jcore)" filter="url(#jglow)" />
                <circle cx="150" cy="150" r={8 + lvl * 6} fill="#fff" opacity={.7 + lvl * .3} />

                <g transform={`rotate(${tick * 90} 150 150)`} opacity=".5">
                    <line x1="150" y1="150" x2="150" y2="40" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </g>
            </svg>
        </div>
    );
}

const STATUS_META = {
    idle: { label: 'STANDBY', color: '#5ad7ff' },
    listening: { label: 'LISTENING', color: '#7ad6c0' },
    thinking: { label: 'PROCESSING', color: '#c8a4ff' },
    speaking: { label: 'TRANSMIT', color: '#5ad7ff' },
    error: { label: 'FAULT', color: '#ff5a5a' },
};

const GREETINGS = [
    'A su disposición, señor. ¿En qué puedo asistirle hoy?',
    'Buenas, señor. Sistemas en línea. ¿Qué necesita?',
    'J.A.R.V.I.S. operativo. ¿Cómo puedo ayudarle?',
];

// ─── Main Component ───
export default function JarvisAssistant({
    studentUserId,
    userId,
    userRole = 'parent',
    studentName = 'tu hijo',
    onClose,
    onCalendarChanged,
    standalone = false,
    trainingMode = false,
}) {
    const [state, setState] = useState('idle');
    const [history, setHistory] = useState([]);
    const [text, setText] = useState('');
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [chatOpen, setChatOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [micLevel, setMicLevel] = useState(0);
    const [greeted, setGreeted] = useState(false);

    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const audioElRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const abortRef = useRef(null);
    const chatEndRef = useRef(null);
    const autoListenRef = useRef(false);

    // Audio level monitor for speaking
    useEffect(() => {
        if (state !== 'speaking') { setAudioLevel(0); return; }
        const an = analyserRef.current;
        if (!an) return;
        const buf = new Uint8Array(an.fftSize);
        let raf;
        const tick = () => {
            an.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
            setAudioLevel(Math.sqrt(sum / buf.length) * 6);
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [state]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, chatOpen]);

    // ─── Server calls ───
    const callChat = useCallback(async (message, convHistory) => {
        const res = await fetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                student_id: studentUserId,
                user_type: userRole === 'apoderado' ? 'parent' : userRole,
                conversation_history: convHistory.slice(-10),
                personality: 'jarvis',
                training_mode: trainingMode,
                admin_user_id: trainingMode ? userId : undefined,
            }),
        });
        if (!res.ok) throw new Error(`Chat: ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error del agente');
        return data.reply;
    }, [studentUserId, userRole, trainingMode, userId]);

    const callTTS = useCallback(async (content, signal) => {
        const res = await fetch('/api/agent/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content, voice: 'onyx' }),
            signal,
        });
        if (!res.ok) throw new Error(`TTS: ${res.status}`);
        return await res.blob();
    }, []);

    const callSTT = useCallback(async (audioBlob) => {
        const fd = new FormData();
        fd.append('audio', audioBlob, 'speech.webm');
        const res = await fetch('/api/agent/stt', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`STT: ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'STT failed');
        return data.text;
    }, []);

    // ─── Speak via TTS (then auto-listen) ───
    const speak = useCallback(async (content) => {
        if (!voiceEnabled) { setState('idle'); autoListenRef.current = true; return; }
        try {
            setState('speaking');
            const ac = new AbortController(); abortRef.current = ac;
            const blob = await callTTS(content, ac.signal);
            const url = URL.createObjectURL(blob);

            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (!analyserRef.current) {
                analyserRef.current = ctx.createAnalyser();
                analyserRef.current.fftSize = 256;
                analyserRef.current.connect(ctx.destination);
            }
            if (ctx.state === 'suspended') await ctx.resume();

            const audio = new Audio(url);
            audioElRef.current = audio;
            const src = ctx.createMediaElementSource(audio);
            if (sourceNodeRef.current) try { sourceNodeRef.current.disconnect(); } catch (_) { }
            sourceNodeRef.current = src;
            src.connect(analyserRef.current);
            await audio.play();
            await new Promise(resolve => { audio.onended = resolve; audio.onerror = resolve; });
            URL.revokeObjectURL(url);
        } catch (e) {
            if (e.name !== 'AbortError') { console.error(e); setError(e.message); }
        } finally {
            setState('idle');
            // Auto-listen after speaking
            autoListenRef.current = true;
        }
    }, [voiceEnabled, callTTS]);

    // ─── Send text → Agent → Speak ───
    const sendText = useCallback(async (content) => {
        if (!content.trim()) return;
        const userMsg = { role: 'user', content: content.trim() };
        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setText('');
        setState('thinking');
        setExpanded(true);
        try {
            const reply = await callChat(content.trim(), newHistory);
            setHistory(h => [...h, { role: 'assistant', content: reply }]);
            if (reply.includes('evento') || reply.includes('calendario')) {
                onCalendarChanged?.();
            }
            await speak(reply);
        } catch (e) {
            console.error(e); setError(e.message); setState('error');
            setTimeout(() => setState('idle'), 2500);
        }
    }, [history, callChat, speak, onCalendarChanged]);

    // ─── Record mic → STT → sendText ───
    const startRecording = useCallback(async () => {
        if (mediaRecorderRef.current?.state === 'recording') return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mr;
            recordedChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size) recordedChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setMicLevel(0);
                const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                if (blob.size < 2000) { setState('idle'); return; }
                setState('thinking');
                try {
                    const transcript = await callSTT(blob);
                    if (transcript && transcript.length > 1) {
                        await sendText(transcript);
                    } else {
                        setState('idle');
                    }
                } catch (e) { console.error(e); setError(e.message); setState('idle'); }
            };
            mr.start();
            setState('listening');

            // Silence-based auto-stop
            const ac = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = ac;
            if (ac.state === 'suspended') await ac.resume();
            const src = ac.createMediaStreamSource(stream);
            const an = ac.createAnalyser(); an.fftSize = 512;
            src.connect(an);
            const buf = new Uint8Array(an.fftSize);
            let lastSpeech = performance.now();
            let everSpoke = false;
            const SPEECH_THRESHOLD = 0.012;
            const SILENCE_TIMEOUT = 2200;
            const MAX_NO_SPEECH = 20000;

            const monitor = () => {
                if (mr.state !== 'recording') return;
                an.getByteTimeDomainData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
                const rms = Math.sqrt(sum / buf.length);
                setMicLevel(Math.min(1, rms * 8));
                if (rms > SPEECH_THRESHOLD) { lastSpeech = performance.now(); everSpoke = true; }
                const silenceMs = performance.now() - lastSpeech;
                if ((everSpoke && silenceMs > SILENCE_TIMEOUT) || (!everSpoke && silenceMs > MAX_NO_SPEECH)) {
                    mr.stop(); return;
                }
                requestAnimationFrame(monitor);
            };
            monitor();
        } catch (e) {
            console.error(e); setError('No se pudo acceder al micrófono: ' + e.message);
            setState('idle');
        }
    }, [callSTT, sendText]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    }, []);

    // Auto-listen after speaking (triggered by autoListenRef flag)
    useEffect(() => {
        if (state === 'idle' && autoListenRef.current) {
            autoListenRef.current = false;
            const t = setTimeout(() => startRecording(), 500);
            return () => clearTimeout(t);
        }
    }, [state, startRecording]);

    const abortAll = useCallback(() => {
        autoListenRef.current = false;
        try { abortRef.current?.abort(); } catch (_) { }
        try { audioElRef.current?.pause(); } catch (_) { }
        stopRecording();
        setState('idle');
    }, [stopRecording]);

    const clearHistory = useCallback(() => {
        abortAll();
        setHistory([{ role: 'assistant', content: 'Registro purgado, señor. A su disposición.' }]);
    }, [abortAll]);

    // Auto-greet on mount
    useEffect(() => {
        if (greeted) return;
        setGreeted(true);
        const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        setHistory([{ role: 'assistant', content: greeting }]);
        setExpanded(true);
        // Speak greeting then auto-listen
        setTimeout(() => speak(greeting), 600);
    }, [greeted, speak]);

    const statusMeta = STATUS_META[state] || STATUS_META.idle;
    const lastReply = history.filter(m => m.role === 'assistant').pop()?.content || '';

    // ─── MINI WIDGET LAYOUT (bottom-left vertical) ───
    return (
        <div className="fixed bottom-4 left-4 z-[300] flex flex-col items-center gap-2" style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            width: expanded ? 340 : 80,
            transition: 'width .3s ease',
        }}>

            {/* Chat panel (slides up when expanded) */}
            {expanded && chatOpen && (
                <div className="w-full rounded-2xl overflow-hidden mb-1 animate-slideUp"
                    style={{ maxHeight: '50vh', background: 'rgba(4,8,13,.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)' }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(90,215,255,.15)' }}>
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(90,215,255,.8)' }}>Registro · {history.length}</span>
                        <button onClick={() => setChatOpen(false)} style={{ color: 'rgba(90,215,255,.6)' }}><X size={14} /></button>
                    </div>
                    <div className="overflow-y-auto p-3 flex flex-col gap-2" style={{ maxHeight: '40vh' }}>
                        {history.map((m, i) => (
                            <div key={i}
                                className={`rounded-2xl px-3 py-2 text-[11px] max-w-[88%] whitespace-pre-line ${m.role === 'user' ? 'self-end' : 'self-start'}`}
                                style={{
                                    background: m.role === 'user' ? 'rgba(90,215,255,.12)' : 'rgba(20,32,44,.55)',
                                    border: '1px solid rgba(90,215,255,.18)', color: '#dbeeff',
                                }}>
                                <span className={`text-[8px] uppercase tracking-widest block mb-1 ${m.role === 'user' ? 'text-right' : ''}`}
                                    style={{ color: 'rgba(90,215,255,.7)' }}>
                                    {m.role === 'user' ? 'USR' : 'J.A.R.V.I.S.'}
                                </span>
                                {m.content}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </div>
            )}

            {/* Reply bubble (when chat closed but expanded) */}
            {expanded && !chatOpen && lastReply && (
                <div className="w-full rounded-2xl rounded-bl-md px-4 py-3 text-[12px] whitespace-pre-line mb-1 animate-slideUp"
                    style={{ background: 'rgba(4,8,13,.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)', color: '#dbeeff' }}>
                    <span className="text-[8px] uppercase tracking-widest block mb-1" style={{ color: 'rgba(90,215,255,.8)' }}>J.A.R.V.I.S.</span>
                    {lastReply}
                </div>
            )}

            {/* Text input (when expanded) */}
            {expanded && (
                <div className="w-full rounded-2xl p-2 flex items-end gap-2 animate-slideUp"
                    style={{ background: 'rgba(4,8,13,.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)' }}>
                    <textarea value={text} onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(text); } }}
                        rows={1} placeholder={state === 'listening' ? 'ESCUCHANDO…' : 'Consulta…'}
                        className="flex-1 bg-transparent resize-none outline-none py-1.5 px-2 text-[12px] placeholder:opacity-40 leading-snug"
                        style={{ minHeight: 36, color: '#dbeeff', maxHeight: 80 }} />
                    <button onClick={() => sendText(text)}
                        disabled={!text.trim() || state === 'thinking' || state === 'speaking'}
                        className="shrink-0 h-8 px-3 rounded-full flex items-center gap-1 text-[10px] uppercase tracking-widest transition-all"
                        style={{
                            background: text.trim() ? '#5ad7ff' : 'rgba(90,215,255,.1)',
                            color: text.trim() ? '#0a141f' : 'rgba(90,215,255,.4)',
                        }}>
                        <Send size={12} />
                    </button>
                </div>
            )}

            {/* Core orb + controls row */}
            <div className="flex items-end gap-2">
                {/* JARVIS core orb */}
                <div className="relative cursor-pointer" onClick={() => setExpanded(e => !e)}
                    style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(4,8,13,.9)', border: '2px solid rgba(90,215,255,.3)', overflow: 'hidden', boxShadow: '0 0 30px rgba(90,215,255,.2)' }}>
                    <JarvisCore state={state} audioLevel={audioLevel} size={80} />
                    {/* Status dot */}
                    <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style={{
                        background: statusMeta.color, boxShadow: `0 0 8px ${statusMeta.color}`,
                        animation: 'pulse 1.4s ease-in-out infinite'
                    }} />
                </div>

                {/* Vertical control strip (when expanded) */}
                {expanded && (
                    <div className="flex flex-col gap-1.5 animate-slideUp">
                        {/* Mic button */}
                        <button onClick={() => state === 'listening' ? stopRecording() : startRecording()}
                            disabled={state === 'thinking' || state === 'speaking'}
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                            style={{
                                background: state === 'listening' ? 'rgba(122,214,192,.3)' : 'rgba(4,8,13,.85)',
                                color: state === 'listening' ? '#7ad6c0' : '#5ad7ff',
                                border: state === 'listening' ? '2px solid #7ad6c0' : '1px solid rgba(90,215,255,.3)',
                                boxShadow: state === 'listening' ? '0 0 16px rgba(122,214,192,.4)' : 'none',
                            }}>
                            {state === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                        {/* Chat toggle */}
                        <button onClick={() => setChatOpen(o => !o)}
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(4,8,13,.85)', border: '1px solid rgba(90,215,255,.3)', color: '#5ad7ff' }}>
                            {chatOpen ? <X size={15} /> : <MessageCircle size={15} />}
                        </button>
                        {/* Voice toggle */}
                        <button onClick={() => setVoiceEnabled(v => !v)}
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(4,8,13,.85)', border: '1px solid rgba(90,215,255,.3)', color: voiceEnabled ? '#5ad7ff' : '#ff8a8a' }}>
                            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>
                        {/* Close */}
                        {onClose && (
                            <button onClick={() => { abortAll(); onClose(); }}
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(4,8,13,.85)', border: '1px solid rgba(255,90,90,.3)', color: '#ff8a8a' }}>
                                <X size={15} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Label */}
            <div className="text-center" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
                <div style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700, fontSize: 10, letterSpacing: '.15em', color: '#cce8ff', textShadow: '0 0 12px rgba(90,215,255,.4)' }}>
                    J.A.R.V.I.S.
                </div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(90,215,255,.5)' }}>
                    {statusMeta.label}
                </div>
            </div>

            {/* Mic level indicator */}
            {state === 'listening' && (
                <div className="rounded-full px-3 py-1.5 flex items-center gap-2"
                    style={{ background: 'rgba(4,8,13,.85)', border: '1px solid rgba(122,214,192,.3)' }}>
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: '#7ad6c0' }}>Escuchando</span>
                    <div className="flex items-end gap-0.5 h-4">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                            <div key={i} style={{
                                width: 2, height: 3 + i * 1.2,
                                background: micLevel > (i + 1) * 0.1 ? '#7ad6c0' : 'rgba(122,214,192,.2)',
                                borderRadius: 1,
                            }} />
                        ))}
                    </div>
                </div>
            )}

            {/* Error toast */}
            {error && (
                <div className="rounded-xl px-3 py-1.5 text-[10px] flex items-center gap-2"
                    style={{ background: 'rgba(4,8,13,.9)', border: '1px solid rgba(248,113,113,.3)', color: '#fca5a5' }}>
                    ⚠ {error}
                    <button onClick={() => setError(null)} style={{ color: '#fca5a5' }}>✕</button>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
                @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                .animate-slideUp { animation: slideUp .25s ease-out; }
            `}</style>
        </div>
    );
}
