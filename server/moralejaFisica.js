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

// =====================================================================
// CAPITULOS 2° MEDIO (Mineduc 2019)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_electricidad_cargas',
        chapterNumber: 1,
        title: 'Electricidad: cargas y corriente',
        skill: 'Explicar fenomenos electricos basicos y corriente continua',
        keywords: ['carga electrica', 'electron', 'coulomb', 'corriente', 'voltaje', 'amperio', 'conductor', 'aislante', 'electrostatica'],
        theoryFocus: [
            'distinguir carga positiva y negativa, conductor y aislante',
            'aplicar ley de Coulomb para fuerza entre cargas',
            'relacionar corriente, voltaje y resistencia en circuitos sencillos'
        ],
        quizFocus: [
            'cargas electricas y ley de Coulomb',
            'conductores y aislantes',
            'corriente, voltaje y unidades',
            'aplicaciones de la electrostatica'
        ]
    },
    {
        id: 'cap2_circuitos_ohm',
        chapterNumber: 2,
        title: 'Circuitos electricos y ley de Ohm',
        skill: 'Resolver circuitos serie y paralelo con ley de Ohm',
        keywords: ['ley de ohm', 'circuito', 'serie', 'paralelo', 'resistencia', 'potencia electrica', 'consumo', 'amperimetro', 'voltimetro'],
        theoryFocus: [
            'aplicar ley de Ohm: V = I * R',
            'resolver circuitos en serie, paralelo y mixtos',
            'calcular potencia, energia electrica y consumo domestico'
        ],
        quizFocus: [
            'ley de Ohm',
            'circuitos serie y paralelo',
            'potencia y consumo electrico',
            'analisis de circuitos mixtos'
        ]
    },
    {
        id: 'cap3_magnetismo',
        chapterNumber: 3,
        title: 'Magnetismo y campo magnetico',
        skill: 'Describir campo magnetico y fuerza sobre cargas en movimiento',
        keywords: ['magnetismo', 'iman', 'campo magnetico', 'lineas de campo', 'polo norte', 'polo sur', 'tesla', 'gauss', 'fuerza magnetica'],
        theoryFocus: [
            'describir lineas de campo magnetico de imanes y bobinas',
            'analizar fuerza magnetica sobre cargas en movimiento',
            'reconocer el magnetismo terrestre y aplicaciones cotidianas'
        ],
        quizFocus: [
            'campo magnetico y lineas de campo',
            'fuerza magnetica',
            'magnetismo terrestre',
            'aplicaciones magneticas'
        ]
    },
    {
        id: 'cap4_electromagnetismo',
        chapterNumber: 4,
        title: 'Electromagnetismo e induccion',
        skill: 'Relacionar electricidad y magnetismo mediante induccion',
        keywords: ['electromagnetismo', 'induccion', 'faraday', 'lenz', 'oersted', 'motor', 'generador', 'transformador', 'flujo magnetico'],
        theoryFocus: [
            'analizar experimentos de Oersted, Faraday y Lenz',
            'explicar funcionamiento de motores, generadores y transformadores',
            'aplicar ley de induccion electromagnetica en contextos tecnologicos'
        ],
        quizFocus: [
            'induccion electromagnetica',
            'leyes de Faraday y Lenz',
            'motores y generadores',
            'transformadores y aplicaciones'
        ]
    },
    {
        id: 'cap5_calor_termodinamica',
        chapterNumber: 5,
        title: 'Calor, temperatura y termodinamica',
        skill: 'Interpretar calor, temperatura y leyes de la termodinamica',
        keywords: ['calor', 'temperatura', 'equilibrio termico', 'calor especifico', 'dilatacion', 'cambio de estado', 'caloria', 'termodinamica', 'entropia'],
        theoryFocus: [
            'distinguir calor y temperatura, escalas termometricas y equilibrio termico',
            'aplicar formula Q = m * c * dT y calcular calor en cambios de fase',
            'introducir leyes de la termodinamica con ejemplos cotidianos'
        ],
        quizFocus: [
            'calor y temperatura',
            'calor especifico y calorimetria',
            'cambios de estado',
            'leyes termodinamicas basicas'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap2_luz_optica');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[0];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

export const resolveMoralejaFisicaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'FISICA',
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
            if (numericSession >= 1 && numericSession <= 13) {
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
