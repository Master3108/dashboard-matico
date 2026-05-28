const createRangeEntries = (start, end, entryFactory) => {
    const entries = {};
    for (let session = start; session <= end; session += 1) {
        entries[session] = typeof entryFactory === 'function'
            ? entryFactory(session)
            : { ...entryFactory };
    }
    return entries;
};

// =====================================================================
// MAPS 1° MEDIO — MINEDUC OFICIAL (Decreto 19/2019)
// =====================================================================

const LANGUAGE_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_narrativa',
        focus: 'analizar narraciones: conflictos, personajes, perspectiva narrativa, simbolos y creencias presentes'
    }),
    ...createRangeEntries(7, 10, {
        chapterId: 'cap2_lirica',
        focus: 'analizar poemas: simbolos, actitud del hablante, lenguaje figurado y relaciones formales'
    }),
    ...createRangeEntries(11, 14, {
        chapterId: 'cap3_drama_tragedia',
        focus: 'analizar textos dramaticos y comprender la vision de mundo expresada en tragedias clasicas'
    }),
    ...createRangeEntries(15, 19, {
        chapterId: 'cap4_romanticismo',
        focus: 'comprender la relevancia del Romanticismo: caracteristicas, autores y contexto historico-cultural'
    }),
    ...createRangeEntries(20, 25, {
        chapterId: 'cap5_argumentacion',
        focus: 'analizar textos argumentativos: tesis, argumentos, hechos vs opiniones, estrategias retoricas'
    }),
    ...createRangeEntries(26, 29, {
        chapterId: 'cap6_medios_persuasion',
        focus: 'analizar textos mediaticos: propositos, estrategias persuasivas, veracidad y recursos no linguisticos'
    }),
    ...createRangeEntries(30, 32, {
        chapterId: 'cap7_no_literarios',
        focus: 'leer textos no literarios para contextualizar lecturas literarias y reflexionar sobre experiencia humana'
    }),
    ...createRangeEntries(33, 36, {
        chapterId: 'cap8_escritura_explicativa',
        focus: 'escribir textos explicativos con organizacion tematica, recursos graficos y correferencia lexica'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap9_escritura_persuasiva',
        focus: 'planificar, escribir, revisar y editar ensayos persuasivos: hipotesis, evidencias, ortografia'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_oralidad_investigacion',
        focus: 'comprender y producir comunicacion oral (resumen, dialogo, exposicion) y realizar investigaciones'
    })
};

const MATH_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_racionales',
        focus: 'calcular operaciones con numeros racionales en forma simbolica'
    }),
    ...createRangeEntries(6, 9, {
        chapterId: 'cap2_potencias_racional',
        focus: 'comprender potencias de base racional y exponente entero; aplicar propiedades en problemas cotidianos'
    }),
    ...createRangeEntries(10, 14, {
        chapterId: 'cap3_productos_notables',
        focus: 'desarrollar productos notables (cuadrado de binomio, suma por diferencia) y factorizar'
    }),
    ...createRangeEntries(15, 19, {
        chapterId: 'cap4_sistemas_2x2',
        focus: 'resolver sistemas de ecuaciones lineales 2x2 por sustitucion, igualacion y reduccion'
    }),
    ...createRangeEntries(20, 23, {
        chapterId: 'cap5_funcion_lineal',
        focus: 'graficar relaciones lineales f(x,y)=ax+by, leer y construir funcion lineal y afin'
    }),
    ...createRangeEntries(24, 27, {
        chapterId: 'cap6_sector_circular',
        focus: 'desarrollar formulas para area y perimetro de sectores y segmentos circulares'
    }),
    ...createRangeEntries(28, 31, {
        chapterId: 'cap7_cono',
        focus: 'formular y aplicar formulas para area de superficie y volumen del cono'
    }),
    ...createRangeEntries(32, 36, {
        chapterId: 'cap8_homotecia',
        focus: 'comprender homotecia: razon, centro, vectores y producto vector-escalar'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap9_tales_semejanza',
        focus: 'aplicar teorema de Tales y criterios de semejanza en figuras y modelos a escala'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap10_probabilidad_estadistica',
        focus: 'tablas de doble entrada, nubes de puntos, probabilidad aditiva y multiplicativa, tablas de Galton'
    })
};

