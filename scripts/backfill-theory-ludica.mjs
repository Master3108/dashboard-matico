#!/usr/bin/env node

const DEFAULT_SUBJECTS = ['MATEMATICA', 'LENGUAJE', 'BIOLOGIA', 'QUIMICA', 'FISICA', 'HISTORIA'];
const DEFAULT_SESSIONS = 46;
const DEFAULT_PHASE = '1';
const DEFAULT_DELAY_MS = 900;
const DEFAULT_BASE_URL = 'http://localhost:3001';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
    const args = process.argv.slice(2);
    const result = {
        baseUrl: DEFAULT_BASE_URL,
        subjects: [...DEFAULT_SUBJECTS],
        sessions: DEFAULT_SESSIONS,
        phase: DEFAULT_PHASE,
        delayMs: DEFAULT_DELAY_MS
    };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--base-url') result.baseUrl = String(args[i + 1] || '').trim() || DEFAULT_BASE_URL;
        if (arg === '--subjects') {
            const raw = String(args[i + 1] || '').trim();
            result.subjects = raw
                .split(',')
                .map((item) => item.trim().toUpperCase())
                .filter(Boolean);
        }
        if (arg === '--sessions') {
            const parsed = Number(args[i + 1] || DEFAULT_SESSIONS);
            result.sessions = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_SESSIONS;
        }
        if (arg === '--phase') result.phase = String(args[i + 1] || DEFAULT_PHASE).trim() || DEFAULT_PHASE;
        if (arg === '--delay-ms') {
            const parsed = Number(args[i + 1] || DEFAULT_DELAY_MS);
            result.delayMs = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_DELAY_MS;
        }
    }

    if (!result.subjects.length) result.subjects = [...DEFAULT_SUBJECTS];
    return result;
};

const main = async () => {
    const { baseUrl, subjects, sessions, phase, delayMs } = parseArgs();
    const webhook = `${baseUrl.replace(/\/$/, '')}/webhook/MATICO`;
    const total = subjects.length * sessions;
    let done = 0;
    let fromSheet = 0;
    let generated = 0;
    let failed = 0;

    console.log(`[THEORY_BACKFILL] Start -> ${total} requests | phase=${phase} | base=${webhook}`);

    for (const subject of subjects) {
        for (let session = 1; session <= sessions; session += 1) {
            const topic = `Sesion ${session} - teoria ludica base`;
            done += 1;

            try {
                const response = await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accion: 'start_route',
                        subject,
                        materia: subject,
                        session,
                        phase,
                        tema: topic,
                        topic
                    })
                });

                if (!response.ok) {
                    failed += 1;
                    const text = await response.text().catch(() => '');
                    console.error(`[${done}/${total}] ERROR ${subject} S${session} -> HTTP ${response.status} ${text.slice(0, 140)}`);
                } else {
                    const json = await response.json().catch(() => ({}));
                    const source = String(json?.theory_source || '').toLowerCase();
                    if (source === 'sheet') fromSheet += 1;
                    else generated += 1;
                    console.log(`[${done}/${total}] OK ${subject} S${session} phase=${phase} source=${source || 'unknown'}`);
                }
            } catch (error) {
                failed += 1;
                console.error(`[${done}/${total}] FAIL ${subject} S${session} -> ${error.message}`);
            }

            if (delayMs > 0) await sleep(delayMs);
        }
    }

    console.log('[THEORY_BACKFILL] Finished');
    console.log(`[THEORY_BACKFILL] Reused from sheet: ${fromSheet}`);
    console.log(`[THEORY_BACKFILL] AI generated: ${generated}`);
    console.log(`[THEORY_BACKFILL] Failed: ${failed}`);

    if (failed > 0) process.exitCode = 1;
};

main().catch((error) => {
    console.error('[THEORY_BACKFILL] Fatal:', error);
    process.exit(1);
});
