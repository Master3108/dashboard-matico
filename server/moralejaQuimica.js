import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';

const MORALEJA_QUIMICA_MATERIAL_ID = 'moraleja_quimica_5ed_2025';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_atomo',
        chapterNumber: 1,
        title: 'El atomo',
        skill: 'Estructura atomica, particulas subatomicas, isotopos y clasificacion de la materia',
        keywords: ['atomo', 'particula subatomica', 'proton', 'neutron', 'electron', 'isotopo', 'isobaro', 'isotono', 'numero atomico', 'numero masico', 'masa atomica', 'dalton', 'thomson', 'rutherford', 'bohr', 'mezcla', 'sustancia pura', 'decantacion', 'filtracion', 'tamizado', 'destilacion'],
        theoryFocus: [
            'explicar modelos atomicos clasicos y relacionarlos con evidencias experimentales',
            'distinguir numero atomico, numero masico, isotopos, isobaros e isotones',
            'clasificar materia en sustancias puras y mezclas junto con metodos de separacion'
        ],
        quizFocus: [
            'estructura atomica',
            'calculo de protones, neutrones y electrones',
            'isotopos y masa atomica promedio',
            'mezclas, fases y metodos de separacion'
        ]
    },
    {
        id: 'cap2_tabla_periodica',
        chapterNumber: 2,
        title: 'Tabla periodica',
        skill: 'Configuracion electronica, numeros cuanticos y propiedades periodicas',
        keywords: ['tabla periodica', 'configuracion electronica', 'electron diferencial', 'numero cuantico', 'spin', 'aufbau', 'pauli', 'hund', 'radio atomico', 'radio ionico', 'electronegatividad', 'afinidad electronica', 'energia de ionizacion', 'carga nuclear efectiva', 'gas noble', 'metal', 'no metal'],
        theoryFocus: [
            'construir configuraciones electronicas globales y resumidas',
            'determinar numeros cuanticos y diagramas de orbitales del electron diferencial',
            'comparar radio atomico, electronegatividad, afinidad electronica y energia de ionizacion en periodos y grupos'
        ],
        quizFocus: [
            'configuracion electronica',
            'numeros cuanticos',
            'clasificacion de elementos',
            'tendencias periodicas'
        ]
    },
    {
        id: 'cap3_enlaces_quimicos',
        chapterNumber: 3,
        title: 'Enlaces quimicos',
        skill: 'Enlace ionico, covalente o metalico, polaridad y geometria molecular',
        keywords: ['enlace quimico', 'enlace ionico', 'enlace covalente', 'enlace metalico', 'lewis', 'polaridad', 'momento dipolar', 'geometria molecular', 'vsepr', 'repulsion de pares', 'fuerzas intermoleculares', 'puente de hidrogeno', 'dipolo dipolo', 'london'],
        theoryFocus: [
            'comparar enlaces ionico, covalente y metalico segun transferencia o comparticion de electrones',
            'usar estructuras de Lewis y teoria de repulsion de pares para inferir geometria molecular',
            'relacionar polaridad y fuerzas intermoleculares con propiedades fisicas de sustancias'
        ],
        quizFocus: [
            'tipo de enlace',
            'estructuras de Lewis',
            'geometria molecular',
            'polaridad e interacciones intermoleculares'
        ]
    },
    {
        id: 'cap4_organica_hidrocarburos',
        chapterNumber: 4,
        title: 'Quimica organica I',
        skill: 'Carbono, hibridacion, hidrocarburos e isomeria basica',
        keywords: ['quimica organica', 'carbono', 'tetravalencia', 'hibridacion', 'sp', 'sp2', 'sp3', 'hidrocarburo', 'alcano', 'alqueno', 'alquino', 'aromatico', 'benceno', 'ciclico', 'isomeria', 'isomero', 'formula molecular', 'formula condensada', 'formula esqueletica'],
        theoryFocus: [
            'explicar propiedades del carbono como tetravalencia, catenacion e hibridacion',
            'clasificar hidrocarburos segun cadena y grado de saturacion',
            'reconocer formulas de representacion e isomeria estructural y geometrica'
        ],
        quizFocus: [
            'clasificacion de hidrocarburos',
            'hibridacion del carbono',
            'representaciones organicas',
            'isomeria basica'
        ]
    },
    {
        id: 'cap5_organica_funciones_oxigenadas',
        chapterNumber: 5,
        title: 'Quimica organica II - funciones oxigenadas',
        skill: 'Reconocer, nombrar y relacionar alcoholes, eteres, aldehidos, cetonas, acidos y esteres',
        keywords: ['alcohol', 'eter', 'aldehido', 'cetona', 'acido carboxilico', 'ester', 'fenol', 'funcion oxigenada', 'oxidacion', 'esterificacion', 'iupac organica'],
        theoryFocus: [
            'identificar funciones oxigenadas a partir de formula o nombre',
            'aplicar reglas basicas de nomenclatura organica para compuestos oxigenados',
            'relacionar grupo funcional con propiedades fisicas, quimicas y usos frecuentes'
        ],
        quizFocus: [
            'reconocimiento de grupos funcionales oxigenados',
            'nomenclatura organica',
            'propiedades de alcoholes, aldehidos, cetonas y acidos',
            'sintesis y transformaciones sencillas'
        ]
    },
    {
        id: 'cap6_organica_funciones_nitrogenadas',
        chapterNumber: 6,
        title: 'Quimica organica III',
        skill: 'Aminas, amidas, nitrilos, halogenuros y estereoquimica',
        keywords: ['amina', 'amida', 'nitrilo', 'halogenuro', 'funcion nitrogenada', 'estereoquimica', 'isomeria optica', 'quiral', 'enantiomero', 'diastereomero'],
        theoryFocus: [
            'reconocer funciones nitrogenadas y halogenadas por formula o nombre',
            'aplicar nomenclatura basica de aminas, amidas, nitrilos y halogenuros',
            'introducir estereoquimica e isomeria optica como extension de la estructura organica'
        ],
        quizFocus: [
            'funciones nitrogenadas',
            'halogenuros organicos',
            'nomenclatura organica avanzada',
            'estereoquimica e isomeria optica'
        ]
    },
    {
        id: 'cap7_nomenclatura_inorganica',
        chapterNumber: 7,
        title: 'Nomenclatura inorganica',
        skill: 'Formulacion y nomenclatura de oxidos, hidruros, acidos, hidroxidos y sales',
        keywords: ['nomenclatura inorganica', 'oxido', 'hidruro', 'hidroxido', 'acido', 'sal', 'peroxido', 'numero de oxidacion', 'stock', 'tradicional', 'sistematica'],
        theoryFocus: [
            'calcular numeros de oxidacion y usarlos para formular compuestos inorganicos',
            'nombrar oxidos, hidruros, acidos, hidroxidos y sales en nomenclatura stock, tradicional o sistematica',
            'distinguir familias de compuestos inorganicos segun composicion y comportamiento'
        ],
        quizFocus: [
            'numero de oxidacion',
            'formulacion inorganica',
            'nomenclatura stock y tradicional',
            'clasificacion de compuestos inorganicos'
        ]
    },
    {
        id: 'cap8_reacciones_estequiometria',
        chapterNumber: 8,
        title: 'Reacciones quimicas y estequiometria',
        skill: 'Balance, leyes ponderales, mol, reactivo limitante y rendimiento',
        keywords: ['reaccion quimica', 'balance', 'estequiometria', 'mol', 'masa molar', 'reactivo limitante', 'reactivo en exceso', 'rendimiento', 'ley de lavoisier', 'ley de proust', 'ley de dalton', 'combustion', 'neutralizacion', 'redox'],
        theoryFocus: [
            'clasificar tipos de reacciones y balancear ecuaciones quimicas',
            'aplicar leyes ponderales y relaciones mol masa volumen en calculos estequiometricos',
            'resolver problemas con reactivo limitante, rendimiento porcentual y equivalentes quimicos'
        ],
        quizFocus: [
            'balance de ecuaciones',
            'calculos mol masa volumen',
            'reactivo limitante y rendimiento',
            'interpretacion cuantitativa de reacciones'
        ]
    },
    {
        id: 'cap9_soluciones',
        chapterNumber: 9,
        title: 'Soluciones',
        skill: 'Concentraciones, diluciones, solubilidad y disociacion electrolitica',
        keywords: ['solucion', 'soluto', 'solvente', 'molaridad', 'molalidad', 'normalidad', 'fraccion molar', 'ppm', 'porcentaje m m', 'porcentaje m v', 'porcentaje v v', 'dilucion', 'solubilidad', 'electrolito', 'van t hoff'],
        theoryFocus: [
            'distinguir tipos de soluciones y formas de expresar concentracion',
            'resolver ejercicios de molaridad, molalidad, normalidad, porcentaje y dilucion',
            'relacionar solubilidad con temperatura, presion, naturaleza de sustancias y disociacion electrolitica'
        ],
        quizFocus: [
            'calculo de concentraciones',
            'mezclas y diluciones',
            'solubilidad y curvas',
            'electrolitos y factor de van t hoff'
        ]
    },
    {
        id: 'cap10_gases_propiedades_coligativas',
        chapterNumber: 10,
        title: 'Gases y propiedades coligativas',
        skill: 'Leyes de los gases, gas ideal, presion osmotica y variaciones de ebullicion o congelacion',
        keywords: ['gas', 'boyle', 'charles', 'gay lussac', 'gas ideal', 'pv nrt', 'presion', 'volumen', 'temperatura', 'propiedades coligativas', 'presion de vapor', 'ebulloscopico', 'crioscopico', 'osmosis', 'presion osmotica', 'raoult'],
        theoryFocus: [
            'aplicar relaciones entre presion, volumen, temperatura y cantidad de gas',
            'resolver problemas con ley combinada y ecuacion de gases ideales',
            'explicar descenso de presion de vapor, ascenso ebulloscopico, descenso crioscopico y presion osmotica'
        ],
        quizFocus: [
            'leyes de los gases',
            'ecuacion del gas ideal',
            'propiedades coligativas',
            'osmosis y presion osmotica'
        ]
    }
];

