import os

# Ruta del archivo principal
file_path = r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico\src\App.jsx'

# Diccionario de correcciones de codificación masivas
corrections = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
    'Ã ': 'Á', 'Ã‰': 'É', 'Ã ': 'Í', 'Ã“': 'Ó', 'Ãš': 'Ú',
    'Ã±': 'ñ', 'Ã‘': 'Ñ',
    'Â¡': '¡', 'Â¿': '¿',
    'ÃÂ½': 'ó', # Caso especial de triple encoding en SESIÓN / SESIÓ/ó
    'ï¿½': 'ó',   # Caso de HISTÓRICO / ó
    # Otros patrones detectados en App.jsx:
    'SesiÃ³n': 'Sesión',
    'sesiÃ³n': 'sesión',
    'quedÃ³': 'quedó',
    'atrÃ¡s': 'atrás',
    'DiagnÃ³stico': 'Diagnóstico',
    'ComprensiÃ³n': 'Comprensión',
    'histÃ³rico': 'histórico',
    'AnÃ¡lisis': 'Análisis',
    'histÃ³rica': 'histórica',
    'TEORÃA': 'TEORÍA',
    'LÃºDICA': 'LÚDICA',
}

def clean_file(path):
    if not os.path.exists(path):
        print(f"Error: {path} no existe")
        return
        
    try:
        # Intentamos leer como UTF-8
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        print(f"Limpiando {path}...")
        
        # Correcciones dinámicas
        for pattern, replacement in corrections.items():
            content = content.replace(pattern, replacement)
        
        # Eliminar el carácter Â huérfano antes de signos
        content = content.replace('Â¡', '¡').replace('Â¿', '¿')
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Hecho.")
    except Exception as e:
        print(f"Error procesando {path}: {str(e)}")

# Limpiar archivos clave
clean_file(file_path)
# También el componente de login que vi sucio en Downloads antes
clean_file(r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico\src\components\LoginPage.jsx')
clean_file(r'c:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico\src\components\InteractiveQuiz.jsx')
