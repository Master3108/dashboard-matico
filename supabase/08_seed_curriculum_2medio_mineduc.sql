-- =====================================================================
-- MATICO - Seed catalogo curricular 2° MEDIO (REWORK MINEDUC OFICIAL)
-- =====================================================================
-- Reemplaza el seed 07_seed_curriculum_2medio.sql que estaba desalineado.
-- Fuente: Bases Curriculares Mineduc 2° medio (Decreto 19/2019) extraídas
-- de https://www.curriculumnacional.cl/curriculum/7o-basico-2o-medio/
--
-- Cambios principales vs version anterior:
--   FISICA: cinematica/Newton/momentum/Universo (NO electricidad/magnetismo)
--   QUIMICA: solo soluciones + organica (NO redox/cinetica/polimeros)
--   BIOLOGIA: incluye reproduccion humana (sin sistema inmune)
--   HISTORIA: siglo XX completo (entreguerras -> transicion democratica chilena)
--   MATEMATICA: incluye trigonometria, logaritmos, vectores
--   LENGUA: 4 ejes (lectura + escritura + oralidad + investigacion)
--
-- Estructura:
--   1. Archiva theory_ludica_bank viejos (active=false, no se borran)
--   2. Borra curriculum_sessions y chapters viejos de 2medio
--   3. Inserta chapters nuevos alineados a OA oficiales
--   4. Inserta 276 sesiones (46 x 6) mapeadas a los nuevos chapters
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ARCHIVAR TEORIAS VIEJAS (NO BORRAR — quedan inactive por trazabilidad)
-- ---------------------------------------------------------------------
update theory_ludica_bank
set active = false
where grade = '2medio' and active = true;

-- 2. ARCHIVAR PREGUNTAS VIEJAS DEL BANCO (NO BORRAR)
update question_bank
set active = false
where grade = '2medio' and active = true;

-- ---------------------------------------------------------------------
-- 3. BORRAR CURRICULUM VIEJO DE 2 MEDIO
-- ---------------------------------------------------------------------
delete from curriculum_sessions where grade = '2medio';
delete from chapters where grade = '2medio';

-- ---------------------------------------------------------------------
-- 4. INSERTAR CAPITULOS NUEVOS — MINEDUC OFICIAL
-- ---------------------------------------------------------------------

-- MATEMATICA (10 capitulos, 12 OA)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('mat_2m_cap1_calculo_reales_raices',     '2medio', 'MATEMATICA',  1, 'Calculos con numeros reales y raices (OA1)',          1),
  ('mat_2m_cap2_potencias_logaritmos',      '2medio', 'MATEMATICA',  2, 'Potencias, raices enesimas y logaritmos (OA2)',       2),
  ('mat_2m_cap3_funcion_cuadratica',        '2medio', 'MATEMATICA',  3, 'Funcion cuadratica (OA3)',                            3),
  ('mat_2m_cap4_ecuaciones_cuadraticas',    '2medio', 'MATEMATICA',  4, 'Ecuaciones cuadraticas (OA4)',                        4),
  ('mat_2m_cap5_funcion_inversa',           '2medio', 'MATEMATICA',  5, 'Funcion inversa (OA5)',                               5),
  ('mat_2m_cap6_interes_compuesto',         '2medio', 'MATEMATICA',  6, 'Cambio porcentual e interes compuesto (OA6)',         6),
  ('mat_2m_cap7_area_volumen_esfera',       '2medio', 'MATEMATICA',  7, 'Esfera: area superficial y volumen (OA7)',            7),
  ('mat_2m_cap8_trigonometria',             '2medio', 'MATEMATICA',  8, 'Razones trigonometricas (OA8)',                       8),
  ('mat_2m_cap9_vectores',                  '2medio', 'MATEMATICA',  9, 'Vectores y proyecciones (OA9)',                       9),
  ('mat_2m_cap10_probabilidad_combinatoria','2medio', 'MATEMATICA', 10, 'Variable aleatoria, combinatoria y probabilidad (OA10-12)', 10);

