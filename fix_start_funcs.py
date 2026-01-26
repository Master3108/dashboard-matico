import os

file_path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# --- FIX startFullQuiz (approx lines 2095) ---
start_sfq = -1
end_sfq = -1
for i, line in enumerate(lines):
    if 'const startFullQuiz = async () =>' in line:
        start_sfq = i
        break

if start_sfq != -1:
    for i in range(start_sfq, len(lines)):
        if '};' in lines[i] and ('const handleContinueToQuiz' in lines[i+1] or i+1 == len(lines)):
            end_sfq = i
            break

new_sfq = """    // START FULL MULTI-STAGE QUIZ - SISTEMA KAIZEN (3 FASES DE 15 PREGUNTAS)
    const startFullQuiz = async () => {
        setIsCallingN8N(true);
        setAiModalOpen(false);

        // CHECK FOR SAVED PROGRESS
        const savedProgress = getQuizProgress();
        const startingPhase = savedProgress.currentPhase || 1;

        console.log(`[QUIZ] Iniciando desde Fase ${startingPhase}`);

        setCurrentQuizPhase(startingPhase);
        setBackgroundQuestionsQueue([]);
        setQuizStats({ correct: 0, incorrect: 0, total: 0 });

        try {
            const levelMap = { 1: "BASICO", 2: "AVANZADO", 3: "CRITICO" };
            const currentLevel = levelMap[startingPhase];

            // PASO 1: GENERAR TEORÍA LÚDICA (Solo la inicial)
            console.log(`[THEORY] Generando teoría inicial...`);
            const theory = await generateTheory(startingPhase, 1); 

            // PASO 2: GENERAR PREGUNTAS (15q para el primer nivel)
            console.log(`[QUIZ] Generando 15 preguntas ${currentLevel}...`);
            const firstPhaseQuestions = await generateQuizBatch(currentLevel, false);

            if (firstPhaseQuestions.length > 0 && theory) {
                setPendingQuizQuestions(firstPhaseQuestions);

                // Mostrar teoría
                setTheoryTitle(`🔥 Sistema Kaizen: ${TODAYS_SESSION.topic}`);
                setTheoryContent(theory);
                setShowTheoryModal(true);
                setIsCallingN8N(false);

                // Pre-generar siguiente fase si existe
                if (startingPhase < 3) {
                    const nextLevel = levelMap[startingPhase + 1];
                    console.log(`[BACK] Pre-generando Fase ${startingPhase + 1} (${nextLevel})...`);
                    setIsLoadingNextBatch(true);
                    
                    backgroundTaskRef.current = generateQuizBatch(nextLevel, true).then(q => {
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
                alert("Error al cargar contenido. Intenta de nuevo.");
                setIsCallingN8N(false);
            }
        } catch (e) {
            console.error("Error:", e);
            setIsCallingN8N(false);
        }
    };
"""

# --- FIX handleContinueToQuiz (approx lines 2178) ---
start_hctq = -1
end_hctq = -1
for i, line in enumerate(lines):
    if 'const handleContinueToQuiz = async () =>' in line:
        start_hctq = i
        break

if start_hctq != -1:
    for i in range(start_hctq, len(lines)):
        if '};' in lines[i] and ('const sendFinalSessionReport' in lines[i+1] or i+1 == len(lines)):
            end_hctq = i
            break

new_hctq = """    // HANDLE "INICIAR QUIZ" BUTTON - Cerrar teoría y mostrar primer nivel
    const handleContinueToQuiz = async () => {
        console.log(`[QUIZ] Iniciando primer batch de 15 preguntas...`);

        // GUARDAR PROGRESO TEORÍA
        await saveProgress('theory_completed', {
            subject: currentSubject,
            session: TODAYS_SESSION.session,
            phase: currentQuizPhase,
            xp_reward: 10
        });

        setShowTheoryModal(false);
        setQuizQuestions(pendingQuizQuestions);
        setShowInteractiveQuiz(true);
        setPendingQuizQuestions([]); 
    };
"""

# Apply changes In REVERSE order to keep indices valid if I used indices, but I'll use list slicing.
# Wait, I found start_hctq after start_sfq. So I'll do hctq first.

if start_hctq != -1 and end_hctq != -1:
    lines[start_hctq:end_hctq+1] = [new_hctq + '\n']

if start_sfq != -1 and end_sfq != -1:
    lines[start_sfq:end_sfq+1] = [new_sfq + '\n']

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully updated startFullQuiz and handleContinueToQuiz.")