const BIOLOGY_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_fosiles',
        focus: 'explicar formacion de fosiles a partir de restos organicos y su uso como evidencia evolutiva'
    }),
    ...createRangeEntries(6, 11, {
        chapterId: 'cap2_diversidad_evolucion',
        focus: 'analizar diversidad de organismos: registro fosil, estructuras homologas y seleccion natural'
    }),
    ...createRangeEntries(12, 16, {
        chapterId: 'cap3_taxonomia',
        focus: 'explicar criterios taxonomicos para clasificar y reconocer relaciones de parentesco'
    }),
    ...createRangeEntries(17, 22, {
        chapterId: 'cap4_ecosistemas',
        focus: 'investigar organizacion e interacciones biologicas en ecosistemas (niveles troficos, simbiosis)'
    }),
    ...createRangeEntries(23, 27, {
        chapterId: 'cap5_poblaciones',
        focus: 'analizar factores que afectan el tamano de poblaciones y predecir consecuencias ecologicas'
    }),
    ...createRangeEntries(28, 33, {
        chapterId: 'cap6_ciclos_biogeoquimicos',
        focus: 'desarrollar modelos de ciclos biogeoquimicos, flujo de energia y bioacumulacion de contaminantes'
    }),
    ...createRangeEntries(34, 39, {
        chapterId: 'cap7_fotosintesis_respiracion',
        focus: 'explicar rol de fotosintesis y respiracion celular en el flujo energetico y ciclo de la materia'
    }),
    ...createRangeEntries(40, 46, {
        chapterId: 'cap8_impacto_humano',
        focus: 'evaluar efectos de acciones humanas y fenomenos naturales sobre el equilibrio ecosistemico'
    })
};

const CHEMISTRY_SESSION_MAP = {
    ...createRangeEntries(1, 12, {
        chapterId: 'cap1_reacciones_cotidianas',
        focus: 'investigar reacciones quimicas cotidianas: fermentacion, combustion, oxidacion; indicadores y variables'
    }),
    ...createRangeEntries(13, 22, {
        chapterId: 'cap2_conservacion_masa',
        focus: 'desarrollar modelo de conservacion de atomos y masa en reacciones quimicas; balancear ecuaciones'
    }),
    ...createRangeEntries(23, 34, {
        chapterId: 'cap3_compuestos_nomenclatura',
        focus: 'explicar formacion de compuestos binarios y ternarios; fuerzas electricas y nomenclatura inorganica'
    }),
    ...createRangeEntries(35, 46, {
        chapterId: 'cap4_estequiometria',
        focus: 'establecer relaciones cuantitativas (estequiometria) entre reactantes y productos en reacciones utiles'
    })
};

const PHYSICS_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_ondas',
        focus: 'demostrar mediante modelos que las ondas transmiten energia (mecanicas/electromagneticas, transversales/longitudinales)'
    }),
    ...createRangeEntries(7, 12, {
        chapterId: 'cap2_fenomenos_sonoros',
        focus: 'explicar fenomenos sonoros: eco, resonancia, efecto Doppler y aplicaciones tecnologicas'
    }),
    ...createRangeEntries(13, 18, {
        chapterId: 'cap3_luz_optica',
        focus: 'explicar fenomenos luminosos: reflexion, refraccion, formacion de imagenes y modelos ondulatorio/corpuscular'
    }),
    ...createRangeEntries(19, 24, {
        chapterId: 'cap4_oido_ojo_humano',
        focus: 'estudiar oido y ojo humano: espectros sonoro y lumineo, defectos visuales y tecnologia correctiva'
    }),
    ...createRangeEntries(25, 30, {
        chapterId: 'cap5_sismos',
        focus: 'describir origen y propagacion de sismos: ondas P/S, parametros sismicos, escalas e impacto'
    }),
    ...createRangeEntries(31, 36, {
        chapterId: 'cap6_tierra_luna_estaciones',
        focus: 'crear modelos del sistema Tierra-Luna: movimientos, estaciones del ano, eclipses y mareas'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap7_estructuras_cosmicas',
        focus: 'describir estructuras cosmicas: meteoros, asteroides, estrellas, galaxias, tamanos y propiedades'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap8_astronomia_chile',
        focus: 'investigar astronomia en Chile: ventajas climaticas, telescopios y aportes cientificos nacionales'
    })
};