-- FISICA (6 capitulos, 6 OA — CN2M OA09-OA14)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('fis_2m_cap1_cinematica',           '2medio', 'FISICA', 1, 'Movimiento rectilineo: cinematica (OA9)',             1),
  ('fis_2m_cap2_leyes_newton',         '2medio', 'FISICA', 2, 'Leyes de Newton y fuerzas (OA10)',                    2),
  ('fis_2m_cap3_energia_mecanica',     '2medio', 'FISICA', 3, 'Energia mecanica, trabajo y potencia (OA11)',         3),
  ('fis_2m_cap4_momentum_colisiones',  '2medio', 'FISICA', 4, 'Momentum y colisiones (OA12)',                        4),
  ('fis_2m_cap5_universo_big_bang',    '2medio', 'FISICA', 5, 'Modelos del Universo y Big Bang (OA13)',              5),
  ('fis_2m_cap6_gravitacion_kepler',   '2medio', 'FISICA', 6, 'Gravitacion universal y leyes de Kepler (OA14)',      6);

-- QUIMICA (4 capitulos, 4 OA — CN2M OA15-OA18)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('qui_2m_cap1_soluciones',               '2medio', 'QUIMICA', 1, 'Soluciones quimicas y concentracion (OA15)',          1),
  ('qui_2m_cap2_propiedades_coligativas',  '2medio', 'QUIMICA', 2, 'Propiedades coligativas (OA16)',                      2),
  ('qui_2m_cap3_carbono_hidrocarburos',    '2medio', 'QUIMICA', 3, 'El carbono y los hidrocarburos (OA17)',               3),
  ('qui_2m_cap4_estereoquimica_isomeria',  '2medio', 'QUIMICA', 4, 'Estereoquimica e isomeria (OA18)',                    4);

-- BIOLOGIA (8 capitulos, 8 OA — CN2M OA01-OA08)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('bio_2m_cap1_sistema_nervioso',         '2medio', 'BIOLOGIA', 1, 'Sistema nervioso y autocuidado (OA1)',               1),
  ('bio_2m_cap2_hormonas',                 '2medio', 'BIOLOGIA', 2, 'Hormonas: glicemia y caracteres sexuales (OA2)',     2),
  ('bio_2m_cap3_sexualidad_reproduccion',  '2medio', 'BIOLOGIA', 3, 'Sexualidad y reproduccion humana (OA3)',             3),
  ('bio_2m_cap4_fecundacion_embarazo',     '2medio', 'BIOLOGIA', 4, 'Fecundacion, embarazo y lactancia (OA4)',            4),
  ('bio_2m_cap5_regulacion_fertilidad',    '2medio', 'BIOLOGIA', 5, 'Metodos de regulacion de la fertilidad (OA5)',       5),
  ('bio_2m_cap6_mitosis_meiosis',          '2medio', 'BIOLOGIA', 6, 'Mitosis, meiosis y anomalias celulares (OA6)',       6),
  ('bio_2m_cap7_herencia_mendel',          '2medio', 'BIOLOGIA', 7, 'Herencia genetica y leyes de Mendel (OA7)',          7),
  ('bio_2m_cap8_manipulacion_genetica',    '2medio', 'BIOLOGIA', 8, 'Manipulacion genetica y bioetica (OA8)',             8);

