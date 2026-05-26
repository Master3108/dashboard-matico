const createRangeEntries = (start, end, entryFactory) => {
    const entries = {};
    for (let session = start; session <= end; session += 1) {
        entries[session] = typeof entryFactory === 'function'
            ? entryFactory(session)
            : { ...entryFactory };
    }
    return entries;
};

const LANGUAGE_SESSION_MAP = {
    ...createRangeEntries(1, 12, {
        chapterId: 'cap5_inferencia',
        focus: 'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'
    }),
    13: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'reconocer proposito comunicativo, opinion y relaciones argumentativas en prensa'
    },
    14: {
        chapterId: 'cap5_inferencia',
        focus: 'inferir conflicto tragico, vision de mundo y rasgos del discurso dramatico'
    },
    15: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'analizar ensayo, tesis, proposito y recursos multimodales o audiovisuales'
    },
    16: {
        chapterId: 'cap3_sintesis',
        focus: 'integrar y sintetizar aprendizajes semestrales en clave PAES'
    },
    17: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'reconocer estructura interna y funcion de partes en textos dramaticos'
    },
    18: {
        chapterId: 'cap5_inferencia',
        focus: 'inferir vision de mundo, tension tragica y sentido simbolico'
    },
    19: {
        chapterId: 'cap5_inferencia',
        focus: 'inferir evolucion psicologica y funcion de personajes'
    },
    20: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'evaluar critica de obra, intencion valorativa y articulacion de argumentos'
    },
    ...createRangeEntries(21, 32, {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'
    }),
    ...createRangeEntries(33, 38, {
        chapterId: 'cap5_inferencia',
        focus: 'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'
    }),
    39: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'interpretar poesia visual considerando relacion entre lenguaje verbal y disposicion grafica'
    },
    40: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'leer narrativa grafica y recursos multimodales como imagen, encuadre y secuencia'
    },
    41: {
        chapterId: 'cap3_sintesis',
        focus: 'condensar ideas y producir sintesis breves con precision narrativa'
    },
    42: {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'organizar oralidad, intencion comunicativa y estrategias de exposicion'
    },
    43: {
        chapterId: 'cap2_info_explicita',
        focus: 'aplicar estrategia PAES de rastreo, localizacion y descarte con evidencia textual'
    },
    44: {
        chapterId: 'cap2_info_explicita',
        focus: 'resolver vocabulario contextual mediante sinonimos, parafrasis y contexto inmediato'
    },
    45: {
        chapterId: 'cap5_inferencia',
        focus: 'integrar habilidades PAES de inferencia, sintesis y justificacion'
    },
    46: {
        chapterId: 'cap3_sintesis',
        focus: 'cerrar el proceso anual sintetizando aprendizajes y estrategias lectoras'
    }
};

const MATH_SESSION_MAP = {
    ...createRangeEntries(1, 3, {
        chapterId: 'cap2_racionales',
        focus: 'trabajar numeros racionales, conversiones y operatoria con fracciones o decimales'
    }),
    ...createRangeEntries(4, 6, {
        chapterId: 'cap4_reales',
        focus: 'construir base de potencias, exponentes y propiedades dentro de numeros reales'
    }),
    7: {
        chapterId: 'cap8_potencias_raices',
        focus: 'modelar crecimiento exponencial y leer regularidades de potencias'
    },
    ...createRangeEntries(8, 9, {
        chapterId: 'cap8_potencias_raices',
        focus: 'resolver raices y operatoria radical con procedimiento claro'
    }),
    10: {
        chapterId: 'cap3_porcentaje_finanzas',
        focus: 'aplicar porcentajes y variaciones en situaciones cotidianas'
    },
    ...createRangeEntries(11, 16, {
        chapterId: 'cap5_algebra',
        focus: 'traducir, desarrollar y factorizar expresiones algebraicas'
    }),
    ...createRangeEntries(17, 22, {
        chapterId: 'cap7_ecuaciones',
        focus: 'resolver ecuaciones, sistemas y problemas de planteamiento'
    }),
    ...createRangeEntries(23, 24, {
        chapterId: 'cap11_funcion_lineal',
        focus: 'leer y construir funcion lineal, afin, pendiente e interpretacion grafica'
    }),
    ...createRangeEntries(25, 34, {
        chapterId: 'cap13_geometria',
        focus: 'trabajar geometria, transformaciones, semejanza, vectores y recta en el plano'
    }),
    ...createRangeEntries(35, 46, {
        chapterId: 'cap14_datos_probabilidad',
        focus: 'analizar datos, medidas estadisticas, conteo y probabilidad'
    })
};

