/**
 * activate_quiz_bank.mjs
 * Activa (active=true) las preguntas del question_bank que estan inactivas.
 * Uso:
 *   node scripts/activate_quiz_bank.mjs --grade 1medio            (dry-run por defecto)
 *   node scripts/activate_quiz_bank.mjs --grade 1medio --commit   (aplica el cambio)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || def) : def; };
const grade = String(getArg('--grade', '1medio')).toLowerCase();
const commit = args.includes('--commit');

const SUBJECTS = ['MATEMATICA', 'COMPETENCIA_LECTORA', 'FISICA', 'QUIMICA', 'BIOLOGIA', 'HISTORIA'];

const count = async (subject, active) => {
  let q = supabase.from('question_bank').select('*', { count: 'exact', head: true }).eq('grade', grade);
  if (subject) q = q.eq('subject', subject);
  if (active !== undefined) q = q.eq('active', active);
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n || 0;
};

const main = async () => {
  console.log(`=== ACTIVAR question_bank | grade=${grade} | modo=${commit ? 'COMMIT' : 'DRY-RUN'} ===\n`);

  console.log('ANTES:');
  let totalInactive = 0;
  for (const s of SUBJECTS) {
    const inactive = await count(s, false);
    totalInactive += inactive;
    console.log(`  ${s.padEnd(22)} inactivas=${inactive} activas=${await count(s, true)}`);
  }
  console.log(`  TOTAL inactivas a activar: ${totalInactive}\n`);

  if (!commit) {
    console.log('DRY-RUN: no se aplicó nada. Re-ejecuta con --commit para activar.');
    return;
  }

  console.log('Aplicando UPDATE active=true por materia...');
  for (const s of SUBJECTS) {
    const { error } = await supabase
      .from('question_bank')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('grade', grade)
      .eq('subject', s)
      .eq('active', false);
    if (error) { console.error(`  ✗ ${s}: ${error.message}`); continue; }
    console.log(`  ✓ ${s} activadas`);
  }

  console.log('\nDESPUÉS:');
  let totalActive = 0;
  for (const s of SUBJECTS) {
    const active = await count(s, true);
    totalActive += active;
    console.log(`  ${s.padEnd(22)} activas=${active} inactivas=${await count(s, false)}`);
  }
  console.log(`  TOTAL activas ahora: ${totalActive}`);
};

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
