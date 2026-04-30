// =====================================================================
// MATICO - Test de conexion a Supabase
// =====================================================================
// Verifica:
//   1. Que el cliente arranca con las credenciales del .env
//   2. Que se puede leer la tabla `subjects` (debe tener 6 filas)
//   3. Que se puede leer la tabla `grades` (debe tener 4 filas)
//   4. Que se puede leer `chapters` (debe tener 51 filas)
//   5. Que se puede leer `curriculum_sessions` (debe tener 276 filas)
//
// Ejecutar:
//   cd server
//   npm run test:supabase
//
// Si todo da OK, esta lista la base para escribir el resto del DAL.
// =====================================================================

import { supabase } from './supabaseClient.js';

const banner = (msg) => console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`);
const ok = (msg) => console.log(`  [OK]    ${msg}`);
const fail = (msg) => console.log(`  [FAIL]  ${msg}`);
const info = (msg) => console.log(`  [INFO]  ${msg}`);

async function checkTable(table, expectedCount = null) {
    try {
        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: false })
            .limit(3);

        if (error) {
            fail(`Tabla ${table}: ${error.message}`);
            return false;
        }

        const total = count ?? (data ? data.length : 0);
        if (expectedCount !== null && total !== expectedCount) {
            fail(`Tabla ${table}: esperaba ${expectedCount} filas, encontre ${total}`);
            return false;
        }

        ok(`Tabla ${table}: ${total} filas`);
        if (data && data.length > 0) {
            const sample = data[0];
            const keys = Object.keys(sample).slice(0, 4).join(', ');
            info(`     muestra: { ${keys}, ... }`);
        }
        return true;
    } catch (err) {
        fail(`Tabla ${table}: ${err.message}`);
        return false;
    }
}

async function main() {
    banner('TEST DE CONEXION A SUPABASE');

    info(`URL: ${process.env.SUPABASE_URL}`);
    info(`Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)}...`);

    banner('VERIFICANDO CATALOGOS BASE');
    const checks = [
        await checkTable('grades', 4),
        await checkTable('subjects', 6),
        await checkTable('chapters', 51),
        await checkTable('curriculum_sessions', 276)
    ];

    banner('VERIFICANDO TABLAS DE DATOS (deberian estar vacias todavia)');
    await checkTable('users');
    await checkTable('question_bank');
    await checkTable('theory_ludica_bank');
    await checkTable('pedagogical_assets');
    await checkTable('progress_log');

    banner('RESULTADO');
    const passed = checks.filter(Boolean).length;
    const total = checks.length;

    if (passed === total) {
        console.log(`\n  >>> TODO OK <<<  ${passed}/${total} checks criticos pasaron`);
        console.log('  La conexion a Supabase funciona perfecto.');
        console.log('  Listo para arrancar el DAL.\n');
        process.exit(0);
    } else {
        console.log(`\n  >>> PROBLEMAS <<<  solo ${passed}/${total} checks pasaron`);
        console.log('  Revisa los mensajes [FAIL] mas arriba.\n');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('\n[ERROR FATAL]', err.message);
    if (err.cause) console.error('  causa:', err.cause);
    process.exit(1);
});
