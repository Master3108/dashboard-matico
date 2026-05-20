import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Mic, MicOff, Send, MessageCircle, Trash2, Volume2, VolumeX } from 'lucide-react';

// ─── JARVIS Visual Core (SVG concentric rings, audio-reactive) ───
function JarvisCore({ state, audioLevel }) {
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
        <div className="relative flex items-center justify-center pointer-events-none select-none">
            {/* Outer glow */}
            <div className="absolute rounded-full blur-3xl" style={{
                width: 320, height: 320, background: color,
                opacity: 0.08 + lvl * 0.25 + (speaking ? 0.1 : 0),
                transform: `scale(${1 + lvl * 0.35})`, transition: 'opacity .25s, background .8s'
            }} />
            <div className="absolute rounded-full blur-2xl" style={{
                width: 180, height: 180, background: color, opacity: 0.18 + lvl * 0.4
            }} />

            <svg width="300" height="300" viewBox="0 0 300 300" style={{ overflow: 'visible' }}>
                <defs>
                    <radialGradient id="jcore" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
                        <stop offset="30%" stopColor={color} stopOpacity=".85" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                    <filter id="jglow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>

                {/* Outer ring — rotating arcs */}
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

                {/* Inner ring — counter-rotating arcs */}
                <g transform={`rotate(${-tick * 32} 150 150)`} filter="url(#jglow)">
                    {[[0, 25], [50, 90], [180, 35], [240, 70]].map(([f, s], i) =>
                        <path key={i} d={arcPath(128, f, s)} stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".7" />)}
                </g>

                {/* Hex grid */}
                <g opacity=".22">
                    {[60, 75, 90, 105].map((r, i) => {
                        const pts = [];
                        for (let k = 0; k < 6; k++) { const a = (k * 60 + (i % 2 ? 30 : 0)) * Math.PI / 180; pts.push(`${150 + Math.cos(a) * r},${150 + Math.sin(a) * r}`); }
                        return <polygon key={i} points={pts.join(' ')} stroke={color} strokeWidth=".8" fill="none" />;
                    })}
                </g>

                {/* Waveform */}
                <g filter="url(#jglow)">
                    <path d={wavePath} stroke={color} strokeWidth="2" fill={color}
                        fillOpacity={speaking ? 0.18 + lvl * 0.25 : 0.08} />
                </g>

                {/* Audio bars */}
                {(speaking || listening) && Array.from({ length: 64 }).map((_, i) => {
                    const a = (i / 64) * Math.PI * 2;
                    const seed = Math.sin(i * 1.3 + tick * 8) * 0.5 + 0.5;
                    const h = 20 + seed * (40 + lvl * 60);
                    const r1 = 60, r2 = r1 + h * (speaking ? lvl + 0.3 : 0.4);
                    return <line key={i} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1}
                        x2={150 + Math.cos(a) * r2} y2={150 + Math.sin(a) * r2}
                        stroke={color} strokeWidth="1.2" opacity={.4 + seed * .5} strokeLinecap="round" />;
                })}

                {/* Inner circles */}
                <circle cx="150" cy="150" r="50" stroke={color} strokeWidth=".6" fill="none" opacity=".4" />
                <circle cx="150" cy="150" r="40" stroke={color} strokeWidth=".6" fill="none" opacity=".4" />

                {/* Core dot */}
                <circle cx="150" cy="150"
                    r={20 + lvl * 12 + (speaking ? Math.sin(tick * 9) * 1.5 : Math.sin(tick * 2) * 0.8)}
                    fill="url(#jcore)" filter="url(#jglow)" />
                <circle cx="150" cy="150" r={8 + lvl * 6} fill="#fff" opacity={.7 + lvl * .3} />

                {/* HUD text */}
                <g fontFamily="monospace" fontSize="6.5" fill={color} opacity=".7">
                    <text x="20" y="30">SYS.CORE</text>
                    <text x="20" y="40">STATUS: {state.toUpperCase()}</text>
                    <text x="244" y="30">v3.1</text>
                    <text x="244" y="40">{Math.round(lvl * 100).toString().padStart(3, '0')}%</text>
                </g>

                {/* Clock hand */}
                <g transform={`rotate(${tick * 90} 150 150)`} opacity=".5">
                    <line x1="150" y1="150" x2="150" y2="40" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </g>
            </svg>
        </div>
    );
}

