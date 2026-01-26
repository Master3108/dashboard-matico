import os

file_path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_on_quiz_complete = """    // HANDLE QUIZ PHASE COMPLETION - SISTEMA KAIZEN SIMPLIFICADO (3 FASES DE 15 PREGUNTAS)
    const onQuizPhaseComplete = async (phaseScore) => {
        console.log(`[QUIZ] Fase ${currentQuizPhase} completada con score:`, phaseScore);

        // ACTUALIZAR STATS TOTALES (Sumar el score de esta fase)
        setQuizStats(prev => ({
            ...prev,
            correct: prev.correct + phaseScore,
            total: prev.total + 15
        }));

        // GUARDAR PROGRESO (LocalStorage)
        saveQuizPhaseProgress(currentQuizPhase, phaseScore);

        // GUARDAR EN GOOGLE SHEETS
        const levelMap = { 1: "BASICO", 2: "AVANZADO", 3: "CRITICO" };
        const levelName = levelMap[currentQuizPhase];

        await saveProgress('phase_completed', {
            subject: currentSubject,
            session: TODAYS_SESSION.session,
            phase: currentQuizPhase,
            levelName: levelName,
            score: phaseScore,
            questionsCompleted: currentQuizPhase * 15,
            totalQuestions: 45,
            xp_reward: 50 
        });

        console.log(`[SAVE] Fase ${currentQuizPhase} guardada en Sheet`);

        // TRANSICIÓN A LA SIGUIENTE FASE O FINAL
        if (currentQuizPhase < 3) {
            const nextPhase = currentQuizPhase + 1;
            const nextLevel = levelMap[nextPhase];
            console.log(`[QUIZ] Avanzando a Fase ${nextPhase} (${nextLevel})...`);

            // Cambiar de fase
            setIsCallingN8N(true);
            setShowInteractiveQuiz(false); // Breve cierre para resetear el componente de quiz

            try {
                let nextQuestions = [];

                // 1. INTENTAR USAR QUEUE O ESPERAR PROMESA PENDIENTE
                if (backgroundQuestionsQueue.length > 0) {
                    console.log(`[QUIZ] Usando preguntas pre-generadas para Fase ${nextPhase}`);
                    nextQuestions = backgroundQuestionsQueue;
                    setBackgroundQuestionsQueue([]);
                } else if (isLoadingNextBatch && backgroundTaskRef.current) {
                    console.log(`[BACK] Esperando pre-generación de Fase ${nextPhase}...`);
                    setLoadingMessage(`Preparando Nivel ${nextLevel}...`);
                    try {
                        const result = await backgroundTaskRef.current;
                        nextQuestions = result.questions;
                        setBackgroundQuestionsQueue([]);
                    } catch (e) {
                        console.error("[BACK] Error en espera, generando manual...");
                        nextQuestions = await generateQuizBatch(nextLevel, false);
                    }
                } else {
                    console.log(`[QUIZ] Generando preguntas ${nextLevel} manualmente...`);
                    nextQuestions = await generateQuizBatch(nextLevel, false);
                }

                if (nextQuestions.length > 0) {
                    setCurrentQuizPhase(nextPhase);
                    setQuizQuestions(nextQuestions);
                    
                    // Resetear el estado de carga y mostrar el quiz de nuevo
                    setIsCallingN8N(false);
                    setLoadingMessage("");
                    setShowInteractiveQuiz(true);

                    console.log(`[QUIZ] Fase ${nextPhase} iniciada con ${nextQuestions.length} preguntas`);

                    // Disparar pre-generación para la siguiente fase si existe
                    if (nextPhase < 3) {
                        const followingLevel = levelMap[nextPhase + 1];
                        console.log(`[BACK] Pre-generando Fase ${nextPhase + 1} (${followingLevel})...`);
                        setIsLoadingNextBatch(true);
                        backgroundTaskRef.current = generateQuizBatch(followingLevel, true).then(q => {
                            setBackgroundQuestionsQueue(q);
                            setIsLoadingNextBatch(false);
                            backgroundTaskRef.current = null;
                            return { questions: q };
                        }).catch(() => {
                            setIsLoadingNextBatch(false);
                            backgroundTaskRef.current = null;
                        });
                    }
                } else {
                    alert("Error al cargar la siguiente fase. Por favor intenta de nuevo.");
                    setIsCallingN8N(false);
                }
            } catch (err) {
                console.error("[PHASE_TRANSITION] Error:", err);
                alert("Error al preparar la siguiente fase.");
                setIsCallingN8N(false);
            }
        } else {
            // TODAS LAS FASES COMPLETADAS (45 PREGUNTAS TOTALES)
            console.log("[QUIZ] ✅ TODAS LAS 3 FASES COMPLETADAS!");
            setShowInteractiveQuiz(false);

            // ENVIAR REPORTE FINAL
            const finalStats = { ...quizStats, correct: quizStats.correct + phaseScore };
            sendFinalSessionReport(finalStats);

            // LIMPIAR Y MARCAR COMPLETADO
            clearQuizProgress();
            markSessionComplete(currentSubject, TODAYS_SESSION.session);

            saveProgress('session_completed', {
                subject: currentSubject,
                session: TODAYS_SESSION.session,
                topic: TODAYS_SESSION.topic,
                total_questions: 45,
                correct_answers: finalStats.correct,
                xp_reward: 300
            });

            alert(`🎉🎉🎉 ¡SESIÓN COMPLETA!\\n\\nHaz dominado: ${TODAYS_SESSION.topic}\\n\\nPuntaje Final: ${finalStats.correct}/45\\n\\n+300 XP 🔥`);
        }
    };
"""

# Find start and end of onQuizPhaseComplete
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'const onQuizPhaseComplete = async' in line:
        # Check if it's the one we recently updated or the old one
        # Earlier I replaced the header, so it should match "SISTEMA KAIZEN SIMPLIFICADO"
        # But even if not, we find the function start.
        # We need the index of the line BEFORE the function comment if we want to replace the whole thing.
        # Let's search for the comment above it.
        if i > 0 and ('HANDLE QUIZ PHASE COMPLETION' in lines[i-1] or 'HANDLE QUIZ SUB-LEVEL COMPLETION' in lines[i-1]):
            start_idx = i - 1
            break

if start_idx != -1:
    # Find the closing brace of the function
    # It ends at "};" and the next line is "// UPDATED CALL AGENT" or blank
    for i in range(start_idx, len(lines)):
        if '};' in lines[i] and (i+1 == len(lines) or '// UPDATED CALL AGENT' in lines[i+1] or 'const callAgent' in lines[i+1] or 'const callAgent =' in lines[i+1]):
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    lines[start_idx:end_idx+1] = [new_on_quiz_complete + '\n']
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Successfully replaced lines {start_idx+1} to {end_idx+1}")
else:
    print(f"Failed to find function bounds: start={start_idx}, end={end_idx}")
