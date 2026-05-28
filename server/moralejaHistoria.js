import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_HISTORIA_MATERIAL_ID = 'moraleja_historia_2026';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    if (raw === '3medio' || raw === '3m' || raw === '3°medio' || raw === 'tercero' || raw === 'terceromedio') return '3medio';
    return '1medio';
};

// =====================================================================
// CAPITULOS 1° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA HI1M 01-25)
// Siglo XIX: Estado-nacion, industrializacion, ocupacion territorio chileno
// =====================================================================
const CHAPTERS = [
    {
        id: 'cap1_ideas_republicanas',
        chapterNumber: 1,
        title: 'Ideas republicanas/liberales y Estado-nacion siglo XIX (OA1-3)',
        skill: 'Explicar ideas republicanas, cultura burguesa y Estado-nacion',
        keywords: ['republicanismo', 'liberalismo', 'cultura burguesa', 'estado-nacion', 'siglo xix', 'revolucion francesa', 'independencia americana', 'ilustracion'],
        theoryFocus: [
            'explicar ideas republicanas y liberales y sus transformaciones politicas y economicas',
            'caracterizar la cultura burguesa, ideal de vida y valores del siglo XIX',
            'analizar la reorganizacion geopolitica y surgimiento del Estado-nacion en America Latina y Europa'
        ],
        quizFocus: ['ideas republicanas y liberales', 'cultura burguesa siglo XIX', 'formacion del Estado-nacion', 'transformaciones politicas y economicas']
    },
    {
        id: 'cap2_progreso_industrializacion',
        chapterNumber: 2,
        title: 'Progreso, industrializacion e imperialismo (OA4-6)',
        skill: 'Analizar industrializacion y expansion imperial',
        keywords: ['progreso indefinido', 'revolucion industrial', 'industrializacion', 'imperialismo', 'colonialismo', 'maquina de vapor', 'urbanizacion'],
        theoryFocus: [
            'reconocer la idea de progreso indefinido en desarrollo cientifico-tecnologico del siglo XIX',
            'caracterizar la industrializacion y sus efectos sobre economia, poblacion y territorio',
            'analizar el imperialismo europeo del siglo XIX y su impacto mundial'
        ],
        quizFocus: ['idea de progreso del siglo XIX', 'revolucion industrial y consecuencias', 'imperialismo europeo', 'colonialismo en Asia y Africa']
    },
    {
        id: 'cap3_primera_guerra_mundial',
        chapterNumber: 3,
        title: 'Primera Guerra Mundial (OA7)',
        skill: 'Analizar Primera Guerra Mundial y nuevo orden geopolitico',
        keywords: ['primera guerra mundial', 'trincheras', 'sarajevo', 'tratado de versalles', 'sociedad de naciones', 'imperios centrales', 'aliados'],
        theoryFocus: [
            'analizar el impacto de la Primera Guerra Mundial en la sociedad civil',
            'comprender el nuevo orden geopolitico post-1918',
            'evaluar el Tratado de Versalles y la Sociedad de Naciones'
        ],
        quizFocus: ['causas de la Primera Guerra Mundial', 'desarrollo y trincheras', 'Tratado de Versalles', 'impacto en sociedad civil']
    },
    {
        id: 'cap4_chile_republica_1833',
        chapterNumber: 4,
        title: 'Chile: formacion republica y Constitucion 1833 (OA8-9)',
        skill: 'Analizar formacion republicana y orden conservador',
        keywords: ['constitucion de 1833', 'portales', 'orden conservador', 'pelucones', 'pipiolos', 'republica chilena', 'autoritarismo'],
        theoryFocus: [
            'analizar la formacion de la republica de Chile y la Constitucion de 1833',
            'caracterizar la consolidacion de la republica chilena',
            'explicar el rol de Diego Portales en el orden conservador'
        ],
        quizFocus: ['Constitucion de 1833', 'rol de Portales', 'pelucones vs pipiolos', 'consolidacion republicana']
    },
    {
        id: 'cap5_chile_salitre',
        chapterNumber: 5,
        title: 'Chile: industria del salitre y exportaciones (OA10-11, OA17)',
        skill: 'Explicar insercion economica y opinion publica',
        keywords: ['salitre', 'exportacion', 'tarapaca', 'antofagasta', 'oficina salitrera', 'opinion publica', 'prensa', 'educacion publica'],
        theoryFocus: [
            'explicar la insercion de Chile en industrializacion mundial via exportacion de recursos naturales',
            'analizar el desarrollo de espacios de opinion publica y educacion',
            'caracterizar transformaciones generadas por las riquezas del salitre'
        ],
        quizFocus: ['ciclo del salitre', 'exportaciones chilenas siglo XIX', 'opinion publica y educacion', 'transformacion social por la riqueza salitrera']
    },
    {
        id: 'cap6_ocupacion_territorio',
        chapterNumber: 6,
        title: 'Ocupacion del territorio chileno (OA12-15)',
        skill: 'Describir ocupacion territorial y Guerra del Pacifico',
        keywords: ['valdivia', 'llanquihue', 'chiloe', 'magallanes', 'araucania', 'mapuche', 'guerra del pacifico', 'tratado de ancon', 'territorio nacional'],
        theoryFocus: [
            'describir procesos de exploracion y reconocimiento del territorio nacional',
            'describir ocupacion de Valdivia, Llanquihue, Chiloe y Magallanes',
            'explicar ocupacion de la Araucania y su impacto en la sociedad mapuche; analizar Guerra del Pacifico'
        ],
        quizFocus: ['ocupacion territorial chilena', 'pacificacion de la Araucania', 'Guerra del Pacifico (1879-1884)', 'consecuencias territoriales']
    },
    {
        id: 'cap7_parlamentarismo_cuestion_social',
        chapterNumber: 7,
        title: 'Parlamentarismo y cuestion social (OA16, OA18, OA23)',
        skill: 'Analizar parlamentarismo y respuestas a la cuestion social',
        keywords: ['parlamentarismo', 'cuestion social', 'huelga', 'obrero', 'anarquismo', 'socialismo', 'mutual', 'sindicato', 'recoleta', 'matanza'],
        theoryFocus: [
            'analizar el orden politico liberal y parlamentario de la segunda mitad del siglo XIX',
            'analizar transformaciones de la sociedad en el cambio de siglo y la cuestion social',
            'explicar respuestas politicas (liberalismo, socialismo, anarquismo)'
        ],
        quizFocus: ['parlamentarismo chileno', 'cuestion social', 'movimiento obrero', 'respuestas politicas']
    },
    {
        id: 'cap8_economia_geografia',
        chapterNumber: 8,
        title: 'Economia: escasez, mercado, finanzas, consumo (OA19-22)',
        skill: 'Explicar fundamentos economicos y consumo responsable',
        keywords: ['escasez', 'necesidades', 'mercado', 'oferta', 'demanda', 'inversion', 'ahorro', 'banco', 'consumo informado', 'finanzas personales'],
        theoryFocus: [
            'explicar el problema economico de escasez y necesidades ilimitadas',
            'explicar funcionamiento del mercado y factores que lo alteran',
            'caracterizar instrumentos financieros y evaluar consumo informado y responsable'
        ],
        quizFocus: ['escasez y necesidades', 'oferta y demanda', 'instrumentos financieros (ahorro, inversion)', 'consumo responsable']
    },
    {
        id: 'cap9_pueblos_indigenas',
        chapterNumber: 9,
        title: 'Pueblos indigenas: convivencia y conflicto (OA24)',
        skill: 'Evaluar relaciones con pueblos indigenas en Chile',
        keywords: ['mapuche', 'aymara', 'rapa nui', 'pueblos originarios', 'interculturalidad', 'reduccion', 'reconocimiento constitucional', 'derechos indigenas'],
        theoryFocus: [
            'evaluar relaciones de conflicto y convivencia con pueblos indigenas en Chile',
            'analizar consecuencias historicas de la pacificacion y las reducciones',
            'caracterizar la diversidad cultural y el reconocimiento de pueblos originarios hoy'
        ],
        quizFocus: ['pueblos originarios de Chile', 'pacificacion y reducciones', 'derechos indigenas actuales', 'interculturalidad']
    },
    {
        id: 'cap10_industria_medioambiente',
        chapterNumber: 10,
        title: 'Industrializacion y medio ambiente (OA25)',
        skill: 'Analizar impacto industrial sobre medio ambiente',
        keywords: ['industrializacion', 'medio ambiente', 'contaminacion', 'desarrollo sostenible', 'recursos naturales', 'huella ecologica'],
        theoryFocus: [
            'analizar el impacto de la industrializacion en el medio ambiente',
            'evaluar el concepto de desarrollo sostenible',
            'relacionar uso de recursos naturales con consecuencias ambientales'
        ],
        quizFocus: ['impacto ambiental de la industrializacion', 'desarrollo sostenible', 'uso de recursos naturales', 'huella ecologica']
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA HI2M 01-25)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_entreguerras_totalitarismos',
        chapterNumber: 1,
        title: 'Crisis del Estado liberal y entreguerras (OA1-2)',
        skill: 'Analizar transformaciones culturales y crisis politicas del periodo entreguerras',
        keywords: ['entreguerras', 'totalitarismo', 'fascismo', 'nazismo', 'stalinismo', 'crisis de 1929', 'estado liberal', 'populismo', 'estado de bienestar', 'vanguardias', 'ruptura de canones'],
        theoryFocus: [
            'relacionar transformaciones culturales de entreguerras con ruptura de canones esteticos tradicionales',
            'analizar crisis del Estado liberal y surgimiento de totalitarismos (fascismo, nazismo, stalinismo)',
            'caracterizar populismo y Estado de Bienestar como respuestas a la crisis'
        ],
        quizFocus: [
            'totalitarismos del siglo XX',
            'crisis del estado liberal',
            'transformaciones culturales y vanguardias',
            'estado de bienestar y populismo'
        ]
    },
    {
        id: 'cap2_segunda_guerra_mundial',
        chapterNumber: 2,
        title: 'Segunda Guerra Mundial y creacion de la ONU (OA3-4)',
        skill: 'Analizar Segunda Guerra Mundial y sus consecuencias globales',
        keywords: ['segunda guerra mundial', 'holocausto', 'hitler', 'aliados', 'eje', 'pearl harbor', 'normandia', 'hiroshima', 'nagasaki', 'onu', 'declaracion universal de derechos humanos'],
        theoryFocus: [
            'analizar Segunda Guerra Mundial considerando ideologias antagonicas y devastacion humana',
            'examinar el holocausto y la negacion de derechos fundamentales',
            'evaluar consecuencias y la creacion de la ONU como respuesta institucional'
        ],
        quizFocus: [
            'causas y desarrollo de la Segunda Guerra Mundial',
            'holocausto y violaciones a DDHH',
            'consecuencias geopoliticas',
            'creacion y rol de la ONU'
        ]
    },
    {
        id: 'cap3_chile_crisis_parlamentaria',
        chapterNumber: 3,
        title: 'Chile: crisis parlamentaria y Constitucion 1925 (OA5)',
        skill: 'Analizar la crisis del parlamentarismo chileno',
        keywords: ['parlamentarismo', 'constitucion de 1925', 'arturo alessandri', 'cuestion social', 'crisis del salitre', 'ibanez del campo', 'republica presidencial'],
        theoryFocus: [
            'analizar la crisis del periodo parlamentario chileno (1891-1925)',
            'caracterizar la cuestion social y la inestabilidad politica',
            'explicar el contenido y significado de la Constitucion de 1925'
        ],
        quizFocus: [
            'crisis del parlamentarismo',
            'cuestion social en Chile',
            'Constitucion de 1925',
            'transicion al regimen presidencial'
        ]
    },
    {
        id: 'cap4_chile_industrializacion',
        chapterNumber: 4,
        title: 'Chile: industrializacion, CORFO y democratizacion (OA6-7, OA12)',
        skill: 'Analizar industrializacion y democratizacion chilena mid-siglo XX',
        keywords: ['corfo', 'isi', 'industrializacion por sustitucion', 'pedro aguirre cerda', 'gabriel gonzalez videla', 'voto femenino', 'migracion campo-ciudad', 'urbanizacion', 'pobreza', 'frente popular'],
        theoryFocus: [
            'analizar transformaciones economicas post-1929 en Chile: industrializacion por sustitucion (ISI), creacion de CORFO',
            'evaluar la democratizacion de la sociedad chilena (voto femenino, ampliacion del sufragio)',
            'caracterizar la pobreza, migracion campo-ciudad y urbanizacion acelerada'
        ],
        quizFocus: [
            'CORFO y modelo ISI',
            'democratizacion del voto',
            'migracion campo-ciudad',
            'reformas sociales mid-siglo XX'
        ]
    },
    {
        id: 'cap5_guerra_fria',
        chapterNumber: 5,
        title: 'Guerra Fria y mundo bipolar (OA8-9, OA11)',
        skill: 'Analizar la Guerra Fria y transformaciones globales',
        keywords: ['guerra fria', 'estados unidos', 'urss', 'bipolaridad', 'carrera armamentista', 'muro de berlin', 'caida del muro', 'neoliberalismo', 'reagan', 'thatcher', 'globalizacion'],
        theoryFocus: [
            'analizar la Guerra Fria como confrontacion ideologica global bipolar',
            'reconocer transformaciones occidentales durante la Guerra Fria (sociedad de consumo, contracultura)',
            'analizar el fin de la Guerra Fria y el auge del neoliberalismo'
        ],
        quizFocus: [
            'bipolaridad EEUU-URSS',
            'conflictos perifericos (Vietnam, Cuba, Corea)',
            'caida del Muro de Berlin',
            'auge del neoliberalismo'
        ]
    },
    {
        id: 'cap6_america_latina_dictaduras',
        chapterNumber: 6,
        title: 'America Latina: movilizacion social y dictaduras (OA10)',
        skill: 'Caracterizar la movilizacion social latinoamericana y las dictaduras militares',
        keywords: ['america latina', 'cuba', 'revolucion cubana', 'fidel castro', 'che guevara', 'plan condor', 'argentina', 'brasil', 'uruguay', 'dictadura', 'desaparecidos'],
        theoryFocus: [
            'caracterizar la movilizacion social latinoamericana de mediados del siglo XX',
            'analizar la Revolucion Cubana como referente regional',
            'examinar las dictaduras militares en el Cono Sur (Argentina, Brasil, Uruguay) y el Plan Condor'
        ],
        quizFocus: [
            'Revolucion Cubana',
            'dictaduras militares latinoamericanas',
            'Plan Condor',
            'movilizacion social y guerrillas'
        ]
    },
    {
        id: 'cap7_chile_60_70_reformas',
        chapterNumber: 7,
        title: 'Chile en los 60 y 70: reformas y crisis (OA13-14)',
        skill: 'Analizar reformas estructurales y crisis previa al golpe',
        keywords: ['eduardo frei montalva', 'reforma agraria', 'salvador allende', 'unidad popular', 'via chilena al socialismo', 'nacionalizacion del cobre', 'crisis economica', 'paro de octubre'],
        theoryFocus: [
            'analizar Chile de los 60: reformas estructurales (Frei Montalva: reforma agraria, chilenizacion del cobre)',
            'estudiar el gobierno de la Unidad Popular y la via chilena al socialismo',
            'analizar la crisis economica, politica y social de inicios de los 70'
        ],
        quizFocus: [
            'reformas de Frei Montalva',
            'Unidad Popular y Allende',
            'nacionalizacion del cobre',
            'crisis de 1972-1973'
        ]
    },
    {
        id: 'cap8_dictadura_chilena',
        chapterNumber: 8,
        title: 'Dictadura militar chilena 1973-1990 (OA15-18)',
        skill: 'Analizar la dictadura militar, DDHH y modelo neoliberal',
        keywords: ['golpe militar 1973', 'pinochet', 'junta militar', 'dina', 'cni', 'detenidos desaparecidos', 'violacion de derechos humanos', 'modelo neoliberal', 'constitucion de 1980', 'chicago boys'],
        theoryFocus: [
            'comparar criticamente interpretaciones sobre el golpe de 1973',
            'explicar la supresion sistematica de DDHH durante la dictadura militar',
            'caracterizar el modelo neoliberal implementado (Chicago Boys) y analizar la institucionalidad de la Constitucion de 1980'
        ],
        quizFocus: [
            'golpe militar de 1973',
            'violaciones a los derechos humanos',
            'modelo neoliberal en dictadura',
            'Constitucion de 1980'
        ]
    },
    {
        id: 'cap9_transicion_democratica',
        chapterNumber: 9,
        title: 'Recuperacion democratica y transicion (OA19-21)',
        skill: 'Explicar la transicion a la democracia y reformas posteriores',
        keywords: ['plebiscito 1988', 'no', 'patricio aylwin', 'concertacion', 'transicion', 'reformas constitucionales', 'comision rettig', 'comision valech', 'memoria', 'justicia transicional'],
        theoryFocus: [
            'explicar los factores de la recuperacion democratica en los 80 (movimientos sociales, oposicion, plebiscito 1988)',
            'analizar la transicion a la democracia y reformas constitucionales',
            'caracterizar la sociedad chilena post-recuperacion democratica (memoria, justicia, desafios)'
        ],
        quizFocus: [
            'plebiscito de 1988',
            'transicion a la democracia',
            'reformas constitucionales',
            'memoria y justicia transicional'
        ]
    },
    {
        id: 'cap10_formacion_ciudadana',
        chapterNumber: 10,
        title: 'Formacion ciudadana: Estado de derecho y DDHH (OA22-25)',
        skill: 'Analizar Estado de derecho, derechos humanos y diversidad',
        keywords: ['derechos humanos', 'declaracion universal', 'estado de derecho', 'division de poderes', 'desigualdad', 'pobreza', 'desarrollo', 'globalizacion', 'discriminacion', 'diversidad', 'interculturalidad'],
        theoryFocus: [
            'analizar el concepto de derechos humanos y su institucionalidad nacional e internacional',
            'explicar los elementos del Estado de derecho y su importancia para la democracia',
            'analizar desafios pendientes para Chile (pobreza, desigualdad, desarrollo) y evaluar la discriminacion en un mundo globalizado'
        ],
        quizFocus: [
            'Declaracion Universal de DDHH',
            'Estado de derecho y division de poderes',
            'desigualdad y desafios sociales',
            'diversidad y no discriminacion'
        ]
    }
];

