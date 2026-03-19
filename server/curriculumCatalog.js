import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'curriculum_catalog.json');

const DEFAULT_CATALOG = {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeGrade: '1medio',
    grades: {
        '1medio': {
            label: '1° medio',
            active: true,
            subjects: {
                MATEMATICA: { label: 'Matemática', active: true },
                LENGUAJE: { label: 'Lenguaje', active: true },
                FISICA: { label: 'Física', active: true },
                QUIMICA: { label: 'Química', active: true },
                BIOLOGIA: { label: 'Biología', active: true },
                HISTORIA: { label: 'Historia', active: true }
            }
        },
        '2medio': { label: '2° medio', active: false, subjects: {} },
        '3medio': { label: '3° medio', active: false, subjects: {} },
        '4medio': { label: '4° medio', active: false, subjects: {} }
    }
};

const ensureCatalog = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        const raw = await fs.readFile(CATALOG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.grades) {
            throw new Error('invalid catalog');
        }
        return parsed;
    } catch {
        await fs.writeFile(CATALOG_FILE, JSON.stringify(DEFAULT_CATALOG, null, 2), 'utf8');
        return DEFAULT_CATALOG;
    }
};

export const getCurriculumCatalog = async () => ensureCatalog();

export const getCurriculumContext = async (grade = '1medio', subject = '') => {
    const catalog = await ensureCatalog();
    const gradeKey = String(grade || catalog.activeGrade || '1medio').trim() || '1medio';
    const gradeNode = catalog.grades?.[gradeKey] || catalog.grades?.[catalog.activeGrade] || null;
    const subjectKey = String(subject || '').trim().toUpperCase();
    const subjectNode = gradeNode?.subjects?.[subjectKey] || null;

    return {
        grade: gradeKey,
        grade_label: gradeNode?.label || gradeKey,
        active: gradeNode?.active ?? false,
        subject: subjectKey,
        subject_label: subjectNode?.label || subjectKey,
        subject_active: subjectNode?.active ?? false
    };
};

