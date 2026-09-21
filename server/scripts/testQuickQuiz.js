import 'dotenv/config';
import { listRuntimeQuestionBankRowsForAdmin } from '../db/runtimeWrites.js';

async function test() {
    console.log('Testing Supabase question_bank query...');
    const subjects = ['MATEMATICA', 'QUIMICA', 'BIOLOGIA', 'FISICA', 'HISTORIA', 'LENGUAJE'];
    for (const sub of subjects) {
        const rows = await listRuntimeQuestionBankRowsForAdmin({
            subject: sub,
            session: 1,
            phase: 1,
            limit: 5,
            grade: '1medio'
        });
        console.log(`[${sub}] Session 1 Phase 1 -> Found: ${rows.length} questions`);
        if (rows.length > 0) {
            console.log(`  Sample Q1: ${rows[0].question.substring(0, 60)}...`);
            console.log(`  Options: A=${rows[0].option_a}, B=${rows[0].option_b}, C=${rows[0].option_c}, D=${rows[0].option_d}`);
            console.log(`  Correct: ${rows[0].correct_answer}`);
        }
    }
}

test().catch(console.error);
