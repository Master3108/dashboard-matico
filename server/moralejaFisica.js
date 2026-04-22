import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_FISICA_MATERIAL_ID = 'moraleja_fisica_1m_2026';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_ondas_sonido',
        chapterNumber: 1,
        title: 'Ondas y sonido',
        skill: 'Describir ondas, interpretar magnitudes y analizar fenomenos ondulatorios',
        keywords: ['onda', 'ondas', 'sonido', 'frecuencia', 'periodo', 'longitud de onda', 'rapidez', 'reflexion', 'refraccion', 'difraccion', 'doppler'],
        theoryFocus: [
            'distinguir ondas mecanicas y electromagneticas, transversales y longitudinales',
            'relacionar periodo, frecuencia, longitud de onda y rapidez de propagacion',
            'explicar fenomenos de reflexion, refraccion, difraccion y efecto doppler en contexto cotidiano'
        ],
        quizFocus: [
            'clasificacion de ondas',
            'calculo de frecuencia, periodo y rapidez',
            'fenomenos ondulatorios',
            'sonido y sus propiedades'
        ]
    },
    {
        id: 'cap2_luz_optica',
        chapterNumber: 2,
        title: 'Luz y optica',
        skill: 'Aplicar reflexion y refraccion para interpretar espejos, lentes y formacion de imagenes',
        keywords: ['luz', 'optica', 'espejo', 'lente', 'snell', 'refraccion', 'reflexion total', 'prisma', 'ojo', 'miopia', 'hipermetropia'],
        theoryFocus: [
            'explicar propagacion de la luz, espectro electromagnetico y dualidad onda-particula',
            'aplicar leyes de reflexion y refraccion en espejos y lentes',
            'relacionar defectos del ojo con correcciones opticas y fenomenos de dispersion'
        ],
        quizFocus: [
            'leyes de reflexion y refraccion',
            'ley de snell y reflexion total interna',
            'espejos y lentes',
            'optica del ojo humano'
        ]
    },
    {
        id: 'cap3_sismos_dinamica_terrestre',
        chapterNumber: 3,
        title: 'Dinamica terrestre y sismos',
        skill: 'Explicar tectonica y propagacion de ondas sismicas para analizar riesgo sismico',
        keywords: ['sismo', 'tectonica', 'placa', 'hipocentro', 'epicentro', 'onda p', 'onda s', 'richter', 'mercalli', 'rayleigh', 'love'],
        theoryFocus: [
            'describir estructura interna de la tierra y tectonica de placas',
            'diferenciar ondas sismicas de cuerpo y superficiales',
            'interpretar escalas de medicion y medidas de prevencion o mitigacion'
        ],
        quizFocus: [
            'tectonica de placas',
            'hipocentro y epicentro',
            'ondas p, s y superficiales',
            'escalas richter y mercalli'
        ]
    },
    {
        id: 'cap4_universo_gravitacion',
        chapterNumber: 4,
        title: 'Universo y gravitacion',
        skill: 'Interpretar modelos astronomicos y relaciones gravitacionales en escalas cosmicas',
        keywords: ['universo', 'big bang', 'kepler', 'gravitacion', 'orbita', 'sistema solar', 'expansion', 'galaxia', 'cosmico'],
        theoryFocus: [
            'explicar estructuras cosmicas, origen y expansion del universo',
            'relacionar leyes de kepler con movimientos orbitales',
            'usar ideas de gravitacion para justificar trayectorias y periodos orbitales'
        ],
        quizFocus: [
            'big bang y expansion',
            'sistema solar y escalas cosmicas',
            'leyes de kepler',
            'gravitacion universal'
        ]
    },
    {
        id: 'cap5_fisica_moderna_aplicaciones',
        chapterNumber: 5,
        title: 'Fisica moderna y aplicaciones',
        skill: 'Conectar principios de fisica con tecnologia y pensamiento cientifico actual',
        keywords: ['fisica moderna', 'cuantica', 'tecnologia', 'aplicaciones', 'energia', 'simulacion', 'desafio final'],
        theoryFocus: [
            'introducir ideas basicas de fisica moderna de forma conceptual y escolar',
            'relacionar conceptos fisicos con tecnologias de uso cotidiano',
            'sintetizar aprendizajes para resolver situaciones integradas'
        ],
        quizFocus: [
            'conceptos introductorios de fisica moderna',
            'aplicaciones tecnologicas de la fisica',
            'integracion de contenidos',
            'preguntas tipo cierre o ensayo'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap2_luz_optica');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaFisicaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const sessionReference = resolveMoralejaSessionReference({
        subject: 'FISICA',
        session: numericSession
    });

    let bestChapter = fallbackChapter;
    let bestScore = -1;
    let resolutionMode = 'fallback';

    if (sessionReference?.chapterId && CHAPTERS_BY_ID[sessionReference.chapterId]) {
        bestChapter = CHAPTERS_BY_ID[sessionReference.chapterId];
        resolutionMode = 'session_map';
    } else {
        for (const chapter of CHAPTERS) {
            const score = scoreChapter(chapter, normalizedTopic);
            if (score > bestScore) {
                bestScore = score;
                bestChapter = chapter;
            }
        }

        if (bestScore > 0) {
            resolutionMode = 'keyword_match';
        } else if (numericSession >= 1 && numericSession <= 13) {
            bestChapter = CHAPTERS_BY_ID.cap1_ondas_sonido;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 14 && numericSession <= 25) {
            bestChapter = CHAPTERS_BY_ID.cap2_luz_optica;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 26 && numericSession <= 33) {
            bestChapter = CHAPTERS_BY_ID.cap3_sismos_dinamica_terrestre;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 34 && numericSession <= 41) {
            bestChapter = CHAPTERS_BY_ID.cap4_universo_gravitacion;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 42) {
            bestChapter = CHAPTERS_BY_ID.cap5_fisica_moderna_aplicaciones;
            resolutionMode = 'session_range_fallback';
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_FISICA_MATERIAL_ID,
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
            `Enfoca la explicacion en: ${bestChapter.theoryFocus.join(' ')}.`,
            'Cierra conectando la teoria con una situacion observable y una pregunta estilo PAES/DEMRE.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben mantener estilo escolar chileno PAES/DEMRE, con distractores plausibles y sin ambiguedades.',
            'Si hay calculos, incluye los datos necesarios y exige razonamiento fisico, no memorizacion ciega.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: MORALEJA_FISICA_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_FISICA_MATERIAL_ID };
