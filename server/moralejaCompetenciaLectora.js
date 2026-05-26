import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';
const MORALEJA_MATERIAL_ID = 'moraleja_competencia_lectora_6ed_2025';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const CHAPTERS = [
    {
        id: 'cap1_coherencia_cohesion',
        chapterNumber: 1,
        title: 'Introduccion a la comprension lectora',
        skill: 'Coherencia y cohesion textual',
        keywords: ['coherencia', 'cohesion', 'referente', 'referentes', 'correferencia', 'elipsis', 'mecanismos de cohesion'],
        theoryFocus: [
            'Distinguir coherencia como sentido global del texto y cohesion como enlaces linguisticos internos.',
            'Reconocer mecanismos de cohesion: sustitucion sinonimica, frase nominal, pronombres, adverbios, adjetivos y elipsis.',
            'Explicar como seguir referentes mejora la comprension y evita errores de interpretacion.'
        ],
        procedures: [
            'Primero identificar el eje tematico del texto.',
            'Luego rastrear a que palabra o idea alude cada referente.',
            'Finalmente verificar como esos enlaces sostienen la progresion del texto.'
        ],
        quizFocus: [
            'identificacion de referentes',
            'correferencia pronominal y lexical',
            'elipsis y continuidad tematica'
        ]
    },
    {
        id: 'cap2_info_explicita',
        chapterNumber: 2,
        title: 'Extraer e identificar informacion explicita',
        skill: 'Localizar informacion explicita',
        keywords: ['informacion explicita', 'literal', 'localizar', 'rastreo', 'sinonimos', 'parafrasis', 'vocabulario contextual'],
        theoryFocus: [
            'Diferenciar explicitamente entre informacion explicita e implicita.',
            'Ensenar el procedimiento de rastreo: leer texto, analizar pregunta, buscar referente y contrastar alternativas.',
            'Mostrar como una respuesta correcta puede aparecer parafraseada y no copiada literal.'
        ],
        procedures: [
            'Leer el texto completo antes de responder.',
            'Subrayar referente, verbo y condicion de la pregunta.',
            'Buscar la informacion pertinente y compararla con cada alternativa.'
        ],
        quizFocus: [
            'localizacion de datos literales',
            'sinonimos y parafrasis',
            'verificacion de alternativas'
        ]
    },
    {
        id: 'cap3_sintesis',
        chapterNumber: 3,
        title: 'Sintesis local y global',
        skill: 'Sintetizar tema e idea principal',
        keywords: ['sintesis', 'idea principal', 'tema', 'macroestructura', 'macrorreglas', 'generalizacion', 'supresion', 'seleccion'],
        theoryFocus: [
            'Diferenciar tema, idea principal y contenido fundamental.',
            'Aplicar macrorreglas de seleccion, supresion y generalizacion.',
            'Ensenar a pasar de datos especificos a una formulacion sintetica fiel al texto.'
        ],
        procedures: [
            'Preguntar de que se habla para hallar el tema.',
            'Preguntar que se dice sobre ese tema para hallar la idea principal.',
            'Suprimir detalles accidentales y generalizar ideas semejantes.'
        ],
        quizFocus: [
            'tema e idea principal',
            'titulo adecuado',
            'sintesis de parrafos y textos'
        ]
    },
    {
        id: 'cap4_propositos_relaciones',
        chapterNumber: 4,
        title: 'Propositos comunicativos y relaciones discursivas',
        skill: 'Determinar propositos y relaciones entre partes del discurso',
        keywords: ['proposito', 'proposito comunicativo', 'relaciones discursivas', 'hecho vs opinion', 'prensa', 'publicidad', 'propaganda', 'medios', 'argumentacion'],
        theoryFocus: [
            'Reconocer intenciones comunicativas como informar, explicar, persuadir, exhortar, narrar o reflexionar.',
            'Analizar relaciones entre parrafos, conectores, recursos verbales y visuales.',
            'Vincular el analisis del lenguaje verbal con imagenes, infografias y elementos multimodales.'
        ],
        procedures: [
            'Observar verbo dominante, tono y tipo de informacion entregada.',
            'Relacionar cada parrafo con el anterior: causa, consecuencia, contraste, ejemplificacion o profundizacion.',
            'Explicar la funcion de citas, comillas, imagenes y recursos graficos.'
        ],
        quizFocus: [
            'proposito comunicativo',
            'relacion entre parrafos',
            'funcion de recursos verbales y visuales'
        ]
    },
    {
        id: 'cap5_inferencia',
        chapterNumber: 5,
        title: 'Inferencia local y global',
        skill: 'Inferir informacion implicita',
        keywords: ['inferencia', 'implicit', 'implicita', 'tono', 'ambiente', 'estado de animo', 'vision de mundo', 'interpretacion'],
        theoryFocus: [
            'Explicar que inferir es construir significado a partir de pistas textuales.',
            'Distinguir inferencia local y global: desde una frase hasta la postura general del texto.',
            'Evitar respuestas inventadas: toda inferencia debe justificarse con huellas del texto.'
        ],
        procedures: [
            'Ubicar la pista textual clave.',
            'Relacionarla con conocimientos linguisticos o contextuales pertinentes.',
            'Formular una conclusion breve y verificable.'
        ],
        quizFocus: [
            'estado de animo y tono',
            'conclusiones implicitas',
            'proyeccion de sentido global'
        ]
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA LE2M 01-24)
// 4 ejes: Lectura, Escritura, Comunicacion Oral, Investigacion
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_narrativa',
        chapterNumber: 1,
        title: 'Lectura literaria: narrativa contemporanea y latinoamericana (OA3, OA7-8)',
        skill: 'Analizar narraciones e interpretar cuentos latinoamericanos',
        keywords: ['narrador', 'cuento', 'novela', 'conflicto', 'personaje', 'estructura narrativa', 'simbolo', 'recurso literario', 'latinoamericano', 'boom'],
        theoryFocus: [
            'Analizar narraciones considerando conflictos, personajes, estructura, perspectiva del narrador, simbolos y recursos literarios.',
            'Leer y comprender cuentos latinoamericanos modernos y contemporaneos.',
            'Formular interpretaciones coherentes con punto de vista personal e historico.'
        ],
        procedures: [
            'Identificar conflicto central, personajes y tipo de narrador.',
            'Reconocer simbolos y recursos literarios (metafora, prolepsis, etc.).',
            'Construir interpretacion fundamentada en evidencia textual.'
        ],
        quizFocus: [
            'analisis de personajes y conflicto',
            'tipo de narrador y perspectiva',
            'simbolos y recursos literarios',
            'interpretacion contextual del cuento latinoamericano'
        ]
    },
    {
        id: 'cap2_lirica',
        chapterNumber: 2,
        title: 'Lectura literaria: poesia y soneto (OA4)',
        skill: 'Analizar poemas considerando lenguaje figurado y formas estroficas',
        keywords: ['poesia', 'soneto', 'hablante lirico', 'simbolo', 'lenguaje figurado', 'metafora', 'rima', 'verso', 'estrofa', 'repeticion'],
        theoryFocus: [
            'Analizar poemas considerando simbolos, actitud del hablante, lenguaje figurado y repeticiones.',
            'Reconocer caracteristicas del soneto (estructura 4-4-3-3, endecasilabos, rima).',
            'Interpretar el sentido global del poema relacionando forma y contenido.'
        ],
        procedures: [
            'Identificar al hablante lirico y su actitud.',
            'Reconocer figuras literarias y su funcion expresiva.',
            'Analizar metrica y rima en el soneto.'
        ],
        quizFocus: [
            'figuras literarias y simbolos',
            'actitud del hablante lirico',
            'estructura del soneto',
            'interpretacion del poema'
        ]
    },
    {
        id: 'cap3_drama',
        chapterNumber: 3,
        title: 'Lectura literaria: texto dramatico y teatro (OA5)',
        skill: 'Analizar textos dramaticos y elementos de puesta en escena',
        keywords: ['drama', 'teatro', 'dialogo', 'acto', 'escena', 'acotacion', 'conflicto dramatico', 'puesta en escena', 'tragedia', 'comedia'],
        theoryFocus: [
            'Analizar textos dramaticos examinando conflicto, personajes, simbolos y atmosfera.',
            'Reconocer elementos de puesta en escena (acotaciones, dialogos, monologos).',
            'Distinguir generos dramaticos (tragedia, comedia, drama moderno).'
        ],
        procedures: [
            'Identificar conflicto dramatico central.',
            'Analizar funcion de las acotaciones.',
            'Reconocer atmosfera y simbolos escenicos.'
        ],
        quizFocus: [
            'conflicto dramatico',
            'estructura del texto teatral',
            'funcion de acotaciones',
            'puesta en escena'
        ]
    },
    {
        id: 'cap4_siglo_oro',
        chapterNumber: 4,
        title: 'Literatura del Siglo de Oro (OA6)',
        skill: 'Comprender obras del Siglo de Oro en contexto historico-cultural',
        keywords: ['siglo de oro', 'cervantes', 'quijote', 'lope de vega', 'gongora', 'quevedo', 'barroco', 'renacimiento', 'picaresca', 'lazarillo'],
        theoryFocus: [
            'Comprender la relevancia de obras del Siglo de Oro espanol.',
            'Caracterizar el contexto historico-cultural (Renacimiento, Barroco) que las origina.',
            'Reconocer aportes a la literatura universal (novela moderna, picaresca, comedia nueva).'
        ],
        procedures: [
            'Contextualizar la obra en su epoca historica.',
            'Identificar elementos esteticos del Renacimiento o Barroco.',
            'Relacionar la obra con su autor y legado.'
        ],
        quizFocus: [
            'autores del Siglo de Oro',
            'caracteristicas Renacimiento vs Barroco',
            'Cervantes y la novela moderna',
            'picaresca y comedia nueva'
        ]
    },
    {
        id: 'cap5_argumentacion',
        chapterNumber: 5,
        title: 'Argumentacion: columnas, cartas y ensayos (OA9)',
        skill: 'Analizar y evaluar textos argumentativos',
        keywords: ['argumentacion', 'tesis', 'argumento', 'columna', 'carta al director', 'ensayo', 'persuasion', 'recurso retorico', 'contraargumento', 'evidencia'],
        theoryFocus: [
            'Analizar y evaluar textos argumentativos como columnas, cartas y ensayos.',
            'Examinar tesis y recursos persuasivos (ethos, pathos, logos).',
            'Distinguir argumentos solidos de falacias.'
        ],
        procedures: [
            'Identificar tesis central del texto.',
            'Mapear argumentos, contraargumentos y refutaciones.',
            'Evaluar validez y efectividad persuasiva.'
        ],
        quizFocus: [
            'identificacion de tesis',
            'tipos de argumentos',
            'recursos persuasivos',
            'deteccion de falacias'
        ]
    },
    {
        id: 'cap6_medios_persuasion',
        chapterNumber: 6,
        title: 'Textos mediaticos y persuasion (OA10)',
        skill: 'Analizar textos mediaticos y estrategias de persuasion',
        keywords: ['medios', 'publicidad', 'propaganda', 'noticia', 'reportaje', 'estrategia persuasiva', 'multimodal', 'recurso visual', 'manipulacion', 'critica de medios'],
        theoryFocus: [
            'Analizar textos mediaticos evaluando propositos y estrategias de persuasion.',
            'Evaluar efectos de recursos linguisticos y visuales.',
            'Desarrollar lectura critica de prensa, publicidad y medios digitales.'
        ],
        procedures: [
            'Identificar el proposito del texto mediatico.',
            'Analizar recursos verbales y visuales.',
            'Detectar sesgos y estrategias de manipulacion.'
        ],
        quizFocus: [
            'propositos en medios',
            'estrategias de persuasion',
            'multimodalidad',
            'lectura critica de prensa y publicidad'
        ]
    },
    {
        id: 'cap7_no_literarios',
        chapterNumber: 7,
        title: 'Textos no literarios para contextualizar (OA1-2, OA11)',
        skill: 'Leer textos no literarios para enriquecer experiencia lectora',
        keywords: ['no literario', 'articulo', 'biografia', 'cronica', 'contexto', 'experiencia humana', 'lectura habitual', 'recreacion'],
        theoryFocus: [
            'Leer habitualmente para aprender y recrearse, seleccionando textos segun preferencias.',
            'Reflexionar sobre dimensiones de la experiencia humana a partir de lecturas.',
            'Leer y comprender textos no literarios para contextualizar lecturas literarias.'
        ],
        procedures: [
            'Seleccionar textos segun proposito y preferencia.',
            'Vincular contenido del texto con experiencias propias o sociales.',
            'Usar textos no literarios como contexto para obras literarias.'
        ],
        quizFocus: [
            'comprension de textos no literarios',
            'reflexion sobre experiencia humana',
            'lectura como practica habitual',
            'contextualizacion historico-cultural'
        ]
    },
    {
        id: 'cap8_escritura_explicativa',
        chapterNumber: 8,
        title: 'Escritura: textos explicativos (OA12-13)',
        skill: 'Escribir textos explicativos con claridad y coherencia',
        keywords: ['escritura', 'texto explicativo', 'explicacion', 'organizacion', 'coherencia', 'ejemplo', 'evidencia', 'investigacion previa', 'genero'],
        theoryFocus: [
            'Aplicar flexiblemente habilidades de escritura en nuevos generos, investigando caracteristicas.',
            'Escribir textos explicativos con presentacion clara y organizacion coherente.',
            'Incluir ejemplos y evidencias que sustenten la explicacion.'
        ],
        procedures: [
            'Investigar caracteristicas del genero antes de escribir.',
            'Organizar contenido en introduccion, desarrollo y cierre.',
            'Incluir ejemplos concretos y evidencias.'
        ],
        quizFocus: [
            'estructura del texto explicativo',
            'organizacion coherente',
            'uso de ejemplos y evidencias',
            'caracteristicas de generos textuales'
        ]
    },
    {
        id: 'cap9_escritura_argumentativa',
        chapterNumber: 9,
        title: 'Escritura: ensayos persuasivos y proceso (OA14-18)',
        skill: 'Planificar, escribir, revisar y editar ensayos argumentativos',
        keywords: ['ensayo', 'persuasivo', 'hipotesis', 'evidencia', 'contraargumento', 'planificacion', 'revision', 'edicion', 'ortografia', 'puntuacion', 'estilo directo', 'estilo indirecto', 'frase nominal'],
        theoryFocus: [
            'Escribir ensayos persuasivos sobre temas literarios con hipotesis, evidencias y contraargumentos.',
            'Planificar, escribir, revisar y editar adecuando registro, coherencia y correccion ortografica.',
            'Usar consistentemente estilo directo/indirecto, frases nominales complejas y ortografia/puntuacion correctas.'
        ],
        procedures: [
            'Planificar el texto: tesis, evidencias, contraargumentos.',
            'Escribir, revisar y editar el texto en varias pasadas.',
            'Aplicar reglas ortograficas, puntuacion y registro adecuado.'
        ],
        quizFocus: [
            'estructura del ensayo persuasivo',
            'uso de contraargumentos',
            'proceso de escritura (planificar/revisar/editar)',
            'ortografia y puntuacion'
        ]
    },
    {
        id: 'cap10_oralidad_investigacion',
        chapterNumber: 10,
        title: 'Comunicacion oral e investigacion (OA19-24)',
        skill: 'Comprender y producir comunicacion oral, e investigar con fuentes confiables',
        keywords: ['oralidad', 'exposicion', 'dialogo', 'debate', 'audiencia', 'recurso paralinguistico', 'fuente confiable', 'investigacion', 'delimitar tema', 'cita'],
        theoryFocus: [
            'Comprender y evaluar textos orales y audiovisuales (postura, contexto, persuasion).',
            'Dialogar constructivamente y expresarse frente a audiencias con progresion tematica.',
            'Realizar investigaciones delimitando temas, seleccionando fuentes confiables y comunicando hallazgos.'
        ],
        procedures: [
            'Escuchar activamente: tomar notas, identificar tesis y argumentos.',
            'Preparar exposiciones con apoyo visual y estructura clara.',
            'Investigar delimitando tema, evaluando fuentes y citando correctamente.'
        ],
        quizFocus: [
            'evaluacion de exposiciones orales',
            'dialogo constructivo',
            'recursos paralinguisticos y no verbales',
            'investigacion con fuentes confiables'
        ]
    }
];

