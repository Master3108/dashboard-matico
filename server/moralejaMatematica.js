import { resolveMoralejaSessionReference } from './moralejaSessionCatalog.js';
const MORALEJA_MATH_MATERIAL_ID = 'moraleja_matematica_2025';
const CURRICULUM_BRIDGE_MATERIAL_ID = 'matico_curriculum_bridge';

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// =====================================================================
// CAPITULOS 1° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA MA1M 01-15)
// =====================================================================
const CHAPTERS_LEGACY_DISABLED = [
    {
        id: 'cap1_enteros',
        chapterNumber: 1,
        title: 'Conjuntos numericos e enteros',
        skill: 'Numeros enteros, divisibilidad y aritmetica basica',
        keywords: ['enteros', 'valor absoluto', 'divisibilidad', 'multiplos', 'divisores', 'primos', 'mcd', 'm.c.d', 'mcm', 'm.c.m', 'paridad', 'papomudas'],
        theoryFocus: [
            'explicar conjuntos numericos, valor absoluto y orden en enteros',
            'resolver operatoria con signos y prioridad de operaciones',
            'usar criterios de divisibilidad, numeros primos, m.c.m y M.C.D en problemas'
        ],
        quizFocus: [
            'operatoria de enteros',
            'divisibilidad y numeros primos',
            'mcm y mcd',
            'planteamiento de problemas aritmeticos'
        ]
    },
    {
        id: 'cap2_racionales',
        chapterNumber: 2,
        title: 'Numeros racionales y decimales',
        skill: 'Fracciones, decimales y aproximaciones',
        keywords: ['racionales', 'fracciones', 'decimal', 'decimales', 'periodico', 'semiperiodico', 'fraccion', 'aproximacion', 'redondeo', 'truncamiento'],
        theoryFocus: [
            'distinguir tipos de fracciones y decimales',
            'operar sumas, restas, productos y cocientes de racionales',
            'comparar, aproximar, truncar y redondear correctamente'
        ],
        quizFocus: [
            'operatoria con fracciones',
            'conversion fraccion-decimal',
            'orden de racionales',
            'aproximaciones'
        ]
    },
    {
        id: 'cap3_porcentaje_finanzas',
        chapterNumber: 3,
        title: 'Porcentaje y matematica financiera',
        skill: 'Porcentajes, variaciones y contexto financiero',
        keywords: ['porcentaje', 'porcentual', 'descuento', 'aumento', 'interes', 'interes simple', 'interes compuesto', 'boleta', 'liquidacion', 'afp', 'isapre', 'credito', 'cae', 'ipc'],
        theoryFocus: [
            'calcular porcentajes directos, inversos y encadenados',
            'interpretar cambios absolutos y relativos',
            'aplicar porcentajes a sueldos, descuentos, intereses y creditos'
        ],
        quizFocus: [
            'porcentajes y descuentos',
            'variacion porcentual',
            'interes simple y compuesto',
            'matematica financiera cotidiana'
        ]
    },
    {
        id: 'cap4_reales',
        chapterNumber: 4,
        title: 'Numeros reales, potencias y raices',
        skill: 'Potencias, radicales y notacion cientifica',
        keywords: ['reales', 'irracionales', 'potencias', 'raices', 'radicales', 'notacion cientifica', 'racionalizacion'],
        theoryFocus: [
            'distinguir racionales e irracionales dentro de los reales',
            'aplicar propiedades de potencias y raices',
            'trabajar orden, simplificacion y notacion cientifica'
        ],
        quizFocus: [
            'propiedades de potencias',
            'operatoria con raices',
            'notacion cientifica',
            'comparacion de numeros reales'
        ]
    },
    {
        id: 'cap5_algebra',
        chapterNumber: 5,
        title: 'Algebra',
        skill: 'Expresiones algebraicas, factorizacion y fracciones algebraicas',
        keywords: ['algebra', 'polinomios', 'productos notables', 'factorizacion', 'fracciones algebraicas', 'terminos semejantes', 'mcd algebraico', 'mcm algebraico'],
        theoryFocus: [
            'traducir lenguaje verbal a lenguaje algebraico',
            'reducir, multiplicar y factorizar expresiones',
            'simplificar y operar fracciones algebraicas'
        ],
        quizFocus: [
            'productos notables',
            'factorizacion',
            'operaciones algebraicas',
            'modelacion algebraica'
        ]
    },
    {
        id: 'cap6_proporcionalidad',
        chapterNumber: 6,
        title: 'Proporcionalidad',
        skill: 'Proporcionalidad directa, inversa y compuesta',
        keywords: ['proporcionalidad', 'directamente proporcional', 'inversamente proporcional', 'razon', 'regla de tres', 'constante de proporcionalidad'],
        theoryFocus: [
            'identificar cuando dos variables son directamente o inversamente proporcionales',
            'usar tablas, graficos y razones para justificar la relacion',
            'resolver problemas de proporcionalidad compuesta'
        ],
        quizFocus: [
            'razones y proporciones',
            'proporcionalidad directa e inversa',
            'proporcionalidad compuesta',
            'interpretacion de tablas y graficos'
        ]
    },
    {
        id: 'cap7_ecuaciones',
        chapterNumber: 7,
        title: 'Ecuaciones y sistemas',
        skill: 'Ecuaciones lineales, sistemas y planteamiento',
        keywords: ['ecuaciones', 'sistemas', 'sustitucion', 'igualacion', 'reduccion', 'valor absoluto', 'planteamiento', 'edades'],
        theoryFocus: [
            'resolver ecuaciones de primer grado y fraccionarias',
            'resolver sistemas 2x2 por distintos metodos',
            'plantear ecuaciones desde problemas de contexto'
        ],
        quizFocus: [
            'ecuaciones lineales',
            'sistemas de ecuaciones',
            'problemas de planteamiento',
            'analisis de soluciones'
        ]
    },
    {
        id: 'cap8_potencias_raices',
        chapterNumber: 8,
        title: 'Potencias y raices',
        skill: 'Potencias, radicales y ecuaciones irracionales',
        keywords: ['ecuacion irracional', 'potencias y raices', 'ecuacion exponencial', 'radical', 'racionalizar'],
        theoryFocus: [
            'usar propiedades de potencias y radicales con fluidez',
            'racionalizar denominadores',
            'resolver ecuaciones irracionales y exponenciales simples'
        ],
        quizFocus: [
            'potencias',
            'raices',
            'racionalizacion',
            'ecuaciones irracionales'
        ]
    },
    {
        id: 'cap9_inecuaciones',
        chapterNumber: 9,
        title: 'Desigualdades e inecuaciones',
        skill: 'Intervalos e inecuaciones',
        keywords: ['inecuacion', 'inecuaciones', 'intervalos', 'desigualdades', 'valor absoluto'],
        theoryFocus: [
            'interpretar desigualdades e intervalos',
            'resolver inecuaciones lineales, cuadraticas y fraccionarias',
            'representar soluciones en notacion de intervalos'
        ],
        quizFocus: [
            'desigualdades',
            'intervalos',
            'inecuaciones lineales',
            'inecuaciones cuadraticas y fraccionarias'
        ]
    },
    {
        id: 'cap10_logaritmos',
        chapterNumber: 10,
        title: 'Logaritmos',
        skill: 'Definicion, propiedades y ecuaciones logaritmicas',
        keywords: ['logaritmos', 'logaritmo', 'ln', 'cambio de base', 'ecuacion logaritmica'],
        theoryFocus: [
            'interpretar logaritmos como exponentes',
            'aplicar propiedades de producto, cociente y potencia',
            'resolver ecuaciones logaritmicas y comparar logaritmos'
        ],
        quizFocus: [
            'definicion de logaritmo',
            'propiedades logaritmicas',
            'cambio de base',
            'ecuaciones logaritmicas'
        ]
    },
    {
        id: 'cap11_funcion_lineal',
        chapterNumber: 11,
        title: 'Funcion lineal y afin',
        skill: 'Rectas, pendiente y evaluacion funcional',
        keywords: ['funcion lineal', 'funcion afin', 'pendiente', 'recta', 'dominio', 'recorrido', 'funciones por tramos'],
        theoryFocus: [
            'evaluar funciones y leer puntos en el plano cartesiano',
            'distinguir funcion constante, lineal y afin',
            'calcular pendiente, intersecciones y ecuacion de la recta'
        ],
        quizFocus: [
            'evaluacion de funciones',
            'pendiente',
            'ecuacion de la recta',
            'funcion afin'
        ]
    },
    {
        id: 'cap12_funcion_cuadratica',
        chapterNumber: 12,
        title: 'Funcion cuadratica y potencia',
        skill: 'Parabolas y funciones potencia',
        keywords: ['funcion cuadratica', 'parabola', 'vertice', 'discriminante', 'funcion potencia', 'concavidad'],
        theoryFocus: [
            'analizar concavidad, vertice e intersecciones de funciones cuadraticas',
            'usar forma canonica y discriminante',
            'describir funciones potencia segun exponente y transformaciones'
        ],
        quizFocus: [
            'vertice y eje de simetria',
            'intersecciones',
            'discriminante',
            'funcion potencia'
        ]
    },
    {
        id: 'cap13_geometria',
        chapterNumber: 13,
        title: 'Geometria y transformaciones',
        skill: 'Vectores, transformaciones y geometria en el plano',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['vectores', 'transformaciones', 'isometricas', 'homotecia', 'congruencia', 'semejanza', 'thales', 'recta', 'plano cartesiano'],
        theoryFocus: [
            'reconocer relaciones geometricas, transformaciones y razonamiento espacial',
            'justificar propiedades de semejanza, congruencia y teorema de thales',
            'interpretar representaciones en el plano y ecuaciones de la recta cuando corresponda'
        ],
        quizFocus: [
            'vectores y desplazamientos',
            'transformaciones geometricas',
            'congruencia y semejanza',
            'recta en el plano'
        ]
    },
    {
        id: 'cap14_datos_probabilidad',
        chapterNumber: 14,
        title: 'Datos y probabilidad',
        skill: 'Estadistica descriptiva, conteo y probabilidad',
        materialId: CURRICULUM_BRIDGE_MATERIAL_ID,
        keywords: ['frecuencia', 'medidas', 'dispersion', 'cajon', 'estadistica', 'probabilidad', 'conteo', 'laplace', 'condicional'],
        theoryFocus: [
            'leer tablas y graficos con foco en interpretacion y modelacion',
            'calcular medidas descriptivas y justificar su uso',
            'resolver problemas de conteo y probabilidad con estrategia explicita'
        ],
        quizFocus: [
            'tablas y graficos',
            'medidas de tendencia central y dispersion',
            'tecnicas de conteo',
            'probabilidad'
        ]
    }
];

