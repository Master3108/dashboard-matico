import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';
const MORALEJA_MATERIAL_ID = 'moraleja_competencia_lectora_6ed_2025';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_coherencia_cohesion',
        chapterNumber: 1,
        title: 'Introduccion a la comprension lectora',
        skill: 'Coherencia y cohesion textual',
        keywords: ['coherencia', 'cohesion', 'referente', 'referentes', 'correferencia', 'elipsis', 'mecanismos de cohesion'],
        theoryFocus: [
            'Distinguir coherencia como sentido global del texto y cohesion como enlaces linguisticos internos.',
            'Reconocer mecanismos de cohesion: sustitucion sinonimica, frase nominal, pronombres, adverbios, adjetivos y elipsis.',
            'Explicar como seguir referentes mejora la comprension y evita errores de interpretacion.'
        ],
        procedures: [
            'Primero identificar el eje tematico del texto.',
            'Luego rastrear a que palabra o idea alude cada referente.',
            'Finalmente verificar como esos enlaces sostienen la progresion del texto.'
        ],
        quizFocus: [
            'identificacion de referentes',
            'correferencia pronominal y lexical',
            'elipsis y continuidad tematica'
        ]
    },
    {
        id: 'cap2_info_explicita',
        chapterNumber: 2,
        title: 'Extraer e identificar informacion explicita',
        skill: 'Localizar informacion explicita',
        keywords: ['informacion explicita', 'literal', 'localizar', 'rastreo', 'sinonimos', 'parafrasis', 'vocabulario contextual'],
        theoryFocus: [
            'Diferenciar explicitamente entre informacion explicita e implicita.',
            'Ensenar el procedimiento de rastreo: leer texto, analizar pregunta, buscar referente y contrastar alternativas.',
            'Mostrar como una respuesta correcta puede aparecer parafraseada y no copiada literal.'
        ],
        procedures: [
            'Leer el texto completo antes de responder.',
            'Subrayar referente, verbo y condicion de la pregunta.',
            'Buscar la informacion pertinente y compararla con cada alternativa.'
        ],
        quizFocus: [
            'localizacion de datos literales',
            'sinonimos y parafrasis',
            'verificacion de alternativas'
        ]
    },
    {
        id: 'cap3_sintesis',
        chapterNumber: 3,
        title: 'Sintesis local y global',
        skill: 'Sintetizar tema e idea principal',
        keywords: ['sintesis', 'idea principal', 'tema', 'macroestructura', 'macrorreglas', 'generalizacion', 'supresion', 'seleccion'],
        theoryFocus: [
            'Diferenciar tema, idea principal y contenido fundamental.',
            'Aplicar macrorreglas de seleccion, supresion y generalizacion.',
            'Ensenar a pasar de datos especificos a una formulacion sintetica fiel al texto.'
        ],
        procedures: [
            'Preguntar de que se habla para hallar el tema.',
            'Preguntar que se dice sobre ese tema para hallar la idea principal.',
            'Suprimir detalles accidentales y generalizar ideas semejantes.'
        ],
        quizFocus: [
            'tema e idea principal',
            'titulo adecuado',
            'sintesis de parrafos y textos'
        ]
    },
    {
        id: 'cap4_propositos_relaciones',
        chapterNumber: 4,
        title: 'Propositos comunicativos y relaciones discursivas',
        skill: 'Determinar propositos y relaciones entre partes del discurso',
        keywords: ['proposito', 'proposito comunicativo', 'relaciones discursivas', 'hecho vs opinion', 'prensa', 'publicidad', 'propaganda', 'medios', 'argumentacion'],
        theoryFocus: [
            'Reconocer intenciones comunicativas como informar, explicar, persuadir, exhortar, narrar o reflexionar.',
            'Analizar relaciones entre parrafos, conectores, recursos verbales y visuales.',
            'Vincular el analisis del lenguaje verbal con imagenes, infografias y elementos multimodales.'
        ],
        procedures: [
            'Observar verbo dominante, tono y tipo de informacion entregada.',
            'Relacionar cada parrafo con el anterior: causa, consecuencia, contraste, ejemplificacion o profundizacion.',
            'Explicar la funcion de citas, comillas, imagenes y recursos graficos.'
        ],
        quizFocus: [
            'proposito comunicativo',
            'relacion entre parrafos',
            'funcion de recursos verbales y visuales'
        ]
    },
    {
        id: 'cap5_inferencia',
        chapterNumber: 5,
        title: 'Inferencia local y global',
        skill: 'Inferir informacion implicita',
        keywords: ['inferencia', 'implicit', 'implicita', 'tono', 'ambiente', 'estado de animo', 'vision de mundo', 'interpretacion'],
        theoryFocus: [
            'Explicar que inferir es construir significado a partir de pistas textuales.',
            'Distinguir inferencia local y global: desde una frase hasta la postura general del texto.',
            'Evitar respuestas inventadas: toda inferencia debe justificarse con huellas del texto.'
        ],
        procedures: [
            'Ubicar la pista textual clave.',
            'Relacionarla con conocimientos linguisticos o contextuales pertinentes.',
            'Formular una conclusion breve y verificable.'
        ],
        quizFocus: [
            'estado de animo y tono',
            'conclusiones implicitas',
            'proyeccion de sentido global'
        ]
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO (Mineduc 2019)
// Mismas 5 habilidades transversales, con contenidos 2° medio
// (narrativa romantica/realista, ensayo argumentativo, discurso publico)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_coherencia_cohesion',
        chapterNumber: 1,
        title: 'Coherencia, cohesion y referencia textual',
        skill: 'Coherencia y cohesion en textos complejos',
        keywords: ['coherencia', 'cohesion', 'referente', 'referentes', 'correferencia', 'elipsis', 'progresion tematica', 'macroestructura'],
        theoryFocus: [
            'Distinguir coherencia global y cohesion local en textos largos y complejos.',
            'Rastrear referentes lexicos, pronominales y deicticos en discursos extensos.',
            'Identificar quiebres de progresion tematica y mecanismos correctivos.'
        ],
        procedures: [
            'Identificar el eje tematico del texto completo.',
            'Rastrear cadenas correferenciales a lo largo de varios parrafos.',
            'Verificar la progresion logica desde la macroestructura.'
        ],
        quizFocus: [
            'identificacion de referentes complejos',
            'cadenas correferenciales',
            'progresion tematica',
            'cohesion en textos largos'
        ]
    },
    {
        id: 'cap2_info_explicita',
        chapterNumber: 2,
        title: 'Informacion explicita y vocabulario contextual avanzado',
        skill: 'Localizar informacion explicita y vocabulario por contexto',
        keywords: ['informacion explicita', 'literal', 'rastreo', 'parafrasis', 'vocabulario contextual', 'sinonimo', 'connotacion', 'denotacion'],
        theoryFocus: [
            'Aplicar estrategia PAES de rastreo en textos extensos y multimodales.',
            'Reconocer parafrasis sutiles que reformulan datos literales.',
            'Resolver vocabulario contextual avanzado: connotacion, denotacion y registro.'
        ],
        procedures: [
            'Subrayar referente, verbo y condicion clave de la pregunta.',
            'Rastrear la informacion en el texto y descartar alternativas parafraseadas erroneamente.',
            'Verificar el significado de la palabra en su contexto inmediato.'
        ],
        quizFocus: [
            'localizacion de datos literales en textos largos',
            'vocabulario por contexto avanzado',
            'parafrasis y reformulacion',
            'denotacion vs connotacion'
        ]
    },
    {
        id: 'cap3_sintesis',
        chapterNumber: 3,
        title: 'Sintesis local y global de textos complejos',
        skill: 'Sintetizar tema, tesis e idea principal en discursos extensos',
        keywords: ['sintesis', 'idea principal', 'tema', 'tesis', 'macroestructura', 'macrorreglas', 'generalizacion', 'condensacion'],
        theoryFocus: [
            'Distinguir tema, tesis e idea principal en ensayos, articulos y discursos.',
            'Aplicar macrorreglas de seleccion, supresion y generalizacion en textos largos.',
            'Producir sintesis fiel al texto original sin agregar ni omitir contenido esencial.'
        ],
        procedures: [
            'Identificar el tema y luego la tesis defendida por el autor.',
            'Suprimir ejemplos y detalles secundarios.',
            'Reformular las ideas centrales en una sintesis breve y precisa.'
        ],
        quizFocus: [
            'tema, tesis e idea principal',
            'titulo adecuado a textos extensos',
            'sintesis de articulos y ensayos',
            'macrorreglas aplicadas'
        ]
    },
    {
        id: 'cap4_propositos_relaciones',
        chapterNumber: 4,
        title: 'Propositos, relaciones discursivas y argumentacion',
        skill: 'Analizar propositos comunicativos y argumentacion formal',
        keywords: ['proposito', 'argumentacion', 'tesis', 'argumento', 'contraargumento', 'falacia', 'discurso publico', 'ensayo', 'debate', 'medios'],
        theoryFocus: [
            'Reconocer propositos: informar, persuadir, exhortar, argumentar.',
            'Analizar estructura argumentativa: tesis, argumentos, contraargumentos, refutacion.',
            'Detectar falacias logicas y recursos retoricos en discurso publico y prensa.'
        ],
        procedures: [
            'Identificar tesis y modo argumental (deductivo, inductivo, por analogia).',
            'Distinguir hecho y opinion, argumento solido y falacia.',
            'Relacionar partes del discurso con funcion comunicativa.'
        ],
        quizFocus: [
            'proposito en discurso publico',
            'estructura argumentativa',
            'falacias y recursos retoricos',
            'hecho vs opinion en prensa'
        ]
    },
    {
        id: 'cap5_inferencia',
        chapterNumber: 5,
        title: 'Inferencia, intertextualidad y sentido global',
        skill: 'Inferir sentidos implicitos e intertextualidad en textos complejos',
        keywords: ['inferencia', 'implicita', 'intertextualidad', 'tono', 'vision de mundo', 'simbolo', 'cosmovision', 'subtexto', 'ironia'],
        theoryFocus: [
            'Explicar inferencia local y global con pistas textuales.',
            'Reconocer intertextualidad: alusiones, citas, parodias, referencias culturales.',
            'Inferir vision de mundo, tono, ironia y subtexto en literatura y ensayo.'
        ],
        procedures: [
            'Ubicar pistas textuales clave (palabras, simbolos, marcadores).',
            'Relacionar pistas con conocimientos contextuales o intertextuales.',
            'Justificar conclusion con evidencia textual verificable.'
        ],
        quizFocus: [
            'tono, ironia y vision de mundo',
            'inferencias globales',
            'intertextualidad',
            'subtexto y simbolismo'
        ]
    }
];

