import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';
const MORALEJA_MATH_MATERIAL_ID = 'moraleja_matematica_2025';
const CURRICULUM_BRIDGE_MATERIAL_ID = 'matico_curriculum_bridge';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_enteros',
        chapterNumber: 1,
        title: 'Conjuntos numericos e enteros',
        skill: 'Numeros enteros, divisibilidad y aritmetica basica',
        keywords: ['enteros', 'valor absoluto', 'divisibilidad', 'multiplos', 'divisores', 'primos', 'mcd', 'm.c.d', 'mcm', 'm.c.m', 'paridad', 'papomudas'],
        theoryFocus: [
            'explicar conjuntos numericos, valor absoluto y orden en enteros',
            'resolver operatoria con signos y prioridad de operaciones',
            'usar criterios de divisibilidad, numeros primos, m.c.m y M.C.D en problemas'
        ],
        quizFocus: [
            'operatoria de enteros',
            'divisibilidad y numeros primos',
            'mcm y mcd',
            'planteamiento de problemas aritmeticos'
        ]
    },
    {
        id: 'cap2_racionales',
        chapterNumber: 2,
        title: 'Numeros racionales y decimales',
        skill: 'Fracciones, decimales y aproximaciones',
        keywords: ['racionales', 'fracciones', 'decimal', 'decimales', 'periodico', 'semiperiodico', 'fraccion', 'aproximacion', 'redondeo', 'truncamiento'],
        theoryFocus: [
            'distinguir tipos de fracciones y decimales',
            'operar sumas, restas, productos y cocientes de racionales',
            'comparar, aproximar, truncar y redondear correctamente'
        ],
        quizFocus: [
            'operatoria con fracciones',
            'conversion fraccion-decimal',
            'orden de racionales',
            'aproximaciones'
        ]
    },
    {
        id: 'cap3_porcentaje_finanzas',
        chapterNumber: 3,
        title: 'Porcentaje y matematica financiera',
        skill: 'Porcentajes, variaciones y contexto financiero',
        keywords: ['porcentaje', 'porcentual', 'descuento', 'aumento', 'interes', 'interes simple', 'interes compuesto', 'boleta', 'liquidacion', 'afp', 'isapre', 'credito', 'cae', 'ipc'],
        theoryFocus: [
            'calcular porcentajes directos, inversos y encadenados',
            'interpretar cambios absolutos y relativos',
            'aplicar porcentajes a sueldos, descuentos, intereses y creditos'
        ],
        quizFocus: [
            'porcentajes y descuentos',
            'variacion porcentual',
            'interes simple y compuesto',
            'matematica financiera cotidiana'
        ]
    },
    {
        id: 'cap4_reales',
        chapterNumber: 4,
        title: 'Numeros reales, potencias y raices',
        skill: 'Potencias, radicales y notacion cientifica',
        keywords: ['reales', 'irracionales', 'potencias', 'raices', 'radicales', 'notacion cientifica', 'racionalizacion'],
        theoryFocus: [
            'distinguir racionales e irracionales dentro de los reales',
            'aplicar propiedades de potencias y raices',
            'trabajar orden, simplificacion y notacion cientifica'
        ],
        quizFocus: [
            'propiedades de potencias',
            'operatoria con raices',
            'notacion cientifica',
            'comparacion de numeros reales'
        ]
    },
    {
        id: 'cap5_algebra',
        chapterNumber: 5,
        title: 'Algebra',
        skill: 'Expresiones algebraicas, factorizacion y fracciones algebraicas',
        keywords: ['algebra', 'polinomios', 'productos notables', 'factorizacion', 'fracciones algebraicas', 'terminos semejantes', 'mcd algebraico', 'mcm algebraico'],
        theoryFocus: [
            'traducir lenguaje verbal a lenguaje algebraico',
            'reducir, multiplicar y factorizar expresiones',
            'simplificar y operar fracciones algebraicas'
        ],
        quizFocus: [
            'productos notables',
            'factorizacion',
            'operaciones algebraicas',
            'modelacion algebraica'
        ]
    },
    {
        id: 'cap6_proporcionalidad',
        chapterNumber: 6,
        title: 'Proporcionalidad',
        skill: 'Proporcionalidad directa, inversa y compuesta',
        keywords: ['proporcionalidad', 'directamente proporcional', 'inversamente proporcional', 'razon', 'regla de tres', 'constante de proporcionalidad'],
        theoryFocus: [
            'identificar cuando dos variables son directamente o inversamente proporcionales',
            'usar tablas, graficos y razones para justificar la relacion',
            'resolver problemas de proporcionalidad compuesta'
        ],
        quizFocus: [
            'razones y proporciones',
            'proporcionalidad directa e inversa',
            'proporcionalidad compuesta',
            'interpretacion de tablas y graficos'
        ]
    },
    {
        id: 'cap7_ecuaciones',
        chapterNumber: 7,
        title: 'Ecuaciones y sistemas',
        skill: 'Ecuaciones lineales, sistemas y planteamiento',
        keywords: ['ecuaciones', 'sistemas', 'sustitucion', 'igualacion', 'reduccion', 'valor absoluto', 'planteamiento', 'edades'],
        theoryFocus: [
            'resolver ecuaciones de primer grado y fraccionarias',
            'resolver sistemas 2x2 por distintos metodos',
            'plantear ecuaciones desde problemas de contexto'
        ],
        quizFocus: [
            'ecuaciones lineales',
            'sistemas de ecuaciones',
            'problemas de planteamiento',
            'analisis de soluciones'
        ]
    },
    {
        id: 'cap8_potencias_raices',
        chapterNumber: 8,
        title: 'Potencias y raices',
        skill: 'Potencias, radicales y ecuaciones irracionales',
        keywords: ['ecuacion irracional', 'potencias y raices', 'ecuacion exponencial', 'radical', 'racionalizar'],
        theoryFocus: [
            'usar propiedades de potencias y radicales con fluidez',
            'racionalizar denominadores',
            'resolver ecuaciones irracionales y exponenciales simples'
        ],
        quizFocus: [
            'potencias',
            'raices',
            'racionalizacion',
            'ecuaciones irracionales'
        ]
    },
    {
        id: 'cap9_inecuaciones',
        chapterNumber: 9,
        title: 'Desigualdades e inecuaciones',
        skill: 'Intervalos e inecuaciones',
        keywords: ['inecuacion', 'inecuaciones', 'intervalos', 'desigualdades', 'valor absoluto'],
        theoryFocus: [
            'interpretar desigualdades e intervalos',
            'resolver inecuaciones lineales, cuadraticas y fraccionarias',
            'representar soluciones en notacion de intervalos'
        ],
        quizFocus: [
            'desigualdades',
            'intervalos',
            'inecuaciones lineales',
            'inecuaciones cuadraticas y fraccionarias'
        ]
    },
    {
        id: 'cap10_logaritmos',
        chapterNumber: 10,
        title: 'Logaritmos',
        skill: 'Definicion, propiedades y ecuaciones logaritmicas',
        keywords: ['logaritmos', 'logaritmo', 'ln', 'cambio de base', 'ecuacion logaritmica'],
        theoryFocus: [
            'interpretar logaritmos como exponentes',
            'aplicar propiedades de producto, cociente y potencia',
            'resolver ecuaciones logaritmicas y comparar logaritmos'
        ],
        quizFocus: [
            'definicion de logaritmo',
            'propiedades logaritmicas',
            'cambio de base',
            'ecuaciones logaritmicas'
        ]
    },
    {
        id: 'cap11_funcion_lineal',
        chapterNumber: 11,
        title: 'Funcion lineal y afin',
        skill: 'Rectas, pendiente y evaluacion funcional',
        keywords: ['funcion lineal', 'funcion afin', 'pendiente', 'recta', 'dominio', 'recorrido', 'funciones por tramos'],
        theoryFocus: [
            'evaluar funciones y leer puntos en el plano cartesiano',
            'distinguir funcion constante, lineal y afin',
            'calcular pendiente, intersecciones y ecuacion de la recta'
        ],
        quizFocus: [
            'evaluacion de funciones',
            'pendiente',
            'ecuacion de la recta',
            'funcion afin'
        ]
    },
    {
        id: 'cap12_funcion_cuadratica',
        chapterNumber: 12,
        title: 'Funcion cuadratica y potencia',
        skill: 'Parabolas y funciones potencia',
        keywords: ['funcion cuadratica', 'parabola', 'vertice', 'discriminante', 'funcion potencia', 'concavidad'],
        theoryFocus: [
            'analizar concavidad, vertice e intersecciones de funciones cuadraticas',
            'usar forma canonica y discriminante',
            'describir funciones potencia segun exponente y transformaciones'
        ],
        quizFocus: [
            'vertice y eje de simetria',
            'intersecciones',
            'discriminante',
            'funcion potencia'
        ]
    },
    {
        id: 'cap13_geometria',
        chapterNumber: 13,
        title: 'Geometria y transformaciones',
        skill: 'Vectores, transformaciones y geometria en el plano',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['vectores', 'transformaciones', 'isometricas', 'homotecia', 'congruencia', 'semejanza', 'thales', 'recta', 'plano cartesiano'],
        theoryFocus: [
            'reconocer relaciones geometricas, transformaciones y razonamiento espacial',
            'justificar propiedades de semejanza, congruencia y teorema de thales',
            'interpretar representaciones en el plano y ecuaciones de la recta cuando corresponda'
        ],
        quizFocus: [
            'vectores y desplazamientos',
            'transformaciones geometricas',
            'congruencia y semejanza',
            'recta en el plano'
        ]
    },
    {
        id: 'cap14_datos_probabilidad',
        chapterNumber: 14,
        title: 'Datos y probabilidad',
        skill: 'Estadistica descriptiva, conteo y probabilidad',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['frecuencia', 'medidas', 'dispersion', 'cajon', 'estadistica', 'probabilidad', 'conteo', 'laplace', 'condicional'],
        theoryFocus: [
            'leer tablas y graficos con foco en interpretacion y modelacion',
            'calcular medidas descriptivas y justificar su uso',
            'resolver problemas de conteo y probabilidad con estrategia explicita'
        ],
        quizFocus: [
            'tablas y graficos',
            'medidas de tendencia central y dispersion',
            'tecnicas de conteo',
            'probabilidad'
        ]
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO (Mineduc 2019)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_reales_irracionales',
        chapterNumber: 1,
        title: 'Numeros reales e irracionales',
        skill: 'Distinguir y operar con numeros reales, racionales e irracionales',
        keywords: ['reales', 'irracionales', 'racionales', 'recta real', 'pi', 'raiz dos', 'numeros reales', 'densidad', 'aproximacion'],
        theoryFocus: [
            'distinguir numeros racionales e irracionales y ubicarlos en la recta real',
            'operar con numeros reales y comparar magnitudes irracionales',
            'analizar densidad de los reales y aproximaciones decimales'
        ],
        quizFocus: [
            'clasificacion de numeros reales',
            'comparacion y orden en la recta',
            'operatoria con irracionales',
            'aproximaciones racionales de irracionales'
        ]
    },
    {
        id: 'cap2_raices_racionalizacion',
        chapterNumber: 2,
        title: 'Raices, radicacion y racionalizacion',
        skill: 'Aplicar propiedades de radicacion y racionalizar denominadores',
        keywords: ['raices', 'radicales', 'racionalizar', 'raiz enesima', 'radicando', 'indice', 'simplificar raices'],
        theoryFocus: [
            'aplicar propiedades de raices enesimas: producto, cociente y potencia',
            'simplificar, sumar y restar expresiones con radicales semejantes',
            'racionalizar denominadores monomios y binomios'
        ],
        quizFocus: [
            'propiedades de radicacion',
            'simplificacion de radicales',
            'racionalizacion de denominadores',
            'ecuaciones con radicales'
        ]
    },
    {
        id: 'cap3_notacion_cientifica',
        chapterNumber: 3,
        title: 'Notacion cientifica y orden de magnitud',
        skill: 'Expresar y comparar magnitudes en notacion cientifica',
        keywords: ['notacion cientifica', 'orden de magnitud', 'mantisa', 'exponente', 'potencias de diez', 'micro', 'nano', 'tera', 'mega'],
        theoryFocus: [
            'expresar numeros muy grandes y muy pequenos en notacion cientifica',
            'operar productos y cocientes en notacion cientifica',
            'comparar ordenes de magnitud en contextos cientificos'
        ],
        quizFocus: [
            'conversion entre forma decimal y cientifica',
            'operaciones en notacion cientifica',
            'comparacion de ordenes de magnitud',
            'aplicaciones en fisica y biologia'
        ]
    },
    {
        id: 'cap4_productos_factorizacion',
        chapterNumber: 4,
        title: 'Productos notables y factorizacion',
        skill: 'Desarrollar productos notables y factorizar expresiones algebraicas',
        keywords: ['productos notables', 'factorizacion', 'cuadrado de binomio', 'suma por diferencia', 'factor comun', 'trinomio', 'agrupacion'],
        theoryFocus: [
            'desarrollar cuadrado de binomio, suma por diferencia y cubo de binomio',
            'factorizar por factor comun, agrupacion, trinomio y suma o diferencia de cubos',
            'simplificar fracciones algebraicas con factorizaciones'
        ],
        quizFocus: [
            'productos notables',
            'factorizacion estrategica',
            'simplificacion de fracciones algebraicas',
            'modelacion algebraica'
        ]
    },
    {
        id: 'cap5_sistemas_2x2',
        chapterNumber: 5,
        title: 'Sistemas de ecuaciones lineales 2x2',
        skill: 'Resolver sistemas 2x2 por sustitucion, igualacion y reduccion',
        keywords: ['sistemas', 'ecuaciones', 'sustitucion', 'igualacion', 'reduccion', 'sistemas lineales', '2x2', 'compatible', 'incompatible'],
        theoryFocus: [
            'resolver sistemas 2x2 por sustitucion, igualacion y reduccion',
            'interpretar graficamente sistemas compatibles, incompatibles e indeterminados',
            'plantear sistemas a partir de problemas de contexto'
        ],
        quizFocus: [
            'metodos de resolucion 2x2',
            'interpretacion grafica',
            'modelacion con sistemas',
            'analisis de soluciones'
        ]
    },
    {
        id: 'cap6_funcion_cuadratica',
        chapterNumber: 6,
        title: 'Funcion cuadratica y parabola',
        skill: 'Modelar y analizar funciones cuadraticas',
        keywords: ['funcion cuadratica', 'parabola', 'vertice', 'eje de simetria', 'concavidad', 'discriminante', 'ceros', 'raices reales'],
        theoryFocus: [
            'analizar vertice, eje de simetria, concavidad e intersecciones de la parabola',
            'resolver ecuaciones cuadraticas con formula general y discriminante',
            'modelar fenomenos cuadraticos en fisica y economia'
        ],
        quizFocus: [
            'vertice y eje',
            'ceros y discriminante',
            'analisis de graficos',
            'modelacion con cuadraticas'
        ]
    },
    {
        id: 'cap7_funcion_inversa_raiz',
        chapterNumber: 7,
        title: 'Funcion inversa y raiz cuadrada',
        skill: 'Reconocer funcion inversa y propiedades de la funcion raiz cuadrada',
        keywords: ['funcion inversa', 'funcion raiz', 'dominio', 'recorrido', 'biyectiva', 'composicion', 'raiz cuadrada'],
        theoryFocus: [
            'identificar funciones invertibles, calcular y graficar inversas',
            'analizar dominio, recorrido y simetria de funciones raiz cuadrada',
            'relacionar funcion cuadratica y su inversa en el dominio adecuado'
        ],
        quizFocus: [
            'calculo de funcion inversa',
            'dominio y recorrido de la funcion raiz',
            'graficos asociados',
            'composicion de funciones'
        ]
    },
    {
        id: 'cap8_semejanza_tales',
        chapterNumber: 8,
        title: 'Semejanza, homotecia y teorema de Tales',
        skill: 'Aplicar semejanza y teorema de Tales en problemas geometricos',
        keywords: ['semejanza', 'homotecia', 'tales', 'thales', 'razon de semejanza', 'figuras semejantes', 'criterios', 'proporcionalidad de segmentos'],
        theoryFocus: [
            'aplicar criterios de semejanza de triangulos (AA, LAL, LLL)',
            'usar homotecia como transformacion que produce figuras semejantes',
            'aplicar teorema de Tales en haces de paralelas y problemas de altura'
        ],
        quizFocus: [
            'criterios de semejanza',
            'teorema de Tales',
            'homotecia',
            'modelacion con figuras semejantes'
        ]
    },
    {
        id: 'cap9_cuerpos_geometricos',
        chapterNumber: 9,
        title: 'Cuerpos geometricos: area y volumen',
        skill: 'Calcular area y volumen de prismas, piramides, cilindros, conos y esferas',
        keywords: ['prisma', 'piramide', 'cilindro', 'cono', 'esfera', 'area total', 'volumen', 'apotema', 'generatriz'],
        theoryFocus: [
            'calcular area lateral y total de prismas, piramides, cilindros y conos',
            'calcular volumen de cuerpos geometricos y aplicar en situaciones reales',
            'relacionar formulas de area y volumen con secciones planas'
        ],
        quizFocus: [
            'area de cuerpos geometricos',
            'volumen de cuerpos geometricos',
            'modelacion con solidos',
            'comparacion volumen-area'
        ]
    },
    {
        id: 'cap10_probabilidad_estadistica',
        chapterNumber: 10,
        title: 'Probabilidad, variable aleatoria y estadistica',
        skill: 'Analizar variable aleatoria, distribucion y medidas de dispersion',
        keywords: ['variable aleatoria', 'distribucion', 'laplace', 'binomial', 'media', 'mediana', 'varianza', 'desviacion estandar', 'probabilidad'],
        theoryFocus: [
            'definir variable aleatoria discreta y construir distribuciones de probabilidad',
            'aplicar regla de Laplace y calcular probabilidades en experimentos compuestos',
            'calcular e interpretar media, varianza y desviacion estandar como medidas de dispersion'
        ],
        quizFocus: [
            'variable aleatoria y distribucion',
            'probabilidad con regla de Laplace',
            'medidas de dispersion',
            'interpretacion de datos estadisticos'
        ]
    }
];

const fallbackChapter = CHAPTERS[0];
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

export const resolveMoralejaMatematicaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'MATEMATICA',
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
            // fallback por rango solo en 1° medio (preserva comportamiento previo)
            if (numericSession >= 1 && numericSession <= 7) {
                bestChapter = CHAPTERS[0];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 8 && numericSession <= 12) {
                bestChapter = CHAPTERS[1];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 13 && numericSession <= 18) {
                bestChapter = CHAPTERS[2];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 19 && numericSession <= 24) {
                bestChapter = CHAPTERS[3];
                resolutionMode = 'session_range_fallback';
            }
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_MATH_MATERIAL_ID,
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
            `Enfoca la explicacion en ${bestChapter.theoryFocus.join(', ')}.`,
            'Incluye procedimiento paso a paso, errores frecuentes y una mini aplicacion tipo DEMRE/PAES.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben evaluar procedimiento, modelacion, argumentacion o representacion cuando corresponda.',
            'La explicacion debe justificar claramente el resultado y mencionar la propiedad o estrategia usada.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: bestChapter.materialId || MORALEJA_MATH_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_MATH_MATERIAL_ID, CURRICULUM_BRIDGE_MATERIAL_ID };
