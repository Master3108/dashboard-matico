import json
import os

source_path = r'C:\Users\Usuario\.gemini\antigravity\brain\6a16de59-3b8e-41c3-ba38-45a32ab32cc9\.system_generated\steps\4\output.txt'
target_path = r'C:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\matico_n8n_workflow.json'

try:
    with open(source_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # The output format seems to be { success: true, data: { ...workflow... } }
    workflow = data.get('data', data)
    
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(workflow, f, indent=2)
    
    print(f"Workflow successfully extracted to {target_path}")
except Exception as e:
    print(f"Error: {e}")