// HISTORIA 1° medio (no existia antes - usaba prompt generico)
const HISTORY_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_ideas_republicanas',
        focus: 'explicar ideas republicanas/liberales del siglo XIX; cultura burguesa y formacion del Estado-nacion en Europa y America Latina'
    }),
    ...createRangeEntries(7, 11, {
        chapterId: 'cap2_progreso_industrializacion',
        focus: 'analizar progreso cientifico-tecnologico, industrializacion y sus efectos; imperialismo europeo y su impacto mundial'
    }),
    ...createRangeEntries(12, 14, {
        chapterId: 'cap3_primera_guerra_mundial',
        focus: 'analizar Primera Guerra Mundial: causas, desarrollo, efectos sobre sociedad civil y nuevo orden geopolitico'
    }),
    ...createRangeEntries(15, 20, {
        chapterId: 'cap4_chile_republica_1833',
        focus: 'analizar formacion de la republica chilena, Constitucion de 1833 y consolidacion del orden conservador'
    }),
    ...createRangeEntries(21, 25, {
        chapterId: 'cap5_chile_salitre',
        focus: 'explicar insercion chilena al mercado mundial via exportacion del salitre y opinion publica/educacion'
    }),
    ...createRangeEntries(26, 31, {
        chapterId: 'cap6_ocupacion_territorio',
        focus: 'describir ocupacion del territorio: Valdivia, Llanquihue, Chiloe, Magallanes, Araucania y Guerra del Pacifico'
    }),
    ...createRangeEntries(32, 36, {
        chapterId: 'cap7_parlamentarismo_cuestion_social',
        focus: 'analizar orden parlamentario, transformaciones del cambio de siglo y la cuestion social'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap8_economia_geografia',
        focus: 'explicar economia: escasez/necesidades, mercado, instrumentos financieros y consumo responsable'
    }),
    ...createRangeEntries(42, 44, {
        chapterId: 'cap9_pueblos_indigenas',
        focus: 'evaluar relaciones de conflicto y convivencia con pueblos indigenas en Chile'
    }),
    ...createRangeEntries(45, 46, {
        chapterId: 'cap10_industria_medioambiente',
        focus: 'analizar impacto de la industrializacion sobre el medio ambiente y desarrollo sostenible'
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

// =====================================================================
// MAPS 3\u00b0 MEDIO \u2014 MINEDUC OFICIAL (Decreto 193/2019)
// Plan comun: Matematica, Lenguaje, Historia (Ed. Ciudadana)
// Diferenciado HC: Fisica, Quimica, Biologia Celular y Molecular
// =====================================================================

const MATH_3M_SESSION_MAP = {
    ...createRangeEntries(1, 10, {
        chapterId: 'cap1_numeros_complejos',
        focus: 'operar con numeros complejos en forma binomica: adicion, sustraccion, multiplicacion y division'
    }),
    ...createRangeEntries(11, 21, {
        chapterId: 'cap2_funcion_exp_log',
        focus: 'aplicar modelos de funciones exponenciales y logaritmicas a fenomenos de crecimiento y decrecimiento'
    }),
    ...createRangeEntries(22, 32, {
        chapterId: 'cap3_geometria_circunferencia',
        focus: 'resolver problemas de geometria euclidiana con relaciones metricas entre angulos, arcos, cuerdas y secantes'
    }),
    ...createRangeEntries(33, 46, {
        chapterId: 'cap4_estadistica_probabilidad_cond',
        focus: 'tomar decisiones en situaciones de incertidumbre usando medidas de dispersion y probabilidades condicionales'
    })
};

const LANGUAGE_3M_SESSION_MAP = {
    ...createRangeEntries(1, 10, {
        chapterId: 'cap1_interpretacion_literaria',
        focus: 'formular interpretaciones literarias considerando recursos, intertextualidad y efecto estetico'
    }),
    ...createRangeEntries(11, 16, {
        chapterId: 'cap2_discurso_no_literario',
        focus: 'analizar criticamente discurso no literario oral, escrito y audiovisual considerando contexto sociocultural'
    }),
    ...createRangeEntries(17, 22, {
        chapterId: 'cap3_discurso_digital',
        focus: 'analizar discurso digital en comunidades en linea evaluando etica, recursos linguisticos y posicionamiento'
    }),
    ...createRangeEntries(23, 30, {
        chapterId: 'cap4_produccion_textos',
        focus: 'producir textos coherentes aplicando proceso de escritura adecuado al genero, proposito y audiencia'
    }),
    ...createRangeEntries(31, 36, {
        chapterId: 'cap5_dialogo_argumentativo',
        focus: 'participar en dialogos argumentativos usando evidencias y evaluando criticamente razonamientos ajenos'
    }),
    ...createRangeEntries(37, 46, {
        chapterId: 'cap6_investigacion_academica',
        focus: 'investigar con fuentes confiables y comunicar hallazgos con rigor etico'
    })
};

const PHYSICS_3M_SESSION_MAP = {
    ...createRangeEntries(1, 7, {
        chapterId: 'cap1_cambio_climatico_fisica',
        focus: 'analizar el cambio climatico global con base en datos cientificos historicos y actuales desde la fisica'
    }),
    ...createRangeEntries(8, 14, {
        chapterId: 'cap2_origen_universo',
        focus: 'comprender explicaciones cientificas sobre el origen y evolucion del universo mediante estudio historiografico'
    }),
    ...createRangeEntries(15, 22, {
        chapterId: 'cap3_movimiento_fuerza_central',
        focus: 'analizar movimiento de cuerpos bajo fuerza central en situaciones cotidianas aplicando mecanica clasica'
    }),
    ...createRangeEntries(23, 30, {
        chapterId: 'cap4_fisica_moderna',
        focus: 'evaluar contribucion de relatividad y mecanica cuantica a la comprension de la realidad y tecnologia'
    }),
    ...createRangeEntries(31, 40, {
        chapterId: 'cap5_fluidos_electromagnetismo_termodinamica',
        focus: 'aplicar fluidos, electromagnetismo y termodinamica para comprender oceanos, atmosfera y corteza terrestre'
    }),
    ...createRangeEntries(41, 46, {
        chapterId: 'cap6_fisica_integrada',
        focus: 'valorar integracion de la fisica con otras ciencias para analizar desafios contemporaneos con perspectiva etica'
    })
};

const CHEMISTRY_3M_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_nanoquimica_polimeros',
        focus: 'evaluar nanoquimica y polimeros: aplicaciones ambientales, medicas, agricolas e industriales'
    }),
    ...createRangeEntries(7, 13, {
        chapterId: 'cap2_acido_base_redox_polimerizacion',
        focus: 'explicar fenomenos acido-base, oxidacion-reduccion y polimerizacion en sistemas naturales y tecnologicos'
    }),
    ...createRangeEntries(14, 21, {
        chapterId: 'cap3_termoquimica_cinetica',
        focus: 'argumentar como termodinamica y cinetica quimica explican el funcionamiento de sistemas naturales'
    }),
    ...createRangeEntries(22, 29, {
        chapterId: 'cap4_cambio_climatico_biogeoquimica',
        focus: 'explicar efectos del cambio climatico sobre ciclos biogeoquimicos y equilibrios quimicos en oceanos y atmosfera'
    }),
    ...createRangeEntries(30, 36, {
        chapterId: 'cap5_contaminantes_quimicos',
        focus: 'analizar origen, rutas de exposicion y efectos de contaminantes quimicos en sistemas naturales'
    }),
    ...createRangeEntries(37, 41, {
        chapterId: 'cap6_quimica_sostenibilidad',
        focus: 'evaluar contribucion de la quimica verde en prevencion y mitigacion del cambio climatico'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap7_quimica_integrada',
        focus: 'valorar integracion de la quimica con otras ciencias para analizar problemas actuales con implicancias eticas'
    })
};

