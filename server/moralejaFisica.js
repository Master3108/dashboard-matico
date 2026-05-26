import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_FISICA_MATERIAL_ID = 'moraleja_fisica_1m_2026';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS_LEGACY_DISABLED = [
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
// CAPITULOS 1° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA CN1M 09-16)
// =====================================================================
const CHAPTERS = [
    {
        id: 'cap1_ondas',
        chapterNumber: 1,
        title: 'Ondas: modelo y transmision de energia (OA9)',
        skill: 'Demostrar mediante modelos que las ondas transmiten energia',
        keywords: ['onda', 'ondas', 'frecuencia', 'periodo', 'longitud de onda', 'amplitud', 'transversal', 'longitudinal', 'mecanica', 'electromagnetica'],
        theoryFocus: [
            'demostrar mediante modelos que las ondas transmiten energia',
            'clasificar ondas: mecanicas/electromagneticas, transversales/longitudinales',
            'relacionar amplitud, frecuencia, periodo y longitud de onda'
        ],
        quizFocus: ['caracteristicas de ondas', 'transmision de energia', 'clasificacion de ondas', 'calculo de frecuencia y periodo']
    },
    {
        id: 'cap2_fenomenos_sonoros',
        chapterNumber: 2,
        title: 'Fenomenos sonoros: eco, resonancia, Doppler (OA10)',
        skill: 'Explicar fenomenos sonoros y sus aplicaciones tecnologicas',
        keywords: ['sonido', 'eco', 'resonancia', 'doppler', 'reverberacion', 'intensidad', 'tono', 'timbre', 'velocidad del sonido'],
        theoryFocus: [
            'explicar fenomenos sonoros: eco, resonancia y efecto Doppler',
            'relacionar intensidad, tono y timbre con caracteristicas fisicas de la onda',
            'evaluar aplicaciones tecnologicas: ecografia, sonar, ultrasonido'
        ],
        quizFocus: ['eco y reverberacion', 'efecto Doppler', 'resonancia', 'aplicaciones tecnologicas del sonido']
    },
    {
        id: 'cap3_luz_optica',
        chapterNumber: 3,
        title: 'Luz: modelos ondulatorio y corpuscular (OA11)',
        skill: 'Explicar fenomenos luminosos mediante modelos fisicos',
        keywords: ['luz', 'ondulatorio', 'corpuscular', 'reflexion', 'refraccion', 'imagen', 'color', 'espectro', 'lente', 'espejo'],
        theoryFocus: [
            'explicar fenomenos luminosos mediante los modelos ondulatorio y corpuscular',
            'describir formacion de imagenes en lentes y espejos',
            'relacionar luz blanca con espectro de colores'
        ],
        quizFocus: ['reflexion y refraccion', 'formacion de imagenes', 'modelos ondulatorio vs corpuscular', 'colores y espectro']
    },
    {
        id: 'cap4_oido_ojo_humano',
        chapterNumber: 4,
        title: 'Oido y ojo humano: espectros y correcciones (OA12)',
        skill: 'Explorar funcionamiento sensorial y tecnologia correctiva',
        keywords: ['oido', 'ojo', 'espectro audible', 'espectro visible', 'miopia', 'hipermetropia', 'astigmatismo', 'lente correctiva', 'sordera'],
        theoryFocus: [
            'explorar funcionamiento del oido humano y rango audible (20-20000 Hz)',
            'explorar funcionamiento del ojo humano y espectro visible',
            'analizar defectos visuales/auditivos y tecnologia correctiva (lentes, audifonos)'
        ],
        quizFocus: ['anatomia del oido', 'anatomia del ojo', 'defectos visuales y correcciones', 'rangos audibles y visibles']
    },
    {
        id: 'cap5_sismos',
        chapterNumber: 5,
        title: 'Sismos: origen, propagacion y consecuencias (OA13)',
        skill: 'Describir energia sismica, parametros y prevencion',
        keywords: ['sismo', 'terremoto', 'onda p', 'onda s', 'hipocentro', 'epicentro', 'richter', 'mercalli', 'tectonica', 'falla'],
        theoryFocus: [
            'describir origen y propagacion de energia en sismos (ondas P, S, superficiales)',
            'comprender parametros sismicos: magnitud, intensidad, hipocentro, epicentro',
            'analizar consecuencias y prevencion ante sismos'
        ],
        quizFocus: ['tipos de ondas sismicas', 'escalas Richter y Mercalli', 'tectonica de placas', 'prevencion sismica']
    },
    {
        id: 'cap6_tierra_luna_estaciones',
        chapterNumber: 6,
        title: 'Sistema Tierra-Luna y estaciones (OA14)',
        skill: 'Modelar movimientos astronomicos del sistema solar',
        keywords: ['tierra', 'luna', 'eclipse', 'mareas', 'estaciones', 'solsticio', 'equinoccio', 'rotacion', 'traslacion', 'inclinacion del eje'],
        theoryFocus: [
            'crear modelos sobre movimientos Tierra-Luna y estaciones del ano',
            'explicar eclipses (solares, lunares) y mareas',
            'relacionar inclinacion del eje terrestre con estaciones'
        ],
        quizFocus: ['movimientos Tierra-Luna', 'eclipses', 'mareas', 'estaciones del ano']
    },
    {
        id: 'cap7_estructuras_cosmicas',
        chapterNumber: 7,
        title: 'Estructuras cosmicas: meteoros, estrellas, galaxias (OA15)',
        skill: 'Describir y comparar estructuras cosmicas',
        keywords: ['meteoro', 'asteroide', 'cometa', 'estrella', 'planeta', 'galaxia', 'via lactea', 'ano luz', 'nebulosa', 'sistema solar'],
        theoryFocus: [
            'describir estructuras cosmicas: meteoros, asteroides, cometas, estrellas',
            'comparar tamanos y propiedades en escala astronomica (ano luz)',
            'caracterizar galaxias (Via Lactea) y el sistema solar'
        ],
        quizFocus: ['clasificacion de objetos cosmicos', 'escalas astronomicas', 'sistema solar', 'galaxias']
    },
    {
        id: 'cap8_astronomia_chile',
        chapterNumber: 8,
        title: 'Astronomia en Chile (OA16)',
        skill: 'Investigar aportes astronomicos chilenos',
        keywords: ['atacama', 'cerro paranal', 'alma', 'observatorio', 'telescopio', 'cielos oscuros', 'investigacion chilena', 'astronomos chilenos'],
        theoryFocus: [
            'investigar investigacion astronomica en Chile (ALMA, VLT, observatorio Paranal)',
            'analizar ventajas climaticas del norte de Chile para astronomia',
            'evaluar tecnologia y aportes cientificos nacionales'
        ],
        quizFocus: ['observatorios en Chile', 'ALMA y VLT', 'ventajas climaticas del Atacama', 'aportes astronomicos chilenos']
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA CN2M 09-14)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_cinematica',
        chapterNumber: 1,
        title: 'Movimiento rectilineo: cinematica (OA9)',
        skill: 'Analizar movimiento rectilineo uniforme y acelerado',
        keywords: ['cinematica', 'movimiento rectilineo', 'mru', 'mua', 'velocidad', 'aceleracion', 'posicion', 'tiempo', 'grafico v-t', 'grafico x-t'],
        theoryFocus: [
            'analizar movimiento rectilineo uniforme (MRU) y uniformemente acelerado (MUA)',
            'relacionar posicion, velocidad, aceleracion y tiempo en situaciones cotidianas',
            'interpretar y construir graficos posicion-tiempo y velocidad-tiempo'
        ],
        quizFocus: [
            'ecuaciones de MRU y MUA',
            'interpretacion de graficos x-t y v-t',
            'caida libre y lanzamiento vertical',
            'problemas de cinematica en contexto'
        ]
    },
    {
        id: 'cap2_leyes_newton',
        chapterNumber: 2,
        title: 'Leyes de Newton y fuerzas (OA10)',
        skill: 'Aplicar leyes de Newton mediante diagramas de cuerpo libre',
        keywords: ['fuerza', 'newton', 'leyes de newton', 'inercia', 'diagrama de cuerpo libre', 'roce', 'tension', 'normal', 'peso', 'aceleracion'],
        theoryFocus: [
            'explicar los efectos de fuerzas netas mediante investigaciones experimentales',
            'aplicar las tres leyes de Newton (inercia, F=ma, accion-reaccion)',
            'construir diagramas de cuerpo libre para resolver problemas'
        ],
        quizFocus: [
            'aplicacion de F=ma',
            'diagramas de cuerpo libre',
            'fuerzas de roce, tension, normal, peso',
            'tercera ley de Newton (accion-reaccion)'
        ]
    },
    {
        id: 'cap3_energia_mecanica',
        chapterNumber: 3,
        title: 'Energia mecanica, trabajo y potencia (OA11)',
        skill: 'Aplicar conservacion de energia mecanica',
        keywords: ['energia cinetica', 'energia potencial', 'energia mecanica', 'trabajo', 'potencia', 'conservacion de la energia', 'joule', 'watt'],
        theoryFocus: [
            'describir el movimiento usando ley de conservacion de la energia mecanica',
            'aplicar conceptos de trabajo y potencia mecanica',
            'analizar transformaciones entre energia cinetica y potencial'
        ],
        quizFocus: [
            'energia cinetica y potencial gravitatoria',
            'conservacion de la energia mecanica',
            'calculo de trabajo y potencia',
            'eficiencia energetica en contexto'
        ]
    },
    {
        id: 'cap4_momentum_colisiones',
        chapterNumber: 4,
        title: 'Momentum y colisiones (OA12)',
        skill: 'Analizar colisiones aplicando ley de conservacion del momentum',
        keywords: ['momentum', 'cantidad de movimiento', 'impulso', 'colision', 'elastica', 'inelastica', 'choque', 'conservacion del momentum'],
        theoryFocus: [
            'analizar datos de colisiones considerando cantidad de movimiento e impulso',
            'aplicar la ley de conservacion del momentum lineal',
            'distinguir colisiones elasticas e inelasticas'
        ],
        quizFocus: [
            'calculo de momentum y impulso',
            'colisiones elasticas vs inelasticas',
            'conservacion del momentum en sistemas aislados',
            'aplicaciones a deportes y trafico'
        ]
    },
    {
        id: 'cap5_universo_big_bang',
        chapterNumber: 5,
        title: 'Modelos del Universo y Big Bang (OA13)',
        skill: 'Demostrar evolucion del conocimiento del Universo',
        keywords: ['universo', 'big bang', 'geocentrico', 'heliocentrico', 'copernico', 'galileo', 'expansion', 'galaxia', 'cosmologia'],
        theoryFocus: [
            'demostrar que el conocimiento del Universo cambia con nuevas evidencias',
            'comparar modelos geocentrico (Ptolomeo), heliocentrico (Copernico) y Big Bang',
            'analizar evidencias actuales: corrimiento al rojo, radiacion cosmica de fondo'
        ],
        quizFocus: [
            'modelo geocentrico vs heliocentrico',
            'teoria del Big Bang y evidencias',
            'evolucion del conocimiento astronomico',
            'estructura del Universo'
        ]
    },
    {
        id: 'cap6_gravitacion_kepler',
        chapterNumber: 6,
        title: 'Gravitacion universal y leyes de Kepler (OA14)',
        skill: 'Explicar fenomenos cosmicos con leyes de Kepler y gravitacion',
        keywords: ['kepler', 'gravitacion universal', 'newton', 'orbita', 'mareas', 'satelite', 'planeta', 'fuerza gravitacional', 'periodo orbital'],
        theoryFocus: [
            'explicar el origen de las mareas mediante leyes de Kepler y gravitacion universal',
            'analizar formacion de estructuras cosmicas (planetas, sistemas solares)',
            'describir movimiento de sondas espaciales y satelites artificiales'
        ],
        quizFocus: [
            'tres leyes de Kepler',
            'ley de gravitacion universal de Newton',
            'mareas y efectos gravitacionales',
            'orbitas y satelites'
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
