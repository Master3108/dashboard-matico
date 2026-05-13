import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, MicOff, Send, Volume2, VolumeX, MessageCircle, ChevronDown, UploadCloud, BookOpen, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';

// WebGL LightningField — 4 rayos radiales, hue por estado, intensidad sincronizada con voz.
// Contexto WebGL creado una sola vez, lee de refs cada frame.
const LightningField = ({ hueRef, analyserRef = null }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
    resize();
    window.addEventListener('resize', resize);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vert = `attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

    const frag = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uIntensity;
      uniform float uAudioLevel;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x),
                   mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.2; a *= 0.5; }
        return v;
      }
      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.y, iResolution.x);
        float r = length(uv);
        float power = uAudioLevel * 4.5;
        float finalRays = 0.0; float coreRays = 0.0;
        for (int i = 0; i < 4; i++) {
          float angle = float(i) * 1.57 + iTime * 0.1;
          float dist = fbm(vec2(r * 2.0 - iTime * 2.0, angle)) * (0.15 + power * 0.1);
          float line = abs(uv.x * cos(angle) + uv.y * sin(angle) + dist);
          float glow = 0.02 / (line + 0.02);
          float core = 0.003 / (line + 0.005);
          float mask = smoothstep(0.18, 0.25, r);
          finalRays += glow * mask;
          coreRays  += core * mask * (0.5 + power);
        }
        vec3 baseColor = hsv2rgb(vec3(uHue/360.0, 0.7, 1.0));
        vec3 col = (baseColor * finalRays * uIntensity) + (vec3(1.0) * coreRays * uIntensity);
        col += baseColor * power * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (src, type) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(vert, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(frag, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uTime = gl.getUniformLocation(prog, 'iTime');
    const uHueLoc = gl.getUniformLocation(prog, 'uHue');
    const uInt = gl.getUniformLocation(prog, 'uIntensity');
    const uAud = gl.getUniformLocation(prog, 'uAudioLevel');

    const freqData = new Uint8Array(128);
    let raf;
    const render = (time) => {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time * 0.001);
      gl.uniform1f(uHueLoc, hueRef?.current ?? 220);

      let level = 0;
      const analyser = analyserRef?.current;
      if (analyser) {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        level = (sum / freqData.length) / 255.0;
      }

      gl.uniform1f(uInt, 1.2);
      gl.uniform1f(uAud, level);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []); // contexto WebGL creado una sola vez

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

const VoiceAgentChat = ({ studentUserId, userId, userRole = 'apoderado', studentName = '', onClose, onCalendarChanged, trainingMode = false }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [showMessages, setShowMessages] = useState(false);
    const [sphereState, setSphereState] = useState('idle'); // idle, listening, thinking, speaking
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);

    // Training mode state
    const [showTraining, setShowTraining] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [trainingEntries, setTrainingEntries] = useState([]);
    const [trainingInput, setTrainingInput] = useState('');
    const [trainingType, setTrainingType] = useState('instruccion');
    const [trainingSaving, setTrainingSaving] = useState(false);
    const [pendingImages, setPendingImages] = useState([]);

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

    // Lightning audio sync refs
    const lightningHueRef = useRef(220);
    const audioCtxRef = useRef(null);
    const lightningAnalyserRef = useRef(null);

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

    // Sync lightning hue with agent state
    useEffect(() => {
        lightningHueRef.current =
            sphereState === 'listening' ? 190 :
            sphereState === 'thinking'  ? 270 :
            sphereState === 'speaking'  ? 175 : 220;
    }, [sphereState]);

    // Track audio level for toroid glow (RAF loop)
    useEffect(() => {
        const freqData = new Uint8Array(128);
        let raf;
        const update = () => {
            const analyser = lightningAnalyserRef.current;
            if (analyser && isSpeaking) {
                analyser.getByteFrequencyData(freqData);
                let sum = 0;
                for (let i = 0; i < freqData.length; i++) sum += freqData[i];
                setAudioLevel(sum / freqData.length / 255);
            } else {
                setAudioLevel(0);
            }
            raf = requestAnimationFrame(update);
        };
        raf = requestAnimationFrame(update);
        return () => cancelAnimationFrame(raf);
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
        const greeting = trainingMode
            ? `Estoy en modo entrenamiento jefe. Dime cómo quieres que me comporte, qué debo recordar o cómo debo hablar. Yo anoto todo.`
            : `Hola jefe, soy la tutora virtual de ${studentName || 'tu hijo'}. Pregúntame lo que quieras, estoy aquí pa' ayudarte.`;
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

    // Lazy AudioContext + AnalyserNode for lightning sync
    const getOrCreateAudioCtx = () => {
        if (!audioCtxRef.current) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            analyser.connect(ctx.destination);
            audioCtxRef.current = ctx;
            lightningAnalyserRef.current = analyser;
        }
        return audioCtxRef.current;
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

            // Connect to analyser so lightning reacts to voice
            try {
                const ctx = getOrCreateAudioCtx();
                await ctx.resume();
                const src = ctx.createMediaElementSource(audio);
                src.connect(lightningAnalyserRef.current);
            } catch (_) { /* non-critical */ }

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
        const files = Array.from(event.target.files || []).slice(0, 5);
        event.target.value = '';
        if (!files.length || isProcessing) return;

        // Convert to base64 previews and store as pending
        const converted = [];
        for (const file of files) {
            const b64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            converted.push({ name: file.name, base64: b64, preview: b64 });
        }
        setPendingImages(prev => [...prev, ...converted].slice(0, 5));
    };

    const removePendingImage = (idx) => {
        setPendingImages(prev => prev.filter((_, i) => i !== idx));
    };

    // Send message to agent
    const sendMessage = async (text) => {
        if (!text || isProcessing) return;
        const shouldResumeListening = listeningDesiredRef.current;
        stopListening({ preserveDesired: shouldResumeListening });
        stopAllAudio();

        // Capture and clear pending images
        const imagesToSend = [...pendingImages];
        setPendingImages([]);

        const hasImages = imagesToSend.length > 0;
        const label = hasImages ? `${text} [+${imagesToSend.length} imagen${imagesToSend.length > 1 ? 'es' : ''}]` : text;
        const userMsg = { role: 'user', content: label, timestamp: new Date(), images: hasImages ? imagesToSend.map(i => i.preview) : undefined };
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

            const chatBody = {
                message: text,
                student_id: studentUserId || userId,
                user_type: userRole === 'apoderado' ? 'parent' : 'student',
                conversation_history: conversationRef.current.slice(-6)
            };
            if (trainingMode) {
                chatBody.training_mode = true;
                chatBody.admin_user_id = userId;
            }
            if (imagesToSend.length > 0) {
                chatBody.images = imagesToSend.map(i => i.base64);
            }
            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatBody)
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

    useEffect(() => {
        const canvas = { current: null }; // stub — canvas 2D removido
        if (!canvas.current) return;
        const ctx = null;
        let t = 0;

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

    // Training helpers
    const fetchTraining = useCallback(async () => {
        try {
            const res = await fetch(`/api/agent/training?admin_user_id=${userId || studentUserId}`);
            if (res.status === 403) { setIsAdmin(false); return; }
            const data = await res.json();
            if (data.success) { setIsAdmin(true); setTrainingEntries(data.entries || []); }
        } catch (_) {}
    }, [userId, studentUserId]);

    const saveTrainingEntry = async () => {
        if (!trainingInput.trim() || trainingSaving) return;
        setTrainingSaving(true);
        try {
            const res = await fetch('/api/agent/training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_user_id: userId || studentUserId, content: trainingInput.trim(), type: trainingType })
            });
            const data = await res.json();
            if (data.success) { setTrainingEntries(prev => [data.entry, ...prev]); setTrainingInput(''); }
        } catch (_) {} finally { setTrainingSaving(false); }
    };

    const toggleTrainingEntry = async (id, active) => {
        try {
            const res = await fetch(`/api/agent/training/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_user_id: userId || studentUserId, active: !active })
            });
            const data = await res.json();
            if (data.success) setTrainingEntries(prev => prev.map(e => e.id === id ? data.entry : e));
        } catch (_) {}
    };

    const deleteTrainingEntry = async (id) => {
        try {
            await fetch(`/api/agent/training/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_user_id: userId || studentUserId })
            });
            setTrainingEntries(prev => prev.filter(e => e.id !== id));
        } catch (_) {}
    };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#020406]">
            {/* LightningField WebGL — fondo completo */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <LightningField hueRef={lightningHueRef} analyserRef={lightningAnalyserRef} />
            </div>

            {/* Flash blanco sutil sincronizado con voz */}
            <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-75"
                style={{ backgroundColor: 'white', opacity: isSpeaking ? audioLevel * 0.08 : 0 }} />

            {/* Degradado atmosférico radial */}
            <div className="absolute inset-0 z-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at center, transparent 0%, black 100%)' }} />

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
                {/* Training mode — el server decide si eres admin */}
                <button onClick={() => { if (!showTraining) fetchTraining(); setShowTraining(v => !v); }}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-sm border border-white/10"
                    title="Modo entrenamiento">
                    <BookOpen className="w-5 h-5 text-blue-300" />
                </button>
            </div>

            {/* Panel de entrenamiento */}
            {showTraining && (
                <div className="absolute inset-x-0 bottom-0 top-16 bg-[#060c1a]/97 backdrop-blur-xl z-40 flex flex-col shadow-2xl border-t border-blue-900/40">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-blue-900/30">
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-blue-400" />
                            <p className="text-blue-300 font-bold text-sm tracking-wide">Modo Entrenamiento</p>
                            {isAdmin && <span className="text-[10px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full border border-blue-700/40">ADMIN</span>}
                        </div>
                        <button onClick={() => setShowTraining(false)} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
                            <X className="w-4 h-4 text-blue-400" />
                        </button>
                    </div>

                    {!isAdmin ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-red-400/70 text-sm">No tienes permisos de administrador.</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Form agregar entrada */}
                            <div className="px-5 py-4 border-b border-blue-900/20 space-y-3">
                                <div className="flex gap-2">
                                    {['instruccion', 'conocimiento', 'qa'].map(t => (
                                        <button key={t} onClick={() => setTrainingType(t)}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${trainingType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10'}`}>
                                            {t === 'instruccion' ? 'Instrucción' : t === 'conocimiento' ? 'Conocimiento' : 'Q&A'}
                                        </button>
                                    ))}
                                </div>
                                <textarea value={trainingInput} onChange={e => setTrainingInput(e.target.value)}
                                    placeholder={trainingType === 'instruccion' ? 'Ej: Cuando alguien pregunte por notas, explica primero el porcentaje...' : trainingType === 'conocimiento' ? 'Ej: La plataforma usa Supabase como base de datos...' : 'Ej: ¿Cómo contactar soporte? → Escribe a soporte@matico.cl'}
                                    rows={3}
                                    className="w-full bg-white/5 border border-blue-800/40 rounded-xl px-4 py-3 text-blue-100 placeholder-blue-700/50 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                                <button onClick={saveTrainingEntry} disabled={!trainingInput.trim() || trainingSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-xl transition font-semibold">
                                    <Plus className="w-4 h-4" />
                                    {trainingSaving ? 'Guardando...' : 'Agregar entrada'}
                                </button>
                            </div>

                            {/* Lista de entradas */}
                            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                                {trainingEntries.length === 0 && (
                                    <p className="text-blue-600/50 text-sm text-center mt-6">Sin entradas todavía. Agrega instrucciones arriba.</p>
                                )}
                                {trainingEntries.map(entry => (
                                    <div key={entry.id} className={`rounded-xl border px-4 py-3 transition ${entry.active ? 'bg-blue-900/20 border-blue-800/40' : 'bg-white/3 border-white/8 opacity-50'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${
                                                    entry.type === 'instruccion' ? 'bg-blue-900 text-blue-300' :
                                                    entry.type === 'conocimiento' ? 'bg-purple-900 text-purple-300' :
                                                    'bg-green-900 text-green-300'}`}>
                                                    {entry.type}
                                                </span>
                                                <p className="text-blue-100 text-sm leading-relaxed">{entry.content}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 mt-1">
                                                <button onClick={() => toggleTrainingEntry(entry.id, entry.active)} title={entry.active ? 'Desactivar' : 'Activar'}>
                                                    {entry.active
                                                        ? <ToggleRight className="w-5 h-5 text-blue-400 hover:text-blue-300" />
                                                        : <ToggleLeft className="w-5 h-5 text-gray-600 hover:text-gray-400" />}
                                                </button>
                                                <button onClick={() => deleteTrainingEntry(entry.id)} title="Eliminar">
                                                    <Trash2 className="w-4 h-4 text-red-500/60 hover:text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                                    {msg.images && msg.images.length > 0 && (
                                        <div className="flex gap-1 mb-1.5 flex-wrap">
                                            {msg.images.map((src, j) => (
                                                <img key={j} src={src} alt="" className="w-10 h-10 object-cover rounded" />
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap"
                                       dangerouslySetInnerHTML={{ __html: msg.content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline text-blue-300">$1</a>') }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* === TOROID CENTRAL === */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10">
                <div className="relative flex items-center justify-center" style={{width:'min(94vw,400px)', aspectRatio:'1/1'}}>
                    {/* Glow exterior reactivo a la voz */}
                    <div className="absolute inset-0 rounded-full blur-[80px] pointer-events-none"
                        style={{
                            backgroundColor: `hsl(${lightningHueRef.current}, 100%, 50%)`,
                            opacity: 0.15 + audioLevel * 0.7,
                            transform: `scale(${1 + audioLevel * 1.2})`
                        }} />
                    {/* Toroid PNG con glow reactivo */}
                    <img
                        src="/toroid.png" alt="" draggable={false}
                        className="relative w-[80%] h-auto object-contain pointer-events-none"
                        style={{
                            filter: `drop-shadow(0 0 ${30 + audioLevel * 60}px hsl(${lightningHueRef.current}, 100%, 65%))`,
                            transform: `scale(${1 + audioLevel * 0.08})`,
                            transition: 'transform 75ms, filter 75ms'
                        }}
                    />
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

                {pendingImages.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2 items-center justify-center">
                        {pendingImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img src={img.preview} alt="" className="w-14 h-14 object-cover rounded-lg border border-blue-500/50" />
                                <button onClick={() => removePendingImage(idx)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-80 hover:opacity-100">
                                    ×
                                </button>
                            </div>
                        ))}
                        <span className="text-blue-400/70 text-xs ml-1">Habla o escribe para enviar con las fotos</span>
                    </div>
                )}

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
