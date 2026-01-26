import os

path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'recommended_action_text: "INICIAR' in line:
        new_lines.append('    recommended_action_text: "INICIAR ANÁLISIS HISTÓRICO"\n')
    elif 'content = "' in line and 'MODO OFFLINE' in line:
        new_lines.append('                content = "⚠️ MODO OFFLINE";\n')
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed.")
