/**
 * run_batch_pregeneration.js
 * Genera el banco de preguntas completo para 2° Medio y 3° Medio (MINEDUC)
 * utilizando el modelo gratuito de Gemini (gemini-3.5-flash).
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tasks = [
    // --- 2° MEDIO ---
    { name: '2° Medio - MATEMATICA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'MATEMATICA', '--from', '16', '--to', '46', '--imageProvider', 'skip'] },
    { name: '2° Medio - FISICA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'FISICA', '--from', '1', '--to', '46', '--imageProvider', 'skip'] },
    { name: '2° Medio - QUIMICA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'QUIMICA', '--from', '1', '--to', '46', '--imageProvider', 'skip'] },
    { name: '2° Medio - BIOLOGIA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'BIOLOGIA', '--from', '1', '--to', '46', '--imageProvider', 'skip'] },
    { name: '2° Medio - COMPETENCIA_LECTORA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'COMPETENCIA_LECTORA', '--from', '1', '--to', '46', '--imageProvider', 'skip'] },
    { name: '2° Medio - HISTORIA', script: 'pregenerateWithImages.js', args: ['--grade', '2medio', '--subject', 'HISTORIA', '--from', '1', '--to', '46', '--imageProvider', 'skip'] },

    // --- 3° MEDIO ---
    { name: '3° Medio - MATEMATICA', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'MATEMATICA', '--from', '1', '--to', '46', '--skip-images'] },
    { name: '3° Medio - FISICA', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'FISICA', '--from', '1', '--to', '46', '--skip-images'] },
    { name: '3° Medio - QUIMICA', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'QUIMICA', '--from', '1', '--to', '46', '--skip-images'] },
    { name: '3° Medio - BIOLOGIA', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'BIOLOGIA', '--from', '1', '--to', '46', '--skip-images'] },
    { name: '3° Medio - LENGUAJE', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'LENGUAJE', '--from', '1', '--to', '46', '--skip-images'] },
    { name: '3° Medio - HISTORIA', script: 'pregen3m.js', args: ['--type', 'quiz', '--subject', 'HISTORIA', '--from', '1', '--to', '46', '--skip-images'] }
];

async function runTask(task) {
    return new Promise((resolve) => {
        console.log(`\n======================================================`);
        console.log(`🚀 INICIANDO: ${task.name}`);
        console.log(`======================================================`);
        const proc = spawn('node', [path.join(__dirname, task.script), ...task.args], {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, AI_PROVIDER: 'gemini' }
        });

        proc.on('close', (code) => {
            console.log(`\n✅ FINALIZADO (${task.name}) con código de salida: ${code}`);
            resolve(code);
        });

        proc.on('error', (err) => {
            console.error(`\n❌ ERROR en ${task.name}:`, err);
            resolve(1);
        });
    });
}

async function main() {
    console.log(`🌟 Arrancando Generación Masiva para 2° y 3° Medio con Gemini (Gratuito)...`);
    for (const task of tasks) {
        await runTask(task);
    }
    console.log(`\n🎉 ¡GENERACIÓN MASIVA COMPLETADA EXITOSAMENTE!`);
}

main().catch(console.error);