const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));
const fallbackChapter = CHAPTERS[0];
const fallbackChapter2M = CHAPTERS_2M[0];

// =====================================================================
// CAPITULOS 3° MEDIO — Educacion Ciudadana Plan Comun (OA FG-ECIU-3M-OAC-01 a 08)
// =====================================================================
const CHAPTERS_3M = [
    {
        id: 'cap1_democracia_ciudadania',
        chapterNumber: 1,
        title: 'Democracia, ciudadania y libertades fundamentales (OA1)',
        skill: 'Identificar fundamentos de la democracia y libertades ciudadanas',
        keywords: ['democracia', 'ciudadania', 'libertades', 'derechos', 'estado', 'constitucion', 'sufragio', 'soberania', 'representacion', 'division de poderes', 'contrato social'],
        theoryFocus: [
            'identificar los fundamentos de la democracia y los tipos de ciudadania',
            'reconocer las libertades fundamentales y sus implicancias para los deberes del Estado',
            'analizar el contrato social y las relaciones entre ciudadanos y Estado democratico'
        ],
        quizFocus: ['fundamentos de la democracia', 'libertades fundamentales', 'deberes del Estado', 'derechos ciudadanos']
    },
    {
        id: 'cap2_sistema_judicial',
        chapterNumber: 2,
        title: 'Sistema judicial y acceso a la justicia (OA2)',
        skill: 'Investigar mecanismos de acceso a la justicia y el sistema judicial chileno',
        keywords: ['sistema judicial', 'poder judicial', 'tribunal', 'acceso justicia', 'contraloria', 'recurso de amparo', 'recurso de proteccion', 'garantias procesales', 'ministerio publico'],
        theoryFocus: [
            'investigar mecanismos de acceso a la justicia en Chile a traves de casos de interes publico',
            'comprender la estructura del poder judicial y sus funciones en el Estado de derecho',
            'analizar garantias procesales y mecanismos de proteccion de derechos en Chile'
        ],
        quizFocus: ['estructura del poder judicial', 'recursos de proteccion y amparo', 'acceso a la justicia', 'garantias procesales']
    },
    {
        id: 'cap3_riesgos_democracia',
        chapterNumber: 3,
        title: 'Riesgos para la democracia (OA3)',
        skill: 'Reflexionar sobre amenazas para la democracia en Chile y el mundo',
        keywords: ['apatia politica', 'populismo', 'corrupcion', 'narcotrafico', 'violencia', 'desigualdad', 'polarizacion', 'desinformacion', 'autoritarismo', 'riesgos democracia', 'fake news'],
        theoryFocus: [
            'reflexionar sobre los riesgos para la democracia en Chile y el mundo contemporaneo',
            'analizar fenomenos como la apatia politica, la corrupcion y la polarizacion social',
            'evaluar el rol de la ciudadania activa para sostener la democracia'
        ],
        quizFocus: ['riesgos para la democracia', 'apatia politica', 'corrupcion y transparencia', 'ciudadania activa']
    },
    {
        id: 'cap4_estado_mercado',
        chapterNumber: 4,
        title: 'Estado, mercado y justicia economica (OA4)',
        skill: 'Evaluar la relacion Estado-mercado considerando justicia economica y sostenibilidad',
        keywords: ['estado', 'mercado', 'salario', 'tributacion', 'impuesto', 'comercio justo', 'desigualdad economica', 'productividad', 'sostenibilidad', 'riqueza', 'pobreza', 'gini'],
        theoryFocus: [
            'evaluar la relacion entre Estado y mercado en el contexto chileno y global',
            'analizar temas de salarios justos, productividad, tributacion y comercio justo',
            'considerar la sostenibilidad y distribucion de la riqueza como criterios de justicia economica'
        ],
        quizFocus: ['relacion Estado-mercado', 'politicas tributarias', 'desigualdad economica', 'comercio justo y sostenibilidad']
    },
    {
        id: 'cap5_derechos_humanos',
        chapterNumber: 5,
        title: 'Derechos humanos: universalidad e indivisibilidad (OA5)',
        skill: 'Promover el reconocimiento y defensa de los derechos humanos',
        keywords: ['derechos humanos', 'ddhh', 'universalidad', 'indivisibilidad', 'no discriminacion', 'violaciones ddhh', 'ddhh chile', 'convenios internacionales', 'onu', 'dignidad humana'],
        theoryFocus: [
            'promover el reconocimiento y defensa de los derechos humanos en la vida cotidiana',
            'comprender la universalidad, indivisibilidad y principio de no discriminacion de los DDHH',
            'analizar el sistema internacional de proteccion de derechos humanos'
        ],
        quizFocus: ['Declaracion Universal DDHH', 'principios de universalidad e indivisibilidad', 'no discriminacion', 'sistema internacional de proteccion']
    },
    {
        id: 'cap6_participacion_bien_comun',
        chapterNumber: 6,
        title: 'Participacion ciudadana y bien comun (OA6)',
        skill: 'Reflexionar sobre formas de participacion y su contribucion al bien comun',
        keywords: ['participacion ciudadana', 'bien comun', 'republicanismo', 'liberalismo', 'comunitarismo', 'voto', 'movimientos sociales', 'sociedad civil', 'voluntariado', 'plebiscito'],
        theoryFocus: [
            'reflexionar sobre distintas formas de participacion ciudadana y su impacto en el bien comun',
            'analizar perspectivas filosoficas del bien comun: republicanismo, liberalismo y comunitarismo',
            'evaluar mecanismos formales e informales de participacion en democracia'
        ],
        quizFocus: ['formas de participacion ciudadana', 'republicanismo vs liberalismo', 'bien comun', 'movimientos sociales y participacion']
    },
    {
        id: 'cap7_territorio_justicia_social',
        chapterNumber: 7,
        title: 'Territorio, justicia social y ambiental (OA7)',
        skill: 'Distinguir relaciones politicas, economicas y socioculturales del territorio',
        keywords: ['territorio', 'justicia social', 'justicia ambiental', 'geopolitica', 'recursos naturales', 'pueblos indigenas', 'descentralizacion', 'escala local regional global', 'ordenamiento territorial'],
        theoryFocus: [
            'distinguir relaciones politicas, economicas y socioculturales que configuran el territorio a distintas escalas',
            'analizar desigualdades territoriales y proponer alternativas de justicia social y ambiental',
            'relacionar problemas territoriales con la distribucion de recursos y el ejercicio del poder'
        ],
        quizFocus: ['relaciones territoriales', 'justicia social y ambiental', 'desigualdades territoriales', 'propuestas de justicia territorial']
    },
    {
        id: 'cap8_democracia_escolar',
        chapterNumber: 8,
        title: 'Democracia escolar y convivencia comunitaria (OA8)',
        skill: 'Participar en ejercicios democraticos escolares y construir convivencia sana',
        keywords: ['democracia escolar', 'consejo de curso', 'centro de alumnos', 'convivencia', 'derechos y deberes', 'resolucion de conflictos', 'libertades fundamentales', 'comunidad escolar'],
        theoryFocus: [
            'participar activamente en ejercicios democraticos escolares reconociendo su valor civico',
            'reconocer la importancia de organizar la vida comunitaria para una sana convivencia',
            'aplicar principios democraticos en la resolucion de conflictos y la toma de decisiones'
        ],
        quizFocus: ['democracia escolar', 'convivencia y resolucion de conflictos', 'derechos y deberes estudiantiles', 'participacion comunitaria']
    }
];

const CHAPTERS_BY_ID_3M = Object.fromEntries(CHAPTERS_3M.map((chapter) => [chapter.id, chapter]));
const fallbackChapter3M = CHAPTERS_3M[0];

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaHistoriaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
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
        subject: 'HISTORIA',
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
        if (bestScore > 0) resolutionMode = 'keyword_match';
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_HISTORIA_MATERIAL_ID,
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
            'Usa fuentes historicas, fechas y nombres claves. Cierra con una pregunta tipo PAES/DEMRE de Historia.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben mantener estilo escolar chileno PAES/DEMRE, con interpretacion historica clara y distractores plausibles.',
            'Usa fechas, nombres de personajes y procesos historicos verificables.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: MORALEJA_HISTORIA_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : '',
            moraleja_grade: gradeKey
        }
    };
};

export { MORALEJA_HISTORIA_MATERIAL_ID };