const BIOLOGY_3M_SESSION_MAP = {
    ...createRangeEntries(1, 5, {
        chapterId: 'cap1_historia_bio_molecular',
        focus: 'investigar el desarrollo historico de la biologia celular y molecular y su relacion con quimica, fisica y matematica'
    }),
    ...createRangeEntries(6, 14, {
        chapterId: 'cap2_estructura_celula_biomoleculas',
        focus: 'explicar estructura y organizacion celular basada en biomoleculas, membranas y organelos'
    }),
    ...createRangeEntries(15, 22, {
        chapterId: 'cap3_dogma_central',
        focus: 'analizar el dogma central ADN\u2192ARN\u2192proteinas y el flujo de informacion genetica'
    }),
    ...createRangeEntries(23, 30, {
        chapterId: 'cap4_regulacion_genica_cancer',
        focus: 'describir regulacion genica, diferenciacion celular, envejecimiento y cancer'
    }),
    ...createRangeEntries(31, 36, {
        chapterId: 'cap5_proteinas_enzimas_motilidad',
        focus: 'explicar funciones de proteinas en actividad enzimatica, canales ionicos y motilidad celular'
    }),
    ...createRangeEntries(37, 40, {
        chapterId: 'cap6_ciencia_chilena_cts',
        focus: 'analizar desarrollo cientifico en biologia celular y molecular en Chile y la relacion ciencia-tecnologia-sociedad'
    }),
    ...createRangeEntries(41, 46, {
        chapterId: 'cap7_biotecnologia_etica',
        focus: 'analizar aplicaciones biotecnologicas (CRISPR, celulas madre, transgenicos) y evaluar implicancias eticas'
    })
};