-- HISTORIA (10 capitulos, 25 OA)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('his_2m_cap1_entreguerras_totalitarismos','2medio', 'HISTORIA',  1, 'Crisis del Estado liberal y entreguerras (OA1-2)',        1),
  ('his_2m_cap2_segunda_guerra_mundial',     '2medio', 'HISTORIA',  2, 'Segunda Guerra Mundial y creacion de la ONU (OA3-4)',     2),
  ('his_2m_cap3_chile_crisis_parlamentaria', '2medio', 'HISTORIA',  3, 'Chile: crisis parlamentaria y Constitucion 1925 (OA5)',  3),
  ('his_2m_cap4_chile_industrializacion',    '2medio', 'HISTORIA',  4, 'Chile: industrializacion, CORFO y democratizacion (OA6-7, OA12)', 4),
  ('his_2m_cap5_guerra_fria',                '2medio', 'HISTORIA',  5, 'Guerra Fria y mundo bipolar (OA8-9, OA11)',              5),
  ('his_2m_cap6_america_latina_dictaduras',  '2medio', 'HISTORIA',  6, 'America Latina: movilizacion social y dictaduras (OA10)', 6),
  ('his_2m_cap7_chile_60_70_reformas',       '2medio', 'HISTORIA',  7, 'Chile en los 60 y 70: reformas y crisis (OA13-14)',      7),
  ('his_2m_cap8_dictadura_chilena',          '2medio', 'HISTORIA',  8, 'Dictadura militar chilena 1973-1990 (OA15-18)',          8),
  ('his_2m_cap9_transicion_democratica',     '2medio', 'HISTORIA',  9, 'Recuperacion democratica y transicion (OA19-21)',        9),
  ('his_2m_cap10_formacion_ciudadana',       '2medio', 'HISTORIA', 10, 'Formacion ciudadana: Estado de derecho, DDHH (OA22-25)', 10);

-- COMPETENCIA_LECTORA (10 capitulos, 24 OA — LE2M OA01-OA24)
insert into chapters (id, grade, subject, chapter_number, title, order_index) values
  ('lec_2m_cap1_narrativa',              '2medio', 'COMPETENCIA_LECTORA',  1, 'Lectura literaria: narrativa contemporanea y latinoamericana (OA3, OA7, OA8)', 1),
  ('lec_2m_cap2_lirica',                 '2medio', 'COMPETENCIA_LECTORA',  2, 'Lectura literaria: poesia y soneto (OA4)',              2),
  ('lec_2m_cap3_drama',                  '2medio', 'COMPETENCIA_LECTORA',  3, 'Lectura literaria: texto dramatico y teatro (OA5)',     3),
  ('lec_2m_cap4_siglo_oro',              '2medio', 'COMPETENCIA_LECTORA',  4, 'Literatura del Siglo de Oro (OA6)',                     4),
  ('lec_2m_cap5_argumentacion',          '2medio', 'COMPETENCIA_LECTORA',  5, 'Argumentacion: columnas, cartas, ensayos (OA9)',        5),
  ('lec_2m_cap6_medios_persuasion',      '2medio', 'COMPETENCIA_LECTORA',  6, 'Textos mediaticos y estrategias de persuasion (OA10)',  6),
  ('lec_2m_cap7_no_literarios',          '2medio', 'COMPETENCIA_LECTORA',  7, 'Textos no literarios para contextualizar (OA1-2, OA11)', 7),
  ('lec_2m_cap8_escritura_explicativa',  '2medio', 'COMPETENCIA_LECTORA',  8, 'Escritura: textos explicativos (OA12-13)',              8),
  ('lec_2m_cap9_escritura_argumentativa','2medio', 'COMPETENCIA_LECTORA',  9, 'Escritura: ensayos persuasivos y proceso (OA14-18)',    9),
  ('lec_2m_cap10_oralidad_investigacion','2medio', 'COMPETENCIA_LECTORA', 10, 'Comunicacion oral e investigacion (OA19-24)',          10);

-- ---------------------------------------------------------------------
-- 5. INSERTAR 276 SESIONES (46 x 6 materias)
-- ---------------------------------------------------------------------

