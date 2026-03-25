import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_BIOLOGIA_MATERIAL_ID = 'moraleja_biologia_5ed_2024';
const CURRICULUM_BRIDGE_MATERIAL_ID = 'matico_curriculum_bridge';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_metodo_cientifico',
        chapterNumber: 1,
        title: 'Metodo cientifico',
        skill: 'Problemas cientificos, hipotesis, variables y analisis de resultados',
        keywords: ['metodo cientifico', 'hipotesis', 'prediccion', 'inferencia', 'variable', 'grupo control', 'grupo experimental', 'ley', 'teoria', 'modelo'],
        theoryFocus: [
            'distinguir observacion, problema, hipotesis, experimentacion, resultados y conclusion',
            'diferenciar prediccion e inferencia con base en evidencia',
            'reconocer variables independiente, dependiente y controlada junto con grupo control y experimental'
        ],
        quizFocus: [
            'componentes de la investigacion cientifica',
            'variables experimentales',
            'interpretacion de tablas y graficos',
            'diferencia entre hipotesis, inferencia, teoria y ley'
        ]
    },
    {
        id: 'cap2_niveles_teoria_celular',
        chapterNumber: 2,
        title: 'Niveles de organizacion y teoria celular',
        skill: 'Jerarquia biologica, propiedades emergentes y teoria celular',
        keywords: ['teoria celular', 'niveles de organizacion', 'propiedades emergentes', 'celula', 'tejido', 'organo', 'sistema', 'poblacion', 'ecosistema', 'bioma', 'biosfera'],
        theoryFocus: [
            'ordenar niveles de organizacion desde atomos hasta biosfera',
            'explicar por que la vida emerge a nivel celular',
            'aplicar postulados de la teoria celular y relacionarlos con diversidad celular y metabolismo'
        ],
        quizFocus: [
            'niveles de organizacion',
            'propiedades emergentes',
            'postulados de la teoria celular',
            'diferenciacion entre organelo, celula, tejido y organo'
        ]
    },
    {
        id: 'cap3_quimica_vida',
        chapterNumber: 3,
        title: 'La quimica de la vida',
        skill: 'Biomoleculas, agua, metabolismo y energia celular',
        keywords: ['biomoleculas', 'carbohidratos', 'lipidos', 'proteinas', 'agua', 'sales minerales', 'metabolismo', 'atp', 'anabolismo', 'catabolismo'],
        theoryFocus: [
            'comparar biomoleculas organicas e inorganicas segun estructura y funcion',
            'relacionar agua y sales minerales con procesos biologicos',
            'distinguir anabolismo y catabolismo, incluyendo ATP como moneda energetica'
        ],
        quizFocus: [
            'funcion de biomoleculas',
            'propiedades del agua',
            'reacciones anabolicas y catabolicas',
            'lectura de relaciones estructura-funcion'
        ]
    },
    {
        id: 'cap4_celula_procariota_eucariota',
        chapterNumber: 4,
        title: 'Celula procariota, eucariota y transporte celular',
        skill: 'Estructura celular, organelos, membrana plasmática y transporte de sustancias',
        keywords: [
            'celula procariota',
            'celula eucariota',
            'procariota',
            'eucariota',
            'organelo',
            'ribosoma',
            'mitocondria',
            'cloroplasto',
            'reticulo endoplasmatico',
            'golgi',
            'lisosoma',
            'peroxisoma',
            'citoesqueleto',
            'membrana plasmatica',
            'mosaico fluido',
            'transporte celular',
            'transporte pasivo',
            'transporte activo',
            'osmosis',
            'difusion',
            'difusion facilitada',
            'endocitosis',
            'exocitosis'
        ],
        theoryFocus: [
            'comparar celulas procariotas y eucariotas, incluyendo organelos y compartimentalizacion',
            'explicar estructura y funcion de membrana plasmatica segun modelo de mosaico fluido',
            'distinguir transporte pasivo y activo, incluyendo difusion, osmosis, endocitosis y exocitosis'
        ],
        quizFocus: [
            'comparacion procariota versus eucariota',
            'funcion de organelos',
            'membrana plasmatica y mosaico fluido',
            'transporte de sustancias a traves de membrana'
        ]
    },
    {
        id: 'cap5_reproduccion_hormonas',
        chapterNumber: 5,
        title: 'Sistema endocrino y reproduccion',
        skill: 'Regulacion hormonal, gametogenesis y reproduccion humana',
        keywords: ['endocrino', 'hipofisis', 'hormona', 'feedback', 'reproduccion', 'gametogenesis', 'espermatogenesis', 'ovogenesis', 'fecundacion', 'ciclo menstrual', 'testosterona', 'progesterona', 'estrogeno'],
        theoryFocus: [
            'explicar regulacion hormonal por retroalimentacion en ejes endocrinos y reproductivos',
            'describir espermatogenesis, ovogenesis y fecundacion',
            'relacionar fases del ciclo menstrual con FSH, LH, estrogenos y progesterona'
        ],
        quizFocus: [
            'interpretacion de graficos hormonales',
            'gametogenesis y fecundacion',
            'retroalimentacion endocrina',
            'sistema reproductor humano'
        ]
    },
    {
        id: 'cap6_adn_reproduccion_celular',
        chapterNumber: 6,
        title: 'ADN y reproduccion celular',
        skill: 'Ciclo celular, mitosis, meiosis y gametogenesis',
        keywords: ['adn', 'replicacion', 'ciclo celular', 'mitosis', 'meiosis', 'crossing over', 'anafase', 'metafase', 'cromosoma', 'cromatida', 'cancer', 'p53'],
        theoryFocus: [
            'describir interfase, puntos de control y mitosis',
            'comparar meiosis y mitosis con foco en reduccion cromosomica y variabilidad genetica',
            'relacionar meiosis con espermatogenesis y ovogenesis'
        ],
        quizFocus: [
            'fases de mitosis y meiosis',
            'numero cromosomico y cantidad de ADN',
            'crossing over y permutacion cromosomica',
            'control del ciclo celular'
        ]
    },
    {
        id: 'cap7_manipulacion_genetica',
        chapterNumber: 7,
        title: 'Manipulacion genetica',
        skill: 'Ingenieria genetica, ADN recombinante y PCR',
        keywords: ['ingenieria genetica', 'adn recombinante', 'plasmido', 'vector', 'pcr', 'transgenico', 'crispr', 'clonacion', 'dolly'],
        theoryFocus: [
            'explicar pasos basicos de la tecnologia de ADN recombinante',
            'describir PCR y sus aplicaciones diagnosticas o biotecnologicas',
            'analizar beneficios y riesgos de organismos transgenicos y clonacion'
        ],
        quizFocus: [
            'enzimas de restriccion y ligasa',
            'PCR',
            'organismos transgenicos',
            'aplicaciones medicas de la ingenieria genetica'
        ]
    },
    {
        id: 'cap8_microorganismos_inmunidad',
        chapterNumber: 8,
        title: 'Microorganismos y barreras defensivas',
        skill: 'Microorganismos, inmunidad innata y adaptativa',
        keywords: ['microorganismos', 'bacteria', 'virus', 'hongo', 'protozoo', 'prion', 'inmunidad', 'anticuerpo', 'linfocito', 'macrofago', 'vacuna', 'vih'],
        theoryFocus: [
            'distinguir bacterias, virus, hongos, protistas y priones',
            'explicar barreras de la inmunidad innata y el rol de la inflamacion',
            'comparar inmunidad humoral y celular junto con vacunacion y memoria inmunologica'
        ],
        quizFocus: [
            'agentes infecciosos',
            'inmunidad innata y adaptativa',
            'vacunas e inmunidad activa o pasiva',
            'respuesta inmune y sus alteraciones'
        ]
    },
    {
        id: 'cap9_evolucion_biodiversidad',
        chapterNumber: 9,
        title: 'Evolucion y biodiversidad',
        skill: 'Evidencias evolutivas, seleccion natural y origen de la biodiversidad',
        keywords: ['evolucion', 'darwin', 'wallace', 'lamarck', 'seleccion natural', 'fijismo', 'biodiversidad', 'fosil', 'anatomia comparada', 'biogeografia', 'especiacion', 'taxonomia', 'sistematica', 'filogenia', 'hominizacion'],
        theoryFocus: [
            'comparar explicaciones pre-darwinianas con darwinismo y teoria sintetica',
            'usar evidencias fosiles, anatomicas, embriologicas, biogeograficas y moleculares',
            'relacionar seleccion natural, especiacion y clasificacion biologica con biodiversidad'
        ],
        quizFocus: [
            'evidencias de la evolucion',
            'seleccion natural',
            'especiacion y biodiversidad',
            'taxonomia y sistematica'
        ]
    },
    {
        id: 'cap10_materia_flujo_energia',
        chapterNumber: 10,
        title: 'Materia y flujo de energia en ecosistemas',
        skill: 'Fotosintesis, respiracion, niveles troficos y ciclos de la materia',
        keywords: ['ecosistema', 'energia', 'fotosintesis', 'respiracion celular', 'cadena trofica', 'trama trofica', 'nivel trofico', 'piramide', 'biomasa', 'ciclo del carbono', 'ciclo del nitrogeno', 'agua', 'productividad primaria'],
        theoryFocus: [
            'explicar como la fotosintesis captura energia y la respiracion la libera',
            'describir flujo de energia, niveles troficos, redes alimentarias y regla del 10 por ciento',
            'relacionar ciclos biogeoquimicos con circulacion de materia en ecosistemas'
        ],
        quizFocus: [
            'fotosintesis y respiracion',
            'cadenas y tramas troficas',
            'piramides ecologicas',
            'ciclos biogeoquimicos'
        ]
    },
    {
        id: 'cap11_ecologia_poblaciones',
        chapterNumber: 11,
        title: 'Ecologia de poblaciones y comunidades',
        skill: 'Poblaciones, crecimiento, regulacion e interacciones biologicas',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['ecologia', 'poblacion', 'densidad', 'distribucion espacial', 'crecimiento poblacional', 'modelo j', 'modelo s', 'logistico', 'competencia', 'depredacion', 'simbiosis', 'regulacion poblacional', 'ecologia humana'],
        theoryFocus: [
            'trabajar atributos de poblacion como densidad, dispersion y crecimiento',
            'comparar modelos de crecimiento exponencial y logistico junto con factores limitantes',
            'analizar interacciones biologicas como competencia, depredacion y simbiosis'
        ],
        quizFocus: [
            'graficos de crecimiento poblacional',
            'organizacion ecologica',
            'interacciones biologicas',
            'ecologia humana y regulacion poblacional'
        ]
    },
    {
        id: 'cap12_sustentabilidad',
        chapterNumber: 12,
        title: 'Sustentabilidad e impacto antropogenico',
        skill: 'Cambio climatico, conservacion y gestion sustentable',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['sustentabilidad', 'sustentable', 'efecto invernadero', 'cambio climatico', 'huella ecologica', 'contaminacion', 'matriz energetica', 'conservacion', 'impacto antropogenico', 'biodiversidad norte', 'biodiversidad sur'],
        theoryFocus: [
            'relacionar efecto invernadero y cambio climatico con actividades humanas',
            'interpretar huella ecologica, contaminacion y matriz energetica desde perspectiva biologica',
            'proponer medidas de conservacion y cuidado de biodiversidad con foco territorial'
        ],
        quizFocus: [
            'cambio climatico',
            'huella ecologica',
            'impacto antropogenico',
            'conservacion de la biodiversidad'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap10_materia_flujo_energia');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaBiologiaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const sessionReference = resolveMoralejaSessionReference({
        subject: 'BIOLOGIA',
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
        } else if (numericSession >= 1 && numericSession <= 12) {
            bestChapter = CHAPTERS_BY_ID.cap9_evolucion_biodiversidad;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 13 && numericSession <= 22) {
            bestChapter = CHAPTERS_BY_ID.cap11_ecologia_poblaciones;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession === 23) {
            bestChapter = CHAPTERS_BY_ID.cap3_quimica_vida;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 24 && numericSession <= 35) {
            bestChapter = CHAPTERS_BY_ID.cap10_materia_flujo_energia;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 36) {
            bestChapter = CHAPTERS_BY_ID.cap12_sustentabilidad;
            resolutionMode = 'session_range_fallback';
        } else if (
            normalizedTopic.includes('procari') ||
            normalizedTopic.includes('eucari') ||
            normalizedTopic.includes('organelo') ||
            normalizedTopic.includes('membrana') ||
            normalizedTopic.includes('mosaico fluido') ||
            normalizedTopic.includes('transporte celular') ||
            normalizedTopic.includes('osmosis') ||
            normalizedTopic.includes('difusion') ||
            normalizedTopic.includes('endocitosis') ||
            normalizedTopic.includes('exocitosis')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap4_celula_procariota_eucariota;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('evolu') ||
            normalizedTopic.includes('darwin') ||
            normalizedTopic.includes('fosil') ||
            normalizedTopic.includes('especiacion')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap9_evolucion_biodiversidad;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('fotosint') ||
            normalizedTopic.includes('respiracion') ||
            normalizedTopic.includes('trofic') ||
            normalizedTopic.includes('ciclo del carbono') ||
            normalizedTopic.includes('ciclo del nitrogeno')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap10_materia_flujo_energia;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('poblacion') ||
            normalizedTopic.includes('ecologia') ||
            normalizedTopic.includes('simbiosis') ||
            normalizedTopic.includes('depredacion')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap11_ecologia_poblaciones;
            resolutionMode = 'topic_hint_fallback';
        }
    }

    const materialId = bestChapter.materialId || MORALEJA_BIOLOGIA_MATERIAL_ID;
    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId,
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
            bestChapter.materialId ? 'Este bloque funciona como puente curricular interno cuando la sesion no coincide de forma literal con un capitulo impreso del libro.' : '',
            sessionReference?.focus ? `Referencia exacta de sesion: ${sessionReference.focus}.` : '',
            `Enfoca la explicacion en: ${bestChapter.theoryFocus.join(' ')}.`,
            'Cierra conectando el contenido con una decision experimental, una interpretacion de grafico o una pregunta tipo PAES segun corresponda.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            bestChapter.materialId ? 'Considera que esta cobertura proviene de un puente curricular interno alineado a la malla de Biologia de la app.' : '',
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben tener estilo escolar chileno PAES/DEMRE: claras, con base conceptual correcta y distractores plausibles.',
            'Si usas tablas o graficos, la explicacion debe indicar que variable cambia, que se observa y por que la alternativa correcta se sostiene.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: materialId,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_BIOLOGIA_MATERIAL_ID, CURRICULUM_BRIDGE_MATERIAL_ID };