// CHAPTERS reales de 1° medio alineados a OA Mineduc oficial
const CHAPTERS = [
    {
        id: 'cap1_racionales',
        chapterNumber: 1,
        title: 'Operaciones con numeros racionales (OA1)',
        skill: 'Calcular operaciones con racionales en forma simbolica',
        keywords: ['racionales', 'fraccion', 'decimal', 'periodico', 'operatoria', 'simbolico', 'suma', 'resta', 'producto', 'cociente'],
        theoryFocus: [
            'calcular operaciones (suma, resta, producto, cociente) con numeros racionales en forma simbolica',
            'representar racionales como fracciones, decimales finitos y periodicos',
            'aplicar reglas de operatoria con signos y conversiones entre representaciones'
        ],
        quizFocus: ['operatoria con fracciones', 'conversion fraccion-decimal', 'operatoria simbolica con racionales', 'planteamiento con racionales']
    },
    {
        id: 'cap2_potencias_racional',
        chapterNumber: 2,
        title: 'Potencias de base racional y exponente entero (OA2)',
        skill: 'Comprender potencias y aplicar propiedades',
        keywords: ['potencia', 'base racional', 'exponente entero', 'propiedades de potencias', 'crecimiento', 'decrecimiento'],
        theoryFocus: [
            'comprender potencias de base racional y exponente entero (positivo, negativo y cero)',
            'transferir propiedades: producto, cociente, potencia de potencia',
            'relacionar potencias con cambios de cantidades y resolver problemas cotidianos'
        ],
        quizFocus: ['propiedades de potencias', 'potencias con exponente negativo', 'aplicaciones contextuales', 'comparacion de potencias']
    },
    {
        id: 'cap3_productos_notables',
        chapterNumber: 3,
        title: 'Productos notables y factorizacion (OA3)',
        skill: 'Desarrollar productos notables y factorizar',
        keywords: ['producto notable', 'cuadrado de binomio', 'suma por diferencia', 'cubo de binomio', 'factorizacion', 'factor comun', 'trinomio'],
        theoryFocus: [
            'desarrollar productos notables de manera concreta, pictorica y simbolica',
            'transformar productos en sumas usando cuadrado de binomio, suma por diferencia, cubo de binomio',
            'aplicar productos notables a situaciones concretas y factorizar'
        ],
        quizFocus: ['productos notables', 'factorizacion estrategica', 'simplificacion algebraica', 'aplicaciones']
    },
    {
        id: 'cap4_sistemas_2x2',
        chapterNumber: 4,
        title: 'Sistemas de ecuaciones lineales 2x2 (OA4)',
        skill: 'Resolver sistemas 2x2 con representaciones graficas y simbolicas',
        keywords: ['sistema', 'ecuaciones lineales', '2x2', 'sustitucion', 'igualacion', 'reduccion', 'grafico', 'plano cartesiano'],
        theoryFocus: [
            'resolver sistemas de ecuaciones lineales 2x2 mediante sustitucion, igualacion y reduccion',
            'representar sistemas graficamente como interseccion de rectas en el plano',
            'modelar y resolver problemas de la vida diaria con sistemas'
        ],
        quizFocus: ['metodos de resolucion 2x2', 'representacion grafica', 'modelacion con sistemas', 'analisis de soluciones']
    },
    {
        id: 'cap5_funcion_lineal',
        chapterNumber: 5,
        title: 'Funcion lineal y afin (OA5)',
        skill: 'Graficar relaciones lineales f(x,y)=ax+by',
        keywords: ['funcion lineal', 'funcion afin', 'pendiente', 'recta', 'plano cartesiano', 'tabla de valores', 'relacion lineal'],
        theoryFocus: [
            'graficar relaciones lineales en dos variables f(x,y)=ax+by',
            'crear tablas de valores y representar ecuaciones en el plano cartesiano',
            'interpretar pendiente y puntos especiales de rectas'
        ],
        quizFocus: ['representacion grafica de la recta', 'pendiente y ordenada al origen', 'tabla de valores', 'modelacion lineal']
    },
    {
        id: 'cap6_sector_circular',
        chapterNumber: 6,
        title: 'Sectores y segmentos circulares (OA6)',
        skill: 'Calcular area y perimetro de sectores y segmentos',
        keywords: ['sector circular', 'segmento circular', 'arco', 'angulo central', 'area', 'perimetro', 'circunferencia'],
        theoryFocus: [
            'desarrollar formulas para area y perimetro de sectores circulares a partir de angulos centrales',
            'desarrollar formulas para segmentos circulares',
            'aplicar a problemas geometricos contextuales'
        ],
        quizFocus: ['area de sector y segmento', 'perimetro y longitud de arco', 'angulos centrales', 'modelacion']
    },
    {
        id: 'cap7_cono',
        chapterNumber: 7,
        title: 'Cono: area de superficie y volumen (OA7)',
        skill: 'Formular y aplicar formulas del cono',
        keywords: ['cono', 'area lateral', 'area total', 'volumen del cono', 'generatriz', 'altura', 'radio', 'red'],
        theoryFocus: [
            'formular y aplicar formulas para area de superficie y volumen del cono',
            'experimentar con redes del cono y relacionar con cilindros',
            'resolver problemas contextuales con conos'
        ],
        quizFocus: ['area lateral y total del cono', 'volumen del cono', 'modelacion con conos', 'comparacion con cilindro']
    },
    {
        id: 'cap8_homotecia',
        chapterNumber: 8,
        title: 'Homotecia y vectores (OA8, OA11)',
        skill: 'Comprender homotecia y representarla vectorialmente',
        keywords: ['homotecia', 'razon de homotecia', 'centro', 'vector', 'producto por escalar', 'perspectiva', 'instrumentos opticos'],
        theoryFocus: [
            'comprender homotecia relacionandola con perspectiva e instrumentos opticos',
            'representar homotecia de forma vectorial (producto de un vector por un escalar)',
            'aplicar propiedades en construcciones'
        ],
        quizFocus: ['homotecia y razon', 'representacion vectorial', 'aplicaciones con instrumentos opticos', 'construcciones geometricas']
    },
    {
        id: 'cap9_tales_semejanza',
        chapterNumber: 9,
        title: 'Teorema de Tales y semejanza (OA9, OA10)',
        skill: 'Aplicar Tales y semejanza en problemas',
        keywords: ['tales', 'thales', 'semejanza', 'proporcionalidad', 'modelo a escala', 'figuras semejantes', 'criterios de semejanza'],
        theoryFocus: [
            'desarrollar el teorema de Tales mediante propiedades de homotecia',
            'aplicar criterios de semejanza para resolver problemas',
            'aplicar semejanza y proporcionalidad a modelos a escala y situaciones cotidianas'
        ],
        quizFocus: ['teorema de Tales', 'criterios de semejanza', 'modelos a escala', 'problemas de proporcionalidad']
    },
    {
        id: 'cap10_probabilidad_estadistica',
        chapterNumber: 10,
        title: 'Probabilidad y estadistica de dos variables (OA12-15)',
        skill: 'Probabilidad aditiva/multiplicativa y comparacion de poblaciones',
        keywords: ['tabla de doble entrada', 'nube de puntos', 'probabilidad aditiva', 'probabilidad multiplicativa', 'azar', 'galton', 'comparacion poblaciones'],
        theoryFocus: [
            'registrar distribuciones de dos caracteristicas en tablas de doble entrada y nubes de puntos',
            'comparar poblaciones mediante graficos xy con nubes de puntos en dos colores',
            'desarrollar reglas de probabilidad aditiva y multiplicativa; experimentar con tablas de Galton'
        ],
        quizFocus: ['tablas de doble entrada', 'nubes de puntos', 'probabilidad aditiva y multiplicativa', 'analisis de azar']
    }
];

