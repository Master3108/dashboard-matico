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

// =====================================================================
// CAPITULOS 2° MEDIO (Mineduc 2019)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_neurona_sinapsis',
        chapterNumber: 1,
        title: 'Neurona, sinapsis y sistema nervioso',
        skill: 'Describir neurona, potencial de accion y sinapsis',
        keywords: ['neurona', 'axon', 'dendrita', 'sinapsis', 'potencial de accion', 'neurotransmisor', 'mielina', 'soma', 'nervio'],
        theoryFocus: [
            'identificar partes de la neurona y su funcion',
            'explicar potencial de accion, despolarizacion y repolarizacion',
            'describir sinapsis quimica y electrica, y rol de neurotransmisores'
        ],
        quizFocus: [
            'estructura de la neurona',
            'potencial de accion',
            'sinapsis quimica',
            'neurotransmisores'
        ]
    },
    {
        id: 'cap2_snc_snp_conducta',
        chapterNumber: 2,
        title: 'SNC, SNP y conducta',
        skill: 'Comparar sistemas nerviosos y bases biologicas de la conducta',
        keywords: ['sistema nervioso central', 'sistema nervioso periferico', 'cerebro', 'medula espinal', 'arco reflejo', 'conducta', 'lobulo', 'cortex'],
        theoryFocus: [
            'distinguir sistema nervioso central y periferico',
            'analizar arco reflejo, vias aferentes y eferentes',
            'relacionar areas cerebrales con funciones cognitivas y conductuales'
        ],
        quizFocus: [
            'SNC y SNP',
            'arcos reflejos',
            'areas cerebrales y funciones',
            'bases biologicas de la conducta'
        ]
    },
    {
        id: 'cap3_drogas_dano_cerebral',
        chapterNumber: 3,
        title: 'Drogas, alcohol y dano cerebral',
        skill: 'Analizar efecto de sustancias sobre el cerebro y conducta',
        keywords: ['droga', 'alcohol', 'nicotina', 'estimulante', 'depresor', 'adiccion', 'tolerancia', 'dependencia', 'dano cerebral', 'cannabis', 'cocaina'],
        theoryFocus: [
            'clasificar drogas: estimulantes, depresoras, alucinogenas',
            'explicar mecanismos de adiccion, tolerancia y dependencia',
            'evaluar danos en el sistema nervioso y prevencion del consumo'
        ],
        quizFocus: [
            'tipos de drogas',
            'mecanismos de adiccion',
            'dano cerebral por consumo',
            'prevencion y autocuidado'
        ]
    },
    {
        id: 'cap4_endocrino_homeostasis',
        chapterNumber: 4,
        title: 'Sistema endocrino y homeostasis',
        skill: 'Explicar hormonas y regulacion homeostatica',
        keywords: ['hormona', 'glandula', 'endocrino', 'hipofisis', 'tiroides', 'suprarrenal', 'pancreas', 'insulina', 'homeostasis', 'glicemia', 'feedback'],
        theoryFocus: [
            'identificar glandulas endocrinas y sus hormonas principales',
            'explicar mecanismos de regulacion por feedback negativo y positivo',
            'analizar homeostasis: glicemia, temperatura, balance hidrico'
        ],
        quizFocus: [
            'glandulas y hormonas',
            'mecanismos de feedback',
            'homeostasis glucemica',
            'enfermedades endocrinas'
        ]
    },
    {
        id: 'cap5_inmune',
        chapterNumber: 5,
        title: 'Sistema inmune e inmunidad',
        skill: 'Distinguir inmunidad innata, adaptativa y respuesta inmune',
        keywords: ['inmune', 'inmunidad', 'anticuerpo', 'antigeno', 'linfocito', 'vacuna', 'alergia', 'autoinmune', 'fagocito', 'memoria inmune'],
        theoryFocus: [
            'distinguir barreras defensivas, inmunidad innata y adaptativa',
            'explicar accion de linfocitos B, T y memoria inmunologica',
            'evaluar vacunas, alergias y enfermedades autoinmunes'
        ],
        quizFocus: [
            'inmunidad innata vs adaptativa',
            'linfocitos y anticuerpos',
            'vacunas y memoria inmune',
            'alergias y autoinmunidad'
        ]
    },
    {
        id: 'cap6_genetica_mendel',
        chapterNumber: 6,
        title: 'Genetica mendeliana',
        skill: 'Aplicar leyes de Mendel y cruzamientos',
        keywords: ['mendel', 'gen', 'alelo', 'genotipo', 'fenotipo', 'homocigoto', 'heterocigoto', 'dominante', 'recesivo', 'punnett', 'monohibrido', 'dihibrido'],
        theoryFocus: [
            'aplicar primera y segunda ley de Mendel',
            'resolver cruzamientos monohibridos y dihibridos con tablas de Punnett',
            'distinguir herencia dominante, recesiva, codominancia e incompleta'
        ],
        quizFocus: [
            'leyes de Mendel',
            'cruzamientos monohibridos y dihibridos',
            'tablas de Punnett',
            'codominancia e incompleta'
        ]
    },
    {
        id: 'cap7_herencia_sexo_mutaciones',
        chapterNumber: 7,
        title: 'Herencia ligada al sexo y mutaciones',
        skill: 'Analizar herencia ligada al sexo, pedigris y mutaciones',
        keywords: ['herencia ligada al sexo', 'cromosoma x', 'cromosoma y', 'daltonismo', 'hemofilia', 'pedigri', 'mutacion', 'cariotipo', 'sindrome', 'trisomia'],
        theoryFocus: [
            'analizar herencia ligada al cromosoma X (hemofilia, daltonismo)',
            'leer e interpretar pedigris familiares',
            'clasificar mutaciones puntuales y cromosomicas (sindrome de Down, Turner)'
        ],
        quizFocus: [
            'herencia ligada al sexo',
            'analisis de pedigris',
            'tipos de mutaciones',
            'enfermedades geneticas comunes'
        ]
    },
    {
        id: 'cap8_variabilidad_evolucion',
        chapterNumber: 8,
        title: 'Variabilidad genetica y evolucion',
        skill: 'Integrar variabilidad, seleccion natural y especiacion',
        keywords: ['variabilidad', 'evolucion', 'seleccion natural', 'deriva genetica', 'especiacion', 'adaptacion', 'darwin', 'aislamiento reproductivo'],
        theoryFocus: [
            'analizar fuentes de variabilidad genetica: mutacion y recombinacion',
            'explicar seleccion natural, deriva y migracion como motores evolutivos',
            'describir mecanismos de especiacion y aislamiento reproductivo'
        ],
        quizFocus: [
            'fuentes de variabilidad',
            'seleccion natural y deriva',
            'especiacion',
            'evidencias evolutivas'
        ]
    },
    {
        id: 'cap9_biotecnologia',
        chapterNumber: 9,
        title: 'Biotecnologia y aplicaciones',
        skill: 'Evaluar biotecnologia moderna y bioetica',
        keywords: ['biotecnologia', 'adn recombinante', 'transgenico', 'ogm', 'crispr', 'clonacion', 'terapia genica', 'bioetica', 'pcr'],
        theoryFocus: [
            'describir tecnicas: ADN recombinante, PCR, CRISPR, clonacion',
            'evaluar aplicaciones en medicina, agricultura e industria',
            'analizar dilemas bioeticos de la manipulacion genetica'
        ],
        quizFocus: [
            'tecnicas biotecnologicas',
            'transgenicos y OGM',
            'terapia genica y CRISPR',
            'bioetica'
        ]
    },
    {
        id: 'cap10_salud_bienestar',
        chapterNumber: 10,
        title: 'Salud, alimentacion y bienestar integral',
        skill: 'Relacionar habitos saludables con prevencion de enfermedades',
        keywords: ['salud', 'alimentacion', 'nutricion', 'ejercicio', 'sedentarismo', 'obesidad', 'diabetes', 'salud mental', 'prevencion', 'autocuidado'],
        theoryFocus: [
            'analizar pilares de salud: alimentacion, actividad fisica, sueno, salud mental',
            'relacionar habitos con prevencion de enfermedades cronicas',
            'evaluar factores de riesgo y promocion de bienestar integral'
        ],
        quizFocus: [
            'alimentacion saludable',
            'actividad fisica y sedentarismo',
            'salud mental',
            'prevencion de enfermedades cronicas'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap10_materia_flujo_energia');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[0];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaBiologiaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'BIOLOGIA',
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
        } else if (is2M) {
            // 2° medio: sin topic_hint fallback (los hints actuales son específicos de 1° medio)
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
