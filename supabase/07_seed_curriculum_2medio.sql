-- =====================================================================
-- MATICO - Seed catalogo curricular 2° MEDIO
-- =====================================================================
-- Carga capitulos y sesiones para las 6 asignaturas activas.
-- Fuente: Bases Curriculares Mineduc 2019 (Decreto 19/2019)
--   Matematica:   ejes Numeros, Algebra y Funciones, Geometria, Probabilidad
--   Fisica:       Electricidad, Magnetismo, Electromagnetismo, Termodinamica
--   Quimica:      Disoluciones, Acido-base, Redox, Cinetica, Polimeros
--   Biologia:     Sistema nervioso, Endocrino, Inmune, Genetica, Salud
--   Lectora:      mismas 5 habilidades transversales (contenidos 2M)
--   Historia:     Estado, DDHH, Economia, Globalizacion, Geografia humana
-- Idempotente: se puede correr varias veces sin duplicar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CAPITULOS
-- ---------------------------------------------------------------------

-- MATEMATICA (10 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('mat_2m_cap1_reales_irracionales',         '2medio', 'MATEMATICA',  1, 'Numeros reales e irracionales',                  1),
  ('mat_2m_cap2_raices_racionalizacion',      '2medio', 'MATEMATICA',  2, 'Raices, radicacion y racionalizacion',           2),
  ('mat_2m_cap3_notacion_cientifica',         '2medio', 'MATEMATICA',  3, 'Notacion cientifica y orden de magnitud',        3),
  ('mat_2m_cap4_productos_factorizacion',     '2medio', 'MATEMATICA',  4, 'Productos notables y factorizacion',             4),
  ('mat_2m_cap5_sistemas_2x2',                '2medio', 'MATEMATICA',  5, 'Sistemas de ecuaciones lineales 2x2',            5),
  ('mat_2m_cap6_funcion_cuadratica',          '2medio', 'MATEMATICA',  6, 'Funcion cuadratica y parabola',                  6),
  ('mat_2m_cap7_funcion_inversa_raiz',        '2medio', 'MATEMATICA',  7, 'Funcion inversa y raiz cuadrada',                7),
  ('mat_2m_cap8_semejanza_tales',             '2medio', 'MATEMATICA',  8, 'Semejanza, homotecia y teorema de Tales',        8),
  ('mat_2m_cap9_cuerpos_geometricos',         '2medio', 'MATEMATICA',  9, 'Cuerpos geometricos: area y volumen',            9),
  ('mat_2m_cap10_probabilidad_estadistica',   '2medio', 'MATEMATICA', 10, 'Probabilidad, variable aleatoria y estadistica', 10)
on conflict (id) do nothing;

-- FISICA (5 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('fis_2m_cap1_electricidad_cargas',     '2medio', 'FISICA', 1, 'Electricidad: cargas y corriente',          1),
  ('fis_2m_cap2_circuitos_ohm',           '2medio', 'FISICA', 2, 'Circuitos electricos y ley de Ohm',         2),
  ('fis_2m_cap3_magnetismo',              '2medio', 'FISICA', 3, 'Magnetismo y campo magnetico',              3),
  ('fis_2m_cap4_electromagnetismo',       '2medio', 'FISICA', 4, 'Electromagnetismo e induccion',             4),
  ('fis_2m_cap5_calor_termodinamica',     '2medio', 'FISICA', 5, 'Calor, temperatura y termodinamica',        5)
on conflict (id) do nothing;

-- QUIMICA (8 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('qui_2m_cap1_disoluciones',            '2medio', 'QUIMICA', 1, 'Disoluciones quimicas y concentracion',         1),
  ('qui_2m_cap2_propiedades_coligativas', '2medio', 'QUIMICA', 2, 'Propiedades coligativas',                        2),
  ('qui_2m_cap3_acido_base_ph',           '2medio', 'QUIMICA', 3, 'Reacciones acido-base, pH y neutralizacion',     3),
  ('qui_2m_cap4_redox_electroquimica',    '2medio', 'QUIMICA', 4, 'Reacciones redox y electroquimica',              4),
  ('qui_2m_cap5_cinetica_equilibrio',     '2medio', 'QUIMICA', 5, 'Cinetica quimica y equilibrio',                  5),
  ('qui_2m_cap6_polimeros',               '2medio', 'QUIMICA', 6, 'Polimeros sinteticos y naturales',               6),
  ('qui_2m_cap7_organica_aplicada',       '2medio', 'QUIMICA', 7, 'Quimica organica aplicada',                      7),
  ('qui_2m_cap8_quimica_ambiental',       '2medio', 'QUIMICA', 8, 'Quimica y medio ambiente',                       8)
on conflict (id) do nothing;

-- BIOLOGIA (10 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('bio_2m_cap1_neurona_sinapsis',          '2medio', 'BIOLOGIA',  1, 'Neurona, sinapsis y sistema nervioso',          1),
  ('bio_2m_cap2_snc_snp_conducta',          '2medio', 'BIOLOGIA',  2, 'SNC, SNP y conducta',                            2),
  ('bio_2m_cap3_drogas_dano_cerebral',      '2medio', 'BIOLOGIA',  3, 'Drogas, alcohol y dano cerebral',                3),
  ('bio_2m_cap4_endocrino_homeostasis',     '2medio', 'BIOLOGIA',  4, 'Sistema endocrino y homeostasis',                4),
  ('bio_2m_cap5_inmune',                    '2medio', 'BIOLOGIA',  5, 'Sistema inmune e inmunidad',                     5),
  ('bio_2m_cap6_genetica_mendel',           '2medio', 'BIOLOGIA',  6, 'Genetica mendeliana',                            6),
  ('bio_2m_cap7_herencia_sexo_mutaciones',  '2medio', 'BIOLOGIA',  7, 'Herencia ligada al sexo y mutaciones',           7),
  ('bio_2m_cap8_variabilidad_evolucion',    '2medio', 'BIOLOGIA',  8, 'Variabilidad genetica y evolucion',              8),
  ('bio_2m_cap9_biotecnologia',             '2medio', 'BIOLOGIA',  9, 'Biotecnologia y aplicaciones',                   9),
  ('bio_2m_cap10_salud_bienestar',          '2medio', 'BIOLOGIA', 10, 'Salud, alimentacion y bienestar integral',      10)
on conflict (id) do nothing;

-- COMPETENCIA_LECTORA (5 capitulos - habilidades transversales con contenidos 2M)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('lec_2m_cap1_coherencia_cohesion',     '2medio', 'COMPETENCIA_LECTORA', 1, 'Coherencia, cohesion y referencia textual',                  1),
  ('lec_2m_cap2_info_explicita',          '2medio', 'COMPETENCIA_LECTORA', 2, 'Informacion explicita y vocabulario contextual avanzado',    2),
  ('lec_2m_cap3_sintesis',                '2medio', 'COMPETENCIA_LECTORA', 3, 'Sintesis local y global de textos complejos',                3),
  ('lec_2m_cap4_propositos_relaciones',   '2medio', 'COMPETENCIA_LECTORA', 4, 'Propositos, relaciones discursivas y argumentacion',         4),
  ('lec_2m_cap5_inferencia',              '2medio', 'COMPETENCIA_LECTORA', 5, 'Inferencia, intertextualidad y sentido global',              5)
on conflict (id) do nothing;

-- HISTORIA (5 capitulos)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('his_2m_cap1_estado_democracia',          '2medio', 'HISTORIA', 1, 'Estado de derecho y sistema politico democratico en Chile', 1),
  ('his_2m_cap2_ddhh_ciudadania',            '2medio', 'HISTORIA', 2, 'Derechos humanos, ciudadania e interculturalidad',          2),
  ('his_2m_cap3_economia_trabajo',           '2medio', 'HISTORIA', 3, 'Sistema economico, trabajo y desigualdades',                3),
  ('his_2m_cap4_globalizacion_geopolitica',  '2medio', 'HISTORIA', 4, 'Globalizacion, integracion regional y geopolitica',         4),
  ('his_2m_cap5_geografia_humana',           '2medio', 'HISTORIA', 5, 'Geografia humana, urbanizacion y desafios socioambientales',5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- SESIONES (46 por asignatura, total 276)
-- ---------------------------------------------------------------------

-- MATEMATICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'MATEMATICA', s,
  case
    when s between  1 and  5 then 'mat_2m_cap1_reales_irracionales'
    when s between  6 and  9 then 'mat_2m_cap2_raices_racionalizacion'
    when s between 10 and 12 then 'mat_2m_cap3_notacion_cientifica'
    when s between 13 and 17 then 'mat_2m_cap4_productos_factorizacion'
    when s between 18 and 22 then 'mat_2m_cap5_sistemas_2x2'
    when s between 23 and 28 then 'mat_2m_cap6_funcion_cuadratica'
    when s between 29 and 31 then 'mat_2m_cap7_funcion_inversa_raiz'
    when s between 32 and 36 then 'mat_2m_cap8_semejanza_tales'
    when s between 37 and 41 then 'mat_2m_cap9_cuerpos_geometricos'
    when s between 42 and 46 then 'mat_2m_cap10_probabilidad_estadistica'
  end,
  case
    when s between  1 and  5 then 'distinguir racionales e irracionales, ubicar en la recta real y operar con numeros reales'
    when s between  6 and  9 then 'aplicar propiedades de raices enesimas, racionalizar denominadores y operar con radicales'
    when s between 10 and 12 then 'expresar y comparar magnitudes en notacion cientifica y estimar ordenes de magnitud'
    when s between 13 and 17 then 'desarrollar productos notables y factorizar expresiones algebraicas con uso estrategico'
    when s between 18 and 22 then 'resolver sistemas lineales 2x2 por sustitucion, igualacion, reduccion y modelar problemas'
    when s between 23 and 28 then 'modelar y analizar funciones cuadraticas: vertice, ceros, eje y concavidad de la parabola'
    when s between 29 and 31 then 'reconocer funcion inversa, funcion raiz cuadrada, dominio, recorrido y graficos asociados'
    when s between 32 and 36 then 'aplicar semejanza, homotecia y teorema de Tales en figuras y resolucion de problemas'
    when s between 37 and 41 then 'calcular area y volumen de prismas, piramides, cilindros, conos y esferas en contexto'
    when s between 42 and 46 then 'analizar variable aleatoria, distribucion, regla de Laplace y medidas de dispersion'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- FISICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'FISICA', s,
  case
    when s between  1 and  9 then 'fis_2m_cap1_electricidad_cargas'
    when s between 10 and 19 then 'fis_2m_cap2_circuitos_ohm'
    when s between 20 and 28 then 'fis_2m_cap3_magnetismo'
    when s between 29 and 37 then 'fis_2m_cap4_electromagnetismo'
    when s between 38 and 46 then 'fis_2m_cap5_calor_termodinamica'
  end,
  case
    when s between  1 and  9 then 'explicar carga electrica, fuerza de Coulomb, corriente, voltaje y conduccion en materiales'
    when s between 10 and 19 then 'analizar circuitos en serie y paralelo aplicando ley de Ohm, potencia y consumo electrico'
    when s between 20 and 28 then 'describir campo magnetico, lineas de campo, fuerza sobre cargas y aplicaciones magneticas'
    when s between 29 and 37 then 'relacionar electricidad y magnetismo: induccion electromagnetica, motores, generadores y transformadores'
    when s between 38 and 46 then 'interpretar calor, temperatura, equilibrio termico, calor especifico, cambios de estado y leyes termodinamicas'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- QUIMICA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'QUIMICA', s,
  case
    when s between  1 and  6 then 'qui_2m_cap1_disoluciones'
    when s between  7 and 10 then 'qui_2m_cap2_propiedades_coligativas'
    when s between 11 and 17 then 'qui_2m_cap3_acido_base_ph'
    when s between 18 and 24 then 'qui_2m_cap4_redox_electroquimica'
    when s between 25 and 30 then 'qui_2m_cap5_cinetica_equilibrio'
    when s between 31 and 35 then 'qui_2m_cap6_polimeros'
    when s between 36 and 41 then 'qui_2m_cap7_organica_aplicada'
    when s between 42 and 46 then 'qui_2m_cap8_quimica_ambiental'
  end,
  case
    when s between  1 and  6 then 'calcular concentracion porcentual, molaridad, molalidad, normalidad y preparar diluciones'
    when s between  7 and 10 then 'analizar propiedades coligativas: presion de vapor, ebulloscopia, crioscopia y osmosis'
    when s between 11 and 17 then 'aplicar teorias acido-base, calcular pH y resolver reacciones de neutralizacion e indicadores'
    when s between 18 and 24 then 'identificar oxidacion-reduccion, balancear redox y describir pilas, celdas y electrolisis'
    when s between 25 and 30 then 'analizar velocidad de reaccion, factores y equilibrio quimico con principio de Le Chatelier'
    when s between 31 and 35 then 'describir polimeros sinteticos y naturales, polimerizacion y aplicaciones tecnologicas'
    when s between 36 and 41 then 'relacionar quimica organica con farmacos, alimentos, cosmeticos y nuevos materiales'
    when s between 42 and 46 then 'evaluar contaminacion, quimica verde, ciclos biogeoquimicos y sostenibilidad ambiental'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- BIOLOGIA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'BIOLOGIA', s,
  case
    when s between  1 and  5 then 'bio_2m_cap1_neurona_sinapsis'
    when s between  6 and  9 then 'bio_2m_cap2_snc_snp_conducta'
    when s between 10 and 13 then 'bio_2m_cap3_drogas_dano_cerebral'
    when s between 14 and 18 then 'bio_2m_cap4_endocrino_homeostasis'
    when s between 19 and 23 then 'bio_2m_cap5_inmune'
    when s between 24 and 28 then 'bio_2m_cap6_genetica_mendel'
    when s between 29 and 32 then 'bio_2m_cap7_herencia_sexo_mutaciones'
    when s between 33 and 37 then 'bio_2m_cap8_variabilidad_evolucion'
    when s between 38 and 41 then 'bio_2m_cap9_biotecnologia'
    when s between 42 and 46 then 'bio_2m_cap10_salud_bienestar'
  end,
  case
    when s between  1 and  5 then 'describir neurona, potencial de accion, sinapsis quimica y electrica, y neurotransmisores'
    when s between  6 and  9 then 'comparar sistema nervioso central y periferico, arcos reflejos y bases biologicas de la conducta'
    when s between 10 and 13 then 'analizar efecto de drogas, alcohol y nicotina sobre el cerebro, adiccion y prevencion'
    when s between 14 and 18 then 'explicar hormonas, glandulas endocrinas, regulacion hormonal y mecanismos de homeostasis'
    when s between 19 and 23 then 'distinguir inmunidad innata y adaptativa, vacunas, alergias y enfermedades autoinmunes'
    when s between 24 and 28 then 'aplicar leyes de Mendel, cruzamientos monohibridos y dihibridos con tablas de Punnett'
    when s between 29 and 32 then 'analizar herencia ligada al sexo, pedigris, mutaciones y enfermedades geneticas'
    when s between 33 and 37 then 'integrar variabilidad genetica, seleccion natural, deriva y especiacion como motor evolutivo'
    when s between 38 and 41 then 'evaluar biotecnologia: ADN recombinante, transgenicos, terapia genica y bioetica'
    when s between 42 and 46 then 'relacionar alimentacion, actividad fisica, salud mental y prevencion de enfermedades cronicas'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- COMPETENCIA_LECTORA (46 sesiones - mapeo una a una)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus) values
  ('2medio', 'COMPETENCIA_LECTORA',  1, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  2, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  3, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  4, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  5, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  6, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  7, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  8, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA',  9, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA', 10, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA', 11, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA', 12, 'lec_2m_cap5_inferencia',            'inferir tono, vision de mundo y sentido global en narrativa romantica y realista'),
  ('2medio', 'COMPETENCIA_LECTORA', 13, 'lec_2m_cap4_propositos_relaciones', 'analizar discurso publico, tesis, argumentos y contraargumentos en prensa actual'),
  ('2medio', 'COMPETENCIA_LECTORA', 14, 'lec_2m_cap5_inferencia',            'inferir vision de mundo y conflicto dramatico en teatro moderno y contemporaneo'),
  ('2medio', 'COMPETENCIA_LECTORA', 15, 'lec_2m_cap4_propositos_relaciones', 'analizar ensayo argumentativo, recursos retoricos y multimodalidad audiovisual'),
  ('2medio', 'COMPETENCIA_LECTORA', 16, 'lec_2m_cap3_sintesis',              'integrar y sintetizar aprendizajes semestrales en clave PAES'),
  ('2medio', 'COMPETENCIA_LECTORA', 17, 'lec_2m_cap4_propositos_relaciones', 'reconocer estructura interna y funcion comunicativa de partes en discurso publico'),
  ('2medio', 'COMPETENCIA_LECTORA', 18, 'lec_2m_cap5_inferencia',            'inferir cosmovision, simbolismo y carga ideologica en lirica contemporanea'),
  ('2medio', 'COMPETENCIA_LECTORA', 19, 'lec_2m_cap5_inferencia',            'inferir evolucion psicologica y rol simbolico de personajes en novela'),
  ('2medio', 'COMPETENCIA_LECTORA', 20, 'lec_2m_cap4_propositos_relaciones', 'evaluar critica literaria, valoracion estetica y articulacion de argumentos'),
  ('2medio', 'COMPETENCIA_LECTORA', 21, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 22, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 23, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 24, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 25, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 26, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 27, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 28, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 29, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 30, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 31, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 32, 'lec_2m_cap4_propositos_relaciones', 'analizar argumentacion formal, hecho vs opinion, falacias y debate ciudadano'),
  ('2medio', 'COMPETENCIA_LECTORA', 33, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 34, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 35, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 36, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 37, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 38, 'lec_2m_cap5_inferencia',            'inferir sentidos literarios, intertextualidad, contexto y efectos de estilo'),
  ('2medio', 'COMPETENCIA_LECTORA', 39, 'lec_2m_cap4_propositos_relaciones', 'interpretar poesia visual y experimental con relacion lenguaje verbal y disposicion grafica'),
  ('2medio', 'COMPETENCIA_LECTORA', 40, 'lec_2m_cap4_propositos_relaciones', 'leer narrativa grafica, comic y recursos multimodales con encuadre y secuencia'),
  ('2medio', 'COMPETENCIA_LECTORA', 41, 'lec_2m_cap3_sintesis',              'condensar ideas y producir sintesis breves de textos complejos'),
  ('2medio', 'COMPETENCIA_LECTORA', 42, 'lec_2m_cap4_propositos_relaciones', 'organizar oralidad, intencion comunicativa y estrategias de exposicion publica'),
  ('2medio', 'COMPETENCIA_LECTORA', 43, 'lec_2m_cap2_info_explicita',        'aplicar estrategia PAES de rastreo, localizacion y descarte con evidencia textual'),
  ('2medio', 'COMPETENCIA_LECTORA', 44, 'lec_2m_cap2_info_explicita',        'resolver vocabulario contextual avanzado mediante sinonimos, parafrasis y contexto'),
  ('2medio', 'COMPETENCIA_LECTORA', 45, 'lec_2m_cap5_inferencia',            'integrar habilidades PAES de inferencia, sintesis y justificacion en textos largos'),
  ('2medio', 'COMPETENCIA_LECTORA', 46, 'lec_2m_cap3_sintesis',              'cerrar el proceso anual sintetizando aprendizajes y estrategias lectoras')
on conflict (grade, subject, session_number) do nothing;

-- HISTORIA (46 sesiones)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'HISTORIA', s,
  case
    when s between  1 and 10 then 'his_2m_cap1_estado_democracia'
    when s between 11 and 19 then 'his_2m_cap2_ddhh_ciudadania'
    when s between 20 and 28 then 'his_2m_cap3_economia_trabajo'
    when s between 29 and 37 then 'his_2m_cap4_globalizacion_geopolitica'
    when s between 38 and 46 then 'his_2m_cap5_geografia_humana'
  end,
  case
    when s between  1 and  3 then 'comprender el Estado de derecho, division de poderes y caracteristicas de la democracia representativa'
    when s between  4 and  6 then 'analizar la Constitucion Politica de Chile, derechos fundamentales y mecanismos de proteccion'
    when s between  7 and  8 then 'estudiar el sistema electoral chileno, partidos politicos y mecanismos de participacion ciudadana'
    when s between  9 and 10 then 'evaluar instituciones publicas, transparencia, probidad y desafios actuales de la democracia'
    when s between 11 and 13 then 'analizar la Declaracion Universal de DDHH, tratados internacionales y rol de organismos como la ONU'
    when s between 14 and 15 then 'comprender la ciudadania activa, deberes civicos y mecanismos formales e informales de participacion'
    when s between 16 and 17 then 'estudiar pueblos originarios de Chile, interculturalidad y reconocimiento constitucional'
    when s between 18 and 19 then 'analizar diversidad, inclusion, equidad de genero y enfoque de derechos en Chile contemporaneo'
    when s between 20 and 22 then 'comprender el sistema economico chileno: mercado, oferta, demanda, agentes economicos y rol del Estado'
    when s between 23 and 24 then 'analizar el mundo del trabajo, derechos laborales, sindicalizacion y mercado del trabajo en Chile'
    when s between 25 and 26 then 'estudiar pobreza, desigualdad, distribucion del ingreso e indicadores socioeconomicos en Chile'
    when s between 27 and 28 then 'evaluar politicas publicas, gasto social, sistema tributario y desafios de cohesion social'
    when s between 29 and 31 then 'analizar la globalizacion economica, comercio internacional y tratados de libre comercio firmados por Chile'
    when s between 32 and 33 then 'comprender la integracion regional latinoamericana: Mercosur, Alianza del Pacifico, OEA'
    when s between 34 and 35 then 'estudiar geopolitica contemporanea, multilateralismo y nuevos actores globales'
    when s between 36 and 37 then 'analizar migraciones, refugiados, identidad cultural y desafios de la sociedad global'
    when s between 38 and 40 then 'analizar geografia humana de Chile: poblacion, densidad, distribucion y dinamicas demograficas'
    when s between 41 and 42 then 'comprender el sistema urbano chileno, segregacion, gentrificacion y calidad de vida en ciudades'
    when s between 43 and 44 then 'estudiar uso del territorio, actividades productivas, recursos naturales y conflictos socioambientales'
    when s = 45              then 'evaluar cambio climatico, transicion energetica y sostenibilidad en el Chile actual'
    when s = 46              then 'integrar desafios socioambientales, derechos humanos y proyecto de pais para el siglo XXI'
  end
from generate_series(1, 46) as s
on conflict (grade, subject, session_number) do nothing;

-- =====================================================================
-- LISTO. Catalogo curricular 2° MEDIO cargado:
--   - 43 capitulos (Mat 10 + Fis 5 + Qui 8 + Bio 10 + Lec 5 + His 5)
--   - 276 sesiones (46 x 6 asignaturas)
-- =====================================================================
