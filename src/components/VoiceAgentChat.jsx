import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, MessageCircle, ChevronDown, UploadCloud } from 'lucide-react';

// WebGL lightning shader — hue-controllable vertical beam
const Lightning = ({ hue = 220, xOffset = 0, speed = 1.6, intensity = 0.5, size = 2 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vert = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;
    const frag = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      #define OCTAVE_COUNT 10
      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }
      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float hash11(float p) {
        p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p);
      }
      mat2 rotate2d(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
      float noise(vec2 p) {
        vec2 ip=floor(p), fp=fract(p);
        float a=hash12(ip), b=hash12(ip+vec2(1,0)), c=hash12(ip+vec2(0,1)), d=hash12(ip+vec2(1,1));
        vec2 t=smoothstep(0.0,1.0,fp);
        return mix(mix(a,b,t.x),mix(c,d,t.x),t.y);
      }
      float fbm(vec2 p) {
        float v=0.0, a=0.5;
        for(int i=0;i<OCTAVE_COUNT;i++) { v+=a*noise(p); p*=rotate2d(0.45); p*=2.0; a*=0.5; }
        return v;
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv = 2.0*uv - 1.0;
        uv.x *= iResolution.x / iResolution.y;
        uv.x += uXOffset;
        uv += 2.0*fbm(uv*uSize + 0.8*iTime*uSpeed) - 1.0;
        float dist = abs(uv.x);
        vec3 base = hsv2rgb(vec3(uHue/360.0, 0.7, 0.8));
        vec3 col = base * pow(mix(0.0,0.07,hash11(iTime*uSpeed))/dist, 1.0) * uIntensity;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (src, type) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(vert, gl.VERTEX_SHADER);
    const fs = compile(frag, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uTime = gl.getUniformLocation(prog, 'iTime');
    const uHueLoc = gl.getUniformLocation(prog, 'uHue');
    const uXOff = gl.getUniformLocation(prog, 'uXOffset');
    const uSpd = gl.getUniformLocation(prog, 'uSpeed');
    const uInt = gl.getUniformLocation(prog, 'uIntensity');
    const uSz = gl.getUniformLocation(prog, 'uSize');

    const t0 = performance.now();
    let raf;
    const render = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform1f(uHueLoc, hue);
      gl.uniform1f(uXOff, xOffset);
      gl.uniform1f(uSpd, speed);
      gl.uniform1f(uInt, intensity);
      gl.uniform1f(uSz, size);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resizeCanvas); };
  }, [hue, xOffset, speed, intensity, size]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

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
        const greeting = `Hola jefe, soy la tutora virtual de ${studentName || 'tu hijo'}. Pregúntame lo que quieras, estoy aquí pa' ayudarte.`;
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
                body: JSON.stringify({ text, voice: 'nova' }),
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
            audio.volume = 1.0;

            // Try play — on mobile may need user gesture
            try {
                await audio.play();
            } catch (playErr) {
                console.warn('[TTS] play() blocked, retrying:', playErr.name);
                // Fallback: set src directly and try again
                audio.src = url;
                audio.load();
                await new Promise(r => setTimeout(r, 200));
                await audio.play();
            }
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

    // Canvas energy animation — smooth flowing arcs instead of jagged lightning
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let t = 0; // continuous time counter

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

        // Persistent arcs — each has a seed so they evolve smoothly
        const arcs = [];
        for (let i = 0; i < 12; i++) {
            arcs.push({
                seed: Math.random() * 1000,
                side: i % 2 === 0 ? -1 : 1, // left or right
                yOff: (Math.random() - 0.5) * 0.8, // vertical offset from center
                speed: 0.6 + Math.random() * 0.8,
                length: 0.5 + Math.random() * 0.6, // how far the arc extends
                width: 1 + Math.random() * 1.5,
                phase: Math.random() * Math.PI * 2
            });
        }

        // Smooth noise-like function
        const smoothNoise = (x) => Math.sin(x * 1.3) * 0.5 + Math.sin(x * 2.7 + 1.4) * 0.3 + Math.sin(x * 4.1 + 2.8) * 0.2;

        // Draw a smooth flowing energy arc using quadratic curves
        const drawEnergyArc = (x1, y1, x2, y2, width, seed, time, intensity) => {
            const segments = 10;
            const dx = (x2 - x1) / segments;
            const dy = (y2 - y1) / segments;
            const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
            const perpX = -(y2-y1) / dist;
            const perpY = (x2-x1) / dist;
            const waveAmp = dist * 0.08 * intensity;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            for (let i = 1; i <= segments; i++) {
                const frac = i / segments;
                const baseX = x1 + dx * i;
                const baseY = y1 + dy * i;
                // Smooth wave displacement — fades at endpoints
                const envelope = Math.sin(frac * Math.PI);
                const wave = smoothNoise(seed + frac * 4 + time) * waveAmp * envelope;
                const nx = baseX + perpX * wave;
                const ny = baseY + perpY * wave;
                ctx.lineTo(nx, ny);
            }
            ctx.stroke();
        };

        const animate = (ts) => {
            animRef.current = requestAnimationFrame(animate);
            t = ts * 0.001; // seconds

            const W = canvas.style.width ? parseFloat(canvas.style.width) : 400;
            const H = canvas.style.height ? parseFloat(canvas.style.height) : 300;
            ctx.clearRect(0, 0, W, H);

            const st = stateRef.current;
            const cx = W / 2;
            const cy = H * 0.42;
            const rx = W * 0.26;
            const ry = H * 0.18;

            // Speaking: flowing energy arcs extending from sides
            if (st === 'speaking') {
                for (let i = 0; i < 8; i++) {
                    const arc = arcs[i];
                    const startX = cx + arc.side * (rx + 5);
                    const startY = cy + arc.yOff * ry;
                    const reach = W * 0.2 * arc.length;
                    const endX = startX + arc.side * reach;
                    const timeWave = Math.sin(t * arc.speed + arc.phase);
                    const endY = startY + timeWave * 25;
                    const alpha = 0.25 + 0.25 * Math.sin(t * arc.speed * 1.5 + arc.seed);
                    const w = arc.width * (0.8 + 0.4 * Math.sin(t * 2 + arc.seed));

                    // Glow layer
                    ctx.save();
                    ctx.strokeStyle = `rgba(59,130,246,${alpha * 0.6})`;
                    ctx.lineWidth = w + 5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.shadowColor = 'rgba(59,130,246,0.6)';
                    ctx.shadowBlur = 18;
                    drawEnergyArc(startX, startY, endX, endY, w + 5, arc.seed, t * arc.speed, 1.2);
                    ctx.restore();

                    // Core bright layer
                    ctx.save();
                    ctx.strokeStyle = `rgba(186,230,253,${alpha + 0.2})`;
                    ctx.lineWidth = w;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.shadowColor = 'rgba(125,211,252,0.7)';
                    ctx.shadowBlur = 10;
                    drawEnergyArc(startX, startY, endX, endY, w, arc.seed, t * arc.speed, 1.0);
                    ctx.restore();
                }
            }

            // Idle / thinking: gentle breathing wisps
            if (st === 'idle' || st === 'thinking') {
                const count = st === 'thinking' ? 4 : 2;
                for (let i = 0; i < count; i++) {
                    const arc = arcs[i];
                    const startX = cx + arc.side * rx;
                    const startY = cy + arc.yOff * ry * 0.5;
                    const reach = 25 + 15 * Math.sin(t * 0.5 + arc.seed);
                    const endX = startX + arc.side * reach;
                    const endY = startY + Math.sin(t * 0.7 + arc.seed) * 8;
                    const alpha = 0.08 + 0.08 * Math.sin(t * 0.6 + arc.seed);

                    ctx.save();
                    ctx.strokeStyle = `rgba(125,211,252,${alpha})`;
                    ctx.lineWidth = 1.2;
                    ctx.lineCap = 'round';
                    ctx.shadowColor = 'rgba(59,130,246,0.3)';
                    ctx.shadowBlur = 8;
                    drawEnergyArc(startX, startY, endX, endY, 1.2, arc.seed, t * 0.4, 0.4);
                    ctx.restore();
                }
            }

            // Listening: energy pulses below + gentle side arcs
            if (st === 'listening') {
                // Bottom energy streams
                for (let i = 0; i < 5; i++) {
                    const arc = arcs[i + 4];
                    const spread = (i - 2) / 2; // -1 to 1
                    const startX = cx + spread * rx * 0.8;
                    const startY = cy + ry * 0.5;
                    const endX = startX + Math.sin(t * 0.8 + arc.seed) * 20;
                    const endY = startY + 40 + 30 * arc.length;
                    const alpha = 0.2 + 0.15 * Math.sin(t * arc.speed + arc.seed);
                    const w = 1 + Math.sin(t * 1.2 + arc.seed) * 0.5;

                    ctx.save();
                    ctx.strokeStyle = `rgba(59,130,246,${alpha * 0.7})`;
                    ctx.lineWidth = w + 3;
                    ctx.lineCap = 'round';
                    ctx.shadowColor = 'rgba(59,130,246,0.5)';
                    ctx.shadowBlur = 12;
                    drawEnergyArc(startX, startY, endX, endY, w + 3, arc.seed, t * arc.speed, 0.7);
                    ctx.restore();

                    ctx.save();
                    ctx.strokeStyle = `rgba(186,230,253,${alpha + 0.1})`;
                    ctx.lineWidth = w;
                    ctx.lineCap = 'round';
                    ctx.shadowColor = 'rgba(125,211,252,0.5)';
                    ctx.shadowBlur = 6;
                    drawEnergyArc(startX, startY, endX, endY, w, arc.seed, t * arc.speed, 0.5);
                    ctx.restore();
                }

                // Subtle side wisps
                for (let i = 0; i < 2; i++) {
                    const arc = arcs[i + 9];
                    const startX = cx + arc.side * rx;
                    const startY = cy + arc.yOff * ry * 0.4;
                    const endX = startX + arc.side * (30 + 15 * Math.sin(t + arc.seed));
                    const endY = startY + Math.sin(t * 0.9 + arc.seed) * 10;

                    ctx.save();
                    ctx.strokeStyle = `rgba(125,211,252,0.15)`;
                    ctx.lineWidth = 1;
                    ctx.lineCap = 'round';
                    ctx.shadowColor = 'rgba(59,130,246,0.4)';
                    ctx.shadowBlur = 8;
                    drawEnergyArc(startX, startY, endX, endY, 1, arc.seed, t * 0.6, 0.3);
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

    // Hue según estado: idle=220 azul, listening=190 cian, thinking=270 morado, speaking=180 teal
    const lightningHue = sphereState === 'listening' ? 190 : sphereState === 'thinking' ? 270 : sphereState === 'speaking' ? 175 : 220;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{background:'radial-gradient(ellipse 130% 90% at 50% 38%, #0a1628 0%, #050a15 55%, #020408 100%)'}}>
            {/* WebGL lightning shader background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
                <Lightning hue={lightningHue} xOffset={0} speed={1.6} intensity={0.55} size={2} />
            </div>

            {/* Stormy atmosphere overlay */}
            <div className="absolute inset-0 pointer-events-none z-1" style={{background:'radial-gradient(ellipse 70% 45% at 50% 40%, rgba(30,58,138,0.1) 0%, transparent 70%)'}} />

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

                    {/* Toroid PNG image — exact reference */}
                    <div className="absolute inset-0 z-5 flex items-center justify-center">
                        <img src="/toroid.png" alt="" className="w-[75%] h-auto object-contain drop-shadow-[0_0_40px_rgba(59,130,246,0.4)]" draggable={false} />
                    </div>
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
                .toroid-glow { filter: drop-shadow(0 0 30px rgba(59,130,246,0.35)); transition: filter 0.4s; }
            `}</style>
        </div>
    );
};

export default VoiceAgentChat;
