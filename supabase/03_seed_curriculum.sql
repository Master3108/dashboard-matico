-- =====================================================================
-- MATICO - Seed catalogo curricular 1° MEDIO
-- =====================================================================
-- Carga capitulos y sesiones para las 6 asignaturas activas.
-- Datos extraidos de:
--   server/moralejaMatematica.js
--   server/moralejaFisica.js
--   server/moralejaQuimica.js
--   server/moralejaBiologia.js
--   server/moralejaCompetenciaLectora.js
--   server/moralejaSessionCatalog.js
--   HISTORIA: estructura armada desde Bases Curriculares Mineduc 2019
--             (Historia, Geografia y Ciencias Sociales 1° medio).
--             Pendiente: crear server/moralejaHistoria.js con esta misma
--             estructura para que el backend pueda mapear sesion->capitulo.
-- Idempotente: se puede correr varias veces sin duplicar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CAPITULOS
-- ---------------------------------------------------------------------

-- MATEMATICA (14 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('mat_1m_cap1_enteros',                 '1medio', 'MATEMATICA',  1, 'Conjuntos numericos e enteros',           1),
  ('mat_1m_cap2_racionales',              '1medio', 'MATEMATICA',  2, 'Numeros racionales y decimales',          2),
  ('mat_1m_cap3_porcentaje_finanzas',     '1medio', 'MATEMATICA',  3, 'Porcentaje y matematica financiera',      3),
  ('mat_1m_cap4_reales',                  '1medio', 'MATEMATICA',  4, 'Numeros reales, potencias y raices',      4),
  ('mat_1m_cap5_algebra',                 '1medio', 'MATEMATICA',  5, 'Algebra',                                  5),
  ('mat_1m_cap6_proporcionalidad',        '1medio', 'MATEMATICA',  6, 'Proporcionalidad',                         6),
  ('mat_1m_cap7_ecuaciones',              '1medio', 'MATEMATICA',  7, 'Ecuaciones y sistemas',                    7),
  ('mat_1m_cap8_potencias_raices',        '1medio', 'MATEMATICA',  8, 'Potencias y raices',                       8),
  ('mat_1m_cap9_inecuaciones',            '1medio', 'MATEMATICA',  9, 'Desigualdades e inecuaciones',             9),
  ('mat_1m_cap10_logaritmos',             '1medio', 'MATEMATICA', 10, 'Logaritmos',                              10),
  ('mat_1m_cap11_funcion_lineal',         '1medio', 'MATEMATICA', 11, 'Funcion lineal y afin',                   11),
  ('mat_1m_cap12_funcion_cuadratica',     '1medio', 'MATEMATICA', 12, 'Funcion cuadratica y potencia',           12),
  ('mat_1m_cap13_geometria',              '1medio', 'MATEMATICA', 13, 'Geometria y transformaciones',            13),
  ('mat_1m_cap14_datos_probabilidad',     '1medio', 'MATEMATICA', 14, 'Datos y probabilidad',                    14)
on conflict (id) do nothing;

-- FISICA (5 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('fis_1m_cap1_ondas_sonido',                '1medio', 'FISICA', 1, 'Ondas y sonido',                       1),
  ('fis_1m_cap2_luz_optica',                  '1medio', 'FISICA', 2, 'Luz y optica',                          2),
  ('fis_1m_cap3_sismos_dinamica_terrestre',   '1medio', 'FISICA', 3, 'Dinamica terrestre y sismos',           3),
  ('fis_1m_cap4_universo_gravitacion',        '1medio', 'FISICA', 4, 'Universo y gravitacion',                4),
  ('fis_1m_cap5_fisica_moderna_aplicaciones', '1medio', 'FISICA', 5, 'Fisica moderna y aplicaciones',         5)
on conflict (id) do nothing;

-- QUIMICA (10 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('qui_1m_cap1_atomo',                          '1medio', 'QUIMICA',  1, 'El atomo',                                       1),
  ('qui_1m_cap2_tabla_periodica',                '1medio', 'QUIMICA',  2, 'Tabla periodica',                                2),
  ('qui_1m_cap3_enlaces_quimicos',               '1medio', 'QUIMICA',  3, 'Enlaces quimicos',                               3),
  ('qui_1m_cap4_organica_hidrocarburos',         '1medio', 'QUIMICA',  4, 'Quimica organica I',                             4),
  ('qui_1m_cap5_organica_funciones_oxigenadas',  '1medio', 'QUIMICA',  5, 'Quimica organica II - funciones oxigenadas',     5),
  ('qui_1m_cap6_organica_funciones_nitrogenadas','1medio', 'QUIMICA',  6, 'Quimica organica III',                            6),
  ('qui_1m_cap7_nomenclatura_inorganica',        '1medio', 'QUIMICA',  7, 'Nomenclatura inorganica',                        7),
  ('qui_1m_cap8_reacciones_estequiometria',      '1medio', 'QUIMICA',  8, 'Reacciones quimicas y estequiometria',           8),
  ('qui_1m_cap9_soluciones',                     '1medio', 'QUIMICA',  9, 'Soluciones',                                      9),
  ('qui_1m_cap10_gases_propiedades_coligativas', '1medio', 'QUIMICA', 10, 'Gases y propiedades coligativas',                10)
on conflict (id) do nothing;

-- BIOLOGIA (12 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('bio_1m_cap1_metodo_cientifico',          '1medio', 'BIOLOGIA',  1, 'Metodo cientifico',                                       1),
  ('bio_1m_cap2_niveles_teoria_celular',     '1medio', 'BIOLOGIA',  2, 'Niveles de organizacion y teoria celular',               2),
  ('bio_1m_cap3_quimica_vida',               '1medio', 'BIOLOGIA',  3, 'La quimica de la vida',                                  3),
  ('bio_1m_cap4_celula_procariota_eucariota','1medio', 'BIOLOGIA',  4, 'Celula procariota, eucariota y transporte celular',      4),
  ('bio_1m_cap5_reproduccion_hormonas',      '1medio', 'BIOLOGIA',  5, 'Sistema endocrino y reproduccion',                        5),
  ('bio_1m_cap6_adn_reproduccion_celular',   '1medio', 'BIOLOGIA',  6, 'ADN y reproduccion celular',                              6),
  ('bio_1m_cap7_manipulacion_genetica',      '1medio', 'BIOLOGIA',  7, 'Manipulacion genetica',                                   7),
  ('bio_1m_cap8_microorganismos_inmunidad',  '1medio', 'BIOLOGIA',  8, 'Microorganismos y barreras defensivas',                   8),
  ('bio_1m_cap9_evolucion_biodiversidad',    '1medio', 'BIOLOGIA',  9, 'Evolucion y biodiversidad',                                9),
  ('bio_1m_cap10_materia_flujo_energia',     '1medio', 'BIOLOGIA', 10, 'Materia y flujo de energia en ecosistemas',              10),
  ('bio_1m_cap11_ecologia_poblaciones',      '1medio', 'BIOLOGIA', 11, 'Ecologia de poblaciones y comunidades',                  11),
  ('bio_1m_cap12_sustentabilidad',           '1medio', 'BIOLOGIA', 12, 'Sustentabilidad e impacto antropogenico',                12)
on conflict (id) do nothing;

-- COMPETENCIA_LECTORA (5 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('lec_1m_cap1_coherencia_cohesion',     '1medio', 'COMPETENCIA_LECTORA', 1, 'Introduccion a la comprension lectora',                  1),
  ('lec_1m_cap2_info_explicita',          '1medio', 'COMPETENCIA_LECTORA', 2, 'Extraer e identificar informacion explicita',           2),
  ('lec_1m_cap3_sintesis',                '1medio', 'COMPETENCIA_LECTORA', 3, 'Sintesis local y global',                                3),
  ('lec_1m_cap4_propositos_relaciones',   '1medio', 'COMPETENCIA_LECTORA', 4, 'Propositos comunicativos y relaciones discursivas',      4),
  ('lec_1m_cap5_inferencia',              '1medio', 'COMPETENCIA_LECTORA', 5, 'Inferencia local y global',                              5)
on conflict (id) do nothing;

-- HISTORIA (5 capitulos) - segun Bases Curriculares Mineduc 2019
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('his_1m_cap1_crisis_orden_liberal',       '1medio', 'HISTORIA', 1, 'Crisis del orden liberal: entreguerras y Chile primera mitad del siglo XX', 1),
  ('his_1m_cap2_guerra_fria_descolonizacion','1medio', 'HISTORIA', 2, 'Guerra Fria, descolonizacion y America Latina',                            2),
  ('his_1m_cap3_dictadura_militar_chile',    '1medio', 'HISTORIA', 3, 'Quiebre democratico y dictadura militar en Chile (1973-1990)',             3),
  ('his_1m_cap4_transicion_chile_actual',    '1medio', 'HISTORIA', 4, 'Recuperacion de la democracia y desafios del Chile actual',                4),
  ('his_1m_cap5_geografia_territorio',       '1medio', 'HISTORIA', 5, 'Geografia, territorio, sociedad y economia del Chile actual',              5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- SESIONES (46 por asignatura, total 230)
-- ---------------------------------------------------------------------
-- Helper: usamos generate_series para evitar 230 INSERTs manuales

-- MATEMATICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '1medio', 'MATEMATICA', s,
  case
    when s between  1 and  3 then 'mat_1m_cap2_racionales'
    when s between  4 and  6 then 'mat_1m_cap4_reales'
    when s between  7 and  9 then 'mat_1m_cap8_potencias_raices'
    when s = 10              then 'mat_1m_cap3_porcentaje_finanzas'
    when s between 11 and 16 then 'mat_1m_cap5_algebra'
    when s between 17 and 22 then 'mat_1m_cap7_ecuaciones'
    when s between 23 and 24 then 'mat_1m_cap11_funcion_lineal'
    when s between 25 and 34 then 'mat_1m_cap13_geometria'
    when s between 35 and 46 then 'mat_1m_cap14_datos_probabilidad'
  end,
  case
    when s between  1 and  3 then 'trabajar numeros racionales, conversiones y operatoria con fracciones o decimales'
    when s between  4 and  6 then 'construir base de potencias, exponentes y propiedades dentro de numeros reales'
    when s = 7               then 'modelar crecimiento exponencial y leer regularidades de potencias'
    when s between  8 and  9 then 'resolver raices y operatoria radical con procedimiento claro'
    when s = 10              then 'aplicar porcentajes y variaciones en situaciones cotidianas'
    when s between 11 and 16 then 'traducir, desarrollar y factorizar expresiones algebraicas'
    when s between 17 and 22 then 'resolver ecuaciones, sistemas y problemas de planteamiento'
    when s between 23 and 24 then 'leer y construir funcion lineal, afin, pendiente e interpretacion grafica'
    when s between 25 and 34 then 'trabajar geometria, transformaciones, semejanza, vectores y recta en el plano'
    when s between 35 and 46 then 'analizar datos, medidas estadisticas, conteo y probabilidad'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- FISICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '1medio', 'FISICA', s,
  case
    when s between  1 and 13 then 'fis_1m_cap1_ondas_sonido'
    when s between 14 and 25 then 'fis_1m_cap2_luz_optica'
    when s between 26 and 33 then 'fis_1m_cap3_sismos_dinamica_terrestre'
    when s between 34 and 41 then 'fis_1m_cap4_universo_gravitacion'
    when s between 42 and 46 then 'fis_1m_cap5_fisica_moderna_aplicaciones'
  end,
  case
    when s between  1 and 13 then 'trabajar ondas y sonido: clasificacion, magnitudes, propagacion y fenomenos ondulatorios'
    when s between 14 and 25 then 'analizar optica geometrica: reflexion, refraccion, lentes, espejos y fenomenos de la luz'
    when s between 26 and 33 then 'explicar dinamica terrestre y sismos: tectonica, ondas sismicas, hipocentro y escalas'
    when s between 34 and 41 then 'interpretar universo y gravitacion: expansion cosmica, sistema solar y leyes de kepler'
    when s between 42 and 46 then 'integrar fisica moderna y aplicaciones tecnologicas con enfoque de cierre de proceso'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- QUIMICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '1medio', 'QUIMICA', s,
  case
    when s between  1 and  8 then 'qui_1m_cap1_atomo'
    when s between  9 and 14 then 'qui_1m_cap2_tabla_periodica'
    when s between 15 and 18 then 'qui_1m_cap3_enlaces_quimicos'
    when s between 19 and 24 then 'qui_1m_cap4_organica_hidrocarburos'
    when s between 25 and 30 then 'qui_1m_cap5_organica_funciones_oxigenadas'
    when s between 31 and 34 then 'qui_1m_cap6_organica_funciones_nitrogenadas'
    when s between 35 and 37 then 'qui_1m_cap7_nomenclatura_inorganica'
    when s between 38 and 42 then 'qui_1m_cap8_reacciones_estequiometria'
    when s between 43 and 45 then 'qui_1m_cap9_soluciones'
    when s = 46              then 'qui_1m_cap10_gases_propiedades_coligativas'
  end,
  case
    when s between  1 and  8 then 'trabajar estructura atomica, isotopos, masa atomica y clasificacion de la materia'
    when s between  9 and 14 then 'analizar configuracion electronica, numeros cuanticos y propiedades periodicas'
    when s between 15 and 18 then 'relacionar enlaces, estructuras de Lewis, geometria molecular y polaridad'
    when s between 19 and 24 then 'estudiar carbono, hibridacion, hidrocarburos e isomeria organica'
    when s between 25 and 30 then 'reconocer funciones oxigenadas, nomenclatura organica y propiedades asociadas'
    when s between 31 and 34 then 'trabajar funciones nitrogenadas, halogenuros y estereoquimica'
    when s between 35 and 37 then 'formular y nombrar compuestos inorganicos con numero de oxidacion'
    when s between 38 and 42 then 'resolver balance, mol, reactivo limitante y rendimiento en reacciones quimicas'
    when s between 43 and 45 then 'calcular concentraciones, diluciones y solubilidad en soluciones quimicas'
    when s = 46              then 'aplicar leyes de los gases y propiedades coligativas como osmosis o descenso crioscopico'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- BIOLOGIA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '1medio', 'BIOLOGIA', s,
  case
    when s between  1 and 12 then 'bio_1m_cap9_evolucion_biodiversidad'
    when s = 13              then 'bio_1m_cap11_ecologia_poblaciones'
    when s between 14 and 22 then 'bio_1m_cap11_ecologia_poblaciones'
    when s = 23              then 'bio_1m_cap3_quimica_vida'
    when s between 24 and 35 then 'bio_1m_cap10_materia_flujo_energia'
    when s between 36 and 46 then 'bio_1m_cap12_sustentabilidad'
  end,
  case
    when s between  1 and 12 then 'trabajar evidencias evolutivas, seleccion natural, biodiversidad y relaciones filogeneticas'
    when s = 13              then 'analizar atributos de poblacion como densidad, distribucion y dinamica demografica'
    when s between 14 and 22 then 'estudiar organizacion ecologica, poblaciones, crecimiento e interacciones biologicas'
    when s = 23              then 'comprender metabolismo celular, ATP y reacciones anabolicas o catabolicas'
    when s between 24 and 35 then 'explicar fotosintesis, respiracion, cadenas troficas, piramides y ciclos biogeoquimicos'
    when s between 36 and 46 then 'relacionar impacto antropogenico, cambio climatico, huella ecologica y conservacion'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- COMPETENCIA_LECTORA (46 sesiones — mapeo complejo, una a una)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus) values
  ('1medio', 'COMPETENCIA_LECTORA',  1, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  2, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  3, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  4, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  5, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  6, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  7, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  8, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA',  9, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA', 10, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA', 11, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA', 12, 'lec_1m_cap5_inferencia',            'extraer inferencias, tono, vision de mundo y sentido global desde textos literarios'),
  ('1medio', 'COMPETENCIA_LECTORA', 13, 'lec_1m_cap4_propositos_relaciones', 'reconocer proposito comunicativo, opinion y relaciones argumentativas en prensa'),
  ('1medio', 'COMPETENCIA_LECTORA', 14, 'lec_1m_cap5_inferencia',            'inferir conflicto tragico, vision de mundo y rasgos del discurso dramatico'),
  ('1medio', 'COMPETENCIA_LECTORA', 15, 'lec_1m_cap4_propositos_relaciones', 'analizar ensayo, tesis, proposito y recursos multimodales o audiovisuales'),
  ('1medio', 'COMPETENCIA_LECTORA', 16, 'lec_1m_cap3_sintesis',              'integrar y sintetizar aprendizajes semestrales en clave PAES'),
  ('1medio', 'COMPETENCIA_LECTORA', 17, 'lec_1m_cap4_propositos_relaciones', 'reconocer estructura interna y funcion de partes en textos dramaticos'),
  ('1medio', 'COMPETENCIA_LECTORA', 18, 'lec_1m_cap5_inferencia',            'inferir vision de mundo, tension tragica y sentido simbolico'),
  ('1medio', 'COMPETENCIA_LECTORA', 19, 'lec_1m_cap5_inferencia',            'inferir evolucion psicologica y funcion de personajes'),
  ('1medio', 'COMPETENCIA_LECTORA', 20, 'lec_1m_cap4_propositos_relaciones', 'evaluar critica de obra, intencion valorativa y articulacion de argumentos'),
  ('1medio', 'COMPETENCIA_LECTORA', 21, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 22, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 23, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 24, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 25, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 26, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 27, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 28, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 29, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 30, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 31, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 32, 'lec_1m_cap4_propositos_relaciones', 'analizar argumentacion, hecho versus opinion, falacias, debate y recursos de medios'),
  ('1medio', 'COMPETENCIA_LECTORA', 33, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 34, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 35, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 36, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 37, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 38, 'lec_1m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('1medio', 'COMPETENCIA_LECTORA', 39, 'lec_1m_cap4_propositos_relaciones', 'interpretar poesia visual considerando relacion entre lenguaje verbal y disposicion grafica'),
  ('1medio', 'COMPETENCIA_LECTORA', 40, 'lec_1m_cap4_propositos_relaciones', 'leer narrativa grafica y recursos multimodales como imagen, encuadre y secuencia'),
  ('1medio', 'COMPETENCIA_LECTORA', 41, 'lec_1m_cap3_sintesis',              'condensar ideas y producir sintesis breves con precision narrativa'),
  ('1medio', 'COMPETENCIA_LECTORA', 42, 'lec_1m_cap4_propositos_relaciones', 'organizar oralidad, intencion comunicativa y estrategias de exposicion'),
  ('1medio', 'COMPETENCIA_LECTORA', 43, 'lec_1m_cap2_info_explicita',        'aplicar estrategia PAES de rastreo, localizacion y descarte con evidencia textual'),
  ('1medio', 'COMPETENCIA_LECTORA', 44, 'lec_1m_cap2_info_explicita',        'resolver vocabulario contextual mediante sinonimos, parafrasis y contexto inmediato'),
  ('1medio', 'COMPETENCIA_LECTORA', 45, 'lec_1m_cap5_inferencia',            'integrar habilidades PAES de inferencia, sintesis y justificacion'),
  ('1medio', 'COMPETENCIA_LECTORA', 46, 'lec_1m_cap3_sintesis',              'cerrar el proceso anual sintetizando aprendizajes y estrategias lectoras')
on conflict (grade, subject, session_number) do nothing;

-- HISTORIA (46 sesiones) - distribucion: 10 / 10 / 8 / 9 / 9
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '1medio', 'HISTORIA', s,
  case
    when s between  1 and 10 then 'his_1m_cap1_crisis_orden_liberal'
    when s between 11 and 20 then 'his_1m_cap2_guerra_fria_descolonizacion'
    when s between 21 and 28 then 'his_1m_cap3_dictadura_militar_chile'
    when s between 29 and 37 then 'his_1m_cap4_transicion_chile_actual'
    when s between 38 and 46 then 'his_1m_cap5_geografia_territorio'
  end,
  case
    when s between  1 and  3 then 'analizar contexto entreguerras: paz de Versalles, crisis de la democracia liberal y auge de totalitarismos'
    when s between  4 and  6 then 'comprender la crisis de 1929, el New Deal y sus efectos economicos en America Latina'
    when s between  7 and  8 then 'estudiar la crisis del parlamentarismo en Chile y la cuestion social'
    when s between  9 and 10 then 'analizar el Estado de bienestar en Chile (1925-1973): industrializacion, ISI, populismo y reformas estructurales'
    when s between 11 and 13 then 'explicar el origen y desarrollo de la Guerra Fria: bipolaridad, carrera armamentista y conflictos perifericos'
    when s between 14 and 15 then 'analizar el proceso de descolonizacion en Asia y Africa y el surgimiento del Tercer Mundo'
    when s between 16 and 18 then 'estudiar America Latina durante la Guerra Fria: revoluciones, dictaduras y dependencia economica'
    when s between 19 and 20 then 'comprender el proceso de reformas estructurales en Chile (Frei Montalva y Allende) y el contexto previo al golpe'
    when s between 21 and 23 then 'analizar el quiebre de la democracia en Chile en 1973: causas, golpe militar y polarizacion politica'
    when s between 24 and 26 then 'estudiar el regimen militar (1973-1990): violacion sistematica de derechos humanos, represion y exilio'
    when s between 27 and 28 then 'analizar las transformaciones economicas y sociales del neoliberalismo en Chile durante la dictadura'
    when s between 29 and 31 then 'comprender el plebiscito de 1988, el retorno a la democracia y la transicion politica chilena'
    when s between 32 and 33 then 'analizar el fin de la Guerra Fria, la caida del Muro y la nueva configuracion del orden mundial'
    when s between 34 and 35 then 'estudiar la globalizacion, sociedad del conocimiento, neoliberalismo y sus impactos sociales'
    when s between 36 and 37 then 'evaluar memoria, derechos humanos, justicia transicional y el legado de la dictadura en el Chile actual'
    when s between 38 and 40 then 'analizar la geografia fisica y humana del territorio chileno: relieves, climas, zonas naturales y poblacion'
    when s between 41 and 42 then 'comprender el sistema urbano chileno, migraciones internas y desafios de la habitabilidad'
    when s between 43 and 44 then 'analizar el sistema politico democratico chileno: instituciones, division de poderes y participacion ciudadana'
    when s = 45              then 'evaluar el modelo economico chileno actual: insercion global, desigualdad y desafios sociales'
    when s = 46              then 'integrar desafios socioambientales del Chile actual: cambio climatico, sustentabilidad y derechos humanos'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- =====================================================================
-- LISTO. Catalogo curricular 1° MEDIO cargado:
--   - 51 capitulos (Mat 14 + Fis 5 + Qui 10 + Bio 12 + Lec 5 + His 5)
--   - 276 sesiones (46 x 6 asignaturas)
-- =====================================================================
