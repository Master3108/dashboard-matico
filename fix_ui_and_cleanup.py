import os

file_path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# --- FIX UI PROGRESS INDICATOR (approx lines 2883) ---
start_ui = -1
end_ui = -1
for i, line in enumerate(lines):
    if '{/* QUIZ PROGRESS INDICATOR - Sistema Japon\u00e9s/Kaizen */}' in line or '{/* QUIZ PROGRESS INDICATOR' in line:
        start_ui = i
        break

if start_ui != -1:
    for i in range(start_ui, len(lines)):
        if '})()}' in lines[i]:
            end_ui = i
            break

new_ui = """                                    {/* INDICADOR DE PROGRESO KAIZEN */}
                                    {(() => {
                                        const progress = getQuizProgress();
                                        const phaseNames = { 1: "B\u00e1sico", 2: "Avanzado", 3: "Cr\u00edtico" };
                                        const phaseColors = {
                                            1: "bg-green-100 text-green-700 border-green-300",
                                            2: "bg-yellow-100 text-yellow-700 border-yellow-300",
                                            3: "bg-red-100 text-red-700 border-red-300"
                                        };

                                        if (progress.currentPhase <= 3) {
                                            const questionsCompleted = (progress.currentPhase - 1) * 15;
                                            return (
                                                <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs font-black border-2 ${phaseColors[progress.currentPhase]} animate-pulse`}>
                                                    \u26a1 Siguiente Nivel: {phaseNames[progress.currentPhase]} | {questionsCompleted}/45 preguntas completadas
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}"""

if start_ui != -1 and end_ui != -1:
    lines[start_ui:end_ui+1] = [new_ui + '\n']

# --- CLEAN UP EXTRA LINES AT END ---
while lines and lines[-1].strip() == "":
    lines.pop()

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully updated UI indicator and cleaned up the file.")
