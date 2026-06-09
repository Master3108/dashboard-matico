/**
 * populate_embeddings.mjs
 * Genera embeddings (OpenAI text-embedding-3-small, 1536 dims) para:
 *   - theory_ludica_bank (texto: topic + theory_markdown)
 *   - question_bank      (texto: topic + question + explanation)
 *   - notebook_ocr_records (texto: ocr_text)
 *   - progress_log (solo eventos con topic + improvement_plan/weakness)
 *
 * Uso:
 *   node scripts/populate_embeddings.mjs --table theory_ludica_bank
 *   node scripts/populate_embeddings.mjs --table question_bank --limit 5000
 *   node scripts/populate_embeddings.mjs --all
 *   node scripts/populate_embeddings.mjs --table theory_ludica_bank --refresh   (reembeber todo)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const BATCH = 96; // openai admite hasta ~2048 por batch, 96 es seguro y rapido

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : d; };
const has = (n) => args.includes(n);
const TABLE = flag('--table');
const RUN_ALL = has('--all');
const REFRESH = has('--refresh');
const LIMIT = Number(flag('--limit', 0)) || 0;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TARGETS = {
  theory_ludica_bank: {
    table: 'theory_ludica_bank',
    pk: 'id',
    select: 'id, topic, theory_markdown',
    buildText: (r) => [r.topic, r.theory_markdown].filter(Boolean).join('\n\n').slice(0, 8000)
  },
  question_bank: {
    table: 'question_bank',
    pk: 'question_id',
    select: 'question_id, topic, question, explanation',
    buildText: (r) => [r.topic, r.question, r.explanation].filter(Boolean).join('\n').slice(0, 4000)
  },
  notebook_ocr_records: {
    table: 'notebook_ocr_records',
    pk: 'id',
    select: 'id, topic, ocr_text',
    buildText: (r) => [r.topic, r.ocr_text].filter(Boolean).join('\n').slice(0, 8000)
  },
  progress_log: {
    table: 'progress_log',
    pk: 'id',
    select: 'id, topic, weakness, improvement_plan',
    buildText: (r) => [r.topic, r.weakness, r.improvement_plan].filter(Boolean).join('\n').slice(0, 4000),
    extraWhere: 'topic IS NOT NULL' // solo eventos con topic
  }
};

const embedBatch = async (texts) => {
  // Reemplazar vacios con espacio para no fallar
  const safe = texts.map(t => (t && t.length) ? t : ' ');
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: safe });
  return res.data.map(d => d.embedding);
};

const populate = async (key) => {
  const cfg = TARGETS[key];
  if (!cfg) { console.error('Tabla no soportada:', key); return; }
  console.log(`\n══════ ${cfg.table} ══════`);

  let processed = 0, errors = 0;
  let cursor = REFRESH ? null : 'missing';

  while (true) {
    let q = supabase.from(cfg.table).select(cfg.select).limit(BATCH);
    if (!REFRESH) q = q.is('embedding', null);
    if (cfg.extraWhere === 'topic IS NOT NULL') q = q.not('topic', 'is', null);

    const { data, error } = await q;
    if (error) { console.error(' ERR select:', error.message); break; }
    if (!data?.length) { console.log(' sin mas filas pendientes'); break; }

    const texts = data.map(cfg.buildText);
    try {
      const embeds = await embedBatch(texts);
      // Update fila por fila (Supabase no soporta UPDATE batch con WHERE distintos)
      for (let i = 0; i < data.length; i++) {
        const id = data[i][cfg.pk];
        const { error: upErr } = await supabase
          .from(cfg.table)
          .update({ embedding: embeds[i], embedding_updated_at: new Date().toISOString() })
          .eq(cfg.pk, id);
        if (upErr) { errors++; console.error('  upd err', cfg.pk + '=' + id, upErr.message); }
        else processed++;
      }
      console.log(`  ${processed} embebidos (${errors} errores)`);
    } catch (err) {
      errors++;
      console.error(' ERR embed:', err.message);
      await sleep(2000); // rate-limit cool down
    }

    if (LIMIT && processed >= LIMIT) { console.log(` limite ${LIMIT} alcanzado`); break; }
    await sleep(200); // throttle suave
  }

  console.log(` listo ${cfg.table}: ${processed} embebidos, ${errors} errores`);
  return { processed, errors };
};

const main = async () => {
  if (!process.env.OPENAI_API_KEY) { console.error('Falta OPENAI_API_KEY en .env'); process.exit(1); }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env'); process.exit(1); }

  const tables = RUN_ALL
    ? ['theory_ludica_bank', 'notebook_ocr_records', 'progress_log', 'question_bank']
    : (TABLE ? [TABLE] : null);

  if (!tables) { console.error('Usa --table <name> o --all'); process.exit(1); }

  console.log(`Modelo: ${EMBED_MODEL} | batch ${BATCH} | refresh=${REFRESH} | limit=${LIMIT || 'sin limite'}`);
  for (const t of tables) await populate(t);
  console.log('\n=== Fin ===');
};

main().catch(e => { console.error('FATAL', e); process.exit(1); });
