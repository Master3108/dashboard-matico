import re, sys

with open(r'c:\Users\Usuario\.gemini\antigravity\conversations\bba6c7a4-183b-4372-b60c-6266956029d2.pb', 'rb') as f:
    data = f.read().decode('utf-8', errors='ignore')

# Match any large block of printable text
# The books are > 100000 characters
blocks = re.findall(r'([^\\x00-\\x1F]{20000,})', data)
print("Found", len(blocks), "blocks of characters > 20,000")

for b in blocks:
    if 'CONJUNTOS NUMERICOS' in b and '===== Page 23 =====' in b:
        print("Found Math book! Length:", len(b))
        with open(r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\server\matematica_paes.txt', 'w', encoding='utf-8') as mb:
            mb.write(b)
    if '===== Page 1 =====' in b and 'PREPARACIÓN PRUEBA CIENCIAS FÍSICA' in b:
        print("Found Physics book! Length:", len(b))
        with open(r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboardMATICO\server\fisica_paes.txt', 'w', encoding='utf-8') as pb:
            pb.write(b)