const fallbackChapter = CHAPTERS[4];
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[4];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

const scoreChapter = (chapter, normalizedTopic) => {
    return chapter.keywords.reduce((score, keyword) => {
        return normalizedTopic.includes(keyword) ? score + 1 : score;
    }, 0);
};

export const resolveMoralejaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'LENGUAJE',
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
            if (numericSession >= 21 && numericSession <= 29) {
                bestChapter = CHAPTERS[3];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 43) {
                bestChapter = CHAPTERS[1];
                resolutionMode = 'session_range_fallback';
            } else if (
                normalizedTopic.includes('narrador') ||
                normalizedTopic.includes('narrativa') ||
                normalizedTopic.includes('terror') ||
                normalizedTopic.includes('drama') ||
                normalizedTopic.includes('tragedia') ||
                normalizedTopic.includes('literatura')
            ) {
                bestChapter = CHAPTERS[4];
                resolutionMode = 'topic_hint_fallback';
            }
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_MATERIAL_ID,
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
            `Enfoca la explicacion en: ${bestChapter.theoryFocus.join(' ')}`,
            `Procedimiento sugerido: ${bestChapter.procedures.join(' ')}`
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza preguntas sobre ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben parecerse a ejercicios de competencia lectora estilo PAES/DEMRE: claras, justificables y centradas en evidencia textual.',
            'Si pides inferencia o sintesis, la explicacion debe nombrar la pista textual o el procedimiento que la sustenta.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: MORALEJA_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_MATERIAL_ID };