const BIOLOGY_SESSION_MAP = {
    ...createRangeEntries(1, 12, {
        chapterId: 'cap9_evolucion_biodiversidad',
        focus: 'trabajar evidencias evolutivas, seleccion natural, biodiversidad y relaciones filogeneticas'
    }),
    13: {
        chapterId: 'cap11_ecologia_poblaciones',
        focus: 'analizar atributos de poblacion como densidad, distribucion y dinamica demografica'
    },
    ...createRangeEntries(14, 22, {
        chapterId: 'cap11_ecologia_poblaciones',
        focus: 'estudiar organizacion ecologica, poblaciones, crecimiento e interacciones biologicas'
    }),
    23: {
        chapterId: 'cap3_quimica_vida',
        focus: 'comprender metabolismo celular, ATP y reacciones anabolicas o catabolicas'
    },
    ...createRangeEntries(24, 35, {
        chapterId: 'cap10_materia_flujo_energia',
        focus: 'explicar fotosintesis, respiracion, cadenas troficas, piramides y ciclos biogeoquimicos'
    }),
    ...createRangeEntries(36, 46, {
        chapterId: 'cap12_sustentabilidad',
        focus: 'relacionar impacto antropogenico, cambio climatico, huella ecologica y conservacion'
    })
};

const CHEMISTRY_SESSION_MAP = {
    ...createRangeEntries(1, 8, {
        chapterId: 'cap1_atomo',
        focus: 'trabajar estructura atomica, isotopos, masa atomica y clasificacion de la materia'
    }),
    ...createRangeEntries(9, 14, {
        chapterId: 'cap2_tabla_periodica',
        focus: 'analizar configuracion electronica, numeros cuanticos y propiedades periodicas'
    }),
    ...createRangeEntries(15, 18, {
        chapterId: 'cap3_enlaces_quimicos',
        focus: 'relacionar enlaces, estructuras de Lewis, geometria molecular y polaridad'
    }),
    ...createRangeEntries(19, 24, {
        chapterId: 'cap4_organica_hidrocarburos',
        focus: 'estudiar carbono, hibridacion, hidrocarburos e isomeria organica'
    }),
    ...createRangeEntries(25, 30, {
        chapterId: 'cap5_organica_funciones_oxigenadas',
        focus: 'reconocer funciones oxigenadas, nomenclatura organica y propiedades asociadas'
    }),
    ...createRangeEntries(31, 34, {
        chapterId: 'cap6_organica_funciones_nitrogenadas',
        focus: 'trabajar funciones nitrogenadas, halogenuros y estereoquimica'
    }),
    ...createRangeEntries(35, 37, {
        chapterId: 'cap7_nomenclatura_inorganica',
        focus: 'formular y nombrar compuestos inorganicos con numero de oxidacion'
    }),
    ...createRangeEntries(38, 42, {
        chapterId: 'cap8_reacciones_estequiometria',
        focus: 'resolver balance, mol, reactivo limitante y rendimiento en reacciones quimicas'
    }),
    ...createRangeEntries(43, 45, {
        chapterId: 'cap9_soluciones',
        focus: 'calcular concentraciones, diluciones y solubilidad en soluciones quimicas'
    }),
    46: {
        chapterId: 'cap10_gases_propiedades_coligativas',
        focus: 'aplicar leyes de los gases y propiedades coligativas como osmosis o descenso crioscopico'
    }
};

