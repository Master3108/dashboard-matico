import sys

with open(r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx', 'rb') as f:
    content = f.read()
    # Find the string "levelNameMap" which is unique
    start = content.find(b'levelNameMap')
    if start != -1:
        print(content[start:start+200])
    else:
        print("Not found")
