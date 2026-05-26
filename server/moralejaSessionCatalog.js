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
// MAPS 2\u00b0 MEDIO (Bases Curriculares Mineduc 2019)
// chapterId apunta al CHAPTERS_2M dentro de cada moralejaXxx.js
// =====================================================================

const LANGUAGE_2M_SESSION_MAP = {
    ...createRangeEntries(1, 12, {
        chapterId: 'cap5_inferencia',
        focus: 'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'
    }),
    13: { chapterId: 'cap4_propositos_relaciones', focus: 'analizar discurso publico, tesis, argumentos y contraargumentos en prensa actual' },
    14: { chapterId: 'cap5_inferencia',            focus: 'inferir vision de mundo y conflicto dramatico en teatro moderno y contemporaneo' },
    15: { chapterId: 'cap4_propositos_relaciones', focus: 'analizar ensayo argumentativo, recursos retoricos y multimodalidad audiovisual' },
    16: { chapterId: 'cap3_sintesis',              focus: 'integrar y sintetizar aprendizajes semestrales en clave PAES' },
    17: { chapterId: 'cap4_propositos_relaciones', focus: 'reconocer estructura interna y funcion comunicativa de partes en discurso publico' },
    18: { chapterId: 'cap5_inferencia',            focus: 'inferir cosmovision, simbolismo y carga ideologica en lirica contemporanea' },
    19: { chapterId: 'cap5_inferencia',            focus: 'inferir evolucion psicologica y rol simbolico de personajes en novela' },
    20: { chapterId: 'cap4_propositos_relaciones', focus: 'evaluar critica literaria, valoracion estetica y articulacion de argumentos' },
    ...createRangeEntries(21, 32, {
        chapterId: 'cap4_propositos_relaciones',
        focus: 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'
    }),
    ...createRangeEntries(33, 38, {
        chapterId: 'cap5_inferencia',
        focus: 'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'
    }),
    39: { chapterId: 'cap4_propositos_relaciones', focus: 'interpretar poesia visual y experimental con relacion lenguaje verbal y disposicion grafica' },
    40: { chapterId: 'cap4_propositos_relaciones', focus: 'leer narrativa grafica, comic y recursos multimodales con encuadre y secuencia' },
    41: { chapterId: 'cap3_sintesis',              focus: 'condensar ideas y producir sintesis breves de textos complejos' },
    42: { chapterId: 'cap4_propositos_relaciones', focus: 'organizar oralidad, intencion comunicativa y estrategias de exposicion publica' },
    43: { chapterId: 'cap2_info_explicita',        focus: 'aplicar estrategia PAES de rastreo, localizacion y descarte con evidencia textual' },
    44: { chapterId: 'cap2_info_explicita',        focus: 'resolver vocabulario contextual avanzado mediante sinonimos, parafrasis y contexto' },
    45: { chapterId: 'cap5_inferencia',            focus: 'integrar habilidades PAES de inferencia, sintesis y justificacion en textos largos' },
    46: { chapterId: 'cap3_sintesis',              focus: 'cerrar el proceso anual sintetizando aprendizajes y estrategias lectoras' }
};

const MATH_2M_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_reales_irracionales',
        focus: 'distinguir racionales e irracionales, ubicar en la recta real y operar con numeros reales'
    }),
    ...createRangeEntries(6, 9, {
        chapterId: 'cap2_raices_racionalizacion',
        focus: 'aplicar propiedades de raices enesimas, racionalizar denominadores y operar con radicales'
    }),
    ...createRangeEntries(10, 12, {
        chapterId: 'cap3_notacion_cientifica',
        focus: 'expresar y comparar magnitudes en notacion cientifica y estimar ordenes de magnitud'
    }),
    ...createRangeEntries(13, 17, {
        chapterId: 'cap4_productos_factorizacion',
        focus: 'desarrollar productos notables y factorizar expresiones algebraicas con uso estrategico'
    }),
    ...createRangeEntries(18, 22, {
        chapterId: 'cap5_sistemas_2x2',
        focus: 'resolver sistemas lineales 2x2 por sustitucion, igualacion, reduccion y modelar problemas'
    }),
    ...createRangeEntries(23, 28, {
        chapterId: 'cap6_funcion_cuadratica',
        focus: 'modelar y analizar funciones cuadraticas: vertice, ceros, eje y concavidad de la parabola'
    }),
    ...createRangeEntries(29, 31, {
        chapterId: 'cap7_funcion_inversa_raiz',
        focus: 'reconocer funcion inversa, funcion raiz cuadrada, dominio, recorrido y graficos asociados'
    }),
    ...createRangeEntries(32, 36, {
        chapterId: 'cap8_semejanza_tales',
        focus: 'aplicar semejanza, homotecia y teorema de Tales en figuras y resolucion de problemas'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap9_cuerpos_geometricos',
        focus: 'calcular area y volumen de prismas, piramides, cilindros, conos y esferas en contexto'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_probabilidad_estadistica',
        focus: 'analizar variable aleatoria, distribucion, regla de Laplace y medidas de dispersion'
    })
};