const PHYSICS_SESSION_MAP = {
    ...createRangeEntries(1, 13, {
        chapterId: 'cap1_ondas_sonido',
        focus: 'trabajar ondas y sonido: clasificacion, magnitudes, propagacion y fenomenos ondulatorios'
    }),
    ...createRangeEntries(14, 25, {
        chapterId: 'cap2_luz_optica',
        focus: 'analizar optica geometrica: reflexion, refraccion, lentes, espejos y fenomenos de la luz'
    }),
    ...createRangeEntries(26, 33, {
        chapterId: 'cap3_sismos_dinamica_terrestre',
        focus: 'explicar dinamica terrestre y sismos: tectonica, ondas sismicas, hipocentro y escalas'
    }),
    ...createRangeEntries(34, 41, {
        chapterId: 'cap4_universo_gravitacion',
        focus: 'interpretar universo y gravitacion: expansion cosmica, sistema solar y leyes de kepler'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap5_fisica_moderna_aplicaciones',
        focus: 'integrar fisica moderna y aplicaciones tecnologicas con enfoque de cierre de proceso'
    })
};

// =====================================================================
// MAPS 2\u00b0 MEDIO \u2014 MINEDUC OFICIAL (Decreto 19/2019)
// Mapeo session -> chapterId basado en OA oficiales de curriculumnacional.cl
// =====================================================================

const LANGUAGE_2M_SESSION_MAP = {
    ...createRangeEntries(1, 7, {
        chapterId: 'cap1_narrativa',
        focus: 'analizar narraciones: conflictos, personajes, estructura, perspectiva del narrador, simbolos y recursos literarios (cuento y novela latinoamericana)'
    }),
    ...createRangeEntries(8, 11, {
        chapterId: 'cap2_lirica',
        focus: 'analizar poemas: simbolos, actitud del hablante, lenguaje figurado, repeticiones y caracteristicas del soneto'
    }),
    ...createRangeEntries(12, 15, {
        chapterId: 'cap3_drama',
        focus: 'analizar textos dramaticos: conflicto, personajes, simbolos, atmosfera y elementos de puesta en escena'
    }),
    ...createRangeEntries(16, 19, {
        chapterId: 'cap4_siglo_oro',
        focus: 'comprender la relevancia de obras del Siglo de Oro espanol considerando contexto historico-cultural'
    }),
    ...createRangeEntries(20, 25, {
        chapterId: 'cap5_argumentacion',
        focus: 'analizar y evaluar textos argumentativos (columnas, cartas, ensayos): tesis, recursos persuasivos y validez'
    }),
    ...createRangeEntries(26, 29, {
        chapterId: 'cap6_medios_persuasion',
        focus: 'analizar textos mediaticos: propositos, estrategias de persuasion y efectos de recursos linguisticos y visuales'
    }),
    ...createRangeEntries(30, 32, {
        chapterId: 'cap7_no_literarios',
        focus: 'leer textos no literarios para contextualizar lecturas literarias y comprender experiencia humana'
    }),
    ...createRangeEntries(33, 36, {
        chapterId: 'cap8_escritura_explicativa',
        focus: 'escribir textos explicativos con presentacion clara, organizacion coherente, ejemplos y evidencias'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap9_escritura_argumentativa',
        focus: 'planificar, escribir, revisar y editar ensayos persuasivos: hipotesis, evidencias, contraargumentos y ortografia'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_oralidad_investigacion',
        focus: 'comprender y producir comunicacion oral (dialogo, exposicion) y realizar investigacion con fuentes confiables'
    })
};

