import sys

path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\src\App.jsx'

with open(path, 'rb') as f:
    content = f.read()

# Fix mangled characters
# ANÃ LISIS -> ANÁLISIS
content = content.replace(b'AN\xc3\x83 LISIS', 'ANÁLISIS'.encode('utf-8'))
# âš ï¸  -> ⚠️
content = content.replace(b'\xc3\xa2\xc5\xa1\xc2\xa0\xc3\xaf\xc2\xb8\xc2\x8f', '⚠️'.encode('utf-8'))

with open(path, 'wb') as f:
    f.write(content)

print("Encoding fixed!")