const HISTORY_3M_SESSION_MAP = {
    ...createRangeEntries(1, 6, {
        chapterId: 'cap1_democracia_ciudadania',
        focus: 'identificar fundamentos de la democracia y ciudadania: libertades fundamentales y deberes del Estado'
    }),
    ...createRangeEntries(7, 11, {
        chapterId: 'cap2_sistema_judicial',
        focus: 'investigar mecanismos de acceso a la justicia y la estructura del poder judicial chileno'
    }),
    ...createRangeEntries(12, 16, {
        chapterId: 'cap3_riesgos_democracia',
        focus: 'reflexionar sobre riesgos para la democracia: apatia, desigualdad, corrupcion y narcotrafico'
    }),
    ...createRangeEntries(17, 22, {
        chapterId: 'cap4_estado_mercado',
        focus: 'evaluar relacion Estado-mercado: salarios, tributacion, comercio justo y sostenibilidad'
    }),
    ...createRangeEntries(23, 28, {
        chapterId: 'cap5_derechos_humanos',
        focus: 'promover reconocimiento y defensa de DDHH: universalidad, indivisibilidad y no discriminacion'
    }),
    ...createRangeEntries(29, 34, {
        chapterId: 'cap6_participacion_bien_comun',
        focus: 'reflexionar sobre participacion ciudadana y bien comun desde perspectivas republicana, liberal y comunitaria'
    }),
    ...createRangeEntries(35, 41, {
        chapterId: 'cap7_territorio_justicia_social',
        focus: 'distinguir relaciones politicas, economicas y socioculturales del territorio y proponer justicia social y ambiental'
    }),
    ...createRangeEntries(42, 46, {
        chapterId: 'cap8_democracia_escolar',
        focus: 'participar en ejercicios democraticos escolares reconociendo la necesidad de organizar la vida comunitaria'
    })
};

const normalizeGrade = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2\u00b0medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    if (raw === '3medio' || raw === '3m' || raw === '3\u00b0medio' || raw === 'tercero' || raw === 'terceromedio') return '3medio';
    return '1medio';
};

const SESSION_MAPS_BY_GRADE = {
    '1medio': {
        LENGUAJE: LANGUAGE_SESSION_MAP,
        MATEMATICA: MATH_SESSION_MAP,
        BIOLOGIA: BIOLOGY_SESSION_MAP,
        QUIMICA: CHEMISTRY_SESSION_MAP,
        FISICA: PHYSICS_SESSION_MAP,
        HISTORIA: HISTORY_SESSION_MAP
    },
    '2medio': {
        LENGUAJE: LANGUAGE_2M_SESSION_MAP,
        MATEMATICA: MATH_2M_SESSION_MAP,
        BIOLOGIA: BIOLOGY_2M_SESSION_MAP,
        QUIMICA: CHEMISTRY_2M_SESSION_MAP,
        FISICA: PHYSICS_2M_SESSION_MAP,
        HISTORIA: HISTORY_2M_SESSION_MAP
    },
    '3medio': {
        LENGUAJE: LANGUAGE_3M_SESSION_MAP,
        MATEMATICA: MATH_3M_SESSION_MAP,
        BIOLOGIA: BIOLOGY_3M_SESSION_MAP,
        QUIMICA: CHEMISTRY_3M_SESSION_MAP,
        FISICA: PHYSICS_3M_SESSION_MAP,
        HISTORIA: HISTORY_3M_SESSION_MAP
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
    HISTORY_SESSION_MAP,
    LANGUAGE_2M_SESSION_MAP,
    MATH_2M_SESSION_MAP,
    BIOLOGY_2M_SESSION_MAP,
    CHEMISTRY_2M_SESSION_MAP,
    PHYSICS_2M_SESSION_MAP,
    HISTORY_2M_SESSION_MAP,
    LANGUAGE_3M_SESSION_MAP,
    MATH_3M_SESSION_MAP,
    BIOLOGY_3M_SESSION_MAP,
    CHEMISTRY_3M_SESSION_MAP,
    PHYSICS_3M_SESSION_MAP,
    HISTORY_3M_SESSION_MAP,
    normalizeGrade
};