const MATH_2M_SESSION_MAP = {
    ...createRangeEntries(1, 4, {
        chapterId: 'cap1_calculo_reales_raices',
        focus: 'realizar calculos y estimaciones con numeros reales, descomponer raices y combinar con racionales'
    }),
    ...createRangeEntries(5, 9, {
        chapterId: 'cap2_potencias_logaritmos',
        focus: 'relacionar potencias, raices enesimas y logaritmos; aplicar propiedades y resolver ecuaciones'
    }),
    ...createRangeEntries(10, 14, {
        chapterId: 'cap3_funcion_cuadratica',
        focus: 'comprender la funcion cuadratica f(x)=ax2+bx+c, su grafico, vertice, ceros y simetria'
    }),
    ...createRangeEntries(15, 18, {
        chapterId: 'cap4_ecuaciones_cuadraticas',
        focus: 'resolver ecuaciones cuadraticas por factorizacion, completacion de cuadrado y formula general'
    }),
    ...createRangeEntries(19, 22, {
        chapterId: 'cap5_funcion_inversa',
        focus: 'comprender la funcion inversa: maquinas, tablas, graficos en funciones lineales y cuadraticas'
    }),
    ...createRangeEntries(23, 26, {
        chapterId: 'cap6_interes_compuesto',
        focus: 'aplicar cambio porcentual constante e interes compuesto en situaciones financieras'
    }),
    ...createRangeEntries(27, 30, {
        chapterId: 'cap7_area_volumen_esfera',
        focus: 'desarrollar formulas de area superficial y volumen de la esfera y resolver problemas'
    }),
    ...createRangeEntries(31, 36, {
        chapterId: 'cap8_trigonometria',
        focus: 'comprender razones trigonometricas (seno, coseno, tangente) y aplicarlas en triangulos'
    }),
    ...createRangeEntries(37, 40, {
        chapterId: 'cap9_vectores',
        focus: 'aplicar trigonometria en composicion y descomposicion de vectores y proyecciones'
    }),
    ...createRangeEntries(41, 46, {
        chapterId: 'cap10_probabilidad_combinatoria',
        focus: 'comprender variables aleatorias, permutaciones, combinatoria y rol de la probabilidad en la sociedad'
    })
};

const PHYSICS_2M_SESSION_MAP = {
    ...createRangeEntries(1, 8, {
        chapterId: 'cap1_cinematica',
        focus: 'analizar movimiento rectilineo uniforme y acelerado: posicion, velocidad, aceleracion y graficos'
    }),
    ...createRangeEntries(9, 16, {
        chapterId: 'cap2_leyes_newton',
        focus: 'explicar efectos de fuerzas netas con leyes de Newton y diagramas de cuerpo libre'
    }),
    ...createRangeEntries(17, 23, {
        chapterId: 'cap3_energia_mecanica',
        focus: 'aplicar ley de conservacion de la energia mecanica, trabajo y potencia mecanica'
    }),
    ...createRangeEntries(24, 30, {
        chapterId: 'cap4_momentum_colisiones',
        focus: 'analizar colisiones usando cantidad de movimiento, impulso y ley de conservacion del momentum'
    }),
    ...createRangeEntries(31, 38, {
        chapterId: 'cap5_universo_big_bang',
        focus: 'comparar modelos geocentrico, heliocentrico y teoria del Big Bang en la evolucion del conocimiento'
    }),
    ...createRangeEntries(39, 46, {
        chapterId: 'cap6_gravitacion_kepler',
        focus: 'aplicar leyes de Kepler y gravitacion universal a mareas, orbitas y sondas espaciales'
    })
};