// =====================================================================
// CAPITULOS 2° MEDIO — MINEDUC OFICIAL (Decreto 19/2019, OA MA2M 01-12)
// =====================================================================
const CHAPTERS_2M = [
    {
        id: 'cap1_calculo_reales_raices',
        chapterNumber: 1,
        title: 'Calculos con numeros reales y raices (OA1)',
        skill: 'Realizar calculos y estimaciones con numeros reales',
        keywords: ['reales', 'raiz', 'raices', 'descomposicion', 'racionales', 'irracionales', 'aproximar', 'estimar', 'recta real'],
        theoryFocus: [
            'realizar calculos exactos y estimaciones con numeros reales',
            'descomponer raices y combinar con numeros racionales',
            'comparar y aproximar magnitudes irracionales en la recta real'
        ],
        quizFocus: [
            'descomposicion y combinacion de raices con racionales',
            'estimaciones razonadas con reales',
            'comparacion y orden de irracionales',
            'resolucion de problemas con numeros reales'
        ]
    },
    {
        id: 'cap2_potencias_logaritmos',
        chapterNumber: 2,
        title: 'Potencias, raices enesimas y logaritmos (OA2)',
        skill: 'Relacionar potencias, raices enesimas y logaritmos',
        keywords: ['potencias', 'raiz enesima', 'logaritmo', 'log', 'ln', 'cambio de base', 'exponente', 'propiedades', 'ecuacion logaritmica', 'ecuacion exponencial'],
        theoryFocus: [
            'relacionar potencias con raices enesimas y logaritmos',
            'aplicar propiedades de logaritmos: producto, cociente, potencia, cambio de base',
            'resolver ecuaciones exponenciales y logaritmicas simples'
        ],
        quizFocus: [
            'conversion entre potencias, raices enesimas y logaritmos',
            'propiedades de logaritmos',
            'ecuaciones exponenciales y logaritmicas',
            'aplicaciones en contexto'
        ]
    },
    {
        id: 'cap3_funcion_cuadratica',
        chapterNumber: 3,
        title: 'Funcion cuadratica (OA3)',
        skill: 'Comprender la funcion cuadratica y representarla',
        keywords: ['funcion cuadratica', 'parabola', 'vertice', 'eje de simetria', 'concavidad', 'ceros', 'ax2', 'grafico', 'puntos especiales'],
        theoryFocus: [
            'reconocer la funcion cuadratica f(x)=ax^2+bx+c en contextos reales',
            'representar funcion cuadratica en tablas y graficos (parabola)',
            'determinar vertice, eje de simetria, ceros y puntos especiales'
        ],
        quizFocus: [
            'identificacion de la funcion cuadratica en contexto',
            'lectura e interpretacion de graficos (parabola)',
            'vertice, eje de simetria y ceros',
            'modelacion con cuadraticas'
        ]
    },
    {
        id: 'cap4_ecuaciones_cuadraticas',
        chapterNumber: 4,
        title: 'Ecuaciones cuadraticas (OA4)',
        skill: 'Resolver ecuaciones cuadraticas por distintos metodos',
        keywords: ['ecuacion cuadratica', 'factorizacion', 'completar cuadrado', 'formula general', 'discriminante', 'raices', 'soluciones'],
        theoryFocus: [
            'resolver ecuaciones cuadraticas (ax^2=b, (ax+b)^2=c, ax^2+bx=0, ax^2+bx+c=0)',
            'aplicar factorizacion, completacion de cuadrado y formula general',
            'analizar discriminante para clasificar soluciones'
        ],
        quizFocus: [
            'resolucion por factorizacion',
            'formula general y discriminante',
            'completacion de cuadrado',
            'aplicaciones a problemas'
        ]
    },
    {
        id: 'cap5_funcion_inversa',
        chapterNumber: 5,
        title: 'Funcion inversa (OA5)',
        skill: 'Comprender la inversa de una funcion',
        keywords: ['funcion inversa', 'biyectiva', 'reflexion', 'maquina de funciones', 'composicion', 'dominio', 'recorrido', 'simetria respecto a y=x'],
        theoryFocus: [
            'identificar funciones invertibles usando maquinas, tablas y graficos',
            'calcular inversas de funciones lineales y cuadraticas (con restriccion de dominio)',
            'interpretar la inversa como reflexion respecto a la recta y=x'
        ],
        quizFocus: [
            'calculo de funcion inversa',
            'representacion grafica de la inversa',
            'restriccion de dominio en funciones cuadraticas',
            'composicion f(f^{-1}(x))=x'
        ]
    },
    {
        id: 'cap6_interes_compuesto',
        chapterNumber: 6,
        title: 'Cambio porcentual constante e interes compuesto (OA6)',
        skill: 'Aplicar cambio porcentual constante en situaciones financieras',
        keywords: ['interes compuesto', 'porcentaje', 'cambio porcentual', 'capitalizacion', 'tasa', 'credito', 'inversion', 'crecimiento exponencial', 'cae'],
        theoryFocus: [
            'identificar cambio porcentual constante como interes compuesto',
            'representar interes compuesto en tablas, graficos y formulas',
            'resolver problemas financieros cotidianos (creditos, inversiones, AFP)'
        ],
        quizFocus: [
            'calculo de interes compuesto',
            'comparacion interes simple vs compuesto',
            'aplicaciones financieras cotidianas',
            'crecimiento porcentual constante'
        ]
    },
    {
        id: 'cap7_area_volumen_esfera',
        chapterNumber: 7,
        title: 'Esfera: area superficial y volumen (OA7)',
        skill: 'Desarrollar y aplicar formulas de la esfera',
        keywords: ['esfera', 'area superficial', 'volumen', 'radio', 'casquete', '4 pi r2', 'volumen esfera'],
        theoryFocus: [
            'conjeturar y desarrollar formulas del area superficial y volumen de la esfera',
            'representar esfera, secciones y casquetes',
            'resolver problemas geometricos y de modelacion con esferas'
        ],
        quizFocus: [
            'area superficial de la esfera',
            'volumen de la esfera',
            'problemas con esferas y casquetes',
            'modelacion contextual'
        ]
    },
    {
        id: 'cap8_trigonometria',
        chapterNumber: 8,
        title: 'Razones trigonometricas (OA8)',
        skill: 'Comprender razones trigonometricas en triangulos rectangulos',
        keywords: ['trigonometria', 'seno', 'coseno', 'tangente', 'razones trigonometricas', 'triangulo rectangulo', 'angulo', 'semejanza', 'cateto', 'hipotenusa'],
        theoryFocus: [
            'relacionar razones trigonometricas (seno, coseno, tangente) con semejanza',
            'explicar pictoricamente las razones en triangulos rectangulos',
            'aplicar razones trigonometricas en resolucion de triangulos y problemas'
        ],
        quizFocus: [
            'calculo de seno, coseno y tangente',
            'resolucion de triangulos rectangulos',
            'aplicaciones (alturas, distancias)',
            'identidades basicas'
        ]
    },
    {
        id: 'cap9_vectores',
        chapterNumber: 9,
        title: 'Vectores y proyecciones (OA9)',
        skill: 'Aplicar trigonometria en composicion y descomposicion de vectores',
        keywords: ['vector', 'vectores', 'componente', 'proyeccion', 'modulo', 'magnitud', 'direccion', 'sentido', 'descomposicion'],
        theoryFocus: [
            'representar vectores en el plano con modulo, direccion y sentido',
            'componer y descomponer vectores usando razones trigonometricas',
            'calcular proyecciones de vectores sobre ejes'
        ],
        quizFocus: [
            'composicion y descomposicion vectorial',
            'proyecciones',
            'modulo y direccion de un vector',
            'aplicaciones a fuerza y velocidad'
        ]
    },
    {
        id: 'cap10_probabilidad_combinatoria',
        chapterNumber: 10,
        title: 'Variable aleatoria, combinatoria y probabilidad (OA10-12)',
        skill: 'Comprender variable aleatoria, combinatoria y probabilidad',
        keywords: ['variable aleatoria', 'distribucion', 'permutacion', 'combinatoria', 'factorial', 'probabilidad', 'laplace', 'medios de comunicacion'],
        theoryFocus: [
            'comprender variables aleatorias finitas: definir, calcular probabilidades y graficar distribuciones',
            'utilizar permutaciones y combinatoria para calcular probabilidades',
            'analizar el rol de la probabilidad en medios y decisiones cotidianas'
        ],
        quizFocus: [
            'variable aleatoria y distribucion',
            'permutaciones y combinatoria',
            'calculo de probabilidades compuestas',
            'lectura critica de probabilidades en medios'
        ]
    }
];

