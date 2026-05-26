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
    return '1medio';
};

// =====================================================================
// CAPITULOS 1° MEDIO (placeholder — el catalogo Mineduc 1° medio usa
// los mismos contenidos de "siglo XX" que ahora estan correctamente
// asignados a 2° medio. Mantener este array vacio significa que
// 1° medio cae al fallback generico y no rompe nada).
// =====================================================================
const CHAPTERS = [];

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
const fallbackChapter2M = CHAPTERS_2M[0];

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

export const resolveMoralejaHistoriaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';

    // Solo hay CHAPTERS para 2° medio; en 1° medio no hay catalogo aun
    if (!is2M) {
        return null;
    }

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'HISTORIA',
        session: numericSession,
        grade: gradeKey
    });

    let bestChapter = fallbackChapter2M;
    let bestScore = -1;
    let resolutionMode = 'fallback';

    if (sessionReference?.chapterId && CHAPTERS_BY_ID_2M[sessionReference.chapterId]) {
        bestChapter = CHAPTERS_BY_ID_2M[sessionReference.chapterId];
        resolutionMode = 'session_map';
    } else {
        for (const chapter of CHAPTERS_2M) {
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