const CHEMISTRY_2M_SESSION_MAP = {
    ...createRangeEntries(1, 12, {
        chapterId: 'cap1_soluciones',
        focus: 'explicar propiedades de soluciones segun estado fisico, componentes y concentracion; calcular molaridad, molalidad y porcentual'
    }),
    ...createRangeEntries(13, 22, {
        chapterId: 'cap2_propiedades_coligativas',
        focus: 'planificar investigacion sobre propiedades coligativas: presion de vapor, ebulloscopia, crioscopia y osmosis'
    }),
    ...createRangeEntries(23, 34, {
        chapterId: 'cap3_carbono_hidrocarburos',
        focus: 'modelar las propiedades del carbono que permiten formar biomoleculas e hidrocarburos (alcanos, alquenos, alquinos, aromaticos)'
    }),
    ...createRangeEntries(35, 46, {
        chapterId: 'cap4_estereoquimica_isomeria',
        focus: 'desarrollar modelos que expliquen estereoquimica e isomeria en compuestos organicos como glucosa'
    })
};

const BIOLOGY_2M_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_sistema_nervioso',
        focus: 'explicar como el sistema nervioso coordina la adaptacion a estimulos; cuidados (sueno, drogas, prevencion de traumatismos)'
    }),
    ...createRangeEntries(7, 11, {
        chapterId: 'cap2_hormonas',
        focus: 'modelar regulacion de glicemia por hormonas pancreaticas y desarrollo de caracteres sexuales secundarios'
    }),
    ...createRangeEntries(12, 17, {
        chapterId: 'cap3_sexualidad_reproduccion',
        focus: 'explicar sexualidad y reproduccion humanas considerando aspectos biologicos, sociales, afectivos y psicologicos'
    }),
    ...createRangeEntries(18, 23, {
        chapterId: 'cap4_fecundacion_embarazo',
        focus: 'describir fecundacion, implantacion y desarrollo embrionario; responsabilidad parental, nutricion prenatal y lactancia'
    }),
    ...createRangeEntries(24, 28, {
        chapterId: 'cap5_regulacion_fertilidad',
        focus: 'evaluar metodos de regulacion de fertilidad e identificar elementos de paternidad y maternidad responsables'
    }),
    ...createRangeEntries(29, 34, {
        chapterId: 'cap6_mitosis_meiosis',
        focus: 'investigar transmision genetica entre generaciones: mitosis, meiosis y anomalias celulares (cancer, trisomia)'
    }),
    ...createRangeEntries(35, 40, {
        chapterId: 'cap7_herencia_mendel',
        focus: 'desarrollar explicacion cientifica sobre herencia genetica aplicando los principios de Mendel'
    }),
    ...createRangeEntries(41, 46, {
        chapterId: 'cap8_manipulacion_genetica',
        focus: 'investigar aplicaciones de manipulacion genetica en alimentos, farmacos y evaluar implicancias eticas y sociales'
    })
};

const HISTORY_2M_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_entreguerras_totalitarismos',
        focus: 'relacionar transformaciones culturales de entreguerras con rupturas esteticas; analizar crisis del Estado liberal, totalitarismos y populismo'
    }),
    ...createRangeEntries(6, 10, {
        chapterId: 'cap2_segunda_guerra_mundial',
        focus: 'analizar Segunda Guerra Mundial: ideologias antagonicas, devastacion humana; evaluar consecuencias y creacion de la ONU'
    }),
    ...createRangeEntries(11, 13, {
        chapterId: 'cap3_chile_crisis_parlamentaria',
        focus: 'analizar crisis del periodo parlamentario chileno y la Constitucion de 1925'
    }),
    ...createRangeEntries(14, 18, {
        chapterId: 'cap4_chile_industrializacion',
        focus: 'analizar transformaciones post-1929 en Chile: industrializacion por sustitucion, CORFO, democratizacion y pobreza mid-siglo XX'
    }),
    ...createRangeEntries(19, 23, {
        chapterId: 'cap5_guerra_fria',
        focus: 'analizar Guerra Fria: confrontacion bipolar, transformaciones occidentales y auge del neoliberalismo al cierre'
    }),
    ...createRangeEntries(24, 27, {
        chapterId: 'cap6_america_latina_dictaduras',
        focus: 'caracterizar movilizacion social latinoamericana, revoluciones y dictaduras militares regionales'
    }),
    ...createRangeEntries(28, 31, {
        chapterId: 'cap7_chile_60_70_reformas',
        focus: 'analizar Chile en los 60 (reformas estructurales) y la crisis de inicios de los 70'
    }),
    ...createRangeEntries(32, 37, {
        chapterId: 'cap8_dictadura_chilena',
        focus: 'comparar interpretaciones del golpe de 1973; explicar dictadura militar, supresion de DDHH, modelo neoliberal y Constitucion de 1980'
    }),
    ...createRangeEntries(38, 41, {
        chapterId: 'cap9_transicion_democratica',
        focus: 'explicar factores de recuperacion democratica en los 80, transicion y reformas constitucionales; sociedad post-democratizacion'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_formacion_ciudadana',
        focus: 'analizar formacion ciudadana: derechos humanos, Estado de derecho, desafios pendientes (pobreza, desigualdad) y diversidad'
    })
};