-- MATEMATICA (46 sesiones - 10 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'MATEMATICA', s,
  case
    when s between  1 and  4 then 'mat_2m_cap1_calculo_reales_raices'
    when s between  5 and  9 then 'mat_2m_cap2_potencias_logaritmos'
    when s between 10 and 14 then 'mat_2m_cap3_funcion_cuadratica'
    when s between 15 and 18 then 'mat_2m_cap4_ecuaciones_cuadraticas'
    when s between 19 and 22 then 'mat_2m_cap5_funcion_inversa'
    when s between 23 and 26 then 'mat_2m_cap6_interes_compuesto'
    when s between 27 and 30 then 'mat_2m_cap7_area_volumen_esfera'
    when s between 31 and 36 then 'mat_2m_cap8_trigonometria'
    when s between 37 and 40 then 'mat_2m_cap9_vectores'
    when s between 41 and 46 then 'mat_2m_cap10_probabilidad_combinatoria'
  end,
  case
    when s between  1 and  4 then 'realizar calculos y estimaciones con numeros reales, descomponer raices y combinar con racionales'
    when s between  5 and  9 then 'relacionar potencias, raices enesimas y logaritmos; aplicar propiedades y resolver ecuaciones'
    when s between 10 and 14 then 'comprender la funcion cuadratica f(x)=ax2+bx+c, su grafico, vertice, ceros y simetria'
    when s between 15 and 18 then 'resolver ecuaciones cuadraticas por factorizacion, completacion de cuadrado y formula general'
    when s between 19 and 22 then 'comprender la funcion inversa: maquinas, tablas, graficos en funciones lineales y cuadraticas'
    when s between 23 and 26 then 'aplicar cambio porcentual constante e interes compuesto en situaciones financieras'
    when s between 27 and 30 then 'desarrollar formulas de area superficial y volumen de la esfera y resolver problemas'
    when s between 31 and 36 then 'comprender razones trigonometricas (seno, coseno, tangente) y aplicarlas en triangulos'
    when s between 37 and 40 then 'aplicar trigonometria en composicion y descomposicion de vectores y proyecciones'
    when s between 41 and 46 then 'comprender variables aleatorias, permutaciones, combinatoria y rol de la probabilidad en la sociedad'
  end
from generate_series(1, 46) as s;

-- FISICA (46 sesiones - 6 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'FISICA', s,
  case
    when s between  1 and  8 then 'fis_2m_cap1_cinematica'
    when s between  9 and 16 then 'fis_2m_cap2_leyes_newton'
    when s between 17 and 23 then 'fis_2m_cap3_energia_mecanica'
    when s between 24 and 30 then 'fis_2m_cap4_momentum_colisiones'
    when s between 31 and 38 then 'fis_2m_cap5_universo_big_bang'
    when s between 39 and 46 then 'fis_2m_cap6_gravitacion_kepler'
  end,
  case
    when s between  1 and  8 then 'analizar movimiento rectilineo uniforme y acelerado: posicion, velocidad, aceleracion y graficos'
    when s between  9 and 16 then 'explicar efectos de fuerzas netas con leyes de Newton y diagramas de cuerpo libre'
    when s between 17 and 23 then 'aplicar ley de conservacion de la energia mecanica, trabajo y potencia mecanica'
    when s between 24 and 30 then 'analizar colisiones usando cantidad de movimiento, impulso y ley de conservacion del momentum'
    when s between 31 and 38 then 'comparar modelos geocentrico, heliocentrico y teoria del Big Bang en la evolucion del conocimiento'
    when s between 39 and 46 then 'aplicar leyes de Kepler y gravitacion universal a mareas, orbitas y sondas espaciales'
  end
from generate_series(1, 46) as s;

-- QUIMICA (46 sesiones - 4 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'QUIMICA', s,
  case
    when s between  1 and 12 then 'qui_2m_cap1_soluciones'
    when s between 13 and 22 then 'qui_2m_cap2_propiedades_coligativas'
    when s between 23 and 34 then 'qui_2m_cap3_carbono_hidrocarburos'
    when s between 35 and 46 then 'qui_2m_cap4_estereoquimica_isomeria'
  end,
  case
    when s between  1 and 12 then 'explicar propiedades de soluciones segun estado fisico, componentes y concentracion; calcular molaridad, molalidad y porcentual'
    when s between 13 and 22 then 'planificar investigacion sobre propiedades coligativas: presion de vapor, ebulloscopia, crioscopia y osmosis'
    when s between 23 and 34 then 'modelar las propiedades del carbono que permiten formar biomoleculas e hidrocarburos (alcanos, alquenos, alquinos, aromaticos)'
    when s between 35 and 46 then 'desarrollar modelos que expliquen estereoquimica e isomeria en compuestos organicos como glucosa'
  end
from generate_series(1, 46) as s;

-- BIOLOGIA (46 sesiones - 8 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'BIOLOGIA', s,
  case
    when s between  1 and  6 then 'bio_2m_cap1_sistema_nervioso'
    when s between  7 and 11 then 'bio_2m_cap2_hormonas'
    when s between 12 and 17 then 'bio_2m_cap3_sexualidad_reproduccion'
    when s between 18 and 23 then 'bio_2m_cap4_fecundacion_embarazo'
    when s between 24 and 28 then 'bio_2m_cap5_regulacion_fertilidad'
    when s between 29 and 34 then 'bio_2m_cap6_mitosis_meiosis'
    when s between 35 and 40 then 'bio_2m_cap7_herencia_mendel'
    when s between 41 and 46 then 'bio_2m_cap8_manipulacion_genetica'
  end,
  case
    when s between  1 and  6 then 'explicar como el sistema nervioso coordina la adaptacion a estimulos; cuidados (sueno, drogas, prevencion de traumatismos)'
    when s between  7 and 11 then 'modelar regulacion de glicemia por hormonas pancreaticas y desarrollo de caracteres sexuales secundarios'
    when s between 12 and 17 then 'explicar sexualidad y reproduccion humanas considerando aspectos biologicos, sociales, afectivos y psicologicos'
    when s between 18 and 23 then 'describir fecundacion, implantacion y desarrollo embrionario; responsabilidad parental, nutricion prenatal y lactancia'
    when s between 24 and 28 then 'evaluar metodos de regulacion de fertilidad e identificar elementos de paternidad y maternidad responsables'
    when s between 29 and 34 then 'investigar transmision genetica entre generaciones: mitosis, meiosis y anomalias celulares (cancer, trisomia)'
    when s between 35 and 40 then 'desarrollar explicacion cientifica sobre herencia genetica aplicando los principios de Mendel'
    when s between 41 and 46 then 'investigar aplicaciones de manipulacion genetica en alimentos, farmacos y evaluar implicancias eticas y sociales'
  end
from generate_series(1, 46) as s;

-- HISTORIA (46 sesiones - 10 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'HISTORIA', s,
  case
    when s between  1 and  5 then 'his_2m_cap1_entreguerras_totalitarismos'
    when s between  6 and 10 then 'his_2m_cap2_segunda_guerra_mundial'
    when s between 11 and 13 then 'his_2m_cap3_chile_crisis_parlamentaria'
    when s between 14 and 18 then 'his_2m_cap4_chile_industrializacion'
    when s between 19 and 23 then 'his_2m_cap5_guerra_fria'
    when s between 24 and 27 then 'his_2m_cap6_america_latina_dictaduras'
    when s between 28 and 31 then 'his_2m_cap7_chile_60_70_reformas'
    when s between 32 and 37 then 'his_2m_cap8_dictadura_chilena'
    when s between 38 and 41 then 'his_2m_cap9_transicion_democratica'
    when s between 42 and 46 then 'his_2m_cap10_formacion_ciudadana'
  end,
  case
    when s between  1 and  5 then 'relacionar transformaciones culturales de entreguerras con rupturas esteticas; analizar crisis del Estado liberal, totalitarismos y populismo'
    when s between  6 and 10 then 'analizar Segunda Guerra Mundial: ideologias antagonicas, devastacion humana; evaluar consecuencias y creacion de la ONU'
    when s between 11 and 13 then 'analizar crisis del periodo parlamentario chileno y la Constitucion de 1925'
    when s between 14 and 18 then 'analizar transformaciones post-1929 en Chile: industrializacion por sustitucion, CORFO, democratizacion y pobreza mid-siglo XX'
    when s between 19 and 23 then 'analizar Guerra Fria: confrontacion bipolar, transformaciones occidentales y auge del neoliberalismo al cierre'
    when s between 24 and 27 then 'caracterizar movilizacion social latinoamericana, revoluciones y dictaduras militares regionales'
    when s between 28 and 31 then 'analizar Chile en los 60 (reformas estructurales) y la crisis de inicios de los 70'
    when s between 32 and 37 then 'comparar interpretaciones del golpe de 1973; explicar dictadura militar, supresion de DDHH, modelo neoliberal y Constitucion de 1980'
    when s between 38 and 41 then 'explicar factores de recuperacion democratica en los 80, transicion y reformas constitucionales; sociedad post-democratizacion'
    when s between 42 and 46 then 'analizar formacion ciudadana: derechos humanos, Estado de derecho, desafios pendientes (pobreza, desigualdad) y diversidad'
  end
from generate_series(1, 46) as s;

-- COMPETENCIA_LECTORA (46 sesiones - 10 capitulos)
insert into curriculum_sessions (grade, subject, session_number, chapter_id, focus)
select '2medio', 'COMPETENCIA_LECTORA', s,
  case
    when s between  1 and  7 then 'lec_2m_cap1_narrativa'
    when s between  8 and 11 then 'lec_2m_cap2_lirica'
    when s between 12 and 15 then 'lec_2m_cap3_drama'
    when s between 16 and 19 then 'lec_2m_cap4_siglo_oro'
    when s between 20 and 25 then 'lec_2m_cap5_argumentacion'
    when s between 26 and 29 then 'lec_2m_cap6_medios_persuasion'
    when s between 30 and 32 then 'lec_2m_cap7_no_literarios'
    when s between 33 and 36 then 'lec_2m_cap8_escritura_explicativa'
    when s between 37 and 41 then 'lec_2m_cap9_escritura_argumentativa'
    when s between 42 and 46 then 'lec_2m_cap10_oralidad_investigacion'
  end,
  case
    when s between  1 and  7 then 'analizar narraciones: conflictos, personajes, estructura, perspectiva del narrador, simbolos y recursos literarios (cuento y novela latinoamericana)'
    when s between  8 and 11 then 'analizar poemas: simbolos, actitud del hablante, lenguaje figurado, repeticiones y caracteristicas del soneto'
    when s between 12 and 15 then 'analizar textos dramaticos: conflicto, personajes, simbolos, atmosfera y elementos de puesta en escena'
    when s between 16 and 19 then 'comprender la relevancia de obras del Siglo de Oro espanol considerando contexto historico-cultural'
    when s between 20 and 25 then 'analizar y evaluar textos argumentativos (columnas, cartas, ensayos): tesis, recursos persuasivos y validez'
    when s between 26 and 29 then 'analizar textos mediaticos: propositos, estrategias de persuasion y efectos de recursos linguisticos y visuales'
    when s between 30 and 32 then 'leer textos no literarios para contextualizar lecturas literarias y comprender experiencia humana'
    when s between 33 and 36 then 'escribir textos explicativos con presentacion clara, organizacion coherente, ejemplos y evidencias'
    when s between 37 and 41 then 'planificar, escribir, revisar y editar ensayos persuasivos: hipotesis, evidencias, contraargumentos y ortografia'
    when s between 42 and 46 then 'comprender y producir comunicacion oral (dialogo, exposicion) y realizar investigacion con fuentes confiables'
  end
from generate_series(1, 46) as s;

-- =====================================================================
-- LISTO. Catalogo curricular 2° MEDIO MINEDUC OFICIAL cargado:
--   - 48 capitulos (Mat 10 + Fis 6 + Qui 4 + Bio 8 + Lec 10 + His 10)
--   - 276 sesiones (46 x 6 asignaturas)
--   - Teorias viejas archivadas (active=false), no borradas
-- =====================================================================