const fallbackChapter = CHAPTERS.find((chapter) => chapter.id === 'cap8_reacciones_estequiometria');
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaQuimicaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const sessionReference = resolveMoralejaSessionReference({
        subject: 'QUIMICA',
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
        } else if (numericSession >= 1 && numericSession <= 8) {
            bestChapter = CHAPTERS_BY_ID.cap1_atomo;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 9 && numericSession <= 14) {
            bestChapter = CHAPTERS_BY_ID.cap2_tabla_periodica;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 15 && numericSession <= 18) {
            bestChapter = CHAPTERS_BY_ID.cap3_enlaces_quimicos;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 19 && numericSession <= 24) {
            bestChapter = CHAPTERS_BY_ID.cap4_organica_hidrocarburos;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 25 && numericSession <= 30) {
            bestChapter = CHAPTERS_BY_ID.cap5_organica_funciones_oxigenadas;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 31 && numericSession <= 34) {
            bestChapter = CHAPTERS_BY_ID.cap6_organica_funciones_nitrogenadas;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 35 && numericSession <= 37) {
            bestChapter = CHAPTERS_BY_ID.cap7_nomenclatura_inorganica;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 38 && numericSession <= 42) {
            bestChapter = CHAPTERS_BY_ID.cap8_reacciones_estequiometria;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 43 && numericSession <= 45) {
            bestChapter = CHAPTERS_BY_ID.cap9_soluciones;
            resolutionMode = 'session_range_fallback';
        } else if (numericSession >= 46) {
            bestChapter = CHAPTERS_BY_ID.cap10_gases_propiedades_coligativas;
            resolutionMode = 'session_range_fallback';
        } else if (
            normalizedTopic.includes('atom') ||
            normalizedTopic.includes('bohr') ||
            normalizedTopic.includes('rutherford') ||
            normalizedTopic.includes('isotop') ||
            normalizedTopic.includes('numero atomico')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap1_atomo;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('configuracion electronica') ||
            normalizedTopic.includes('numero cuantico') ||
            normalizedTopic.includes('tabla periodica') ||
            normalizedTopic.includes('electronegativ') ||
            normalizedTopic.includes('radio atom')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap2_tabla_periodica;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('enlace') ||
            normalizedTopic.includes('lewis') ||
            normalizedTopic.includes('geometria molecular') ||
            normalizedTopic.includes('polaridad')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap3_enlaces_quimicos;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('hidrocarburo') ||
            normalizedTopic.includes('alcano') ||
            normalizedTopic.includes('alqueno') ||
            normalizedTopic.includes('alquino') ||
            normalizedTopic.includes('hibridacion')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap4_organica_hidrocarburos;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('alcohol') ||
            normalizedTopic.includes('aldehido') ||
            normalizedTopic.includes('cetona') ||
            normalizedTopic.includes('acido carboxilico') ||
            normalizedTopic.includes('ester')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap5_organica_funciones_oxigenadas;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('amina') ||
            normalizedTopic.includes('amida') ||
            normalizedTopic.includes('nitrilo') ||
            normalizedTopic.includes('estereoquim')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap6_organica_funciones_nitrogenadas;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('nomenclatura inorganica') ||
            normalizedTopic.includes('numero de oxidacion') ||
            normalizedTopic.includes('oxido') ||
            normalizedTopic.includes('hidroxido') ||
            normalizedTopic.includes('sal')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap7_nomenclatura_inorganica;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('estequi') ||
            normalizedTopic.includes('reactivo limitante') ||
            normalizedTopic.includes('balance') ||
            normalizedTopic.includes('mol') ||
            normalizedTopic.includes('rendimiento')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap8_reacciones_estequiometria;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('solucion') ||
            normalizedTopic.includes('molaridad') ||
            normalizedTopic.includes('molalidad') ||
            normalizedTopic.includes('normalidad') ||
            normalizedTopic.includes('dilucion') ||
            normalizedTopic.includes('ppm')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap9_soluciones;
            resolutionMode = 'topic_hint_fallback';
        } else if (
            normalizedTopic.includes('gases') ||
            normalizedTopic.includes('boyle') ||
            normalizedTopic.includes('charles') ||
            normalizedTopic.includes('gay lussac') ||
            normalizedTopic.includes('osm') ||
            normalizedTopic.includes('coligativa')
        ) {
            bestChapter = CHAPTERS_BY_ID.cap10_gases_propiedades_coligativas;
            resolutionMode = 'topic_hint_fallback';
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_QUIMICA_MATERIAL_ID,
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
            'Cierra conectando el contenido con una relacion cuantitativa, una comparacion conceptual o una pregunta tipo PAES segun corresponda.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben mantener estilo escolar chileno PAES/DEMRE, con distractores plausibles y consistencia quimica correcta.',
            'Si hay calculos, el enunciado debe entregar los datos necesarios y permitir resolver sin ambiguedades.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: MORALEJA_QUIMICA_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_QUIMICA_MATERIAL_ID };