const fallbackChapter = CHAPTERS[0];
const CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const fallbackChapter2M = CHAPTERS_2M[0];
const CHAPTERS_BY_ID_2M = Object.fromEntries(CHAPTERS_2M.map((chapter) => [chapter.id, chapter]));

const scoreChapter = (chapter, normalizedTopic) => chapter.keywords.reduce((score, keyword) => {
    return normalizedTopic.includes(keyword) ? score + 1 : score;
}, 0);

const normalizeGradeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return '1medio';
    if (raw === '2medio' || raw === '2m' || raw === '2°medio' || raw === 'segundo' || raw === 'segundomedio') return '2medio';
    return '1medio';
};

export const resolveMoralejaMatematicaContext = ({ topic = '', session = 0, phase = '', mode = 'quiz', grade = '1medio' } = {}) => {
    const normalizedTopic = normalize(topic);
    const numericSession = Number(session || 0) || 0;
    const normalizedPhase = normalize(phase);
    const gradeKey = normalizeGradeKey(grade);
    const is2M = gradeKey === '2medio';
    const chaptersForGrade = is2M ? CHAPTERS_2M : CHAPTERS;
    const chaptersByIdForGrade = is2M ? CHAPTERS_BY_ID_2M : CHAPTERS_BY_ID;
    const fallbackForGrade = is2M ? fallbackChapter2M : fallbackChapter;

    const sessionReference = resolveMoralejaSessionReference({
        subject: 'MATEMATICA',
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
            // fallback por rango solo en 1° medio (preserva comportamiento previo)
            if (numericSession >= 1 && numericSession <= 7) {
                bestChapter = CHAPTERS[0];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 8 && numericSession <= 12) {
                bestChapter = CHAPTERS[1];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 13 && numericSession <= 18) {
                bestChapter = CHAPTERS[2];
                resolutionMode = 'session_range_fallback';
            } else if (numericSession >= 19 && numericSession <= 24) {
                bestChapter = CHAPTERS[3];
                resolutionMode = 'session_range_fallback';
            }
        }
    }

    const chapterLabel = `Capitulo ${bestChapter.chapterNumber}: ${bestChapter.title}`;

    return {
        materialId: MORALEJA_MATH_MATERIAL_ID,
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
            `Enfoca la explicacion en ${bestChapter.theoryFocus.join(', ')}.`,
            'Incluye procedimiento paso a paso, errores frecuentes y una mini aplicacion tipo DEMRE/PAES.'
        ].filter(Boolean).join('\n'),
        quizGuidance: [
            `Base pedagogica obligatoria: ${chapterLabel}.`,
            `Habilidad a evaluar: ${bestChapter.skill}.`,
            sessionReference?.focus ? `Considera especificamente esta sesion: ${sessionReference.focus}.` : '',
            `Prioriza ${bestChapter.quizFocus.join(', ')}.`,
            'Las preguntas deben evaluar procedimiento, modelacion, argumentacion o representacion cuando corresponda.',
            'La explicacion debe justificar claramente el resultado y mencionar la propiedad o estrategia usada.'
        ].filter(Boolean).join('\n'),
        bankMetadata: {
            source_material: bestChapter.materialId || MORALEJA_MATH_MATERIAL_ID,
            moraleja_chapter: bestChapter.id,
            moraleja_skill: bestChapter.skill,
            moraleja_mode: mode,
            moraleja_resolution: resolutionMode,
            moraleja_session_reference: sessionReference ? `session_${numericSession}` : ''
        }
    };
};

export { MORALEJA_MATH_MATERIAL_ID, CURRICULUM_BRIDGE_MATERIAL_ID };
