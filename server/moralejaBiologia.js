import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_BIOLOGIA_MATERIAL_ID = 'moraleja_biologia_5ed_2024';
const CURRICULUM_BRIDGE_MATERIAL_ID = 'matico_curriculum_bridge';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS_LEGACY_DISABLED = [
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
// CAPITULOS 1° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA CN1M 01-08)
// =====================================================================
const CHAPTERS = [
    {
        id: 'cap1_fosiles',
        chapterNumber: 1,
        title: 'Fosiles y evidencias del pasado (OA1)',
        skill: 'Explicar formacion de fosiles y su valor evolutivo',
        keywords: ['fosil', 'fosiles', 'paleontologia', 'sedimentacion', 'estratigrafia', 'datacion', 'molde', 'permineralizacion', 'animal', 'planta'],
        theoryFocus: [
            'explicar como se forman los fosiles a partir de restos de animales y plantas',
            'reconocer fosiles como evidencia del pasado biologico',
            'analizar el rol de la paleontologia en la reconstruccion evolutiva'
        ],
        quizFocus: ['proceso de fosilizacion', 'tipos de fosiles', 'datacion y estratigrafia', 'fosiles como evidencia evolutiva']
    },
    {
        id: 'cap2_diversidad_evolucion',
        chapterNumber: 2,
        title: 'Diversidad y teoria evolutiva (OA2)',
        skill: 'Analizar evidencias evolutivas y seleccion natural',
        keywords: ['evolucion', 'darwin', 'seleccion natural', 'estructura homologa', 'analoga', 'registro fosil', 'adaptacion', 'biodiversidad'],
        theoryFocus: [
            'analizar diversidad de organismos como resultado evolutivo',
            'interpretar evidencias: registro fosil, estructuras homologas/analogas, ADN',
            'aplicar teoria de seleccion natural de Darwin'
        ],
        quizFocus: ['evidencias evolutivas', 'estructuras homologas vs analogas', 'seleccion natural', 'aportes de Darwin']
    },
    {
        id: 'cap3_taxonomia',
        chapterNumber: 3,
        title: 'Clasificacion taxonomica y parentesco (OA3)',
        skill: 'Explicar criterios taxonomicos y relaciones de parentesco',
        keywords: ['taxonomia', 'reino', 'filo', 'clase', 'orden', 'familia', 'genero', 'especie', 'linneo', 'cladistica', 'arbol filogenetico'],
        theoryFocus: [
            'explicar como se construye la clasificacion de organismos',
            'aplicar criterios taxonomicos jerarquicos (reino, filo, clase, orden, familia, genero, especie)',
            'identificar relaciones de parentesco mediante arboles filogeneticos'
        ],
        quizFocus: ['categorias taxonomicas', 'sistema de Linneo', 'arboles filogeneticos', 'reinos y dominios']
    },
    {
        id: 'cap4_ecosistemas',
        chapterNumber: 4,
        title: 'Ecosistemas: organizacion e interacciones (OA4)',
        skill: 'Investigar niveles de organizacion e interacciones biologicas',
        keywords: ['ecosistema', 'comunidad', 'poblacion', 'individuo', 'biotopo', 'biocenosis', 'simbiosis', 'mutualismo', 'comensalismo', 'parasitismo', 'depredacion'],
        theoryFocus: [
            'investigar niveles de organizacion: individuo, poblacion, comunidad, ecosistema, bioma',
            'analizar interacciones biologicas: simbiosis (mutualismo, comensalismo, parasitismo)',
            'estudiar relaciones de competencia, depredacion y herbivoria'
        ],
        quizFocus: ['niveles de organizacion ecologica', 'tipos de interacciones biologicas', 'simbiosis', 'cadenas y redes troficas']
    },
    {
        id: 'cap5_poblaciones',
        chapterNumber: 5,
        title: 'Dinamica poblacional (OA5)',
        skill: 'Analizar factores que afectan poblaciones',
        keywords: ['poblacion', 'densidad', 'natalidad', 'mortalidad', 'migracion', 'capacidad de carga', 'crecimiento exponencial', 'crecimiento logistico'],
        theoryFocus: [
            'analizar factores que afectan tamano de poblaciones (natalidad, mortalidad, migracion)',
            'comprender curvas de crecimiento exponencial y logistico',
            'predecir consecuencias de cambios poblacionales sobre el ecosistema'
        ],
        quizFocus: ['densidad poblacional', 'natalidad/mortalidad/migracion', 'curvas de crecimiento', 'capacidad de carga del ambiente']
    },
    {
        id: 'cap6_ciclos_biogeoquimicos',
        chapterNumber: 6,
        title: 'Ciclos biogeoquimicos y flujo de energia (OA6)',
        skill: 'Modelar ciclos de materia y flujo energetico',
        keywords: ['ciclo del carbono', 'ciclo del nitrogeno', 'ciclo del agua', 'flujo de energia', 'bioacumulacion', 'biomagnificacion', 'contaminante'],
        theoryFocus: [
            'desarrollar modelos que expliquen ciclos biogeoquimicos (carbono, nitrogeno, agua)',
            'analizar flujo de energia en cadenas y piramides troficas',
            'evaluar bioacumulacion y biomagnificacion de contaminantes'
        ],
        quizFocus: ['ciclo del carbono', 'ciclo del nitrogeno', 'ciclo del agua', 'bioacumulacion en cadenas troficas']
    },
    {
        id: 'cap7_fotosintesis_respiracion',
        chapterNumber: 7,
        title: 'Fotosintesis y respiracion celular (OA7)',
        skill: 'Explicar rol energetico y de ciclo de materia',
        keywords: ['fotosintesis', 'respiracion celular', 'clorofila', 'cloroplasto', 'mitocondria', 'glucosa', 'atp', 'oxigeno', 'co2'],
        theoryFocus: [
            'explicar el rol de la fotosintesis: captacion de energia solar y produccion de glucosa',
            'explicar la respiracion celular: oxidacion de glucosa para producir ATP',
            'relacionar fotosintesis y respiracion con flujo energetico y ciclo de materia'
        ],
        quizFocus: ['ecuacion de fotosintesis', 'ecuacion de respiracion celular', 'cloroplasto vs mitocondria', 'rol energetico de ATP']
    },
    {
        id: 'cap8_impacto_humano',
        chapterNumber: 8,
        title: 'Impacto humano y sustentabilidad (OA8)',
        skill: 'Evaluar efectos antropicos sobre ecosistemas y recursos',
        keywords: ['impacto antropico', 'sustentabilidad', 'cambio climatico', 'deforestacion', 'contaminacion', 'extincion', 'recursos naturales', 'conservacion', 'huella ecologica'],
        theoryFocus: [
            'explicar efectos de acciones humanas sobre el equilibrio ecosistemico',
            'analizar fenomenos naturales y su impacto en recursos (sismos, sequias, incendios)',
            'evaluar estrategias de sustentabilidad y conservacion'
        ],
        quizFocus: ['impacto humano sobre ecosistemas', 'cambio climatico', 'extincion de especies', 'sustentabilidad y conservacion']
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA CN2M 01-08)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_sistema_nervioso',
        chapterNumber: 1,
        title: 'Sistema nervioso y autocuidado (OA1)',
        skill: 'Explicar como el sistema nervioso coordina la adaptacion a estimulos',
        keywords: ['sistema nervioso', 'neurona', 'estimulo', 'sinapsis', 'cerebro', 'sueno', 'droga', 'autocuidado', 'traumatismo', 'reflejo'],
        theoryFocus: [
            'explicar como el sistema nervioso coordina acciones para adaptarse a estimulos',
            'analizar la importancia de cuidados (horas de sueno, no consumir drogas)',
            'investigar prevencion de traumatismos y proteccion del sistema nervioso'
        ],
        quizFocus: [
            'coordinacion nerviosa frente a estimulos',
            'rol del sueno y efectos de drogas en el cerebro',
            'prevencion de traumatismos',
            'autocuidado del sistema nervioso'
        ]
    },
    {
        id: 'cap2_hormonas',
        chapterNumber: 2,
        title: 'Hormonas: glicemia y caracteres sexuales (OA2)',
        skill: 'Modelar regulacion por hormonas pancreaticas y sexuales',
        keywords: ['hormona', 'insulina', 'glucagon', 'glicemia', 'pancreas', 'hormonas sexuales', 'caracteres sexuales secundarios', 'testosterona', 'estrogeno', 'pubertad'],
        theoryFocus: [
            'crear modelos que expliquen la regulacion de glicemia por hormonas pancreaticas (insulina, glucagon)',
            'modelar el desarrollo de caracteres sexuales secundarios mediante hormonas sexuales',
            'relacionar funcionamiento hormonal con homeostasis y pubertad'
        ],
        quizFocus: [
            'regulacion de glicemia (insulina vs glucagon)',
            'hormonas sexuales y pubertad',
            'caracteres sexuales secundarios',
            'mecanismos de feedback hormonal'
        ]
    },
    {
        id: 'cap3_sexualidad_reproduccion',
        chapterNumber: 3,
        title: 'Sexualidad y reproduccion humana (OA3)',
        skill: 'Explicar sexualidad y reproduccion integrando aspectos biopsicosociales',
        keywords: ['sexualidad', 'reproduccion', 'aspectos biologicos', 'afectivo', 'psicologico', 'responsabilidad individual', 'identidad', 'genero', 'orientacion'],
        theoryFocus: [
            'explicar que sexualidad y reproduccion humanas integran aspectos biologicos, sociales, afectivos y psicologicos',
            'analizar la dimension de responsabilidad individual en sexualidad',
            'reflexionar sobre identidad, autocuidado y respeto en relaciones humanas'
        ],
        quizFocus: [
            'dimensiones de la sexualidad humana',
            'responsabilidad individual',
            'distincion sexualidad vs reproduccion',
            'aspectos afectivos y psicologicos'
        ]
    },
    {
        id: 'cap4_fecundacion_embarazo',
        chapterNumber: 4,
        title: 'Fecundacion, embarazo y lactancia (OA4)',
        skill: 'Describir fecundacion, embarazo y lactancia con responsabilidad parental',
        keywords: ['fecundacion', 'implantacion', 'embarazo', 'desarrollo embrionario', 'feto', 'placenta', 'lactancia', 'nutricion prenatal', 'responsabilidad parental'],
        theoryFocus: [
            'describir fecundacion, implantacion y desarrollo embrionario',
            'analizar la responsabilidad parental en nutricion prenatal',
            'explicar la importancia de la lactancia materna'
        ],
        quizFocus: [
            'proceso de fecundacion e implantacion',
            'etapas del desarrollo embrionario',
            'nutricion prenatal',
            'beneficios de la lactancia materna'
        ]
    },
    {
        id: 'cap5_regulacion_fertilidad',
        chapterNumber: 5,
        title: 'Metodos de regulacion de la fertilidad (OA5)',
        skill: 'Evaluar metodos de regulacion de la fertilidad',
        keywords: ['anticonceptivo', 'metodo de barrera', 'metodo hormonal', 'diu', 'preservativo', 'fertilidad', 'planificacion familiar', 'paternidad responsable', 'its'],
        theoryFocus: [
            'explicar y evaluar metodos de regulacion de la fertilidad (barrera, hormonales, naturales, quirurgicos)',
            'identificar elementos de paternidad y maternidad responsables',
            'analizar prevencion de infecciones de transmision sexual (ITS)'
        ],
        quizFocus: [
            'comparacion de metodos anticonceptivos',
            'efectividad y limitaciones',
            'paternidad y maternidad responsables',
            'prevencion de ITS'
        ]
    },
    {
        id: 'cap6_mitosis_meiosis',
        chapterNumber: 6,
        title: 'Mitosis, meiosis y anomalias celulares (OA6)',
        skill: 'Investigar transmision genetica entre generaciones',
        keywords: ['mitosis', 'meiosis', 'reproduccion celular', 'cancer', 'trisomia', 'cromosoma', 'sindrome de down', 'anomalia celular', 'ciclo celular'],
        theoryFocus: [
            'investigar que el material genetico se transmite entre generaciones',
            'comparar mitosis (reproduccion asexual) y meiosis (formacion de gametos)',
            'analizar causas y consecuencias de anomalias celulares (cancer, trisomia 21)'
        ],
        quizFocus: [
            'mitosis vs meiosis',
            'transmision de material genetico',
            'cancer como perdida de control celular',
            'trisomia 21 (sindrome de Down)'
        ]
    },
    {
        id: 'cap7_herencia_mendel',
        chapterNumber: 7,
        title: 'Herencia genetica y leyes de Mendel (OA7)',
        skill: 'Aplicar principios basicos de Mendel a la herencia',
        keywords: ['mendel', 'gen', 'alelo', 'genotipo', 'fenotipo', 'dominante', 'recesivo', 'homocigoto', 'heterocigoto', 'punnett', 'cruzamiento'],
        theoryFocus: [
            'desarrollar explicacion cientifica sobre herencia genetica',
            'aplicar primera (segregacion) y segunda (distribucion independiente) ley de Mendel',
            'resolver cruzamientos monohibridos y dihibridos con tablas de Punnett'
        ],
        quizFocus: [
            'leyes de Mendel',
            'cruzamientos monohibridos y dihibridos',
            'genotipo vs fenotipo',
            'tablas de Punnett'
        ]
    },
    {
        id: 'cap8_manipulacion_genetica',
        chapterNumber: 8,
        title: 'Manipulacion genetica y bioetica (OA8)',
        skill: 'Investigar aplicaciones de manipulacion genetica y evaluar implicancias',
        keywords: ['manipulacion genetica', 'transgenico', 'ogm', 'farmaco', 'insulina recombinante', 'crispr', 'bioetica', 'alimento modificado', 'terapia genica'],
        theoryFocus: [
            'investigar aplicaciones de manipulacion genetica en alimentos, farmacos y otros campos',
            'evaluar implicancias eticas y sociales de la biotecnologia',
            'analizar casos: insulina recombinante, OGM, terapia genica'
        ],
        quizFocus: [
            'aplicaciones de la manipulacion genetica',
            'transgenicos y OGM',
            'implicancias eticas y sociales',
            'farmacos producidos por biotecnologia'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap10_materia_flujo_energia');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[0];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

// =====================================================================
// CAPITULOS 3° MEDIO — Biologia Celular y Molecular Diferenciado HC (OA CN-BCMO-3y4-OAC-01 a 07)
// =====================================================================
const CHAPTERS_3M = [
    {
        id: 'cap1_historia_bio_molecular',
        chapterNumber: 1,
        title: 'Historia de la biologia celular y molecular (OA1)',
        skill: 'Investigar el desarrollo historico de la biologia celular y molecular',
        keywords: ['biologia celular', 'biologia molecular', 'historia ciencia', 'microscopio', 'watson', 'crick', 'franklin', 'teoria celular', 'robert hooke', 'van leeuwenhoek'],
        theoryFocus: [
            'investigar el desarrollo historico del conocimiento en biologia celular y molecular',
            'comprender la relacion de la biologia molecular con quimica, fisica y matematica',
            'valorar los aportes de cientificos clave en el descubrimiento del ADN y la estructura celular'
        ],
        quizFocus: ['historia de la biologia molecular', 'descubrimiento de la estructura del ADN', 'teoria celular', 'relacion interdisciplinaria']
    },
    {
        id: 'cap2_estructura_celula_biomoleculas',
        chapterNumber: 2,
        title: 'Estructura y funcion celular: biomoleculas y organelos (OA2)',
        skill: 'Explicar la estructura celular basada en biomoleculas, membranas y organelos',
        keywords: ['celula', 'biomolecula', 'organelo', 'membrana celular', 'nucleo', 'mitocondria', 'ribosoma', 'reticulo endoplasmatico', 'proteina', 'lipido', 'carbohidrato', 'procariota', 'eucariota', 'metabolismo'],
        theoryFocus: [
            'explicar la estructura y organizacion celular basada en biomoleculas, membranas y organelos',
            'describir los procesos de metabolismo, motilidad y comunicacion celular',
            'relacionar estructura y funcion de cada organelo con la continuidad y evolucion de la vida'
        ],
        quizFocus: ['organelos y sus funciones', 'biomoleculas: proteinas, lipidos, carbohidratos y ADN', 'membrana celular', 'celula procariota vs eucariota']
    },
    {
        id: 'cap3_dogma_central',
        chapterNumber: 3,
        title: 'Dogma central de la biologia molecular: ADN → ARN → proteinas (OA3)',
        skill: 'Analizar el dogma central y el flujo de informacion genetica',
        keywords: ['dogma central', 'adn', 'arn', 'proteina', 'replicacion', 'transcripcion', 'traduccion', 'codon', 'aminoacido', 'mrna', 'trna', 'rrna', 'ribosoma', 'gen', 'informacion genetica'],
        theoryFocus: [
            'explicar el dogma central: replicacion del ADN, transcripcion al ARN y traduccion a proteinas',
            'describir el flujo de informacion genetica desde el ADN al ARN y a las proteinas',
            'analizar criticamente el significado biologico del dogma central de la biologia molecular'
        ],
        quizFocus: ['replicacion del ADN', 'transcripcion y tipos de ARN', 'traduccion y sintesis proteica', 'codigo genetico']
    },
    {
        id: 'cap4_regulacion_genica_cancer',
        chapterNumber: 4,
        title: 'Regulacion genica, diferenciacion celular y cancer (OA4)',
        skill: 'Describir mecanismos de regulacion genica y su relacion con enfermedades',
        keywords: ['regulacion genica', 'diferenciacion celular', 'cancer', 'oncogen', 'apoptosis', 'proliferacion celular', 'estimulo ambiental', 'envejecimiento', 'tumor', 'mutacion', 'epigenetica'],
        theoryFocus: [
            'describir mecanismos de regulacion genica y su relacion con diferenciacion y proliferacion celular',
            'explicar como estimulos ambientales influyen en la expresion genica',
            'relacionar alteraciones en la regulacion genica con el cancer y el envejecimiento'
        ],
        quizFocus: ['regulacion genica', 'diferenciacion celular', 'mecanismos del cancer', 'apoptosis y proliferacion']
    },
    {
        id: 'cap5_proteinas_enzimas_motilidad',
        chapterNumber: 5,
        title: 'Proteinas, enzimas y motilidad celular (OA5)',
        skill: 'Explicar funciones de proteinas en procesos celulares clave',
        keywords: ['proteina', 'enzima', 'catalizador', 'sustrato', 'motilidad', 'contraccion muscular', 'canal ionico', 'receptor', 'actina', 'miosina', 'conformacion proteica'],
        theoryFocus: [
            'explicar la actividad enzimatica y las relaciones entre estructuras y funciones de proteinas',
            'describir el flujo de iones a traves de membranas a traves de canales proteicos',
            'relacionar cambios conformacionales de proteinas con motilidad celular y contraccion muscular'
        ],
        quizFocus: ['estructura y funcion de enzimas', 'canales ionicos y membranas', 'motilidad celular', 'contraccion muscular a nivel molecular']
    },
    {
        id: 'cap6_ciencia_chilena_cts',
        chapterNumber: 6,
        title: 'Ciencia chilena y relacion ciencia-tecnologia-sociedad (OA6)',
        skill: 'Analizar el desarrollo cientifico en biologia en Chile y su impacto social',
        keywords: ['ciencia chile', 'investigacion chilena', 'innovacion', 'tecnologia sociedad', 'cts', 'politica cientifica', 'genomica', 'neurociencia', 'desarrollo sostenible', 'fondecyt'],
        theoryFocus: [
            'analizar el desarrollo del conocimiento de biologia celular y molecular en Chile y el mundo',
            'reconocer distintas lineas de investigacion biologica activas en Chile',
            'evaluar la relacion entre ciencia, tecnologia y sociedad en el contexto biologico actual'
        ],
        quizFocus: ['investigacion biologica en Chile', 'relacion ciencia-tecnologia-sociedad', 'politica cientifica', 'lineas de investigacion biologica']
    },
    {
        id: 'cap7_biotecnologia_etica',
        chapterNumber: 7,
        title: 'Biotecnologia: CRISPR, celulas madre y transgenicos (OA7)',
        skill: 'Analizar aplicaciones biotecnologicas y evaluar sus implicancias eticas',
        keywords: ['biotecnologia', 'crispr', 'edicion genetica', 'celulas madre', 'transgenico', 'ogm', 'clonacion', 'terapia genica', 'etica', 'bioetica', 'pcr', 'cancer terapia'],
        theoryFocus: [
            'analizar aplicaciones biotecnologicas: tratamientos para el cancer, celulas madre y organismos transgenicos',
            'evaluar el potencial y los riesgos de la edicion genomica con CRISPR',
            'discutir implicancias eticas, sociales y legales de las biotecnologias modernas'
        ],
        quizFocus: ['CRISPR y edicion genomica', 'celulas madre y diferenciacion', 'organismos transgenicos y OGM', 'etica en biotecnologia']
    }
];

const fallbackChapter3M = CHAPTERS_3M[0];
const CHAPTERS_BY_ID_3M = Object.fromEntries(CHAPTERS_3M.map((chapter) => [chapter.id, chapter]));

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    if (raw === '3medio' || raw === '3m' || raw === '3°medio' || raw === 'tercero' || raw === 'terceromedio') return '3medio';
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
    const is3M = gradeKey === '3medio';
    const chaptersForGrade = is3M ? CHAPTERS_3M : is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is3M ? CHAPTERS_BY_ID_3M : is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is3M ? fallbackChapter3M : is2M ? fallbackChapter2M : fallbackChapter;

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