const normalizeGrade = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2\u00b0medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

const SESSION_MAPS_BY_GRADE = {
    '1medio': {
        LENGUAJE: LANGUAGE_SESSION_MAP,
        MATEMATICA: MATH_SESSION_MAP,
        BIOLOGIA: BIOLOGY_SESSION_MAP,
        QUIMICA: CHEMISTRY_SESSION_MAP,
        FISICA: PHYSICS_SESSION_MAP
    },
    '2medio': {
        LENGUAJE: LANGUAGE_2M_SESSION_MAP,
        MATEMATICA: MATH_2M_SESSION_MAP,
        BIOLOGIA: BIOLOGY_2M_SESSION_MAP,
        QUIMICA: CHEMISTRY_2M_SESSION_MAP,
        FISICA: PHYSICS_2M_SESSION_MAP,
        HISTORIA: HISTORY_2M_SESSION_MAP
    }
};

export const resolveMoralejaSessionReference = ({ subject = '', session = 0, grade = '1medio' } = {}) => {
    const numericSession = Number(session || 0) || 0;
    if (!numericSession) return null;

    const normalizedSubject = String(subject || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const gradeKey = normalizeGrade(grade);
    const gradeMaps = SESSION_MAPS_BY_GRADE[gradeKey] || SESSION_MAPS_BY_GRADE['1medio'];

    let sessionMap = null;

    if (normalizedSubject.includes('LENGUAJE') || normalizedSubject.includes('LECTURA') || normalizedSubject.includes('COMPETENCIA_LECTORA')) {
        sessionMap = gradeMaps.LENGUAJE;
    } else if (normalizedSubject.includes('MATEMATICA')) {
        sessionMap = gradeMaps.MATEMATICA;
    } else if (normalizedSubject.includes('BIOLOGIA')) {
        sessionMap = gradeMaps.BIOLOGIA;
    } else if (normalizedSubject.includes('QUIMICA')) {
        sessionMap = gradeMaps.QUIMICA;
    } else if (normalizedSubject.includes('FISICA')) {
        sessionMap = gradeMaps.FISICA;
    } else if (normalizedSubject.includes('HISTORIA')) {
        sessionMap = gradeMaps.HISTORIA;
    }

    if (!sessionMap || !sessionMap[numericSession]) return null;

    return {
        session: numericSession,
        grade: gradeKey,
        ...sessionMap[numericSession]
    };
};

export {
    LANGUAGE_SESSION_MAP,
    MATH_SESSION_MAP,
    BIOLOGY_SESSION_MAP,
    CHEMISTRY_SESSION_MAP,
    PHYSICS_SESSION_MAP,
    LANGUAGE_2M_SESSION_MAP,
    MATH_2M_SESSION_MAP,
    BIOLOGY_2M_SESSION_MAP,
    CHEMISTRY_2M_SESSION_MAP,
    PHYSICS_2M_SESSION_MAP,
    HISTORY_2M_SESSION_MAP,
    normalizeGrade
};