const fallbackChapter = CHAPTERS[4];
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[4];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

const scoreChapter = (chapter, normalizedTopic) => {
    return chapter.keywords.reduce((score, keyword) => {
        return normalizedTopic.includes(keyword) ? score + 1 : score;
    }, 0);
};

export const resolveMoralejaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'LENGUAJE',
        session: numericSession,
        grade: gradeKey
    });

    let bestChapter = fallbackForGrade;
    let bestScore = -1;
    let resolutionMode = 'fallback';

    if (sessionReference?.chapterId && chaptersByIdForGrade[sessionReference.chapterId]) {
        bestChapter = chaptersByIdForGrade[sessionReference.chapterId];
        resolutionMode = 'session_map';
    } else {
        for (const chapter of chaptersForGrade) {
            const score = scoreChapter(chapter, normalizedTopic);
            if (score > bestScore) {
                bestScore = score;
                bestChapter = chapter;
            }
        }

        if (bestScore > 0) {
            resolutionMode = 'keyword_match';
        } else if (!is2M) {
            // fallback por rango solo en 1° medio
            if (numericSession >= 21 && numericSession <= 29) {
                bestChapter = CHAPTERS[3];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 43) {
                bestChapter = CHAPTERS[1];
                resolutionMode = 'session_range_fallback';
            } else if (
                normalizedTopic.includes('narrador') ||
                normalizedTopic.includes('narrativa') ||
                normalizedTopic.includes('terror') ||
                normalizedTopic.includes('drama') ||
                normalizedTopic.includes('tragedia') ||
                normalizedTopic.includes('literatura')
            ) {
                bestChapter = CHAPTERS[4];
                resolutionMode = 'topic_hint_fallback';
            }
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_MATERIAL_ID,
        chapterId: bestChapter.id,
        chapterNumber: bestChapter.chapterNumber,
        chapterLabel,
        skill: bestChapter.skill,
        mode,
        phase: normalizedPhase || 'sin_fase',
        topic,
        session: numericSession,
        theoryGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad prioritaria: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Referencia exacta de sesion: ${sessionReference.focus}.` : '',
            `Enfoca la explicacion en: ${bestChapter.theoryFocus.join(' ')}`,
            `Procedimiento sugerido: ${bestChapter.procedures.join(' ')}`
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben parecerse a ejercicios de competencia lectora estilo PAES/DEMRE: claras, justificables y centradas en evidencia textual.',
            'Si pides inferencia o sintesis, la explicacion debe nombrar la pista textual o el procedimiento que la sustenta.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: MORALEJA_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_MATERIAL_ID };
