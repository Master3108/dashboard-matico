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

export const resolveMoralejaSessionReference = ({ subject = '', session = 0 } = {}) => {
    const numericSession = Number(session || 0) || 0;
    if (!numericSession) return null;

    const normalizedSubject = String(subject || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    let sessionMap = null;

    if (normalizedSubject.includes('LENGUAJE') || normalizedSubject.includes('LECTURA')) {
        sessionMap = LANGUAGE_SESSION_MAP;
    } else if (normalizedSubject.includes('MATEMATICA')) {
        sessionMap = MATH_SESSION_MAP;
    } else if (normalizedSubject.includes('BIOLOGIA')) {
        sessionMap = BIOLOGY_SESSION_MAP;
    } else if (normalizedSubject.includes('QUIMICA')) {
        sessionMap = CHEMISTRY_SESSION_MAP;
    } else if (normalizedSubject.includes('FISICA')) {
        sessionMap = PHYSICS_SESSION_MAP;
    }

    if (!sessionMap || !sessionMap[numericSession]) return null;

    return {
        session: numericSession,
        ...sessionMap[numericSession]
    };
};

export {
    LANGUAGE_SESSION_MAP,
    MATH_SESSION_MAP,
    BIOLOGY_SESSION_MAP,
    CHEMISTRY_SESSION_MAP,
    PHYSICS_SESSION_MAP
};