// ─── Status label map ───
const STATUS_META = {
    idle: { label: 'STANDBY', color: '#5ad7ff' },
    listening: { label: 'LISTENING', color: '#7ad6c0' },
    thinking: { label: 'PROCESSING', color: '#c8a4ff' },
    speaking: { label: 'TRANSMIT', color: '#5ad7ff' },
    error: { label: 'FAULT', color: '#ff5a5a' },
};

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
    const [text, setText] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [micLevel, setMicLevel] = useState(0);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [chatOpen, setChatOpen] = useState(false);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([
        { role: 'assistant', content: `Inicializando núcleo. Subsistemas en línea. Datos de ${studentName} cargados. A la espera de instrucciones, señor.` },
    ]);

    const audioElRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const abortRef = useRef(null);
    const chatEndRef = useRef(null);

    // Audio level analyzer for ring reactivity
    useEffect(() => {
        let raf;
        const data = new Uint8Array(128);
        const loop = () => {
            if (analyserRef.current && state === 'speaking') {
                analyserRef.current.getByteFrequencyData(data);
                let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
                setAudioLevel(Math.min(1, (sum / data.length / 255) * 1.6));
            } else if (state === 'listening') {
                setAudioLevel(0.15 + 0.1 * Math.abs(Math.sin(performance.now() / 250)));
            } else {
                setAudioLevel(prev => prev * 0.85);
            }
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(raf);
    }, [state]);

    // Auto-scroll chat
    useEffect(() => {
        if (chatOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
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
    }, [studentUserId, userRole]);

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

    // ─── Speak via TTS ───
    const speak = useCallback(async (content) => {
        if (!voiceEnabled) { setState('idle'); return; }
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
            // Disconnect previous source if exists
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

    const abortAll = useCallback(() => {
        try { abortRef.current?.abort(); } catch (_) { }
        try { audioElRef.current?.pause(); } catch (_) { }
        stopRecording();
        setState('idle');
    }, [stopRecording]);

    const clearHistory = useCallback(() => {
        abortAll();
        setHistory([{ role: 'assistant', content: 'Registro purgado, señor. A su disposición.' }]);
    }, [abortAll]);

    const statusMeta = STATUS_META[state] || STATUS_META.idle;

    // ─── Render ───
    const containerClass = standalone
        ? 'fixed inset-0 z-[9999]'
        : 'fixed inset-0 z-[300]';

    return (
        <div className={containerClass} style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            background: 'linear-gradient(180deg, #04080d 0%, #07101a 60%, #030608 100%)',
            color: '#dbeeff',
        }}>
            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(90,215,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(90,215,255,.04) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
            }} />
            {/* Scanlines */}
            <div className="absolute inset-0 pointer-events-none opacity-60" style={{
                background: 'repeating-linear-gradient(180deg, transparent 0px, transparent 2px, rgba(90,215,255,.025) 3px)',
            }} />

            {/* Top bar */}
            <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4 z-20">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl border flex items-center justify-center"
                        style={{ borderColor: 'rgba(90,215,255,.4)', background: 'rgba(90,215,255,.1)', boxShadow: '0 0 20px rgba(90,215,255,.2) inset' }}>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700, color: '#b8e6ff', textShadow: '0 0 12px rgba(90,215,255,.4)' }}>J</span>
                    </div>
                    <div>
                        <div style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700, fontSize: 13, letterSpacing: '.15em', color: '#cce8ff', textShadow: '0 0 12px rgba(90,215,255,.4)' }}>
                            J.A.R.V.I.S.
                        </div>
                        <div className="text-[8px] uppercase tracking-[0.22em]" style={{ color: 'rgba(90,215,255,.5)' }}>
                            Asistente de {studentName}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <div className="rounded-full pl-2 pr-3 py-1 inline-flex items-center gap-1.5"
                        style={{ background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)' }}>
                        <span className="block w-2 h-2 rounded-full" style={{
                            background: statusMeta.color, boxShadow: `0 0 8px ${statusMeta.color}`,
                            animation: 'pulse 1.4s ease-in-out infinite'
                        }} />
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(90,215,255,.9)' }}>{statusMeta.label}</span>
                    </div>
                    {/* Voice toggle */}
                    <button onClick={() => setVoiceEnabled(v => !v)}
                        className="rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(10,20,31,.65)', border: '1px solid rgba(90,215,255,.22)', color: voiceEnabled ? '#5ad7ff' : '#ff8a8a' }}>
                        {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </button>
                    {/* Clear */}
                    <button onClick={clearHistory}
                        className="rounded-full w-8 h-8 flex items-center justify-center"
                        style={{ background: 'rgba(10,20,31,.65)', border: '1px solid rgba(90,215,255,.22)', color: 'rgba(90,215,255,.6)' }}>
                        <Trash2 size={13} />
                    </button>
                    {/* Close */}
                    {onClose && (
                        <button onClick={() => { abortAll(); onClose(); }}
                            className="rounded-full w-8 h-8 flex items-center justify-center"
                            style={{ background: 'rgba(10,20,31,.65)', border: '1px solid rgba(255,90,90,.3)', color: '#ff8a8a' }}>
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Core visual */}
            <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -55%)' }}>
                <JarvisCore state={state} audioLevel={audioLevel} />
            </div>

            {/* STOP button while active */}
            {(state === 'speaking' || state === 'thinking' || state === 'listening') && (
                <button onClick={abortAll}
                    className="fixed z-30 rounded-full flex items-center justify-center"
                    style={{
                        width: 48, height: 48, left: 16, bottom: 120,
                        background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,90,90,.5)', color: '#ff8a8a',
                        boxShadow: '0 0 24px rgba(255,90,90,.3)',
                    }}>
                    <X size={20} />
                </button>
            )}

            {/* Mic level indicator */}
            {state === 'listening' && (
                <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 110 }}>
                    <div className="rounded-full px-4 py-2 flex items-center gap-3"
                        style={{ background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)' }}>
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: '#7ad6c0' }}>Te escucho</span>
                        <div className="flex items-end gap-0.5 h-5">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                                <div key={i} style={{
                                    width: 3, height: 4 + i * 1.5,
                                    background: micLevel > (i + 1) * 0.08 ? '#7ad6c0' : 'rgba(122,214,192,.2)',
                                    borderRadius: 1.5,
                                }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Last reply bubble (when chat closed) */}
            {!chatOpen && history.length > 0 && history[history.length - 1].role === 'assistant' && (
                <div className="fixed z-20 pointer-events-none" style={{ right: 60, bottom: 130, maxWidth: 'min(380px,75vw)' }}>
                    <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-[12px] whitespace-pre-line"
                        style={{ background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)', color: '#dbeeff' }}>
                        <span className="text-[8px] uppercase tracking-widest block mb-1 text-right" style={{ color: 'rgba(90,215,255,.8)' }}>J.A.R.V.I.S.</span>
                        {history[history.length - 1].content}
                    </div>
                </div>
            )}

            {/* Composer */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20" style={{ width: 'min(620px, 92vw)' }}>
                <div className="rounded-[24px] p-2 flex items-end gap-2"
                    style={{ background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px) saturate(140%)', border: '1px solid rgba(90,215,255,.22)' }}>
                    <button onClick={() => state === 'listening' ? stopRecording() : startRecording()}
                        disabled={state === 'thinking' || state === 'speaking'}
                        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                        style={{
                            background: state === 'listening' ? 'rgba(122,214,192,.3)' : 'rgba(90,215,255,.15)',
                            color: state === 'listening' ? '#7ad6c0' : '#5ad7ff',
                            border: state === 'listening' ? '2px solid #7ad6c0' : 'none',
                        }}>
                        {state === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <textarea value={text} onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(text); } }}
                        rows={1} placeholder={state === 'listening' ? 'ESCUCHANDO…' : 'Introduzca su consulta…'}
                        className="flex-1 bg-transparent resize-none outline-none py-2 px-2 text-[13px] placeholder:opacity-40 leading-snug"
                        style={{ minHeight: 40, color: '#dbeeff', maxHeight: 120 }} />
                    <button onClick={() => sendText(text)}
                        disabled={!text.trim() || state === 'thinking' || state === 'speaking'}
                        className="shrink-0 h-10 px-4 rounded-full flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-widest transition-all"
                        style={{
                            background: text.trim() ? '#5ad7ff' : 'rgba(90,215,255,.1)',
                            color: text.trim() ? '#0a141f' : 'rgba(90,215,255,.4)',
                            cursor: text.trim() ? 'pointer' : 'not-allowed',
                        }}>
                        <Send size={14} /> Enviar
                    </button>
                </div>
                <p className="text-center text-[9px] uppercase tracking-widest mt-1.5" style={{ color: 'rgba(90,215,255,.3)' }}>
                    ⏎ Enviar · 🎤 Voz · Pausa 2s para enviar
                </p>
            </div>

            {/* Chat toggle */}
            <button onClick={() => setChatOpen(o => !o)}
                className="fixed z-30 rounded-full flex items-center justify-center"
                style={{
                    width: 44, height: 44, right: 16, bottom: 110,
                    background: 'rgba(10,20,31,.65)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(90,215,255,.22)', color: '#5ad7ff',
                    boxShadow: '0 0 24px rgba(90,215,255,.25)',
                }}>
                {chatOpen ? <X size={18} /> : <MessageCircle size={18} />}
            </button>

            {/* Chat log panel */}
            {chatOpen && (
                <div className="fixed z-30" style={{ right: 68, bottom: 110, width: 'min(360px,80vw)' }}>
                    <div className="rounded-2xl flex flex-col overflow-hidden"
                        style={{ maxHeight: '65vh', background: 'rgba(10,20,31,.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(90,215,255,.22)' }}>
                        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'rgba(90,215,255,.15)' }}>
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(90,215,255,.8)' }}>Registro · {history.length}</span>
                            <button onClick={() => setChatOpen(false)} style={{ color: 'rgba(90,215,255,.6)' }}>
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
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
                </div>
            )}

            {/* Error toast */}
            {error && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2 text-[11px]"
                    style={{ background: 'rgba(10,20,31,.85)', border: '1px solid rgba(248,113,113,.3)', color: '#fca5a5' }}>
                    ⚠️ {error}
                    <button onClick={() => setError(null)} className="ml-3" style={{ color: '#fca5a5' }}>✕</button>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
            `}</style>
        </div>
    );
}