const PHYSICS_2M_SESSION_MAP = {
    ...createRangeEntries(1, 9, {
        chapterId: 'cap1_electricidad_cargas',
        focus: 'explicar carga electrica, fuerza de Coulomb, corriente, voltaje y conduccion en materiales'
    }),
    ...createRangeEntries(10, 19, {
        chapterId: 'cap2_circuitos_ohm',
        focus: 'analizar circuitos en serie y paralelo aplicando ley de Ohm, potencia y consumo electrico'
    }),
    ...createRangeEntries(20, 28, {
        chapterId: 'cap3_magnetismo',
        focus: 'describir campo magnetico, lineas de campo, fuerza sobre cargas y aplicaciones magneticas'
    }),
    ...createRangeEntries(29, 37, {
        chapterId: 'cap4_electromagnetismo',
        focus: 'relacionar electricidad y magnetismo: induccion, motores, generadores y transformadores'
    }),
    ...createRangeEntries(38, 46, {
        chapterId: 'cap5_calor_termodinamica',
        focus: 'interpretar calor, temperatura, equilibrio termico, calor especifico y leyes termodinamicas'
    })
};

const CHEMISTRY_2M_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_disoluciones',
        focus: 'calcular concentracion porcentual, molaridad, molalidad, normalidad y preparar diluciones'
    }),
    ...createRangeEntries(7, 10, {
        chapterId: 'cap2_propiedades_coligativas',
        focus: 'analizar propiedades coligativas: presion de vapor, ebulloscopia, crioscopia y osmosis'
    }),
    ...createRangeEntries(11, 17, {
        chapterId: 'cap3_acido_base_ph',
        focus: 'aplicar teorias acido-base, calcular pH y resolver reacciones de neutralizacion e indicadores'
    }),
    ...createRangeEntries(18, 24, {
        chapterId: 'cap4_redox_electroquimica',
        focus: 'identificar oxidacion-reduccion, balancear redox y describir pilas, celdas y electrolisis'
    }),
    ...createRangeEntries(25, 30, {
        chapterId: 'cap5_cinetica_equilibrio',
        focus: 'analizar velocidad de reaccion, factores y equilibrio quimico con principio de Le Chatelier'
    }),
    ...createRangeEntries(31, 35, {
        chapterId: 'cap6_polimeros',
        focus: 'describir polimeros sinteticos y naturales, polimerizacion y aplicaciones tecnologicas'
    }),
    ...createRangeEntries(36, 41, {
        chapterId: 'cap7_organica_aplicada',
        focus: 'relacionar quimica organica con farmacos, alimentos, cosmeticos y nuevos materiales'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap8_quimica_ambiental',
        focus: 'evaluar contaminacion, quimica verde, ciclos biogeoquimicos y sostenibilidad ambiental'
    })
};

const BIOLOGY_2M_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_neurona_sinapsis',
        focus: 'describir neurona, potencial de accion, sinapsis quimica y electrica, y neurotransmisores'
    }),
    ...createRangeEntries(6, 9, {
        chapterId: 'cap2_snc_snp_conducta',
        focus: 'comparar sistema nervioso central y periferico, arcos reflejos y bases biologicas de la conducta'
    }),
    ...createRangeEntries(10, 13, {
        chapterId: 'cap3_drogas_dano_cerebral',
        focus: 'analizar efecto de drogas, alcohol y nicotina sobre el cerebro, adiccion y prevencion'
    }),
    ...createRangeEntries(14, 18, {
        chapterId: 'cap4_endocrino_homeostasis',
        focus: 'explicar hormonas, glandulas endocrinas, regulacion hormonal y mecanismos de homeostasis'
    }),
    ...createRangeEntries(19, 23, {
        chapterId: 'cap5_inmune',
        focus: 'distinguir inmunidad innata y adaptativa, vacunas, alergias y enfermedades autoinmunes'
    }),
    ...createRangeEntries(24, 28, {
        chapterId: 'cap6_genetica_mendel',
        focus: 'aplicar leyes de Mendel, cruzamientos monohibridos y dihibridos con tablas de Punnett'
    }),
    ...createRangeEntries(29, 32, {
        chapterId: 'cap7_herencia_sexo_mutaciones',
        focus: 'analizar herencia ligada al sexo, pedigris, mutaciones y enfermedades geneticas'
    }),
    ...createRangeEntries(33, 37, {
        chapterId: 'cap8_variabilidad_evolucion',
        focus: 'integrar variabilidad genetica, seleccion natural, deriva y especiacion como motor evolutivo'
    }),
    ...createRangeEntries(38, 41, {
        chapterId: 'cap9_biotecnologia',
        focus: 'evaluar biotecnologia: ADN recombinante, transgenicos, terapia genica y bioetica'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_salud_bienestar',
        focus: 'relacionar alimentacion, actividad fisica, salud mental y prevencion de enfermedades cronicas'
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
        FISICA: PHYSICS_2M_SESSION_MAP
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

    if (normalizedSubject.includes('LENGUAJE') || normalizedSubject.includes('LECTURA')) {
        sessionMap = gradeMaps.LENGUAJE;
    } else if (normalizedSubject.includes('MATEMATICA')) {
        sessionMap = gradeMaps.MATEMATICA;
    } else if (normalizedSubject.includes('BIOLOGIA')) {
        sessionMap = gradeMaps.BIOLOGIA;
    } else if (normalizedSubject.includes('QUIMICA')) {
        sessionMap = gradeMaps.QUIMICA;
    } else if (normalizedSubject.includes('FISICA')) {
        sessionMap = gradeMaps.FISICA;
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
    normalizeGrade
};
