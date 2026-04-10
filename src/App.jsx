import React, { useState, useEffect, useRef } from 'react';
import MathRenderer from './components/MathRenderer';
import InteractiveQuiz from './components/InteractiveQuiz';
import LoginPage from './components/LoginPage';
import CuadernoMission from './components/CuadernoMission';
import {
    BookOpen,
    Brain,
    Calendar as CalendarIcon,
    Activity,
    ArrowRight,
    Atom,
    Dna,
    Clock,
    Award,
    AlertTriangle,
    XCircle,
    BarChart2,
    Zap,
    Menu,
    X,
    ChevronRight,
    Flame,
    Play,
    Pause,
    RotateCcw,
    TrendingUp,
    Check,
    Star,
    Lock,
    ShoppingBag,
    Smartphone,
    MessageCircle,
    Settings,
    Flag,
    FileText,
    PieChart,
    Server,
    Database,
    Lightbulb,
    Wifi,
    WifiOff,
    ExternalLink,
    HelpCircle,
    Loader,
    Image as ImageIcon, Maximize, Minimize, Download
    , FlaskConical, Globe, Trash2, Shield
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Pie,
    PieChart as RechartsPieChart
} from 'recharts';

const KaTeXCSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
const KaTeXJS = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
const KaTeXAutoRender = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';

const downloadTextFile = (fileName, content, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const escapeCsvCell = (value = '') => {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
};

const buildGeneratedQuestionsCsv = (items = []) => {
    const headers = [
        'id',
        'subject',
        'source_action',
        'source_mode',
        'source_session',
        'source_topic',
        'occurrences',
        'question',
        'A',
        'B',
        'C',
        'D',
        'correct_answer',
        'explanation',
        'created_at',
        'updated_at'
    ];

    const rows = items.map((item) => ([
        item.id || '',
        item.subject || '',
        item.source_action || '',
        item.source_mode || '',
        item.source_session || '',
        item.source_topic || '',
        item.occurrences || 1,
        item.question || '',
        item.options?.A || '',
        item.options?.B || '',
        item.options?.C || '',
        item.options?.D || '',
        item.correct_answer || '',
        item.explanation || '',
        item.created_at || '',
        item.updated_at || ''
    ]).map(escapeCsvCell).join(','));

    return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
};

// MathRenderer moved to ./components/MathRenderer.jsx

const N8N_URLS = {
    production: "/webhook/MATICO",
    test: "/webhook-test/MATICO"
};

const QUIZ_PHASE_LEVELS = {
    1: 'Basico',
    2: 'AVANZADO',
    3: 'Critico'
};
const QUIZ_TOTAL_QUESTIONS = 45;
const QUIZ_PHASE_QUESTIONS = 15;
const QUIZ_BATCH_SIZE = 3;
const QUIZ_BATCHES_PER_PHASE = QUIZ_PHASE_QUESTIONS / QUIZ_BATCH_SIZE;

// --- PRODUCCIÃ³N: CALENDARIO MATICO ---
const COURSE_START_DATE = new Date('2026-01-26T00:00:00'); // Lunes 26 de Enero
const WEEKLY_PLAN = [
    { day: 1, subject: 'MATEMATICA' },
    { day: 2, subject: 'LENGUAJE' },
    { day: 3, subject: 'FISICA' },
    { day: 4, subject: 'QUIMICA' },
    { day: 5, subject: 'BIOLOGIA' },
    { day: 6, subject: 'HISTORIA' }
];

const COLORS = {
    bg: '#FFFFFF',
    textMain: '#3C3C3C',
    textLight: '#AFAFAF',
    yellow: '#FFC800',
    yellowShadow: '#C7A005',
    blue: '#1CB0F6',
    green: '#58CC02',
    red: '#FF4B4B',
    purple: '#9D65C9',
    orange: '#FF9F43'
};

const LANGUAGE_SYLLABUS = [
    {
        session: 1,
        unit: 'DiagnÃ³stico',
        topic: 'ComprensiÃ³n Lectora: La vida simplemente',
        videoTitle: 'Contexto HistÃ³rico (Opcional)',
        videoLink: 'https://www.youtube.com/watch?v=Fyy9nGemSqU',
        readingTitle: 'La vida simplemente (Resumen y AnÃ¡lisis)',
        readingContent: `En las profundidades de la ciudad de Rancagua, durante las primeras dÃ©cadas del siglo XX, la existencia parecÃ­a transcurrir bajo una ley distinta a la del resto del mundo, una ley dictada por la geografÃ­a del desamparo y el peso del lodo. AllÃ­ se extendÃ­a el legendario "CallejÃ³n de la Muerte", un rincÃ³n donde la dignidad humana libraba una batalla diaria contra la precariedad y el olvido. Roberto, el protagonista de este relato, creciÃ³ respirando el aire cargado de humedad de este callejÃ³n, donde las viviendas no eran mÃ¡s que precarias estructuras de tablas y latas que apenas lograban sostenerse en pie sobre un suelo que, con cada lluvia, se convertÃ­a en un pantano voraz. Para Roberto, el barro no era simplemente suciedad en los zapatos; era un elemento vivo, una presencia constante que simbolizaba la inmovilidad de la pobreza, esa fuerza que parecÃ­a querer succionar cualquier sueÃ±o de libertad que intentara elevarse por encima de los techos de zinc.

El centro del universo de Roberto era una casa de remolienda, un burdel que funcionaba bajo la administraciÃ³n implacable de su tÃ­a, DoÃ±a Munda. Aquella mujer era el pilar de un negocio que florecÃ­a en medio de la miseria, una figura de autoridad que se movÃ­a entre el estrÃ©pito de las botellas, el humo denso de los cigarrillos "Yolanda" y las risas fingidas de las mujeres que allÃ­ trabajaban. Munda entendÃ­a la vida como un sistema de engranajes donde el dinero era el Ãºnico aceite capaz de evitar el colapso, y su carÃ¡cter se habÃ­a forjado con la dureza de quien sabe que en el callejÃ³n no hay espacio para la debilidad. En un rincÃ³n opuesto de esa misma casa habitaba la madre de Roberto, una presencia de dulzura casi milagrosa en aquel ambiente. Ella era la cara de la resignaciÃ³n amorosa, una mujer que se desgastaba fÃ­sicamente para que su hijo tuviera lo que el entorno le negaba: un rastro de limpieza en su ropa y una barrera protectora, aunque fuera frÃ¡gil, contra la crudeza de lo que sucedÃ­a tras las cortinas del burdel. Roberto creciÃ³ observando esta dualidad: la fuerza de la tÃ­a que garantizaba la supervivencia y la ternura de la madre que alimentaba su alma.

Durante su primera infancia, el mundo de Roberto se limitaba a los lÃ­mites del callejÃ³n y al vasto "pajonal", un terreno baldÃ­o donde la naturaleza salvaje se mezclaba con los desperdicios de la ciudad. AllÃ­, junto a otros niÃ±os de rodillas costrosas y mirada despierta, Roberto descubrÃ­a los secretos de la vida a travÃ©s del juego. En el pajonal, los niÃ±os eran reyes de reinos invisibles, pero tambiÃ©n eran receptores de los miedos colectivos que los adultos sembraban para controlarlos. Historias sobre el "Viejo del Saco" o el "CulebrÃ³n" poblaban sus pesadillas nocturnas, dÃ¡ndole una forma fantÃ¡stica a los peligros reales que acechaban en la oscuridad. Sin embargo, a medida que Roberto dejaba de ser un niÃ±o pequeÃ±o, empezÃ³ a notar que los hombres que llegaban a la casa de su tÃ­a eran mÃ¡s aterradores que cualquier monstruo de cuento; eran hombres consumidos por el alcohol, por el trabajo agotador en las minas o en el campo, que buscaban un momento de olvido en los brazos de mujeres que, al igual que ellos, solo intentaban sobrevivir un dÃ­a mÃ¡s.

El gran quiebre en la vida de Roberto, el momento en que su horizonte dejÃ³ de ser una pared de madera podrida, fue su entrada en la escuela pÃºblica. Al principio, la escuela representaba un lugar extraÃ±o, con sus reglas rÃ­gidas y su atmÃ³sfera de orden que contrastaba violentamente con el caos del callejÃ³n. Pero fue allÃ­ donde Roberto se encontrÃ³ con el poder transformador de las letras. Su profesor, un hombre que supo detectar la inteligencia vivaz que se escondÃ­a tras la apariencia humilde del niÃ±o, se convirtiÃ³ en su mentor silencioso. Roberto descubriÃ³ que las palabras eran herramientas, llaves capaces de abrir celdas invisibles. Cada libro que caÃ­a en sus manos Ã³Ã‚Âdesde cuentos de aventuras hasta poemas de grandes autoresÃ³Ã‚Â era una invitaciÃ³n a un mundo donde la justicia no era un concepto abstracto y donde la belleza no estaba prohibida para los pobres. La lectura despertÃ³ en Ã©l una sensibilidad que lo alejaba de sus pares; mientras otros niÃ±os aceptaban su destino como obreros o delincuentes en potencia, Roberto empezaba a soÃ±ar con ser escritor, con tener una voz que pudiera narrar el dolor de su gente.

Sin embargo, este despertar intelectual trajo consigo el veneno de la conciencia de clase. Al salir de su barrio para ir a la escuela o al centro de Rancagua, Roberto comenzÃ³ a percibir las miradas de los "otros". Notaba cÃ³mo las personas de las casas sÃ³lidas y jardines cuidados se apartaban al paso de alguien que venÃ­a del callejÃ³n, cÃ³mo la policÃ­a trataba con sospecha a cualquiera que tuviera el rastro del barro en su vestimenta. SurgiÃ³ entonces una contradicciÃ³n dolorosa en su pecho: el amor profundo y la gratitud que sentÃ­a por su madre y su tÃ­a se mezclaban con una vergÃƒÂ¼enza punzante por el origen de su sustento. Se sentÃ­a un traidor al avergonzarse de la casa donde recibÃ­a alimento, pero no podÃ­a evitar el asco moral que le producÃ­a el negocio de la prostituciÃ³n y la degradaciÃ³n humana que veÃ­a a diario. Esta lucha interna marcÃ³ su paso de la niÃ±ez a la adolescencia, convirtiÃ©ndolo en un observador melancÃ³lico de su propia realidad.

A medida que Roberto crecÃ­a, tambiÃ©n veÃ­a cÃ³mo sus amigos de la infancia eran devorados por la maquinaria del callejÃ³n. Algunos terminaban en la cÃ¡rcel, otros se perdÃ­an en el vicio del juego y el aguardiente, y muchos simplemente desaparecÃ­an en la mediocridad de un trabajo que les robaba la juventud. Roberto veÃ­a en ellos su propio reflejo si decidÃ­a rendirse. La novela detalla cÃ³mo las experiencias de Roberto en el burdel le enseÃ±aron sobre la naturaleza humana mÃ¡s que cualquier manual de psicologÃ­a: vio la soledad de los hombres, la desesperaciÃ³n de las mujeres y la fragilidad de las promesas. Todo ese cÃºmulo de experiencias fue fermentando en su interior. ComprendiÃ³ que la frase "la vida simplemente" era lo que la gente decÃ­a para justificar su falta de lucha, para aceptar que el mundo era asÃ­ y nada podÃ­a cambiarse. Pero Ã©l, armado con la educaciÃ³n que tanto le costÃ³ conseguir y con la pluma que empezaba a manejar con destreza, decidiÃ³ que su vida no serÃ­a "simplemente" lo que el azar decidiÃ³.

Hacia el final de su proceso de formaciÃ³n, Roberto logra una madurez que lo sitÃºa por encima de sus circunstancias. Comprende que no necesita borrar su pasado ni renegar de su madre para ser alguien; por el contrario, su origen es su mayor fuente de verdad. El libro concluye con una imagen de esperanza contenida: Roberto sabe que el camino hacia afuera del callejÃ³n es largo y que todavÃ­a tendrÃ¡ que pisar mucho barro, pero su mente ya ha cruzado el pajonal y ha llegado a las estrellas. Ha entendido que la educaciÃ³n no es solo acumular datos, sino la capacidad de entender el mundo para transformarlo. Al final, Roberto se convierte en el cronista de los olvidados, en aquel que darÃ¡ testimonio de que en el CallejÃ³n de la Muerte tambiÃ©n hubo amor, sueÃ±os y una lucha incansable por la dignidad. La historia termina no con un final feliz de cuento de hadas, sino con la victoria real de un joven que ha conquistado su propia identidad y que estÃ¡ listo para escribir su destino, dejando atrÃ¡s la resignaciÃ³n para abrazar la posibilidad de una vida que sea mucho mÃ¡s que "simplemente" existir.`
    },
    {
        session: 2,
        unit: 'Narrativa',
        topic: 'Narrador y Conflicto: Frankenstein',
        videoTitle: 'LENGUAJE | El Narrador | Clase NÃ‚Â°4',
        videoLink: 'https://www.youtube.com/watch?v=0Vv5aIgDp9c',
        readingTitle: 'Frankenstein (Fragmento)',
        readingContent: `La historia de Victor Frankenstein no comienza en un laboratorio oscuro, sino en la idÃ­lica y refinada ciudad de Ginebra, rodeado de una familia que personificaba la bondad y el orden. Victor fue un niÃ±o amado, el hijo primogÃ©nito de Alphonse Frankenstein, un hombre de leyes respetado, y de Caroline Beaufort, una mujer cuya compasiÃ³n la llevaba a buscar a los mÃ¡s necesitados. Fue en uno de esos viajes de caridad donde la familia adoptÃ³ a Elizabeth Lavenza, una niÃ±a de una belleza casi angelical que se convirtiÃ³ en la compaÃ±era inseparable de Victor y, con el tiempo, en el amor de su vida. Junto a ellos creciÃ³ tambiÃ©n Henry Clerval, un joven de espÃ­ritu noble y poÃ©tico que representaba la humanidad y el arte, en contraste con la mente analÃ­tica y curiosa de Victor. Esta infancia perfecta, sin embargo, sembrÃ³ en el joven Frankenstein una sed de conocimiento que no conocÃ­a lÃ­mites. Mientras sus amigos se interesaban por la polÃ­tica o la literatura, Victor se sumergÃ­a en los textos antiguos de alquimistas como Cornelio Agrippa y Paracelso, buscando en sus pÃ¡ginas el secreto para dominar la vida y la muerte.

La tragedia golpeÃ³ su hogar cuando la fiebre escarlatina se llevÃ³ a su madre, cuya Ãºltima voluntad fue ver a Victor y Elizabeth unidos en matrimonio. Este dolor, en lugar de detenerlo, impulsÃ³ a Victor hacia la Universidad de Ingolstadt en Alemania, donde su mente brillante se enfrentÃ³ a la ciencia moderna. AllÃ­, bajo la tutela del profesor Waldman, quien lo alentÃ³ a explorar los misterios de la creaciÃ³n, Victor se sumergiÃ³ en una obsesiÃ³n que lo aislÃ³ del mundo. Durante dos aÃ±os, dejÃ³ de escribir a su familia, descuidÃ³ su salud y pasÃ³ noches enteras en cementerios y salas de disecciÃ³n, estudiando la descomposiciÃ³n de la carne para entender cÃ³mo devolverle la chispa de la vida. Su meta era ambiciosa: querÃ­a crear una nueva especie que bendijera a su creador, una raza de seres que no conocieran la enfermedad ni la muerte prematura. En su ceguera cientÃ­fica, no se detuvo a pensar en las consecuencias morales de jugar a ser Dios.

La culminaciÃ³n de sus esfuerzos llegÃ³ en una lÃºgubre noche de noviembre, mientras la lluvia golpeaba las ventanas de su laboratorio. Utilizando una mezcla de quÃ­mica, galvanismo y restos humanos que habÃ­a recolectado con gran esfuerzo, Victor logrÃ³ lo imposible. Al aplicar la descarga final, vio cÃ³mo el cuerpo gigantesco que habÃ­a construido abrÃ­a sus ojos de un amarillo apagado. Pero en ese instante de triunfo, la belleza de su sueÃ±o se transformÃ³ en una pesadilla insoportable. Al ver la piel amarillenta que apenas cubrÃ­a los mÃºsculos y las arterias, el cabello negro lustroso y los dientes de una blancura aterradora, Victor sintiÃ³ un asco que le recorriÃ³ la mÃ©dula. No pudo soportar la visiÃ³n de aquel ser que Ã©l mismo habÃ­a diseÃ±ado para ser hermoso y que ahora le devolvÃ­a una mirada de muda sÃºplica. Preso del pÃ¡nico, Victor huyÃ³ de la habitaciÃ³n, abandonando a su creaciÃ³n a su suerte, esperando que el olvido o la muerte se llevaran aquel error. Sin embargo, cuando regresÃ³ a su habitaciÃ³n escoltado por su amigo Henry Clerval, quien acababa de llegar a Ingolstadt, la criatura habÃ­a desaparecido.

Mientras Victor caÃ­a en una fiebre nerviosa que lo mantuvo postrado durante meses, la criatura iniciaba su propio y doloroso viaje por el mundo. Dotado de una fuerza sobrehumana y una resistencia increÃ­ble, el ser vagÃ³ por los bosques, sufriendo el acoso del hambre, la sed y el frÃ­o. Su mente, inicialmente como la de un niÃ±o reciÃ©n nacido, procesaba los sonidos de los pÃ¡jaros y el calor del sol con una mezcla de asombro y miedo. Su primer contacto con la humanidad fue desastroso: al entrar en una aldea buscando comida, fue recibido con piedras y gritos de terror. ComprendiÃ³ rÃ¡pidamente que su apariencia era una barrera insuperable. Buscando refugio, se escondiÃ³ en un cobertizo adosado a una pequeÃ±a cabaÃ±a en el bosque, donde vivÃ­a la familia De Lacey. A travÃ©s de una grieta en la pared, el ser se convirtiÃ³ en un observador invisible de la vida de esta familia compuesta por un anciano ciego, su hijo Felix y su hija Agatha.

Durante casi un aÃ±o, el monstruo viviÃ³ en las sombras, alimentÃ¡ndose de las sobras y ayudando a los De Lacey de forma anÃ³nima, recolectando leÃ±a por las noches para que Felix no tuviera que esforzarse tanto. Al observar a los humanos, aprendiÃ³ el significado de las palabras, los conceptos de propiedad, familia y amor. La llegada de Safie, una joven extranjera, le permitiÃ³ aprender a hablar y leer al mismo ritmo que ella mientras Felix le enseÃ±aba. El ser encontrÃ³ tres libros en el bosque: "El paraÃ­so perdido", "Las vidas de Plutarco" y "Las cuitas del joven Werther", los cuales leyÃ³ con una sed voraz. Estas obras le enseÃ±aron sobre la historia de las naciones, los sentimientos humanos y, fatalmente, sobre la creaciÃ³n y el abandono. Al leer los diarios de Victor que habÃ­a guardado en su abrigo al huir del laboratorio, comprendiÃ³ finalmente su origen: Ã©l no era un hijo amado, sino un monstruo despreciado por su propio padre. Su corazÃ³n, inicialmente lleno de benevolencia, comenzÃ³ a llenarse de una amargura profunda.

El punto de no retorno ocurriÃ³ cuando la criatura intentÃ³ presentarse ante el anciano De Lacey, confiando en que su ceguera le permitirÃ­a juzgarlo por su voz y no por su aspecto. El anciano lo escuchÃ³ con amabilidad, pero cuando el resto de la familia regresÃ³, el horror se desatÃ³. Felix, creyendo que el monstruo atacaba a su padre, lo golpeÃ³ con furia. El ser huyÃ³ hacia el bosque, pero esta vez la tristeza se habÃ­a transformado en un odio ardiente. Al ver que incluso los humanos mÃ¡s nobles lo rechazaban, decidiÃ³ declarar una guerra eterna contra la especie humana y, especialmente, contra su creador. En su camino hacia Ginebra, salvÃ³ a una niÃ±a de morir ahogada, solo para recibir un disparo de su padre, quien creyÃ³ que el monstruo intentaba hacerle daÃ±o. Este fue el Ãºltimo clavo en la tumba de su bondad. Al llegar a las afueras de Ginebra, se encontrÃ³ con un niÃ±o pequeÃ±o, William Frankenstein. Al saber que el niÃ±o era pariente de su creador, lo asesinÃ³ con sus propias manos y colocÃ³ un retrato que el niÃ±o llevaba en el vestido de Justine, una joven sirvienta de la familia, para incriminarla.

Victor, destrozado por la muerte de su hermano y la posterior ejecuciÃ³n de la inocente Justine, buscÃ³ consuelo en las montaÃ±as. Fue en el glaciar de Montanvert donde creador y criatura se encontraron cara a cara. AllÃ­, en un discurso de una elocuencia desgarradora, el monstruo le relatÃ³ sus sufrimientos y le hizo una Ãºnica peticiÃ³n: "Soy malvado porque soy infeliz. Hazme una compaÃ±era tan deforme como yo para que podamos vivir aislados del hombre". Victor, movido por la compasiÃ³n y el miedo, aceptÃ³ el trato. ViajÃ³ a Inglaterra y luego a las remotas islas Orcadas en Escocia para comenzar su segunda obra. Sin embargo, mientras trabajaba en la nueva criatura, lo asaltaron dudas atroces: Â¿y si ella fuera mÃ¡s malvada que el primero? Â¿y si procreaban una raza de demonios? Al ver al monstruo observÃ¡ndolo a travÃ©s de la ventana con una sonrisa macabra, Victor destruyÃ³ el cuerpo de la mujer frente a sus ojos. El ser jurÃ³ venganza con una frase que sellarÃ­a el destino de Victor: "EstarÃ© contigo en tu noche de bodas".

La venganza fue sistemÃ¡tica y cruel. Primero, la criatura asesinÃ³ a Henry Clerval, haciendo que Victor fuera arrestado injustamente en Irlanda. Tras recuperar su libertad, Victor regresÃ³ a Ginebra para casarse con Elizabeth, esperando que el matrimonio fuera un refugio contra la sombra que lo perseguÃ­a. Pero en la noche de bodas, mientras Victor buscaba al monstruo por la casa armado con pistolas, escuchÃ³ el grito agÃ³nico de su esposa. El ser habÃ­a cumplido su promesa, estrangulando a Elizabeth en su propia cama. La muerte de Elizabeth provocÃ³ tambiÃ©n el fallecimiento del padre de Victor, quien no pudo soportar tanto dolor. HabiÃ©ndolo perdido todo, Victor Frankenstein transformÃ³ su remordimiento en una furia ciega y dedicÃ³ sus Ãºltimos dÃ­as a perseguir a su creaciÃ³n por todo el mundo, desde los desiertos de la Tartaria hasta los hielos eternos del Polo Norte.

La persecuciÃ³n terminÃ³ cuando un Victor exhausto y moribundo fue rescatado por el barco del capitÃ¡n Robert Walton, un explorador que buscaba el paso del norte. Victor le confiÃ³ su historia como una advertencia sobre los peligros de la ambiciÃ³n intelectual sin Ã©tica. Tras la muerte de Victor a bordo del barco, Walton encontrÃ³ a la criatura llorando sobre el cadÃ¡ver de su creador. En un Ãºltimo monÃ³logo lleno de desesperaciÃ³n, el ser confesÃ³ que su odio habÃ­a sido el resultado de una soledad que ningÃºn humano podÃ­a imaginar. AfirmÃ³ que su crimen mÃ¡s grande habÃ­a sido el asesinato de su propia alma. Sin nadie mÃ¡s en el mundo que le diera sentido a su existencia, la criatura le prometiÃ³ a Walton que se dirigirÃ­a al extremo mÃ¡s lejano del Ã­Ã‚Ârtico para construir una pira funeraria y arrojarse a las llamas, terminando asÃ­ con el sufrimiento de haber sido el Ãºnico de su especie. La criatura desapareciÃ³ en la oscuridad y la distancia, dejando tras de sÃ­ la advertencia eterna sobre la responsabilidad que conlleva dar vida a lo que no estamos dispuestos a amar.`
    },
    {
        session: 3,
        unit: 'Narrativa',
        topic: 'Terror GÃ³tico: DrÃ¡cula',
        videoTitle: 'Intertextualidad-Clase NÃ‚Â°16',
        videoLink: 'https://www.youtube.com/watch?v=NBNdpV4AG1g',
        readingTitle: 'DrÃ¡cula (Resumen y AnÃ¡lisis)',
        readingContent: `La historia de la oscuridad mÃ¡s antigua comienza en las pÃ¡ginas del diario de Jonathan Harker, un joven y ambicioso abogado inglÃ©s que emprende un viaje agotador hacia los confines de Europa del Este. Su destino son los montes CÃ¡rpatos, en la regiÃ³n de Transilvania, donde debe cerrar un negocio inmobiliario con un noble local: el Conde DrÃ¡cula. A medida que el tren se interna en paisajes cada vez mÃ¡s salvajes y neblinosos, Jonathan percibe un cambio en la atmÃ³sfera. Los campesinos locales, al enterarse de su destino final, lo miran con una mezcla de lÃ¡stima y terror absoluto; le entregan crucifijos, rosarios y ramos de ajo, murmurando oraciones para protegerlo de algo que llaman el "Vurdalak". A pesar de su escepticismo inglÃ©s y su fe en la razÃ³n moderna, Jonathan empieza a sentir una inquietud creciente cuando, al llegar al desfiladero de Borgo en medio de una noche cerrada, es recogido por un carruaje conducido por un hombre cuya fuerza fÃ­sica parece sobrehumana y cuya mirada brilla con un fulgor rojizo bajo la luz de las antorchas.

Al llegar al imponente y ruinoso castillo de DrÃ¡cula, Jonathan es recibido por el mismo Conde, un hombre de edad avanzada, vestido de negro de pies a cabeza, con un rostro extremadamente pÃ¡lido, labios inusualmente rojos y dedos largos que terminan en uÃ±as afiladas. Los primeros dÃ­as transcurren bajo una cortesÃ­a aristocrÃ¡tica, pero pronto el abogado descubre que el castillo es una prisiÃ³n de piedra. Jonathan nota con horror que DrÃ¡cula no tiene reflejo en los espejos, que posee una fuerza capaz de doblar barras de hierro y que nunca se le ve comer ni beber. Una tarde, al observar por la ventana, ve al Conde trepar por los muros verticales del castillo como si fuera una lagartija gigante, lo que finalmente le confirma que estÃ¡ ante un ser que no pertenece al mundo de los vivos. Su terror alcanza el clÃ­max cuando, tras desobedecer las advertencias del Conde, es atacado por tres mujeres fantasmales de una belleza letal que habitan en las sombras de las salas prohibidas, seres sedientos de sangre que solo son detenidos por la intervenciÃ³n del propio DrÃ¡cula, quien les promete que Jonathan serÃ¡ de ellas una vez que sus negocios en Londres hayan concluido.

Mientras Jonathan busca desesperadamente una salida de aquella fortaleza rodeada por el aullido constante de los lobos, la acciÃ³n se traslada a Inglaterra, especÃ­ficamente a la pintoresca costa de Whitby. AllÃ­, Mina Murray, la virtuosa prometida de Jonathan, espera noticias de su amado mientras acompaÃ±a a su mejor amiga, Lucy Westenra, una joven de gran belleza que acaba de recibir tres propuestas de matrimonio simultÃ¡neas. La calma se rompe durante una tormenta de proporciones apocalÃ­pticas que trae consigo al Demeter, un barco ruso que llega a puerto sin un solo tripulante vivo a bordo. El capitÃ¡n yace muerto, atado al timÃ³n con un rosario entre las manos, y un enorme perro negro salta desde la cubierta desapareciendo entre la niebla. Nadie sospecha que en las bodegas del barco viajan cincuenta cajas llenas de tierra sagrada de Transilvania, el sustento vital que el Conde DrÃ¡cula necesita para establecer su imperio de terror en la populosa Londres.

Poco despuÃ©s del desembarco, la salud de Lucy empieza a deteriorarse de una manera que desafÃ­a toda lÃ³gica mÃ©dica. Se vuelve sonÃ¡mbula y, una noche, Mina la encuentra desmayada en un banco del acantilado bajo la luz de la luna, con una figura oscura inclinada sobre ella. A partir de ese momento, Lucy se vuelve cada vez mÃ¡s pÃ¡lida y dÃ©bil, y en su cuello aparecen dos pequeÃ±as marcas rojas que parecen negarse a cicatrizar. Su prometido, Arthur Holmwood, ahora Lord Godalming, pide ayuda a su amigo el doctor John Seward, quien dirige un manicomio cercano. Seward, desconcertado por el caso de Lucy y por el extraÃ±o comportamiento de uno de sus pacientes, un hombre llamado Renfield que devora moscas y araÃ±as creyendo que asÃ­ absorbe su fuerza vital, decide convocar a su antiguo maestro en Ã­Ã‚Âmsterdam: el eminente profesor Abraham Van Helsing.

Van Helsing representa la sÃ­ntesis perfecta entre la ciencia moderna y el conocimiento de las tradiciones antiguas. Al examinar a Lucy, comprende de inmediato que no se enfrenta a una anemia comÃºn, sino a un depredador sobrenatural. A pesar de realizar mÃºltiples transfusiones de sangre de todos los hombres del grupo y de rodear la habitaciÃ³n de Lucy con flores de ajo y crucifijos, el Conde DrÃ¡cula logra burlar las defensas utilizando sus poderes para controlar a los animales y la niebla. Lucy muere, pero para Van Helsing su fallecimiento es solo el inicio de una transformaciÃ³n aterradora. El profesor debe convencer a Arthur, Seward y al aventurero estadounidense Quincey Morris de que Lucy se ha convertido en una "No-Muerta" que ahora acecha a los niÃ±os de la ciudad bajo el nombre de la "Dama de Blanco". En una de las escenas mÃ¡s intensas de la obra, el grupo desciende a la cripta de los Westenra, donde Arthur, guiado por la mano de Van Helsing, atraviesa el corazÃ³n de su amada con una estaca de madera para liberar su alma de la maldiciÃ³n del vampirismo.

Tras el descanso eterno de Lucy, el grupo de hombres se une a Jonathan Harker, quien ha logrado escapar de Transilvania, y a Mina, quien se convierte en el cerebro logÃ­stico del equipo. Mina organiza todos los diarios, cartas y recortes de prensa en un registro cronolÃ³gico que les permite entender los movimientos del Conde. Descubren que DrÃ¡cula ha comprado una propiedad llamada Carfax, justo al lado del manicomio de Seward, y que estÃ¡ ocultando allÃ­ sus cajas de tierra. El Conde, al sentirse acorralado por la inteligencia del grupo, decide atacar a su eslabÃ³n mÃ¡s fuerte: Mina. Entra en sus aposentos y, tras asesinar a Renfield por intentar protegerla, obliga a Mina a beber sangre de su propio pecho, creando un vÃ­nculo mÃ­stico y maldito. DrÃ¡cula le advierte que ahora ella es de su misma sangre y que, tras su muerte, se convertirÃ¡ en una de sus compaÃ±eras eternas.

Este acto de crueldad se convierte en el mayor error del Conde. Van Helsing descubre que, debido al "bautismo de sangre", Mina puede entrar en un estado de hipnosis al amanecer y al anochecer, permitiÃ©ndole ver y oÃ­r lo que el Conde percibe. Con esta informaciÃ³n, el grupo comienza una frenÃ©tica cacerÃ­a por todo Londres, purificando con hostias consagradas cada una de las cajas de tierra de DrÃ¡cula, dejÃ¡ndolo sin refugios donde esconderse durante el dÃ­a. SintiÃ©ndose vulnerable en una tierra que ya no le es propicia, el Conde huye de regreso a Transilvania por mar, creyendo que su antiguo castillo le devolverÃ¡ la seguridad. Sin embargo, los cazadores inician una carrera contra el tiempo a travÃ©s de Europa, viajando por tierra y rÃ­o para interceptar el carromato de DrÃ¡cula antes de que el sol se ponga en las faldas de los CÃ¡rpatos.

El clÃ­max de la novela ocurre bajo la sombra del imponente castillo de DrÃ¡cula, en medio de una tormenta de nieve. El grupo se ha dividido: Van Helsing y Mina viajan directamente al castillo, donde el profesor logra destruir a las tres mujeres vampiras en sus tumbas, mientras que Jonathan, Arthur, Seward y Quincey persiguen al carromato protegido por gitanos que transporta el ataÃºd del Conde. Justo cuando los Ãºltimos rayos del sol estÃ¡n por desaparecer y el poder de DrÃ¡cula alcanzarÃ­a su mÃ¡ximo esplendor, se desata una batalla feroz. Quincey Morris resulta herido de muerte, pero en un Ãºltimo esfuerzo de valentÃ­a, Jonathan Harker corta el cuello del Conde con su gran cuchillo mientras el puÃ±al de Quincey atraviesa el corazÃ³n del monstruo. En un suspiro de alivio absoluto, el cuerpo del Conde DrÃ¡cula se desintegra convirtiÃ©ndose en cenizas, y la marca roja de la maldiciÃ³n en la frente de Mina desaparece para siempre. La historia concluye con el sacrificio de Quincey y una reflexiÃ³n aÃ±os despuÃ©s sobre cÃ³mo el amor, la lealtad y la uniÃ³n de la ciencia con la fe lograron vencer a la oscuridad mÃ¡s profunda, dejando un legado de paz para las futuras generaciones.`
    },
    {
        session: 4,
        unit: 'Narrativa',
        topic: 'Realismo Social: Subterra',
        videoTitle: 'El gÃ©nero lÃ­rico-Hablante y Objeto',
        videoLink: 'https://www.youtube.com/watch?v=ldjVCmsAfhM',
        readingTitle: 'Subterra (Resumen y AnÃ¡lisis)',
        readingContent: `En las entraÃ±as de la tierra, donde el sol es un recuerdo lejano y el aire se vuelve un enemigo pesado y denso, se desarrolla la crÃ³nica de una de las Ã©pocas mÃ¡s oscuras de la historia trabajadora: la vida en las minas de carbÃ³n de Lota, en Chile. La obra maestra de Baldomero Lillo, titulada Subterra, no es solo una colecciÃ³n de relatos, sino un grito de protesta y un retrato descarnado de la condiciÃ³n humana frente a la explotaciÃ³n industrial de principios del siglo XX. El escenario principal es la mina, un monstruo de piedra y sombras que devora hombres, jÃ³venes y niÃ±os por igual, devolviendo a cambio solo miseria, pulmones enfermos y corazones rotos. En este mundo subterrÃ¡neo, la oscuridad no es solo la ausencia de luz, sino una presencia tangible que envuelve la existencia de miles de familias que dependen del "oro negro" para no morir de hambre, aunque ese mismo carbÃ³n sea el que finalmente les robe la vida.

La historia nos sumerge inicialmente en la desgarradora realidad de la infancia perdida a travÃ©s de uno de sus relatos mÃ¡s icÃ³nicos: "La compuerta nÃºmero 12". AquÃ­ conocemos a Pablo, un niÃ±o de apenas ocho aÃ±os, cuyo destino queda sellado cuando su padre, un minero envejecido prematuramente por el esfuerzo, lo lleva por primera vez a las galerÃ­as profundas. El padre sabe que estÃ¡ entregando a su hijo a una esclavitud moderna, pero la extrema pobreza y la necesidad de aumentar los ingresos familiares no le dejan otra opciÃ³n. El trabajo de Pablo consiste en ser un "atendedor" de compuerta, sentado en la oscuridad absoluta durante horas interminables, con la Ãºnica misiÃ³n de abrir y cerrar una puerta de madera cada vez que pasan los carros cargados de carbÃ³n. El llanto del niÃ±o al verse abandonado en aquel tÃºnel hÃºmedo y negro, donde el silencio solo es roto por el goteo del agua y el eco de las mÃ¡quinas, representa la inocencia triturada por un sistema econÃ³mico despiadado. El padre, al amarrar a su propio hijo para que no huya del miedo, simboliza la tragedia de una clase social que se ve obligada a sacrificar a sus propias semillas para asegurar un mendrugo de pan.

A medida que nos internamos mÃ¡s en la narraciÃ³n, la obra explora el concepto del "determinismo social", la idea de que quien nace en la mina estÃ¡ condenado a morir en ella. Lillo nos presenta el "ChiflÃ³n del Diablo", una de las galerÃ­as mÃ¡s peligrosas y temidas debido a su inestabilidad y a la frecuencia de los derrumbes. En este lugar, la muerte acecha en cada crujido de las vigas de madera. Conocemos la historia de los mineros que, por la falta de trabajo en otras secciones, se ven obligados a aceptar turnos en el ChiflÃ³n, sabiendo que las probabilidades de salir con vida son escasas. La tensiÃ³n se traslada tambiÃ©n a la superficie, donde las madres, esposas e hijas esperan con el corazÃ³n en un hilo el sonido de la sirena que anuncia un accidente. Cuando la tragedia finalmente ocurre, el autor describe con maestrÃ­a el desfile de cuerpos inertes y la desesperaciÃ³n de las mujeres que buscan entre los rostros cubiertos de hollÃ­n a sus seres queridos, evidenciando que el dolor de la mina se extiende mucho mÃ¡s allÃ¡ de las galerÃ­as subterrÃ¡neas, envenenando la vida de toda la comunidad.

Otro aspecto fundamental de la obra es la crÃ­tica feroz a la "pulperÃ­a" y al sistema de pago mediante fichas. En el relato "El pago", se detalla cÃ³mo el esfuerzo infrahumano de los mineros es recompensado con salarios miserables que apenas alcanzan para pagar las deudas contraÃ­das en los almacenes de la propia compaÃ±Ã­a minera. Los trabajadores viven atrapados en un cÃ­rculo vicioso de deuda eterna; el dinero nunca llega a sus manos de forma real, sino que es devuelto inmediatamente a los dueÃ±os de la mina a travÃ©s de precios inflados y multas arbitrarias. Lillo retrata a los capataces y administradores no solo como jefes, sino como verdugos que vigilan cada movimiento de los mineros, buscando cualquier excusa en "El registro" para confiscar sus pertenencias o humillarlos, demostrando que en Lota el minero no era considerado un ciudadano, sino una herramienta reemplazable, menos valiosa incluso que las mulas que arrastraban los carros.

La atmÃ³sfera de peligro constante se eleva a su mÃ¡ximo punto con el relato de "El GrisÃº". El grisÃº es un gas invisible, inodoro y altamente explosivo que se acumula en las galerÃ­as mal ventiladas. Es el asesino silencioso de la mina. El autor utiliza este elemento para mostrar la negligencia de la administraciÃ³n, que prefiere arriesgar la vida de cientos de hombres antes que invertir en sistemas de seguridad adecuados. Cuando la explosiÃ³n ocurre, la descripciÃ³n es dantesca: el fuego recorre los tÃºneles como una bestia furiosa, calcinando todo a su paso. Este evento no solo elimina vidas fÃ­sicas, sino que destruye las esperanzas de las familias, dejando a viudas y huÃ©rfanos en la mÃ¡s absoluta desprotecciÃ³n, ya que la compaÃ±Ã­a minera rara vez asumÃ­a responsabilidad alguna por las muertes, culpando a menudo a la "imprudencia" de los propios trabajadores para evitar pagar indemnizaciones.

Sin embargo, en medio de tanta oscuridad, Lillo tambiÃ©n rescata destellos de humanidad y solidaridad. A travÃ©s de personajes como Juan FariÃ±a, en el relato "Juan FariÃ±a", el autor introduce elementos de misterio y leyenda. FariÃ±a es un minero con una fuerza y una capacidad de trabajo que parecen sobrenaturales, despertando el recelo y la admiraciÃ³n de sus compaÃ±eros. Se rumorea que tiene un pacto con el diablo, pero en realidad, su figura representa la resistencia fÃ­sica y espiritual del trabajador chileno. Su historia termina en un acto de rebeliÃ³n final contra la mina: se dice que inundÃ³ las galerÃ­as para detener la explotaciÃ³n, prefiriendo destruir la fuente de trabajo antes que permitir que siguiera devorando la dignidad de sus hermanos. Este tinte legendario sirve para elevar la lucha del minero a una dimensiÃ³n Ã©pica, donde el hombre se enfrenta a fuerzas que parecen divinas o demonÃ­acas.

Hacia el final de la obra, queda una sensaciÃ³n de melancolÃ­a profunda pero tambiÃ©n de una urgente necesidad de cambio. Baldomero Lillo no ofrece finales felices porque la realidad de Lota no los permitÃ­a. Su objetivo era conmover la conciencia de la sociedad chilena de su tiempo, mostrando que el progreso industrial y la riqueza de unos pocos estaban construidos sobre el sufrimiento, la sangre y el sudor de miles de seres humanos enterrados vivos. Subterra concluye como un testimonio eterno de la lucha de clases, donde la mina es una metÃ¡fora de un sistema social que ciega a los hombres y les roba el futuro. La imagen final es la de un sol que brilla afuera, hermoso y cÃ¡lido, pero que para el minero es un extraÃ±o, pues su "vida simplemente" se ha convertido en una sombra perpetua bajo la tierra, esperando que algÃºn dÃ­a la justicia logre penetrar en las profundidades de la compuerta nÃºmero 12 y liberar a los hijos del carbÃ³n de su destino de hollÃ­n y silencio.`
    },
    {
        session: 5,
        unit: 'LÃ­rica',
        topic: 'AlegorÃ­a PolÃ­tica: RebeliÃ³n en la granja',
        videoTitle: 'Figuras literarias, parte III',
        videoLink: 'https://www.youtube.com/watch?v=YZqoA6dyqCc',
        readingTitle: 'RebeliÃ³n en la granja (Resumen y AnÃ¡lisis)',
        readingContent: `La historia comienza en la Granja Solariega, una propiedad rural en Inglaterra bajo el mando del seÃ±or Jones, un granjero que, sumido en el alcoholismo y la negligencia, ha dejado de preocuparse por el bienestar de sus animales. La chispa del cambio surge una noche cuando el Viejo Mayor, un cerdo premiado y respetado por todos, convoca a una reuniÃ³n secreta en el granero principal. En un discurso que cambiarÃ­a el destino de la granja, Mayor comparte un sueÃ±o que tuvo sobre un mundo donde los animales viven libres de la tiranÃ­a del hombre, sin lÃ¡tigos, sin cadenas y sin ser sacrificados para el beneficio humano. El Viejo Mayor les enseÃ±a una canciÃ³n revolucionaria titulada "Bestias de Inglaterra", que se convierte en el himno de su esperanza, y les explica que el hombre es el Ãºnico ser que consume sin producir, siendo la causa de todas sus miserias. Aunque Mayor muere pocos dÃ­as despuÃ©s, sus palabras germinan en la mente de los animales mÃ¡s inteligentes, especialmente en los cerdos, quienes empiezan a organizar un sistema de pensamiento llamado Animalismo.

La rebeliÃ³n ocurre de manera imprevista cuando el seÃ±or Jones, tras una borrachera monumental, olvida alimentar a los animales durante un dÃ­a entero. Impulsados por el hambre y la desesperaciÃ³n, los animales rompen los cierres de los depÃ³sitos de comida y, cuando Jones y sus peones intentan reprimirlos con lÃ¡tigos, los animales contraatacan con una furia incontenible, expulsando a los humanos de la propiedad. En un instante de jÃºbilo absoluto, la Granja Solariega pasa a llamarse Granja de los Animales. Bajo el liderazgo de dos cerdos jÃ³venes, Snowball y NapoleÃ³n, se establecen los Siete Mandamientos en la pared del granero, leyes sagradas que dictan que lo que camina sobre dos piernas es enemigo, lo que camina sobre cuatro piernas o tiene alas es amigo, y que ningÃºn animal debe usar ropa, dormir en camas, beber alcohol o matar a otro animal. El mandamiento final y mÃ¡s importante resume todo el espÃ­ritu de la revuelta: "Todos los animales son iguales".

Al principio, la granja prospera bajo una autogestiÃ³n ejemplar. Snowball, un lÃ­der brillante, elocuente y lleno de ideas innovadoras, organiza comitÃ©s para educar a los animales y diseÃ±a planes para mejorar la productividad. Por su parte, NapoleÃ³n es un personaje mÃ¡s silencioso, sombrÃ­o y calculador, que prefiere actuar en las sombras. La tensiÃ³n entre ambos crece constantemente, representando dos visiones opuestas del poder. Mientras Snowball propone la construcciÃ³n de un molino de viento para generar electricidad y reducir la jornada laboral, NapoleÃ³n se opone ferozmente, argumentando que lo importante es centrarse en la producciÃ³n de alimentos inmediata. Durante la defensa de la granja en la "Batalla del Establo", donde Jones intenta recuperar su propiedad por la fuerza, Snowball demuestra un heroÃ­smo asombroso liderando la carga, mientras que NapoleÃ³n apenas participa. Sin embargo, la rivalidad llega a su punto crÃ­tico cuando NapoleÃ³n utiliza a una jaurÃ­a de perros enormes y feroces, que Ã©l mismo habÃ­a criado en secreto, para expulsar a Snowball de la granja bajo amenaza de muerte.

Tras la expulsiÃ³n de Snowball, NapoleÃ³n asume el control absoluto y elimina las asambleas dominicales, declarando que todas las decisiones serÃ¡n tomadas por un comitÃ© de cerdos presidido por Ã©l mismo. Utiliza a Squealer, un cerdo con una habilidad extraordinaria para la manipulaciÃ³n verbal, para convencer al resto de los animales de que Snowball siempre fue un traidor y un agente secreto del seÃ±or Jones. Squealer es la pieza clave de la propaganda: es capaz de convencer a los animales de que sus recuerdos son falsos y de que la realidad es la que NapoleÃ³n dicta. El proyecto del molino de viento, al que NapoleÃ³n se habÃ­a opuesto, es retomado ahora como una idea propia de Ã©l, alegando que Snowball se la habÃ­a robado. Los animales comienzan a trabajar jornadas extenuantes, enfrentando el hambre y el frÃ­o, pero lo hacen con el consuelo de que ahora trabajan para sÃ­ mismos y no para un amo humano.

La corrupciÃ³n del poder se vuelve evidente a medida que los cerdos comienzan a otorgarse privilegios especiales, como mudarse a la casa del seÃ±or Jones y dormir en camas. Cuando los animales notan que esto viola los mandamientos, descubren que las leyes en la pared han sido alteradas sutilmente; ahora el mandamiento dice que no se puede dormir en una cama "con sÃ¡banas". Esta tÃ¡ctica de modificaciÃ³n gradual se aplica a todas las leyes. La figura de NapoleÃ³n se vuelve cada vez mÃ¡s distante y sagrada, rodeado siempre por su guardia pretoriana de perros. Comienzan las purgas internas, donde animales confiesan crÃ­menes inexistentes bajo presiÃ³n y son ejecutados frente a todos, violando el mandamiento de no matar a otros animales, el cual ahora reza: "NingÃºn animal matarÃ¡ a otro animal sin causa". El terror se instala en la granja, y la canciÃ³n "Bestias de Inglaterra" es prohibida, sustituida por himnos que glorifican la figura de NapoleÃ³n como el "Padre de todos los animales".

El personaje de Boxer, el caballo de tiro, representa la tragedia de la clase trabajadora mÃ¡s noble y sacrificada. Su lema, "TrabajarÃ© mÃ¡s fuerte", es el motor que permite la construcciÃ³n del molino una y otra vez tras derrumbes y ataques externos. Sin embargo, cuando Boxer cae enfermo debido al agotamiento extremo, NapoleÃ³n promete enviarlo a un hospital humano para que lo curen. El horror estalla cuando los animales ven que el furgÃ³n que se lleva a Boxer tiene escrito en un costado "FÃ¡brica de Cola y Descuartizador de Caballos". Squealer logra calmar los Ã¡nimos con mÃ¡s mentiras, asegurando que el vehÃ­culo simplemente no habÃ­a sido repintado por el veterinario, pero la verdad es amarga: NapoleÃ³n vendiÃ³ al trabajador mÃ¡s leal de la granja para comprarse una caja de whisky.

AÃ±os despuÃ©s, la granja es mÃ¡s rica que nunca, pero solo para los cerdos y los perros. Los Siete Mandamientos han desaparecido por completo, sustituidos por una Ãºnica y cÃ­nica sentencia: "Todos los animales son iguales, pero algunos animales son mÃ¡s iguales que otros". Los cerdos empiezan a caminar sobre dos patas, a usar ropa y a llevar lÃ¡tigos en sus manos para supervisar el trabajo. El clÃ­max de la historia ocurre cuando NapoleÃ³n invita a los granjeros humanos de los alrededores a una cena de celebraciÃ³n. Desde las ventanas, el resto de los animales observa con asombro cÃ³mo cerdos y hombres brindan por la prosperidad mutua y por el regreso de la disciplina fÃ©rrea en la granja, que vuelve a llamarse Granja Solariega. Mientras estalla una pelea por una trampa en una partida de cartas, los animales miran los rostros de los cerdos y luego los de los hombres, y se dan cuenta de algo aterrador: ya no pueden distinguir quiÃ©n es quiÃ©n. La revoluciÃ³n ha terminado convirtiÃ©ndose exactamente en aquello que jurÃ³ destruir, cerrando un cÃ­rculo de opresiÃ³n donde los cerdos han reemplazado a los humanos en su tiranÃ­a.`
    },
    {
        session: 6,
        unit: 'LÃ­rica',
        topic: 'Tragedia Griega: AntÃ­gona',
        videoTitle: 'Post PAES Competencia Lectora',
        videoLink: 'https://www.youtube.com/watch?v=0KBmmhtwHlE',
        readingTitle: 'AntÃ­gona (Resumen y AnÃ¡lisis)',
        readingContent: `La tragedia de AntÃ­gona comienza en la mÃ­tica ciudad de Tebas, una ciudad que aÃºn sangra por las heridas de una guerra civil fratricida. Tras la caÃ­da y el exilio de Edipo, sus dos hijos varones, Eteocles y Polinices, acordaron turnarse en el trono de la ciudad. Sin embargo, la ambiciÃ³n rompiÃ³ el pacto: Eteocles se negÃ³ a ceder el poder al cumplirse su aÃ±o, lo que llevÃ³ a Polinices a buscar refugio en Argos y regresar con un ejÃ©rcito extranjero para reclamar su derecho por la fuerza. La batalla terminÃ³ en una tragedia simÃ©trica a las puertas de Tebas, donde los dos hermanos se dieron muerte el uno al otro en un combate singular. Con la lÃ­nea sucesoria masculina interrumpida por la sangre, el trono recae en Creonte, tÃ­o de los fallecidos, quien asume el mando con la firme intenciÃ³n de restaurar el orden y la autoridad del Estado en una ciudad devastada por el conflicto.

El primer acto de Creonte como rey es promulgar un edicto que sacude los cimientos morales de la ciudad: Eteocles, defensor de Tebas, recibirÃ¡ todos los honores fÃºnebres correspondientes a un hÃ©roe; pero Polinices, el invasor, es declarado traidor y su cuerpo debe quedar a la intemperie, sin sepultura, para ser devorado por las aves y los perros. En la mentalidad griega, negar los ritos funerarios no era solo un insulto fÃ­sico, sino una condena espiritual eterna, ya que el alma del difunto no podrÃ­a encontrar descanso en el Hades. Es aquÃ­ donde surge la figura de AntÃ­gona, la hermana de los fallecidos, quien decide que no puede permitir que la ley de un hombre pase por encima de las leyes divinas y los lazos de sangre. La obra se abre con una tensa conversaciÃ³n entre AntÃ­gona y su hermana Ismene. Mientras AntÃ­gona personifica la valentÃ­a y el deber sagrado, Ismene representa la prudencia y el miedo frente al poder absoluto, negÃ¡ndose a participar en el entierro por temor a la ejecuciÃ³n pÃºblica decretada por Creonte.

AntÃ­gona, solitaria en su resoluciÃ³n, acude al campo de batalla y cubre el cuerpo de Polinices con una fina capa de polvo y ritos simbÃ³licos. Poco despuÃ©s, un guardia aterrorizado informa a Creonte de lo sucedido. El rey, cuya psicologÃ­a estÃ¡ dominada por la inseguridad de un gobernante nuevo y el miedo a la anarquÃ­a, reacciona con paranoia, sospechando que sus enemigos polÃ­ticos han sobornado a los guardias. Sin embargo, AntÃ­gona es capturada cuando intenta realizar los ritos por segunda vez bajo la luz del dÃ­a. Al ser llevada ante Creonte, se produce uno de los debates mÃ¡s profundos de la literatura universal. AntÃ­gona no niega su acto; por el contrario, lo defiende con una altivez desafiante. Ella sostiene que el edicto de Creonte no tiene fuerza para anular las "leyes no escritas e inquebrantables de los dioses", que dictan el respeto a los muertos. Por su parte, Creonte argumenta que el bienestar de la ciudad depende de la obediencia ciega a la ley y que un traidor no puede ser tratado igual que un patriota, ni siquiera en la muerte.

La ceguera de Creonte lo lleva a condenar a AntÃ­gona a ser encerrada viva en una tumba de piedra, un castigo que busca evitar que la ciudad se manche con su sangre directa, pero que en la prÃ¡ctica es un entierro en vida. En este punto aparece HemÃ³n, hijo de Creonte y prometido de AntÃ­gona. HemÃ³n intenta razonar con su padre, actuando como la voz del pueblo que admira el valor de la joven. Le advierte que un gobernante que no escucha y que cree ser el Ãºnico poseedor de la verdad termina por destruir el Estado que intenta salvar. La discusiÃ³n escala en violencia verbal: Creonte acusa a su hijo de estar esclavizado por una mujer, mientras HemÃ³n le advierte que la muerte de AntÃ­gona arrastrarÃ¡ consigo otra muerte. La obstinaciÃ³n de Creonte, conocida como hubris o orgullo excesivo, lo ciega ante las seÃ±ales de peligro.

El giro trÃ¡gico final es desencadenado por el profeta ciego Tiresias, quien acude al palacio para advertir a Creonte que los dioses estÃ¡n furiosos. Las aves de rapiÃ±a, saciadas con la carne de Polinices, estÃ¡n contaminando los altares, y los sacrificios no son aceptados. Tiresias profetiza que, si Creonte no rectifica, pagarÃ¡ "cadÃ¡ver por cadÃ¡ver" de su propia estirpe. Solo ante la amenaza sobrenatural, Creonte cede y decide liberar a AntÃ­gona y enterrar a Polinices. Sin embargo, el destino ya estÃ¡ sellado. Cuando Creonte llega a la tumba de piedra, descubre que AntÃ­gona se ha ahorcado con su propio velo para evitar la lenta agonÃ­a de la inaniciÃ³n. HemÃ³n, destrozado por el dolor, intenta atacar a su padre y, al fallar, se suicida abrazando el cuerpo de su prometida.

La noticia del suicidio de HemÃ³n llega al palacio y provoca la tragedia final: EurÃ­dice, la esposa de Creonte y madre de HemÃ³n, se quita la vida maldiciendo a su marido por ser el causante de la muerte de sus hijos. La obra termina con un Creonte devastado, quien ha pasado de ser un monarca autoritario que creÃ­a controlar el destino de Tebas a ser un hombre roto que suplica por su propia muerte, comprendiendo demasiado tarde que la sabidurÃ­a consiste en no desafiar las leyes sagradas ni los sentimientos humanos mÃ¡s bÃ¡sicos. El Coro cierra la tragedia reflexionando sobre cÃ³mo el orgullo de los hombres es castigado con grandes golpes de la fortuna, y cÃ³mo solo a travÃ©s del sufrimiento se aprende, finalmente, la sensatez. AntÃ­gona queda como el sÃ­mbolo eterno de la desobediencia civil y la primacÃ­a de la conciencia individual sobre la arbitrariedad del poder polÃ­tico.`
    },
    {
        session: 7,
        unit: 'LÃ­rica',
        topic: 'Drama Moderno: Casa de muÃ±ecas',
        videoTitle: 'AnÃ¡lisis: La CanciÃ³n del Pirata',
        videoLink: 'https://www.youtube.com/watch?v=xtOya7BLCiY',
        readingTitle: 'Casa de muÃ±ecas (Resumen y AnÃ¡lisis)',
        readingContent: `La obra comienza en la calidez de un hogar burguÃ©s noruego a finales del siglo XIX, durante los preparativos para la celebraciÃ³n de la Navidad. El ambiente inicial destila una aparente felicidad y estabilidad financiera, marcada por el reciente ascenso de Torvald Helmer a la direcciÃ³n de un banco. Nora Helmer, su esposa, entra en escena cargada de paquetes y dulces, personificando la imagen de la mujer ideal de la Ã©poca: alegre, despreocupada y dedicada al consumo y al embellecimiento del hogar. Desde los primeros diÃ¡logos, se establece una dinÃ¡mica de poder desigual y paternalista; Torvald se dirige a Nora con apodos condescendientes como "alondra", "ardillita" o "pajarito", tratÃ¡ndola mÃ¡s como a una mascota o una posesiÃ³n preciada que como a una compaÃ±era intelectual. Nora acepta este papel con una mezcla de coqueterÃ­a y sumisiÃ³n, reforzando la idea de que su Ãºnica funciÃ³n es ser una fuente de entretenimiento y alegrÃ­a para su marido, una figura decorativa en lo que parece ser una vida perfecta.

Sin embargo, tras esta fachada de ligereza, Nora oculta un secreto que ha guardado con celo durante aÃ±os y que constituye el motor de la tragedia. AÃ±os atrÃ¡s, cuando Torvald cayÃ³ gravemente enfermo y los mÃ©dicos advirtieron que solo un viaje al sur podrÃ­a salvar su vida, Nora se vio en la desesperada necesidad de conseguir una gran suma de dinero. Dado que las leyes y las convenciones sociales de la Ã©poca impedÃ­an que una mujer solicitara un prÃ©stamo sin el consentimiento de su marido o su padre, Nora se vio obligada a actuar en la sombra. FalsificÃ³ la firma de su padre, que acababa de morir, para obtener un crÃ©dito del procurador Nils Krogstad. Desde entonces, Nora ha trabajado en secreto, ahorrando de su gasto domÃ©stico y realizando trabajos de copia manual para pagar las cuotas de la deuda, viendo este acto como una prueba de su amor heroico y sacrificio personal, convencida de que, si Torvald llegara a saberlo, lo verÃ­a como un gesto sublime de devociÃ³n.

La trama se complica con la llegada de Kristine Linde, una antigua amiga de Nora que ha enviudado recientemente y busca empleo. A travÃ©s de la conversaciÃ³n con Kristine, Nora revela su secreto, buscando reconocimiento por su valentÃ­a. Sin embargo, la realidad golpea con la apariciÃ³n de Krogstad, quien trabaja en el banco de Torvald y estÃ¡ a punto de ser despedido. Krogstad, consciente de que su reputaciÃ³n social estÃ¡ en juego, visita a Nora para chantajearla: si ella no logra convencer a Torvald de mantenerlo en su puesto, Ã©l revelarÃ¡ el fraude y la falsificaciÃ³n a su marido y a la justicia. Nora intenta interceder por Ã©l, pero Torvald, movido por un rÃ­gido sentido de la moralidad y un profundo desprecio por la falta de integridad de Krogstad, se niega rotundamente, argumentando que la presencia de un hombre deshonesto en el banco contaminarÃ­a el ambiente y la educaciÃ³n de sus propios hijos.

A medida que el chantaje de Krogstad avanza, Nora experimenta un torbellino de angustia y desesperaciÃ³n. Considera diversas salidas, desde pedir dinero al Dr. Rank, un amigo cercano de la familia que estÃ¡ secretamente enamorado de ella y que sufre una enfermedad terminal, hasta el suicidio. Sin embargo, Nora se aferra a la esperanza de lo que ella llama "el milagro": la convicciÃ³n de que, cuando Torvald descubra la verdad, asumirÃ¡ toda la responsabilidad, se sacrificarÃ¡ por ella y la protegerÃ¡ frente al mundo, demostrando que su amor es tan grande como el de ella. Esta fe ciega en la nobleza de su marido es lo que la sostiene mientras ensaya frenÃ©ticamente la tarantela, un baile que simboliza su agitaciÃ³n interna y su lucha por mantener el control mientras el mundo que ha construido se desmorona bajo sus pies.

La tensiÃ³n alcanza su punto mÃ¡ximo durante la fiesta de disfraces en el piso superior. Tras el baile, Krogstad deja una carta detallando todo el asunto en el buzÃ³n cerrado de Torvald. Kristine Linde, quien tuvo una relaciÃ³n sentimental con Krogstad en el pasado, intenta interceder, logrando que el chantajista se arrepienta y decida devolver el documento de la deuda. Sin embargo, Kristine decide que es necesario que los Helmer se enfrenten a la verdad para que su matrimonio deje de ser una mentira. Cuando Torvald finalmente lee la carta, la reacciÃ³n no es el "milagro" que Nora esperaba. En lugar de protegerla, Torvald estalla en una furia egoÃ­sta y violenta. La acusa de criminal, de mentirosa y de haber destruido su reputaciÃ³n y su futuro. Le prohÃ­be educar a sus hijos, considerÃ¡ndola una presencia corruptora, y declara que su matrimonio ha terminado, aunque deben mantener las apariencias externas para salvar el prestigio social. En este momento, la venda cae de los ojos de Nora: comprende que el hombre con el que ha vivido ocho aÃ±os y con el que ha tenido tres hijos es un extraÃ±o que no la ama, sino que ama la imagen de ella que Ã©l ha creado.

El giro final de la obra ocurre cuando llega una segunda carta de Krogstad devolviendo el documento de la deuda. Al ver que el peligro ha pasado, la actitud de Torvald cambia instantÃ¡neamente. Recupera su tono paternal y "perdona" a Nora, atribuyendo sus actos a su "debilidad femenina" y expresando su deseo de volver a la normalidad de su "casa de muÃ±ecas". Pero Nora ya no es la misma. Se quita su disfraz de fiesta y, por primera vez en su vida, se sienta a hablar seriamente con su marido. Nora analiza su existencia y llega a la conclusiÃ³n de que siempre ha sido tratada como un objeto: primero por su padre, quien la llamaba su "muÃ±eca", y luego por Torvald, quien la ha mantenido en una minorÃ­a de edad perpetua. Se da cuenta de que ha pasado de manos de uno a otro sin haber desarrollado nunca una identidad propia, y que sus supuestos deberes hacia su esposo y sus hijos son secundarios frente a su deber mÃ¡s sagrado: el deber hacia sÃ­ misma.

Nora decide abandonar el hogar, a su marido y a sus hijos, comprendiendo que no estÃ¡ capacitada para educarlos si antes no se educa a sÃ­ misma y descubre quiÃ©n es en realidad. Torvald, desesperado, apela a la religiÃ³n, a la moral y a la ley, pero Nora rebate cada argumento con una lÃ³gica aplastante basada en su experiencia personal. Ella declara que no puede creer en lo que dicen los libros si su corazÃ³n y su razÃ³n le dicen algo distinto. La obra termina con una de las escenas mÃ¡s famosas de la historia del teatro: Nora sale de la casa y cierra la puerta tras de sÃ­ con un golpe seco, un sonido que resonÃ³ en toda Europa como el inicio de una nueva era para los derechos y la autonomÃ­a de la mujer. Nora deja atrÃ¡s la seguridad de la "casa de muÃ±ecas" para enfrentarse a un mundo incierto, pero libre, dejando a un Torvald devastado que solo puede quedarse preguntÃ¡ndose si algÃºn dÃ­a ocurrirÃ¡ "el milagro mÃ¡s grande": que ambos cambien tanto que su convivencia pueda convertirse en un verdadero matrimonio.`
    },
    {
        session: 8,
        unit: 'LÃ­rica',
        topic: 'Tragedia Rural: Bodas de sangre',
        videoTitle: 'Repaso General PAES Lectura',
        videoLink: 'https://www.youtube.com/watch?v=ysWK6sbI4Dw',
        readingTitle: 'Bodas de sangre (Resumen y AnÃ¡lisis)',
        readingContent: `La tragedia de Federico GarcÃ­a Lorca comienza en el paisaje Ã¡rido y caluroso de la AndalucÃ­a rural, un entorno donde la tierra, el honor y la sangre dictan las leyes de la existencia. La obra se abre con una conversaciÃ³n cargada de presagios entre la Madre y su hijo, el Novio. Desde los primeros versos, la Madre se presenta como una figura marcada por el dolor y el luto perpetuo; ha perdido a su marido y a otro de sus hijos en una disputa violenta con la familia de los FÃ©lix. Para ella, la vida es una frÃ¡gil tregua que puede romperse con el brillo de una navaja, un objeto que desprecia y teme por su capacidad de segar la vida de "un hombre que es un sol". El Novio, ajeno a estos temores ancestrales, anuncia su deseo de casarse con una joven que vive en las lejanÃ­as de los secanos. Aunque la Madre acepta con resignaciÃ³n el deseo de su hijo de continuar la estirpe, la sombra de la muerte y el recuerdo de la familia enemiga planean sobre la escena como nubarrones negros.

El conflicto se profundiza cuando se revela el pasado de la Novia. A travÃ©s de las conversaciones de la vecindad y el servicio, nos enteramos de que la joven mantuvo hace aÃ±os una relaciÃ³n apasionada con Leonardo, un miembro de la familia FÃ©lix. Leonardo es el Ãºnico personaje de la obra que posee un nombre propio, lo que subraya su individualidad rebelde y su papel como motor de la tragedia. Actualmente, Leonardo estÃ¡ casado con la prima de la Novia y tiene un hijo, pero su fuego interno no se ha apagado. Lo vemos aparecer en escenas cargadas de tensiÃ³n, llegando a la casa de la Novia en su caballo, que corre hasta reventar, simbolizando una pasiÃ³n desbocada que no puede ser contenida por las convenciones sociales ni por los lazos del matrimonio. El caballo de Leonardo es un sÃ­mbolo lorquiano del deseo sexual y la fuerza instintiva que arrastra a los personajes hacia su destino.

La trama avanza hacia el dÃ­a de la boda, un evento que deberÃ­a ser de alegrÃ­a pero que estÃ¡ impregnado de una atmÃ³sfera asfixiante. La Novia se debate en una lucha interna desgarradora: por un lado, desea la estabilidad y el honor que le ofrece el Novio, un hombre bueno y trabajador; por otro lado, se siente irremediablemente atraÃ­da por la fuerza oscura y salvaje de Leonardo. En la maÃ±ana de la ceremonia, Leonardo visita a la Novia en su alcoba mientras ella se prepara, y en un diÃ¡logo lleno de reproches y deseo contenido, ambos reconocen que el fuego que los une sigue vivo a pesar de los aÃ±os y de la sangre derramada entre sus familias. La Novia intenta resistir, afirmando que se casarÃ¡ para encerrarse "con su marido" y levantar un muro contra el pasado, pero sus palabras carecen de la fuerza necesaria para convencerse a sÃ­ misma.

La boda se celebra con toda la pompa rural, entre cantos de azahar y bailes, pero la tensiÃ³n es palpable. Tras la ceremonia, mientras los invitados festejan, la tragedia estalla: la Novia y Leonardo huyen juntos a lomos del caballo, escapando hacia el bosque. Este acto de rebeliÃ³n mÃ¡xima rompe todas las leyes de la honra y desata la furia de las dos familias. La Madre, al enterarse de la fuga y de que el hombre involucrado es un FÃ©lix, instiga a su hijo a la persecuciÃ³n, transformando su miedo inicial en una sed de justicia y sangre. "Ha llegado otra vez la hora de la sangre", exclama, marcando el inicio de una cacerÃ­a humana en la que el Novio debe defender su honor y el de su linaje en una tierra que no perdona la traiciÃ³n.

El tercer acto de la obra se traslada a un bosque nocturno y mÃ¡gico, donde Lorca abandona el realismo para introducir elementos simbÃ³licos y poÃ©ticos. Aparecen los LeÃ±adores, que actÃºan como un coro griego comentando el destino de los fugitivos, y dos figuras sobrenaturales: la Luna y la Mendiga (que representa a la Muerte). La Luna, personificada como un joven leÃ±ador de cara blanca, anhela sangre para calentar su luz frÃ­a y se convierte en cÃ³mplice de la tragedia al iluminar el camino de los perseguidores. La Mendiga, por su parte, guÃ­a al Novio hacia su rival, asegurÃ¡ndose de que el encuentro sea fatal. En este bosque, el tiempo parece detenerse y la pasiÃ³n de Leonardo y la Novia alcanza su cÃ©nit lÃ­rico; ambos saben que su amor es una condena a muerte, pero aceptan su destino con una entrega absoluta, afirmando que "la culpa es de la tierra" y de la fuerza de la sangre que corre por sus venas.

El clÃ­max ocurre fuera de escena, pero su impacto es devastador. Leonardo y el Novio se encuentran y se dan muerte mutuamente con navajas, cumpliendo el temor inicial de la Madre. La obra termina con un cuadro de dolor universal. La Novia regresa a la casa de la Madre, con el vestido blanco manchado de sangre y el alma destrozada, pidiendo ser sacrificada para demostrar que, aunque huyÃ³, su cuerpo sigue siendo "puro" porque fue arrastrada por una fuerza superior a su voluntad. La Madre, sin embargo, ya no tiene espacio para el odio o el perdÃ³n; se queda sola en su casa, rodeada de las mujeres de luto, aceptando que ya no tiene hijos que perder y que su Ãºnica compaÃ±Ã­a serÃ¡ el recuerdo de "ese pequeÃ±o cuchillo que apenas cabe en la mano, pero que penetra frÃ­o por las carnes asombradas". Bodas de sangre concluye asÃ­ como una reflexiÃ³n sobre el ciclo inevitable de la violencia, la imposibilidad de escapar al destino y la fuerza de una pasiÃ³n que, como un rÃ­o de sangre, termina por desbordar y destruir todo a su paso.`
    },
    {
        session: 9,
        unit: 'Narrativa',
        topic: 'Narrativa ContemporÃ¡nea: El curioso incidente...',
        videoTitle: 'El texto argumentativo',
        videoLink: 'https://www.youtube.com/watch?v=5bZ42hoiYh8',
        readingTitle: 'El curioso incidente del perro a medianoche (Resumen y AnÃ¡lisis)',
        readingContent: `La historia comienza en una calle tranquila de Swindon, Inglaterra, durante una medianoche que cambiarÃ­a para siempre la percepciÃ³n del mundo de Christopher John Francis Boone. Christopher es un joven de quince aÃ±os con una mente prodigiosa para las matemÃ¡ticas y la lÃ³gica, pero que experimenta el mundo de una manera radicalmente distinta a la mayorÃ­a de las personas debido a un trastorno del espectro autista, probablemente sÃ­ndrome de Asperger, aunque nunca se menciona explÃ­citamente en el texto. Para Christopher, el mundo es un caos de estÃ­mulos sensoriales que debe ser ordenado meticulosamente a travÃ©s de reglas, nÃºmeros primos y hechos comprobables. Esa noche, Christopher descubre el cadÃ¡ver de Wellington, el caniche de su vecina la seÃ±ora Shears, atravesado por una horca de jardÃ­n en medio del cÃ©sped. Este evento, que para otros podrÃ­a ser un incidente lamentable pero menor, se convierte para Christopher en el punto de partida de un enigma que debe resolver, decidiendo escribir un libro sobre su investigaciÃ³n, al estilo de sus admiradas historias de Sherlock Holmes.

La vida de Christopher estÃ¡ regida por una estructura rÃ­gida diseÃ±ada para protegerlo del abrumador ruido del mundo exterior. No soporta que lo toquen, no comprende las metÃ¡foras Ã³Ã‚Âporque las considera mentirasÃ³Ã‚Â y juzga la calidad de su dÃ­a basÃ¡ndose en el color de los coches que ve desde el autobÃºs escolar: cuatro coches rojos seguidos significan un "Buen DÃ­a", mientras que cuatro coches amarillos presagian un "DÃ­a Negro" en el que no hablarÃ¡ con nadie. Su principal apoyo es Siobhan, su tutora en la escuela, quien le enseÃ±a a descifrar las complejas emociones humanas a travÃ©s de dibujos de caras y le anima a seguir escribiendo su crÃ³nica detectivesca. Sin embargo, su padre, Ed Boone, reacciona con una furia desproporcionada y angustiante cuando descubre que su hijo estÃ¡ haciendo preguntas sobre la muerte del perro, prohibiÃ©ndole terminantemente continuar con su investigaciÃ³n y exigiÃ©ndole que deje de meter las narices en los asuntos de los vecinos.

A pesar de la prohibiciÃ³n de su padre, la curiosidad lÃ³gica de Christopher lo lleva a desobedecer. Durante sus pesquisas, descubre verdades que los adultos a su alrededor han intentado ocultar bajo capas de silencio y engaÃ±o. La mÃ¡s devastadora de estas verdades se revela cuando Christopher, buscando su libro de notas que su padre le habÃ­a confiscado, encuentra una caja con cartas escondidas en el armario de Ed. Al leerlas, su mundo lÃ³gico se colapsa: las cartas estÃ¡n escritas por su madre, Judy, y tienen fechas posteriores al momento en que su padre le dijo que ella habÃ­a muerto de un ataque al corazÃ³n en el hospital. Christopher descubre que su madre no estÃ¡ muerta, sino que vive en Londres con el seÃ±or Shears, el exmarido de su vecina. La revelaciÃ³n de que su padre le ha mentido durante aÃ±os sobre el hecho mÃ¡s fundamental de su vida rompe el Ãºnico vÃ­nculo de confianza que Christopher poseÃ­a, llevÃ¡ndolo a un estado de pÃ¡nico y parÃ¡lisis emocional.

La situaciÃ³n alcanza un punto de no retorno cuando Ed, en un intento desesperado de reconciliaciÃ³n y honestidad tras ser descubierto, confiesa a Christopher que fue Ã©l quien matÃ³ a Wellington. La confesiÃ³n de su padre no es recibida como un acto de redenciÃ³n, sino como una amenaza mortal para Christopher. En su lÃ³gica binaria, si su padre es capaz de matar a un perro, tambiÃ©n es capaz de matarlo a Ã©l porque Ã©l tambiÃ©n es un ser vivo que puede ser impredecible. Aterrorizado y sintiÃ©ndose inseguro en su propio hogar, Christopher toma una decisiÃ³n que desafÃ­a todas sus limitaciones: viajar solo a Londres para encontrar a su madre. Este viaje representa una odisea Ã©pica para alguien que nunca ha ido mÃ¡s allÃ¡ de su propia calle sin compaÃ±Ã­a y que se desorienta en lugares desconocidos y ruidosos.

El viaje a Londres es una de las partes mÃ¡s intensas y detalladas de la narraciÃ³n. Christopher debe enfrentarse a la estaciÃ³n de tren, un lugar que describe como un ataque masivo a sus sentidos, donde los anuncios, la multitud y el movimiento constante lo obligan a sentarse en el suelo y taparse los oÃ­dos para no "explotar". A travÃ©s de un esfuerzo intelectual sobrehumano, utiliza sus conocimientos de matemÃ¡ticas y su capacidad para crear mapas mentales para navegar por el metro de Londres, enfrentÃ¡ndose a la policÃ­a y al agotamiento. Esta parte de la historia permite al lector experimentar la angustia y la valentÃ­a silenciosa de Christopher, quien a pesar de su terror paralizante, sigue adelante porque su lÃ³gica le dice que es la Ãºnica forma de sobrevivir.

Al llegar finalmente al apartamento de su madre, el encuentro provoca un caos emocional en la vida de Judy y del seÃ±or Shears. Judy, que se sentÃ­a incapaz de cuidar a Christopher aÃ±os atrÃ¡s debido a sus propias crisis de ansiedad y a la dificultad de manejar el comportamiento de su hijo, se ve inundada por la culpa y el amor. El regreso de Christopher a su vida fuerza la ruptura de su relaciÃ³n con el seÃ±or Shears y la obliga a regresar a Swindon para asegurar el bienestar de su hijo. La tensiÃ³n entre Ed y Judy es constante y dolorosa, reflejando el impacto que tiene en una pareja la crianza de un niÃ±o con necesidades especiales cuando no existe la comunicaciÃ³n adecuada.

El final de la obra muestra a un Christopher que ha crecido internamente a travÃ©s del trauma. A pesar de la inestabilidad que lo rodea, logra cumplir uno de sus mayores sueÃ±os: presentarse al examen de Bachillerato de MatemÃ¡ticas de Nivel A, obteniendo la calificaciÃ³n mÃ¡xima. Este logro acadÃ©mico es para Ã©l la prueba de que puede hacer cualquier cosa, incluso vivir solo y convertirse en un cientÃ­fico. Su padre, Ed, intenta recuperar su confianza poco a poco, regalÃ¡ndole un cachorro de Golden Retriever llamado Sandy para reemplazar la pÃ©rdida de Wellington y demostrando su compromiso de no volver a mentirle. Aunque la relaciÃ³n familiar no se repara de forma mÃ¡gica y el futuro de Christopher sigue presentando desafÃ­os significativos, la novela termina con una nota de esperanza basada en la autonomÃ­a. Christopher ha resuelto el misterio, ha sobrevivido a un viaje aterrador y ha descubierto la verdad sobre su familia, concluyendo que su mente Ãºnica, lejos de ser una limitaciÃ³n, es la herramienta que le permitirÃ¡ conquistar su propio destino.`
    },
    {
        session: 10,
        unit: 'Narrativa',
        topic: 'Narrativa/CrÃ³nica: CrÃ³nica de una muerte anunciada',
        videoTitle: 'Hecho y opiniÃ³n',
        videoLink: 'https://www.youtube.com/watch?v=UsiqUeoyIaw',
        readingTitle: 'CrÃ³nica de una muerte anunciada (Resumen y AnÃ¡lisis)',
        readingContent: `El dÃ­a en que lo iban a matar, Santiago Nasar se levantÃ³ a las cinco y media de la maÃ±ana para esperar el buque en que llegaba el obispo. HabÃ­a tenido un sueÃ±o confuso sobre Ã¡rboles de higuerÃ³n y una llovizna tierna, un presagio que su madre, PlÃ¡cida Linero, experta en interpretar sueÃ±os ajenos, no alcanzÃ³ a descifrar como una seÃ±al de peligro. Santiago era un joven apuesto, heredero de una fortuna considerable y con un talento natural para el manejo de las armas y la cetrerÃ­a, rasgos que habÃ­a aprendido de su padre Ã¡rabe, Ibrahim Nasar. Aquella maÃ±ana fatÃ­dica, el pueblo entero estaba conmocionado por la visita del obispo, pero bajo esa capa de fervor religioso se gestaba una tragedia de honor que ya era de dominio pÃºblico, menos para el propio Santiago. La fatalidad comenzÃ³ meses atrÃ¡s con la llegada de Bayardo San RomÃ¡n, un hombre de aspecto galante y recursos ilimitados que llegÃ³ al pueblo con el Ãºnico propÃ³sito de casarse. Bayardo eligiÃ³ a Ã­Ã‚Ângela Vicario, la hija menor de una familia de escasos recursos pero de honor rÃ­gido, y tras un cortejo ostentoso que incluyÃ³ la compra de la casa mÃ¡s hermosa del pueblo a un viudo reacio, se celebrÃ³ la boda mÃ¡s grande que la regiÃ³n recordara.

Sin embargo, la noche de bodas terminÃ³ en un escÃ¡ndalo que marcarÃ­a el destino de todos. Bayardo San RomÃ¡n descubriÃ³ que Ã­Ã‚Ângela Vicario no era virgen y, siguiendo las leyes del honor de la Ã©poca, la devolviÃ³ a la casa de sus padres en la madrugada. Bajo la presiÃ³n de los golpes de su madre y el interrogatorio desesperado de sus hermanos gemelos, Pedro y Pablo Vicario, Ã­Ã‚Ângela pronunciÃ³ un nombre: Santiago Nasar. Nunca se supo con certeza si Santiago era realmente el responsable, pues Ã­Ã‚Ângela siempre mantuvo su versiÃ³n pero las pruebas circunstanciales sugerÃ­an que podrÃ­a estar protegiendo a alguien a quien realmente amaba. Para los gemelos Vicario, la respuesta fue inmediata y obligatoria segÃºn los cÃ³digos sociales que regÃ­an su mundo: debÃ­an matar a Santiago Nasar para lavar la honra de su hermana. Lo que siguiÃ³ fue una secuencia de eventos absurdos donde la voluntad humana pareciÃ³ disolverse frente a un destino que se negaba a ser evitado.

Los gemelos Vicario no eran asesinos por naturaleza; eran hombres de paz que se sintieron empujados por el deber. Por esta razÃ³n, hicieron todo lo posible para que alguien los detuviera. Durante horas, anunciaron sus intenciones a voz en cuello en el mercado y en la tienda de leche de Clotilde Armenta. Afilaban sus cuchillos de destazar cerdos a la vista de todos, esperando que la autoridad o algÃºn vecino les impidiera cometer el crimen. El pueblo, sin embargo, reaccionÃ³ con una mezcla de incredulidad, morbo y negligencia. Algunos pensaron que era una bravuconada de borrachos; otros creyeron que Santiago Nasar ya sabÃ­a y estaba protegido, y hubo quienes simplemente consideraron que los asuntos de honor eran privados y no debÃ­an interferir. El coronel LÃ¡zaro Aponte les quitÃ³ los cuchillos una vez, creyendo que con eso bastaba, pero los gemelos regresaron con otros nuevos, reafirmando que su compromiso no era con la muerte, sino con su propia dignidad.

A medida que avanzaba la maÃ±ana, la red de advertencias fallidas se volvÃ­a mÃ¡s compleja. Santiago Nasar saliÃ³ de su casa por la puerta principal, la cual solÃ­a estar cerrada pero que ese dÃ­a estaba abierta por la visita del obispo. CaminÃ³ por el pueblo saludando a la gente, ajeno al hecho de que los gemelos lo esperaban frente a la tienda de Clotilde. Hubo mensajes que nunca llegaron, personas que intentaron advertirle pero se cruzaron en el camino equivocado, y puertas que se cerraron en el momento menos oportuno. Incluso su novia, Flora Miguel, despechada por los rumores del escÃ¡ndalo, lo recibiÃ³ con ira en lugar de protegerlo. Cuando Santiago finalmente comprendiÃ³ que lo buscaban para matarlo, entrÃ³ en un estado de confusiÃ³n total, corriendo hacia su casa mientras el pueblo observaba la persecuciÃ³n como si fuera una funciÃ³n de teatro.

El clÃ­max de la tragedia ocurriÃ³ frente a la puerta de su propia casa. Su madre, PlÃ¡cida Linero, creyendo que Santiago ya estaba adentro, cerrÃ³ la puerta principal justo cuando Ã©l intentaba entrar huyendo de los cuchillos de los gemelos. Los hermanos Vicario lo alcanzaron contra la madera de la puerta y lo apuÃ±alaron con una saÃ±a que parecÃ­a dictada por una fuerza externa. Santiago Nasar, con las vÃ­sceras en las manos, logrÃ³ caminar un corto trecho, entrÃ³ por la puerta de la cocina y cayÃ³ muerto en el centro de su hogar. El asesinato no fue solo un acto de los Vicario, sino una ejecuciÃ³n colectiva permitida por la pasividad de una comunidad que aceptaba el sacrificio humano como una forma de mantener el equilibrio moral. La autopsia, realizada de manera rÃºstica por el pÃ¡rroco debido a la ausencia del mÃ©dico, fue un segundo ultraje al cuerpo de Santiago, convirtiendo su cadÃ¡ver en una carnicerÃ­a tÃ©cnica que solo aumentÃ³ el horror de los testigos.

Los aÃ±os siguientes no trajeron paz al pueblo. Los gemelos Vicario fueron absueltos por la justicia bajo el argumento del honor, pero sus vidas quedaron marcadas por el insomnio y la culpa. Bayardo San RomÃ¡n desapareciÃ³ en un estado de postraciÃ³n, convertido en un fantasma de su antigua gloria. Ã­Ã‚Ângela Vicario, exiliada en un pueblo remoto, descubriÃ³ que su amor por Bayardo naciÃ³ precisamente en el momento del rechazo. Durante dÃ©cadas, le escribiÃ³ miles de cartas que Ã©l nunca contestÃ³, hasta que un dÃ­a, ya ancianos, Bayardo regresÃ³ a ella con todas las cartas sin abrir, demostrando que el destino, aunque cruel, tambiÃ©n tiene formas extraÃ±as de cerrar sus ciclos. La crÃ³nica de la muerte de Santiago Nasar quedÃ³ grabada en la memoria colectiva no como un misterio por resolver, sino como la prueba de que, en ocasiones, todos somos cÃ³mplices de las tragedias que vemos venir y que nadie tiene la voluntad suficiente para detener.`
    },
    {
        session: 11,
        unit: 'Narrativa',
        topic: 'Narrativa del Terror: Edgar Allan Poe',
        videoTitle: 'El narrador y el conflicto',
        videoLink: '',
        readingTitle: 'El gato negro (Edgar Allan Poe)',
        readingContent: 'Ni espero ni solicito que crean el relato muy salvaje, y sin embargo muy hogareÃ±o, que voy a escribir. EstarÃ­a loco si lo esperase, en un caso donde mis propios sentidos rechazan su propio testimonio. No obstante, no estoy loco, y con toda seguridad no sueÃ±o. Pero maÃ±ana morirÃ©, y hoy quiero aliviar mi alma...',
        pages: 18,
        examDate: '2026-02-15'
    },
    {
        session: 12,
        unit: 'LÃ­rica',
        topic: 'Romanticismo: Gustavo Adolfo BÃ©cquer',
        videoTitle: 'El lenguaje figurado y los sÃ­mbolos',
        videoLink: '',
        readingTitle: 'Rimas y Leyendas (SelecciÃ³n)',
        readingContent: 'VolverÃ¡n las oscuras golondrinas/en tu balcÃ³n sus nidos a colgar,/y otra vez con el ala a sus cristales/jugando llamarÃ¡n./Pero aquellas que el vuelo refrenaron/tu hermosura y mi dicha a contemplar,/aquellas que aprendieron nuestros nombres.../Â¡esas... no volverÃ¡n!',
        pages: 25,
        examDate: '2026-03-01'
    },
    {
        session: 13,
        unit: 'ArgumentaciÃ³n',
        topic: 'Prensa y OpiniÃ³n: Cartas al Director',
        videoTitle: 'Veracidad y consistencia de la informaciÃ³n',
        videoLink: '',
        readingTitle: 'SelecciÃ³n de Columnas (Libertad y CiudadanÃ­a)',
        readingContent: 'SeÃ±or Director: La libertad de expresiÃ³n no es un cheque en blanco para la desinformaciÃ³n. En tiempos de crisis, la ciudadanÃ­a requiere certezas, no rumores esparcidos por redes sociales...',
        pages: 12,
        examDate: '2026-03-15'
    },
    {
        session: 14,
        unit: 'DramÃ¡tico',
        topic: 'Tragedia Griega: Edipo Rey',
        videoTitle: 'Fragmentos de tragedias griegas',
        videoLink: '',
        readingTitle: 'Edipo Rey (Fragmento)',
        readingContent: 'EDIPO: Â¡Oh hijos, descendencia nueva del antiguo Cadmo! Â¿Por quÃ© estÃ¡is en actitud suplicante ante mis altares, coronados con ramos de olivo? La ciudad estÃ¡ llena de incienso, y a la vez de peanes y de lamentos...',
        pages: 35,
        examDate: '2026-04-01'
    },
    {
        session: 15,
        unit: 'Medios',
        topic: 'Identidad Latinoamericana',
        videoTitle: 'Recursos audiovisuales y multimodales',
        videoLink: '',
        readingTitle: 'La identidad latinoamericana (Ensayo)',
        readingContent: 'Â¿Existe una sola identidad en AmÃ©rica Latina o somos un mosaico de culturas superpuestas? Desde la llegada de los barcos europeos hasta la globalizaciÃ³n digital, nuestra regiÃ³n ha sido un laboratorio de mestizaje...',
        pages: 20,
        examDate: '2026-04-15'
    },
    { session: 16, unit: 'Repaso', topic: 'Deep Review Semestral', videoTitle: 'Estrategias de Lectura PAES', videoLink: 'https://www.youtube.com/watch?v=D-r_y4b4BO8' },
    { session: 17, unit: 'Teatro', topic: 'Estructura DramÃ¡tica', videoTitle: 'Estructura interna obra dramÃ¡tica', videoLink: 'https://www.youtube.com/watch?v=Tn4XSVX5Ais' },
    { session: 18, unit: 'Teatro', topic: 'VisiÃ³n de Mundo (Tragedia)', videoTitle: 'GÃ©nero DramÃ¡tico: Tragedia', videoLink: 'https://www.youtube.com/watch?v=tXWk5TcEAAc' },
    { session: 19, unit: 'Teatro', topic: 'EvoluciÃ³n de Personajes', videoTitle: 'El lenguaje dramÃ¡tico', videoLink: 'https://www.youtube.com/watch?v=NhHbymnMAR0' },
    { session: 20, unit: 'Teatro', topic: 'CrÃ­tica de Obra', videoTitle: 'Puesta en Escena y Virtualidad', videoLink: 'https://www.youtube.com/watch?v=_PB3SSNzwCQ' },
    { session: 21, unit: 'Medios', topic: 'Hecho vs OpiniÃ³n', videoTitle: 'Diferencia Hecho y OpiniÃ³n', videoLink: 'https://www.youtube.com/watch?v=UsiqUeoyIaw' },
    { session: 22, unit: 'ArgumentaciÃ³n', topic: 'Estructura Argumentativa', videoTitle: 'Texto Argumentativo', videoLink: 'https://www.youtube.com/watch?v=5bZ42hoiYh8' },
    { session: 23, unit: 'ArgumentaciÃ³n', topic: 'Falacias Argumentativas I', videoTitle: 'Falacias LÃ³gicas', videoLink: 'https://www.youtube.com/watch?v=qY0e9dYp1kM' },
    { session: 24, unit: 'ArgumentaciÃ³n', topic: 'Falacias Argumentativas II', videoTitle: 'MÃ¡s Falacias', videoLink: 'https://www.youtube.com/watch?v=qY0e9dYp1kM' },
    { session: 25, unit: 'ArgumentaciÃ³n', topic: 'Debate: TÃ©cnicas y Estructura', videoTitle: 'El Debate', videoLink: 'https://www.youtube.com/watch?v=TxkM_8M_b2U' },
    { session: 26, unit: 'Medios', topic: 'Lectura CrÃ­tica de Prensa', videoTitle: 'GÃ©neros PeriodÃ­sticos', videoLink: 'https://www.youtube.com/watch?v=6rXJp1a0W2k' },
    { session: 27, unit: 'Medios', topic: 'Publicidad y Propaganda', videoTitle: 'Publicidad vs Propaganda', videoLink: 'https://www.youtube.com/watch?v=Xw8om9x1i1M' },
    { session: 28, unit: 'Medios', topic: 'Estereotipos en Medios', videoTitle: 'Estereotipos de GÃ©nero', videoLink: 'https://www.youtube.com/watch?v=3X9z1X1X1X1' },
    { session: 29, unit: 'Medios', topic: 'Fake News y DesinformaciÃ³n', videoTitle: 'CÃ³mo detectar Fake News', videoLink: 'https://www.youtube.com/watch?v=4X9z1X1X1X1' },
    { session: 30, unit: 'Escritura', topic: 'Ensayo: La Tesis', videoTitle: 'CÃ³mo escribir una Tesis', videoLink: 'https://www.youtube.com/watch?v=5X9z1X1X1X1' },
    { session: 31, unit: 'Escritura', topic: 'Ensayo: Argumentos', videoTitle: 'Tipos de Argumentos', videoLink: 'https://www.youtube.com/watch?v=6X9z1X1X1X1' },
    { session: 32, unit: 'EvaluaciÃ³n', topic: 'EvaluaciÃ³n ArgumentaciÃ³n', videoTitle: 'Repaso ArgumentaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=7X9z1X1X1X1' },
    { session: 33, unit: 'Literatura', topic: 'Boom Latinoamericano', videoTitle: 'El Boom Latinoamericano', videoLink: 'https://www.youtube.com/watch?v=8X9z1X1X1X1' },
    { session: 34, unit: 'Literatura', topic: 'Realismo MÃ¡gico', videoTitle: 'QuÃ© es el Realismo MÃ¡gico', videoLink: 'https://www.youtube.com/watch?v=9X9z1X1X1X1' },
    { session: 35, unit: 'Literatura', topic: 'Literatura DistÃ³pica', videoTitle: 'DistopÃ­as Literarias', videoLink: 'https://www.youtube.com/watch?v=0X9z1X1X1X1' },
    { session: 36, unit: 'Literatura', topic: 'Ciencia FicciÃ³n', videoTitle: 'Historia de la Ciencia FicciÃ³n', videoLink: 'https://www.youtube.com/watch?v=1X9z1X1X1X1' },
    { session: 37, unit: 'Literatura', topic: 'Cine y Literatura', videoTitle: 'Adaptaciones CinematogrÃ¡ficas', videoLink: 'https://www.youtube.com/watch?v=2X9z1X1X1X1' },
    { session: 38, unit: 'Literatura', topic: 'Intertextualidad Pop', videoTitle: 'Intertextualidad en los Simpson', videoLink: 'https://www.youtube.com/watch?v=3X9z1X1X1X1' },
    { session: 39, unit: 'PoesÃ­a', topic: 'PoesÃ­a Visual (Parra)', videoTitle: 'Nicanor Parra y AntipoesÃ­a', videoLink: 'https://www.youtube.com/watch?v=4X9z1X1X1X1' },
    { session: 40, unit: 'Medios', topic: 'Narrativa GrÃ¡fica', videoTitle: 'Lenguaje del CÃ³mic', videoLink: 'https://www.youtube.com/watch?v=5X9z1X1X1X1' },
    { session: 41, unit: 'Escritura', topic: 'Taller Microcuentos', videoTitle: 'CÃ³mo escribir Microcuentos', videoLink: 'https://www.youtube.com/watch?v=6X9z1X1X1X1' },
    { session: 42, unit: 'Oralidad', topic: 'Taller de Oratoria', videoTitle: 'TÃ©cnicas de Oratoria', videoLink: 'https://www.youtube.com/watch?v=7X9z1X1X1X1' },
    { session: 43, unit: 'PAES', topic: 'Estrategias Lectura PAES', videoTitle: 'Tips PAES Lectura', videoLink: 'https://www.youtube.com/watch?v=8X9z1X1X1X1' },
    { session: 44, unit: 'PAES', topic: 'Vocabulario Contextual', videoTitle: 'Ejercicios Vocabulario', videoLink: 'https://www.youtube.com/watch?v=9X9z1X1X1X1' },
    { session: 45, unit: 'PAES', topic: 'Ensayo Final Lectura', videoTitle: 'ResoluciÃ³n Ensayo PAES', videoLink: 'https://www.youtube.com/watch?v=0X9z1X1X1X1' },
    { session: 46, unit: 'Cierre', topic: 'Cierre AÃ±o Escolar', videoTitle: 'ReflexiÃ³n Final', videoLink: 'https://www.youtube.com/watch?v=1X9z1X1X1X1' }
];

// --- COMPONENTS ---

const clayCard = 'bg-white rounded-[32px] border-2 border-white/50 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.02)] transition-transform duration-500 hover:-translate-y-2';
const clayBtnPrimary = 'bg-[#4F46E5] text-white font-black rounded-2xl border-b-4 border-[#3730A3] hover:bg-[#4338CA] active:border-b-0 active:translate-y-1 transition-all duration-200 w-full py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_4px_10px_rgba(79,70,229,0.3)] hover:scale-105 hover:-translate-y-1 active:scale-95';
const clayBtnAction = 'bg-[#58CC02] text-white font-black rounded-2xl border-b-4 border-[#46A302] hover:bg-[#46A302] active:border-b-0 active:translate-y-1 transition-all duration-100 w-full py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-[inset_0_4px_4px_rgba(255,255,255,0.4),0_10px_20px_rgba(88,204,2,0.3)] hover:scale-[1.05] hover:-translate-y-1 active:scale-95';

const repairText = (value = '') => {
    if (value === null || value === undefined) return '';
    let text = String(value);

    try {
        if (/[ÃƒÃ‚]/.test(text)) {
            text = decodeURIComponent(escape(text));
        }
    } catch (error) {
        // Keep original text if decoding fails.
    }

    try {
        if (/[ÃƒÃ‚ï¿½]/.test(text) && typeof TextDecoder !== 'undefined') {
            const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);
            const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            if (decoded && decoded.replace(/\u0000/g, '').trim()) {
                text = decoded;
            }
        }
    } catch (error) {
        // Keep current text if second-pass decoding fails.
    }

    return text
        // Common mojibake fixes (UTF-8 interpreted as Latin-1)
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Á')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó')
        .replace(/Ãš/g, 'Ú')
        .replace(/Ã‘/g, 'Ñ')
        .replace(/Ã¼/g, 'ü')
        .replace(/Ãœ/g, 'Ü')
        .replace(/Â°/g, '°')
        .replace(/Â·/g, '·')
        .replace(/Â/g, '')
        // Double-encoded variants
        .replace(/ÃƒÂ¡/g, 'á')
        .replace(/ÃƒÂ©/g, 'é')
        .replace(/ÃƒÂ­/g, 'í')
        .replace(/ÃƒÂ³/g, 'ó')
        .replace(/ÃƒÂº/g, 'ú')
        .replace(/ÃƒÂ±/g, 'ñ')
        .replace(/Ãƒâ€˜/g, 'Ñ')
        .replace(/ÃƒÂ¼/g, 'ü')
        // Cleanup
        .replace(/ï¿½/g, '')
        .replace(/Ã³x[^\s]*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};
const clayInset = 'bg-[#F7F7F7] rounded-2xl border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]';

const MATH_SYLLABUS = [
    { session: 1, unit: 'NÃºmeros', topic: 'Racionales: Concepto y ConversiÃ³n', videoTitle: 'MatemÃ¡tica-Clase NÃ‚Â°1-Racionales', videoLink: 'https://www.youtube.com/watch?v=1-vOmO4Ss5Y' },
    { session: 2, unit: 'NÃºmeros', topic: 'Operatoria Combinada en Q', videoTitle: 'Operatoria combinada con racionales', videoLink: 'https://www.youtube.com/watch?v=vbh4lcMtpoI' },
    { session: 3, unit: 'NÃºmeros', topic: 'MultiplicaciÃ³n y DivisiÃ³n Q', videoTitle: 'Capsule-Rational Numbers', videoLink: 'https://www.youtube.com/watch?v=M6qOX1Xj_tY' },
    { session: 4, unit: 'NÃºmeros', topic: 'Potencias: DefiniciÃ³n', videoTitle: 'AyudantÃ­a PTU-Potencias', videoLink: 'https://www.youtube.com/watch?v=0BILyJ_NyDA' },
    { session: 5, unit: 'NÃºmeros', topic: 'Propiedades de Potencias', videoTitle: '#PruebadeInvierno MatemÃ¡tica-POTENCIAS', videoLink: 'https://www.youtube.com/watch?v=9VCg25rf7xg' },
    { session: 6, unit: 'NÃºmeros', topic: 'Exponente Cero y Negativo', videoTitle: 'Potencias y sus propiedades (Segmento)', videoLink: 'https://www.youtube.com/watch?v=Cdti7efBqVc' },
    { session: 7, unit: 'NÃºmeros', topic: 'Crecimiento Exponencial', videoTitle: 'MatemÃ¡tica-Potencias 1Ã‚Â° Medio', videoLink: 'https://www.youtube.com/watch?v=1RjOhQwPJB4' },
    { session: 8, unit: 'NÃºmeros', topic: 'RaÃ­ces EnÃ©simas', videoTitle: 'Prueba de TransiciÃ³n-RaÃ­ces', videoLink: 'https://www.youtube.com/watch?v=xMYFzXcFYns' },
    { session: 9, unit: 'NÃºmeros', topic: 'Operatoria con RaÃ­ces', videoTitle: 'Capsule-Roots', videoLink: 'https://www.youtube.com/watch?v=HwxfKSq0lh8' },
    { session: 10, unit: 'NÃºmeros', topic: 'Porcentajes', videoTitle: 'PAES M1-Porcentaje', videoLink: 'https://www.youtube.com/watch?v=YJ9l1Ew_rns' },
    { session: 11, unit: 'Ã­Ã‚Âlgebra', topic: 'Lenguaje Algebraico', videoTitle: 'EXPRESIONES ALGEBRAICAS Clase NÃ­ÃƒÂ¢Ã‚Â¬Ã³aÃƒâ€™Ã³Ã‚Âº3', videoLink: 'https://www.youtube.com/watch?v=lojCGXH4Odk' },
    { session: 12, unit: 'Ã­Ã‚Âlgebra', topic: 'Cuadrado de Binomio', videoTitle: 'Cuadrado de binomio', videoLink: 'https://www.youtube.com/watch?v=IjL5zOyxs20' },
    { session: 13, unit: 'Ã­Ã‚Âlgebra', topic: 'Suma por Diferencia', videoTitle: 'Suma por diferencia', videoLink: 'https://www.youtube.com/watch?v=-w_lg-r7pDg' },
    { session: 14, unit: 'Ã­Ã‚Âlgebra', topic: 'Binomio con TÃ©rmino ComÃºn', videoTitle: 'Clase 6: Ã­Ã‚Âlgebra y funciones', videoLink: 'https://www.youtube.com/watch?v=CvgRtkMJ7ao' },
    { session: 15, unit: 'Ã­Ã‚Âlgebra', topic: 'FactorizaciÃ³n: Factor ComÃºn', videoTitle: 'FactorizaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=JpYUEEqYxbU' },
    { session: 16, unit: 'Ã­Ã‚Âlgebra', topic: 'FactorizaciÃ³n de Trinomios', videoTitle: 'Mathematical Factorization Criteria', videoLink: 'https://www.youtube.com/watch?v=pKwJBMHSeAY' },
    { session: 17, unit: 'Ã­Ã‚Âlgebra', topic: 'Ecuaciones Lineales', videoTitle: 'PAES M1-Ecuaciones lineales', videoLink: 'https://www.youtube.com/watch?v=vnjowqDBGB8' },
    { session: 18, unit: 'Ã­Ã‚Âlgebra', topic: 'Sistemas Ecuaciones (Intro)', videoTitle: 'Sistemas de ecuaciones (Casos)', videoLink: 'https://www.youtube.com/watch?v=AFKpBTCc6oU' },
    { session: 19, unit: 'Ã­Ã‚Âlgebra', topic: 'MÃ©todo de SustituciÃ³n', videoTitle: 'Sistemas de ecuaciones-SustituciÃ³n', videoLink: 'https://www.youtube.com/watch?v=aBmuYyKeWaE' },
    { session: 20, unit: 'Ã­Ã‚Âlgebra', topic: 'MÃ©todo de ReducciÃ³n', videoTitle: 'INTENSIVO SISTEMAS DE ECUACIONES', videoLink: 'https://www.youtube.com/watch?v=J2dRZ2iM3sY' },
    { session: 21, unit: 'Ã­Ã‚Âlgebra', topic: 'MÃ©todo de IgualaciÃ³n', videoTitle: 'METODO DE IGUALACIÃ³N', videoLink: 'https://www.youtube.com/watch?v=tr78m4H9BIw' },
    { session: 22, unit: 'Ã­Ã‚Âlgebra', topic: 'Problemas de Planteo', videoTitle: 'PLANTEO DE PROBLEMAS', videoLink: 'https://www.youtube.com/watch?v=780RStmengs' },
    { session: 23, unit: 'Ã­Ã‚Âlgebra', topic: 'FunciÃ³n Lineal', videoTitle: 'FUNCIÃ³N LINEAL Y AFÃ­Ã‚ÂN', videoLink: 'https://www.youtube.com/watch?v=XC6VLf8pOVg' },
    { session: 24, unit: 'Ã­Ã‚Âlgebra', topic: 'FunciÃ³n AfÃ­n', videoTitle: 'FunciÃ³n lineal y afÃ­n (Parte 2)', videoLink: 'https://www.youtube.com/watch?v=TU0NMpLS88U' },
    { session: 25, unit: 'GeometrÃ­a', topic: 'Vectores', videoTitle: 'Vectores en el plano cartesiano', videoLink: 'https://www.youtube.com/watch?v=fjKr9TnAKYs' },
    { session: 26, unit: 'GeometrÃ­a', topic: 'Transformaciones IsomÃ©tricas', videoTitle: 'TRANSFORMACIONES ISOMÃ­Ã³ Ã³Ãƒâ€™Ã‚Â¢ÃƒÂ¢Ã³Ã‚Â¬Ã‚Â°TRICAS', videoLink: 'https://www.youtube.com/watch?v=_tIaG3tmVgI' },
    { session: 27, unit: 'GeometrÃ­a', topic: 'Homotecia: Concepto', videoTitle: 'Homotecia', videoLink: 'https://www.youtube.com/watch?v=_rJoKG8MLg8' },
    { session: 28, unit: 'GeometrÃ­a', topic: 'Homotecia: Propiedades', videoTitle: 'Homotecia de figuras planas', videoLink: 'https://www.youtube.com/watch?v=OTGPT5AG2ww' },
    { session: 29, unit: 'GeometrÃ­a', topic: 'Congruencia de TriÃ¡ngulos', videoTitle: 'Congruencia de triÃ¡ngulos', videoLink: 'https://www.youtube.com/watch?v=PX9FjNz7yR8' },
    { session: 30, unit: 'GeometrÃ­a', topic: 'Criterios de Congruencia', videoTitle: 'GuÃ­a de ejercicios Congruencia', videoLink: 'https://www.youtube.com/watch?v=uuQ31qlYNaQ' },
    { session: 31, unit: 'GeometrÃ­a', topic: 'Semejanza de TriÃ¡ngulos', videoTitle: 'Estudia para la PSU-Semejanza', videoLink: 'https://www.youtube.com/watch?v=S8RVnQG2q3I' },
    { session: 32, unit: 'GeometrÃ­a', topic: 'Teorema de Thales', videoTitle: 'TEOREMA DE THALES Clase NÃ‚Â°27', videoLink: 'https://www.youtube.com/watch?v=2ExAmja3378' },
    { session: 33, unit: 'GeometrÃ­a', topic: 'AplicaciÃ³n de Thales', videoTitle: 'Prueba de TransiciÃ³n-Teorema Thales', videoLink: 'https://www.youtube.com/watch?v=AhUyh4IZmHI' },
    { session: 34, unit: 'GeometrÃ­a', topic: 'EcuaciÃ³n de la Recta', videoTitle: 'EcuaciÃ³n de la recta', videoLink: 'https://www.youtube.com/watch?v=-_MUgcyh3Ig' },
    { session: 35, unit: 'Datos', topic: 'Tablas de Frecuencia', videoTitle: 'Tablas de Frecuencia-Clase NÃ‚Â°24', videoLink: 'https://www.youtube.com/watch?v=1EZyGLlUQGw' },
    { session: 36, unit: 'Datos', topic: 'Medidas Tendencia Central', videoTitle: 'Medidas tendencia central y rango', videoLink: 'https://www.youtube.com/watch?v=Vb5AzDzQcwo' },
    { session: 37, unit: 'Datos', topic: 'Medidas de PosiciÃ³n', videoTitle: 'Medidas de posiciÃ³n Clase NÃ‚Â°28', videoLink: 'https://www.youtube.com/watch?v=jCfQjycgwdM' },
    { session: 38, unit: 'Datos', topic: 'Diagrama de CajÃ³n', videoTitle: 'Diagrama de cajÃ³n y bigotes', videoLink: 'https://www.youtube.com/watch?v=GBNpyyApgdA' },
    { session: 39, unit: 'Datos', topic: 'Medidas de DispersiÃ³n', videoTitle: 'Medidas de dispersiÃ³n', videoLink: 'https://www.youtube.com/watch?v=uwHz-WYYVpQ' },
    { session: 40, unit: 'Datos', topic: 'Probabilidad (Laplace)', videoTitle: 'Regla de Laplace', videoLink: 'https://www.youtube.com/watch?v=bazKrpT91kY' },
    { session: 41, unit: 'Datos', topic: 'Regla Aditiva', videoTitle: 'Probabilidades (UniÃ³n)', videoLink: 'https://www.youtube.com/watch?v=zI6Aly68P0Q' },
    { session: 42, unit: 'Datos', topic: 'Regla Multiplicativa', videoTitle: 'Probabilidad condicional', videoLink: 'https://www.youtube.com/watch?v=ZyF6TtT6hwo' },
    { session: 43, unit: 'Datos', topic: 'TÃ©cnicas de Conteo', videoTitle: 'TÃ­Ã³ Ã³Ãƒâ€™Ã‚Â¢ÃƒÂ¢Ã³Ã‚Â¬Ã‚Â°CNICAS DE CONTEO', videoLink: 'https://www.youtube.com/watch?v=klUzWXgLBRM' },
    { session: 44, unit: 'Datos', topic: 'Probabilidad Condicional', videoTitle: 'Probabilidad Condicional Intro', videoLink: 'https://www.youtube.com/watch?v=ZyF6TtT6hwo' },
    { session: 45, unit: 'Datos', topic: 'Proyecto EstadÃ­stica', videoTitle: 'EstadÃ­stica en la Vida Real', videoLink: 'https://www.youtube.com/watch?v=GBNpyyApgdA' },
    { session: 46, unit: 'Cierre', topic: 'Gran DesafÃ­o Final', videoTitle: 'Ensayo General MatemÃ¡tica', videoLink: 'https://www.youtube.com/watch?v=1-vOmO4Ss5Y' }
];

// ---------------------------------------------------

const DEFAULT_DAILY_ROUTE = {
    sujeto: 'MatemÃ¡tica',
    oa_title: 'S1: Racionales: Concepto y ConversiÃ³n',
    color: '#4D96FF',
    icon: Brain,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video de la Clase', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. TeorÃ­a LÃºdica IA', action: 'start_route', icon: 'Brain', isComplete: false },
        { step: '3. Quiz de 45 Preguntas Kaizen', action: 'quiz', icon: 'Lock', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANÃƒÂLISIS HISTÃ³RICO"
};

const DEFAULT_LANG_ROUTE = {
    sujeto: 'Lenguaje',
    oa_title: 'S1: NivelaciÃ³n y DiagnÃ³stico',
    color: '#FF9F43',
    icon: BookOpen,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video AnÃ¡lisis', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. CrÃ­tica Literaria IA', action: 'start_route', icon: 'BookOpen', isComplete: false },
        { step: '3. RedacciÃ³n/Quiz', action: 'quiz', icon: 'Star', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANÃƒÂLISIS HISTÃ³RICO"
};


const CHEMISTRY_SYLLABUS = [
    // UNIDAD 1: REACCIONES (Sesiones 1-10)
    { session: 1, unit: 'Reacciones', topic: 'Transformaciones FÃ­sicas vs. QuÃ­micas', videoTitle: 'Cambios FÃ­sicos y QuÃ­micos', videoLink: 'https://www.youtube.com/watch?v=Zz0xuNCpAQc' },
    { session: 2, unit: 'Reacciones', topic: 'Evidencias EmpÃ­ricas de ReacciÃ³n', videoTitle: 'Reacciones cotidianas', videoLink: 'https://www.curriculumnacional.cl/docente/629/w3-article-34461.html' },
    { session: 3, unit: 'Reacciones', topic: 'TeorÃ­a de las Colisiones', videoTitle: 'TeorÃ­a de Colisiones', videoLink: 'https://www.youtube.com/watch?v=-RQIfEefAzg' },
    { session: 4, unit: 'Reacciones', topic: 'EnergÃ­a de ActivaciÃ³n', videoTitle: 'Perfil de EnergÃ­a', videoLink: 'https://www.youtube.com/watch?v=vkNZKYPfBss' },
    { session: 5, unit: 'Reacciones', topic: 'La EcuaciÃ³n QuÃ­mica', videoTitle: 'AnatomÃ­a de la EcuaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=G4kiAaLiigI' },
    { session: 6, unit: 'Reacciones', topic: 'SÃ­ntesis y DescomposiciÃ³n', videoTitle: 'Tipos de ReacciÃ³n I', videoLink: 'https://www.youtube.com/shorts/hsWclMOU6Hs' },
    { session: 7, unit: 'Reacciones', topic: 'SustituciÃ³n y Desplazamiento', videoTitle: 'Tipos de ReacciÃ³n II', videoLink: 'https://www.youtube.com/watch?v=Qz0ipe5qc8I' },
    { session: 8, unit: 'Reacciones', topic: 'NeutralizaciÃ³n Ãƒâ€™Ã‚Âcido-Base', videoTitle: 'NeutralizaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=mHJsc1tnAnk' },
    { session: 9, unit: 'Reacciones', topic: 'ExotÃ©rmicas y EndotÃ©rmicas', videoTitle: 'TermodinÃ¡mica BÃ¡sica', videoLink: 'https://www.youtube.com/watch?v=G7TFOnQoU8w' },
    { session: 10, unit: 'Reacciones', topic: 'Taller de ClasificaciÃ³n', videoTitle: 'Ejercicios Tipos de ReacciÃ³n', videoLink: 'https://www.youtube.com/watch?v=rTzSYDg2NU4' },

    // UNIDAD 2: LEYES Y BALANCEO (Sesiones 11-22)
    { session: 11, unit: 'Leyes Ponderales', topic: 'Ley de Lavoisier', videoTitle: 'ConservaciÃ³n de la Masa', videoLink: 'https://www.youtube.com/watch?v=kJpWo_KNH3s' },
    { session: 12, unit: 'Leyes Ponderales', topic: 'Ley de Proust', videoTitle: 'Proporciones Definidas', videoLink: 'https://www.youtube.com/watch?v=X3p48ApI0hg' },
    { session: 13, unit: 'Leyes Ponderales', topic: 'ResoluciÃ³n de Problemas', videoTitle: 'Ejercicios Leyes Ponderales', videoLink: 'https://www.youtube.com/watch?v=s0F71jI-Qq0' },
    { session: 14, unit: 'Balanceo', topic: 'Fundamentos del Balanceo', videoTitle: 'Intro al Balanceo', videoLink: 'https://www.youtube.com/watch?v=XfEZQ8ens80' },
    { session: 15, unit: 'Balanceo', topic: 'MÃ©todo de Tanteo', videoTitle: 'Balanceo por Tanteo', videoLink: 'https://www.youtube.com/watch?v=OQ4mjedkr0M' },
    { session: 16, unit: 'Balanceo', topic: 'PrÃ¡ctica Intensiva Tanteo', videoTitle: 'Ejercicios Tanteo', videoLink: 'https://www.youtube.com/watch?v=AteEPYCMGDE' },
    { session: 17, unit: 'Balanceo', topic: 'MÃ©todo Algebraico Intro', videoTitle: 'Intro Algebraico', videoLink: 'https://www.youtube.com/watch?v=VxgyhjojvGI' },
    { session: 18, unit: 'Balanceo', topic: 'Sistemas de Ecuaciones QuÃ­micas', videoTitle: 'ResoluciÃ³n Algebraica', videoLink: 'https://www.youtube.com/watch?v=ZYUMX1DO4tY' },
    { session: 19, unit: 'Balanceo', topic: 'Balanceo Complejo', videoTitle: 'Algebraico Avanzado', videoLink: 'https://www.youtube.com/watch?v=MCEc0e-bDt4' },
    { session: 20, unit: 'Nomenclatura', topic: 'Ã³xidos BÃ¡sicos y Ãƒâ€™Ã‚Âcidos', videoTitle: 'Nomenclatura Ã³xidos', videoLink: 'https://www.youtube.com/watch?v=pH9acFVTlM8' },
    { session: 21, unit: 'Nomenclatura', topic: 'Hidruros y Sales Binarias', videoTitle: 'Binarios', videoLink: 'https://www.youtube.com/watch?v=OUvUaQE8G8Q' },
    { session: 22, unit: 'Nomenclatura', topic: 'Compuestos Ternarios', videoTitle: 'HidrÃ³xidos y OxÃ¡cidos', videoLink: 'https://www.youtube.com/watch?v=-L-g5vR1gV0' },

    // UNIDAD 3: EL MOL (Sesiones 23-34)
    { session: 23, unit: 'EstequiometrÃ­a', topic: 'Concepto de Mol', videoTitle: 'Â¿QuÃ© es un Mol?', videoLink: 'https://www.youtube.com/watch?v=zzUBFrHYNu4' },
    { session: 24, unit: 'EstequiometrÃ­a', topic: 'NÃºmero de Avogadro', videoTitle: 'Dimensionando el Mol', videoLink: 'https://www.youtube.com/watch?v=Ds8cSbdXghs' },
    { session: 25, unit: 'EstequiometrÃ­a', topic: 'Masa AtÃ³mica', videoTitle: 'Tabla PeriÃ³dica y Masa', videoLink: 'https://www.youtube.com/watch?v=A8qq0U9LkTE' },
    { session: 26, unit: 'EstequiometrÃ­a', topic: 'Masa Molar Compuestos', videoTitle: 'CÃ¡lculo Masa Molar', videoLink: 'https://www.youtube.com/watch?v=kBXSRIm8uBc' },
    { session: 27, unit: 'EstequiometrÃ­a', topic: 'ConversiÃ³n Gramos a Moles', videoTitle: 'Conversiones BÃ¡sicas', videoLink: 'https://www.youtube.com/watch?v=TwRQUj8cEBw' },
    { session: 28, unit: 'EstequiometrÃ­a', topic: 'ConversiÃ³n Masa-Mol-Ãƒâ€™Ã‚Âtomos', videoTitle: 'Conversiones Avanzadas', videoLink: 'https://www.youtube.com/watch?v=7bxHKDtW5tQ' },
    { session: 29, unit: 'EstequiometrÃ­a', topic: 'Compuestos Hidratados', videoTitle: 'Masa Molar Compleja', videoLink: 'https://www.youtube.com/watch?v=3pamhajW65s' },
    { session: 30, unit: 'EstequiometrÃ­a', topic: 'ComposiciÃ³n Porcentual', videoTitle: 'Porcentaje en Masa', videoLink: 'https://www.youtube.com/watch?v=ni4KlRkBoVg' },
    { session: 31, unit: 'EstequiometrÃ­a', topic: 'FÃ³rmula EmpÃ­rica y Molecular', videoTitle: 'DeducciÃ³n de FÃ³rmulas', videoLink: 'https://www.youtube.com/watch?v=MnafInl0GQw' },
    { session: 32, unit: 'EstequiometrÃ­a', topic: 'Relaciones Molares', videoTitle: 'EstequiometrÃ­a Mol-Mol', videoLink: 'https://www.youtube.com/watch?v=lx_Rahu3sVw' },
    { session: 33, unit: 'EstequiometrÃ­a', topic: 'CÃ¡lculo Masa-Masa', videoTitle: 'EstequiometrÃ­a Masa-Masa', videoLink: 'https://www.youtube.com/watch?v=oAG6uyyVKEg' },
    { session: 34, unit: 'EstequiometrÃ­a', topic: 'Taller EstequiometrÃ­a', videoTitle: 'Ejercicios Mixtos', videoLink: 'https://www.youtube.com/watch?v=oAG6uyyVKEg' },

    // UNIDAD 4: SOLUCIONES Y CINÃƒâ€™Ã³0TICA (Sesiones 35-46)
    { session: 35, unit: 'EstequiometrÃ­a Real', topic: 'Reactivo Limitante Concepto', videoTitle: 'Intro Reactivo Limitante', videoLink: 'https://www.youtube.com/watch?v=_rts32wOiv0' },
    { session: 36, unit: 'EstequiometrÃ­a Real', topic: 'CÃ¡lculo Reactivo Limitante', videoTitle: 'CÃ¡lculo RL', videoLink: 'https://www.youtube.com/watch?v=bOrVhbELagw' },
    { session: 37, unit: 'EstequiometrÃ­a Real', topic: 'Rendimiento de ReacciÃ³n', videoTitle: 'Porcentaje de Rendimiento', videoLink: 'https://www.youtube.com/watch?v=iAATyWldpqs' },
    { session: 38, unit: 'EstequiometrÃ­a Real', topic: 'Pureza de Reactivos', videoTitle: 'Ejercicios con Pureza', videoLink: 'https://www.youtube.com/watch?v=urHXCP2gUf8' },
    { session: 39, unit: 'Soluciones', topic: 'IntroducciÃ³n Soluciones', videoTitle: 'Soluto y Solvente', videoLink: 'https://www.youtube.com/watch?v=stzzdORx1vM' },
    { session: 40, unit: 'Soluciones', topic: 'Unidades FÃ­sicas', videoTitle: 'ConcentraciÃ³n %', videoLink: 'https://www.youtube.com/watch?v=stzzdORx1vM' },
    { session: 41, unit: 'Soluciones', topic: 'Molaridad', videoTitle: 'ConcentraciÃ³n Molar', videoLink: 'https://www.youtube.com/watch?v=LDs8dhIIr-g' },
    { session: 42, unit: 'CinÃ©tica', topic: 'Factores de Velocidad I', videoTitle: 'Temp y Superficie', videoLink: 'https://www.youtube.com/watch?v=HROvz_OQnx8' },
    { session: 43, unit: 'CinÃ©tica', topic: 'Factores de Velocidad II', videoTitle: 'Catalizadores', videoLink: 'https://www.youtube.com/watch?v=vJ7bk49kA9g' },
    { session: 44, unit: 'CinÃ©tica', topic: 'Exp. Virtual CinÃ©tica', videoTitle: 'Laboratorio Virtual', videoLink: 'https://www.youtube.com/watch?v=TuA_8006jCM' },
    { session: 45, unit: 'IntegraciÃ³n', topic: 'Lluvia Ãƒâ€™Ã‚Âcida', videoTitle: 'QuÃ­mica Ambiental', videoLink: 'https://www.youtube.com/watch?v=YsEqU2TuvaI' },
    { session: 46, unit: 'Cierre', topic: 'SÃ­ntesis Final', videoTitle: 'Resumen PAES', videoLink: 'https://www.youtube.com/watch?v=Zz0xuNCpAQc' }
];

const DEFAULT_CHEM_ROUTE = {
    sujeto: 'QuÃ­mica',
    oa_title: 'S1: Transformaciones FÃ­sicas vs. QuÃ­micas',
    color: '#E84393',
    icon: FlaskConical,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video AnÃ¡lisis', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. Laboratorio Virtual', action: 'start_route', icon: 'FlaskConical', isComplete: false },
        { step: '3. Quiz de Reacciones', action: 'quiz', icon: 'Atom', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANÃƒÂLISIS HISTÃ³RICO"
};


const VideoModal = ({ isOpen, onClose, videoUrl, title, onDoubt, onFinish }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    if (!isOpen || !videoUrl) return null;

    const getVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = getVideoId(videoUrl);

    // NEW: Automatic Screen Capture for Doubt
    // NEW: Automatic Screen Capture for Doubt
    const handleDoubt = async () => {
        try {
            // 1. Request Screen Share (User must select tab)
            // We use 'selfBrowserSurface: "include"' to ensure the current tab is listed
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false,
                selfBrowserSurface: "include", // Standard
                preferCurrentTab: true         // Chrome/Non-standard hint
            });

            // WAIT for the modal/picker to fully close (Animation delay)
            await new Promise(resolve => setTimeout(resolve, 800));

            // 2. Capture a single frame (Video is still playing -> Clean shot)
            const videoTrack = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(videoTrack);
            const bitmap = await imageCapture.grabFrame();

            // 3. Stop sharing immediately
            videoTrack.stop();

            // 4. Auto-Pause Video NOW (After capture)
            const iframe = document.getElementById('youtube-player');
            if (iframe) {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            }

            // 4. Convert to Base64
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
            const base64Image = canvas.toDataURL('image/png');

            // 5. Open Doubt Modal with Image
            onDoubt({
                type: 'video',
                title: title,
                url: videoUrl,
                timestamp: "captured",
                image: base64Image
            });

        } catch (err) {
            console.warn("Screen capture cancelled or failed:", err);
            // Fallback: Open without image
            onDoubt({
                type: 'video',
                title: title,
                url: videoUrl,
                timestamp: "unknown",
                image: null
            });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-[#2B2E4A]/90 backdrop-blur-md p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className={`${clayCard} w-full max-w-6xl bg-black p-4 relative flex flex-row gap-6 shadow-2xl max-h-[90vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-white font-bold text-lg truncate flex-1">{title}</h3>
                        <button onClick={() => setIsMaximized(!isMaximized)} className="text-white/60 hover:text-[#FFD93D] transition-colors mr-4">
                            {isMaximized ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                        </button>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                            <X className="w-8 h-8" />
                        </button>
                    </div>
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black relative mb-6 border border-white/10 shadow-inner flex-shrink-0">
                        {videoId ? (
                            <iframe
                                id="youtube-player"
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`}
                                title={title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            ></iframe >
                        ) : (
                            <div className="flex items-center justify-center h-full text-white">Error cargando el video</div>
                        )}
                    </div >

                    {/* FLOATING ACTION BUTTON FOR CAPTURE */}
                </div>

                {/* SIDEBAR BUTTONS (DESKTOP)/BOTTOM (MOBILE) */}
                <div className="flex flex-col justify-center gap-3 w-40 md:w-48 shrink-0">
                    <button
                        onClick={async () => {
                            if (onFinish) {
                                setIsLoading(true);
                                try {
                                    await onFinish();
                                } catch (e) {
                                    console.error(e);
                                }
                                setIsLoading(false);
                            }
                            onClose();
                        }}
                        disabled={isLoading}
                        className={`${isLoading ? 'bg-gray-400 border-gray-500' : 'bg-[#6BCB77]'} text-[#2B2E4A] font-black rounded-xl shadow-[0_4px_0_#4dad5b] active:shadow-none active:translate-y-[4px] transition-all py-3 px-6 flex items-center justify-center gap-2 uppercase tracking-widest text-xs hover:bg-[#7ce089]`}
                    >
                        {isLoading ? '? Guardando...' : '? Terminar Video'}
                    </button>

                    <button
                        onClick={handleDoubt}
                        className="bg-[#2B2E4A] text-[#FFD93D] font-bold rounded-2xl border-2 border-[#FFD93D] shadow-[0_8px_16px_rgba(0,0,0,0.3)] active:scale-95 transition-all p-4 flex items-center justify-center gap-2 hover:bg-[#34385a] animate-bounce-subtle"
                        title="Capturar Pantalla y Preguntar"
                    >
                        <ImageIcon className="w-6 h-6" />
                        <span className="uppercase tracking-wider text-xs font-black">Capturar y Hacer Pregunta</span>
                    </button>
                    <p className="text-white/40 text-[10px] text-center uppercase font-bold tracking-widest">
                        No cubre el video
                    </p>
                </div>
            </div>
        </div>
    );
};

// COMPONENT: Reading Modal
const ReadingModal = ({ isOpen, onClose, title, content, onFinish, buttonText = "Terminar y Analizar" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#2B2E4A]/95 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`${clayCard} w-full max-w-3xl bg-[#FDFBF7] relative flex flex-col shadow-2xl max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-[#2B2E4A]/10 bg-white rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Modo Lectura</p>
                            <h3 className="font-serif text-2xl font-bold text-[#2B2E4A]">{title}</h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#9094A6] hover:text-[#2B2E4A] transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 font-serif text-lg leading-relaxed text-[#2B2E4A]/90 whitespace-pre-wrap">
                    <MathRenderer text={content} />
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#2B2E4A]/10 rounded-b-3xl flex justify-end">
                    <button
                        onClick={onFinish}
                        className="bg-[#2B2E4A] text-white font-bold rounded-xl py-3 px-8 shadow-lg hover:bg-[#34385a] transition-all flex items-center gap-2"
                    >
                        <span>{buttonText}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// COMPONENT: Question Modal with Paste Support
const QuestionModal = ({ isOpen, onClose, onSubmit, isCallingN8N, initialContext }) => {
    const [question, setQuestion] = useState("");
    const [pastedImage, setPastedImage] = useState(null);
    const [timestamp, setTimestamp] = useState("");

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            // Check if we have an auto-captured image
            if (initialContext?.image) {
                setPastedImage(initialContext.image);
                setQuestion("ExplÃ­came paso a paso este ejercicio que aparece en el video.");
                setTimestamp(initialContext.timestamp === 'captured' ? "Detectado (Captura)" : "");
            } else {
                setQuestion("");
                setPastedImage(null);
                setTimestamp("");
            }
        }
    }, [isOpen, initialContext]);

    // Pre-fill context if available
    const contextType = initialContext?.type;
    const isVideoContext = contextType === 'video';

    if (!isOpen) return null;

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    setPastedImage(event.target.result);
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (question.trim() || pastedImage) {
            onSubmit(question, pastedImage, timestamp, initialContext);
            setQuestion("");
            setPastedImage(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#2B2E4A]/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`${clayCard} w-full max-w-lg bg-[#E0E5EC] relative animate-scale-up max-h-[90vh] overflow-y-auto`}>
                <button onClick={onClose} className="absolute top-4 right-4 text-[#9094A6] hover:text-[#2B2E4A] z-10">
                    <X className="w-6 h-6" />
                </button>

                <h3 className="font-black text-[#2B2E4A] text-xl mb-2 flex items-center gap-2">
                    <HelpCircle className="w-6 h-6 text-[#FF9F43]" />
                    Â¿Tienes alguna duda?
                </h3>

                {isVideoContext && (
                    <div className="mb-4 p-3 bg-[#2B2E4A]/5 rounded-xl border border-[#2B2E4A]/10 text-xs text-[#9094A6]">
                        <p className="font-bold mb-1 flex items-center gap-1 uppercase tracking-wide">
                            <Play className="w-3 h-3" /> Contexto: Video
                        </p>
                        <p className="italic text-[#2B2E4A] mb-2">{initialContext.title}</p>

                        <div className="flex items-center gap-2 bg-white/50 p-2 rounded-lg">
                            <Clock className="w-4 h-4 text-[#4D96FF]" />
                            <span className="font-bold text-[#2B2E4A]">Minuto:</span>
                            <input
                                type="text"
                                placeholder="Ej: 5:32"
                                className="bg-transparent border-b border-[#4D96FF] w-20 focus:outline-none text-[#2B2E4A] font-bold"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <p className="text-[#9094A6] text-sm mb-4 font-bold">
                    {isVideoContext
                        ? "Pega un pantallazo (Ctrl+V) del video y describe tu duda."
                        : "PregÃºntale a Matico sobre cualquier concepto."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onPaste={handlePaste}
                            className={`${clayInset} w-full h-32 p-4 text-[#2B2E4A] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[#4D96FF]/50`}
                            placeholder={isVideoContext ? "Describe el ejercicio o pega una imagen..." : "Ej: Â¿Por quÃ© todo nÃºmero elevado a 0 es 1?"}
                            disabled={isCallingN8N}
                        />
                    </div>

                    {/* IMAGE PREVIEW/CONFIRMATION */}
                    {pastedImage && (
                        <div className="relative group rounded-xl overflow-hidden border-2 border-[#4D96FF] shadow-lg animate-fade-in mb-4">
                            <img src={pastedImage} alt="Analysis Target" className="w-full h-auto max-h-60 object-contain bg-black" />
                            <button
                                type="button"
                                onClick={() => setPastedImage(null)}
                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 z-10"
                                title="Eliminar imagen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white text-xs font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                Imagen lista para analizar
                            </div>
                        </div>
                    )}

                    {/* HINT IF NO IMAGE */}
                    {!pastedImage && isVideoContext && (
                        <div className="text-xs text-[#9094A6] italic text-center border mr-2 ml-2 border-dashed border-gray-400 rounded-lg p-2">
                            Tip: Presiona <span className="font-bold bg-gray-200 px-1 rounded">ImpPnt</span> y luego <span className="font-bold bg-gray-200 px-1 rounded">Ctrl + V</span> aqui.
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`${clayBtnAction} w-full`}
                        disabled={isCallingN8N || (!question.trim() && !pastedImage)}
                    >
                        {isCallingN8N ? 'Pensando...' : (pastedImage ? 'Confirmar y analizar imagen' : 'Preguntar a Matico')}
                    </button>
                </form>
            </div >
        </div >
    );
};

const formatDurationMs = (ms = 0) => {
    if (!Number.isFinite(ms)) return '0 ms';
    if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
    return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`;
};

// NEW: CUSTOM LOADING OVERLAY
const LoadingOverlay = ({ isOpen, message, diagnostics }) => {
    const [liveNow, setLiveNow] = useState(Date.now());

    useEffect(() => {
        if (!isOpen || !diagnostics?.startedAt || diagnostics?.finishedAt) return undefined;
        setLiveNow(Date.now());
        const intervalId = setInterval(() => setLiveNow(Date.now()), 200);
        return () => clearInterval(intervalId);
    }, [isOpen, diagnostics?.startedAt, diagnostics?.finishedAt]);

    if (!isOpen) return null;

    const totalMs = diagnostics?.finishedAt
        ? diagnostics.totalMs || 0
        : diagnostics?.startedAt
            ? liveNow - diagnostics.startedAt
            : 0;

    const clientSteps = Array.isArray(diagnostics?.steps) ? diagnostics.steps : [];
    const serverSteps = Array.isArray(diagnostics?.serverTimings?.steps) ? diagnostics.serverTimings.steps : [];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2B2E4A]/60 backdrop-blur-md animate-fade-in">
            <div className={`${clayCard} !bg-[#FFC300] flex flex-col items-center p-8 animate-bounce max-w-xl w-[92vw]`}>
                <Brain className="w-16 h-16 text-[#2B2E4A] animate-spin mb-4" />
                <h2 className="text-2xl font-black text-[#2B2E4A] text-center uppercase tracking-widest whitespace-pre-line">
                    {message || "ESPERA...\nESTOY PENSANDO"}
                </h2>
                {diagnostics ? (
                    <div className="w-full mt-5 rounded-3xl bg-white/65 border-4 border-[#2B2E4A] px-4 py-3 text-[#2B2E4A]">
                        <div className="flex items-center justify-between gap-3 text-sm font-black uppercase tracking-wide">
                            <span>Tiempo total</span>
                            <span>{formatDurationMs(totalMs)}</span>
                        </div>
                        {diagnostics.currentStep ? (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#5B4A00]">
                                Paso actual: {diagnostics.currentStep}
                            </p>
                        ) : null}

                        {clientSteps.length > 0 ? (
                            <div className="mt-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5B4A00]">App</p>
                                <div className="mt-2 space-y-2">
                                    {clientSteps.map((step, index) => (
                                        <div key={`${step.label}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-semibold">
                                                {step.status === 'running' ? 'â€¢ ' : ''}
                                                {step.label}
                                            </span>
                                            <span className="font-black whitespace-nowrap">
                                                {step.durationMs != null ? formatDurationMs(step.durationMs) : '...'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {serverSteps.length > 0 ? (
                            <div className="mt-4">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5B4A00]">Servidor / IA</p>
                                <div className="mt-2 space-y-2">
                                    {serverSteps.map((step, index) => (
                                        <div key={`${step.step}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                                            <span className="font-semibold">{step.step}</span>
                                            <span className="font-black whitespace-nowrap">
                                                {formatDurationMs(step.delta_ms || 0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div >
    );
};

const MaticoAvatar = ({ mood = 'happy', size = 'md', isThinking = false, onClick }) => {
    const sizeClass = size === 'lg' ? 'w-40 h-40' : size === 'sm' ? 'w-16 h-16' : 'w-28 h-28';
    const earSize = size === 'sm' ? 'w-5 h-7' : 'w-10 h-14';
    const eyeSize = size === 'sm' ? 'w-2 h-2.5' : 'w-5 h-6';
    const noseSize = size === 'sm' ? 'w-3 h-2' : 'w-6 h-4';
    const muzzleSize = size === 'sm' ? 'w-8 h-5' : 'w-16 h-10';

    return (
        <div onClick={onClick} className={`${sizeClass} relative flex items-center justify-center group transition-transform duration-300 hover:scale-110 hover:rotate-6 cursor-pointer`}>
            {/* REMOVED THINKING BUBBLE HERE AS IT IS REPLACED BY OVERLAY */}
            <div className="absolute bottom-1 -right-2 w-4 h-6 bg-[#FFD93D] rounded-full origin-bottom rotate-[30deg] animate-pulse shadow-sm -z-10"></div>
            <div className={`absolute top-0 -left-2 ${earSize} bg-[#FFD93D] rounded-b-[30px] rounded-t-[10px] rotate-[-10deg] shadow-[inset_-2px_-2px_6px_#C7A005,2px_4px_6px_rgba(0,0,0,0.1)] origin-top z-20`}></div>
            <div className={`absolute top-0 -right-2 ${earSize} bg-[#FFD93D] rounded-b-[30px] rounded-t-[10px] rotate-[10deg] shadow-[inset_2px_-2px_6px_#C7A005,-2px_4px_6px_rgba(0,0,0,0.1)] origin-top z-20`}></div>
            <div className="absolute inset-[5%] bg-[#FFD93D] rounded-[45%] shadow-[inset_-4px_-4px_12px_#C7A005,inset_4px_4px_12px_#FFE88A,8px_8px_16px_#a3b1c6,-8px_-8px_16px_#ffffff] z-10"></div>
            <div className="absolute top-[15%] left-[25%] w-[25%] h-[12%] bg-white/60 rounded-full rotate-[-25deg] blur-[1px] z-30"></div>
            <div className="relative w-full h-full flex flex-col items-center justify-center z-30 translate-y-2">
                <div className="flex gap-6 w-full justify-center mb-2">
                    <div className={`${eyeSize} bg-[#2B2E4A] rounded-full relative`}>
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                        {mood === 'thinking' || isThinking ? <div className="absolute -top-2 -left-1 w-[120%] h-1 bg-[#2B2E4A] rounded-full rotate-[-15deg]"></div> : null}
                    </div>
                    <div className={`${eyeSize} bg-[#2B2E4A] rounded-full relative`}>
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                        {mood === 'thinking' || isThinking ? <div className="absolute -top-2 -left-0 w-[120%] h-1 bg-[#2B2E4A] rounded-full rotate-[15deg]"></div> : null}
                    </div>
                </div>
                <div className={`${muzzleSize} bg-[#FFE88A] rounded-[40%] flex flex-col items-center justify-start pt-1 shadow-sm relative`}>
                    <div className={`${noseSize} bg-[#2B2E4A] rounded-t-[40%] rounded-b-[50%] relative z-10`}>
                        <div className="absolute top-[20%] left-[25%] w-[30%] h-[25%] bg-white/30 rounded-full"></div>
                    </div>
                    {mood === 'happy' && !isThinking && <div className="w-6 h-3 border-b-4 border-[#2B2E4A] rounded-full -mt-1"></div>}
                    {mood === 'excited' && !isThinking && (
                        <div className="flex flex-col items-center -mt-1 relative">
                            <div className="w-6 h-3 bg-[#2B2E4A] rounded-b-full"></div>
                            <div className="absolute top-2 w-3 h-4 bg-[#FF6B6B] rounded-b-full border-t border-[#FF6B6B] shadow-sm animate-bounce"></div>
                        </div>
                    )}
                    {(mood === 'thinking' || isThinking) && <div className="w-2 h-2 bg-[#2B2E4A] rounded-full mt-1"></div>}
                    {mood === 'sad' && !isThinking && <div className="w-6 h-3 border-t-4 border-[#2B2E4A] rounded-full mt-2"></div>}
                </div>
            </div>
        </div>
    );
};

const AnnualRaceBar = ({ currentDay, totalDays }) => {
    const percentage = (currentDay / totalDays) * 100;
    return (
        <div className={`${clayCard} py-4 px-6 relative overflow-visible mt-6 mb-2 animate-fade-in-up`}>
            <div className="flex justify-between items-end mb-2">
                <h3 className="font-black text-[#2B2E4A] uppercase text-xs tracking-widest flex items-center gap-2">
                    <Flag className="w-4 h-4 text-[#FF6B6B] animate-wiggle" /> La Gran Carrera (Meta {totalDays} DÃ­as)
                </h3>
                <div className="text-right">
                    <span className="font-black text-2xl text-[#4D96FF]">{currentDay}</span>
                    <span className="font-bold text-[#9094A6] text-xs">/ {totalDays} DÃ­as</span>
                </div>
            </div>
            <div className="relative h-4 w-full bg-[#E0E5EC] rounded-full shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff]">
                <div className="absolute top-0 left-0 h-full rounded-full bg-[#4D96FF]" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const PomodoroTimer = () => {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) interval = setInterval(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    return (
        <div className={`${clayCard} flex flex-col items-center`}>
            <div className="flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-[#4D96FF] animate-pulse" /><span className="font-black text-[#2B2E4A] text-xs">TIMER</span></div>
            <div className="text-5xl font-black text-[#2B2E4A] mb-8">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
            <button onClick={() => setIsActive(!isActive)} className={isActive ? clayBtnAction : "!bg-[#2B2E4A] !border-[#1E293B] " + clayBtnPrimary}>{isActive ? 'PAUSAR' : 'INICIAR'}</button>
        </div>
    );
};


// HELPER FOR ROBUST N8N JSON PARSING
const parseN8NResponse = (textResponse) => {
    if (!textResponse || typeof textResponse !== 'string') return {};

    const cleanJsonString = (str) => {
        if (!str || typeof str !== 'string') return str;

        // 1. Contextual LaTeX fixes & Robust Escape Management
        // We protect double-backslashes and valid JSON escapes like \" or \/
        // but we double-escape collisions with LaTeX like \f, \t, \n, \r, \b
        // and any invalid single backslashes like \d.
        return str.replace(/(\\\\)|(\\["/])|(\\u[0-9a-fA-F]{4})|(\\[bfnrt])|(\\)/g, (match, dbl, validStr, uni, collidable, single) => {
            if (dbl) return dbl; // Keep \\ (already escaped)
            if (validStr) return validStr; // Keep \" and \/
            if (uni) return uni; // Keep \uXXXX
            if (collidable) return '\\' + collidable; // Turn \f into \\f, \n into \\n, etc.
            if (single) return '\\\\'; // Turn \s into \\s
            return match;
        })
            .replace(/[\0-\x08\x0B\x0C\x0E-\x1F]+/g, '') // Stop control char injection while preserving \t, \n and \r
            .trim();
    };

    const attemptParse = (str) => {
        if (!str) return null;
        try {
            return JSON.parse(str);
        } catch (e1) {
            try {
                return JSON.parse(cleanJsonString(str));
            } catch (e2) {
                // If it looks like a JSON block trapped in text
                const match = str.match(/({[\s\S]*})|(\[[\s\S]*\])/);
                if (match) {
                    try {
                        return JSON.parse(cleanJsonString(match[0]));
                    } catch (e3) { return null; }
                }
                return null;
            }
        }
    };

    const unbox = (data, depth = 0) => {
        if (!data || depth > 6) return data;

        // CASE 1: ARRAY
        if (Array.isArray(data)) {
            if (data.length === 0) return {};
            // Prefer items that look like they contain questions
            const bestItem = data.find(i => i && (i.questions || i.question || i.output)) || data[0];
            return unbox(bestItem, depth + 1);
        }

        // CASE 2: STRING (Potential nested JSON string)
        if (typeof data === 'string') {
            const trimmed = data.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = attemptParse(trimmed);
                if (parsed) return unbox(parsed, depth + 1);
            }
            return data;
        }

        // CASE 3: OBJECT
        if (typeof data === 'object') {
            // First check if this object IS already what we want
            if (Array.isArray(data.questions)) return data;

            // Otherwise look inside priority keys
            const priorityKeys = ['questions', 'output', 'json', 'text', 'raw_output', 'content', 'theory', 'data'];
            for (const key of priorityKeys) {
                if (data[key] !== undefined && data[key] !== null) {
                    const unboxed = unbox(data[key], depth + 1);
                    if (unboxed && (unboxed.questions || unboxed.question || Array.isArray(unboxed))) return unboxed;
                }
            }
            return data;
        }
        return data;
    };

    try {
        const initialData = attemptParse(textResponse);
        if (!initialData) return { error: true, raw: textResponse };

        const result = unbox(initialData);
        // If unbox found an object/array, return it. If it's still a string, wrap it.
        if (typeof result === 'string') return { output: result };
        return result || {};
    } catch (e) {
        console.warn("[PARSER] Error final:", e);
        return { error: true, raw: textResponse };
    }
};

const AIContentModal = ({ isOpen, onClose, content, subject, callAgent, isCallingN8N, routeTitle, apiJson, quizStats, updateQuizStats, userQuery, onAskDoubt, quizLevel, setQuizLevel, quizQuestionNumber, setQuizQuestionNumber, onStartQuiz }) => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const scrollRef = useRef(null); // REF FOR SCROLLING

    // RESET STATE AND SCROLL ON CONTENT CHANGE
    useEffect(() => {
        if (isOpen) {
            setSelectedOption(null);
            setShowExplanation(false);
            setIsCorrect(null);
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        }
    }, [isOpen, content, apiJson]);

    if (!isOpen) return null;

    const safeRouteTitle = repairText(routeTitle);
    const isQuiz = (content || '').includes('QUIZ DE VALIDACION');
    const isReview = (content || '').includes('Modulo de Refuerzo');
    const isActiveQuiz = apiJson && apiJson.question;
    // NEW: DETECT VIDEO CONTEXT FROM QUERY
    const isVideoContext = userQuery && userQuery.includes('[Context: Video');
    const isTheory = !isQuiz && !isReview && !isActiveQuiz && !isVideoContext;

    let actionText = 'CERRAR';
    let actionColor = clayBtnAction;
    let actionHandler = onClose;

    if (isVideoContext) {
        actionText = 'VOLVER AL VIDEO';
        actionColor = clayBtnPrimary;
        actionHandler = onClose;
    } else if (isTheory) {
        actionText = 'INICIAR QUIZ COMPLETO';
        actionColor = 'bg-[#4D96FF] text-white shadow-[6px_6px_12px_#2a6bc7,-6px_-6px_12px_#70b9ff] hover:bg-[#3f80d6]';
        actionHandler = onStartQuiz ? onStartQuiz : () => callAgent(subject, 'generate_quiz', routeTitle);
    } else if (isActiveQuiz) {
        actionText = 'SIGUIENTE PREGUNTA ? ';
        actionColor = clayBtnAction;
        actionHandler = () => {
            callAgent(subject, 'deepen_knowledge', `${safeRouteTitle}-Continuacion`);
        };
    } else if (isQuiz) {
        actionText = 'COMENZAR QUIZ';
        actionColor = 'bg-[#4D96FF] text-white shadow-[6px_6px_12px_#2a6bc7,-6px_-6px_12px_#70b9ff] hover:bg-[#3f80d6]';
        actionHandler = onStartQuiz ? onStartQuiz : () => callAgent(subject, 'generate_quiz', routeTitle);
    }

    const contentTitle = isTheory ? `Teoria Ludica por Matico (${safeRouteTitle}):` : (isActiveQuiz ? 'Quiz en Progreso' : (isQuiz ? 'Quiz Generado' : 'Plan de Refuerzo:'));

    const handleOptionClick = (index) => {
        if (showExplanation) return;
        setSelectedOption(index);
        setShowExplanation(true);
        let correct = false;
        if (apiJson && (index === apiJson.correctIndex)) {
            setIsCorrect(true);
            correct = true;
        } else {
            setIsCorrect(false);
            correct = false;
        }
        updateQuizStats(correct);
    };

    const handleNextStep = () => {
        if (isCorrect) {
            // NEW: PROGRESS LEVEL ON SUCCESS
            setQuizLevel(prev => prev + 1);
            const nextQ = (quizQuestionNumber || 1) + 1;
            if (setQuizQuestionNumber) setQuizQuestionNumber(nextQ);
            callAgent(subject, 'deepen_knowledge', `${safeRouteTitle}-Nivel Avanzado`, null, null, null, nextQ);
        } else {
            // OPTIONAL: KEEP LEVEL OR DECREASE? FOR NOW KEEP TO REINFORCE
            callAgent(subject, 'remedial_explanation', `${safeRouteTitle}-Refuerzo Concepto`);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[#2B2E4A]/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`${clayCard} w-full max-w-lg bg-[#E0E5EC] relative animate-scale-up flex flex-col max-h-[90vh]`}>
                <button onClick={onClose} className="absolute top-4 right-4 text-[#9094A6] hover:text-[#2B2E4A] z-10">
                    <X className="w-6 h-6" />
                </button>

                <div className="flex items-center justify-between mb-4 flex-shrink-0 pr-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#E0E5EC] shadow-[inset_3px_3px_6px_#a3b1c6,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center">
                            <Brain className="w-6 h-6 text-[#4D96FF] animate-wiggle" />
                        </div>
                        <div>
                            <h3 className="font-black text-[#2B2E4A] text-lg">Agente de {repairText(subject)}</h3>
                            <p className="text-[#9094A6] text-xs font-bold uppercase">Contenido generado por IA</p>
                        </div>
                    </div>

                    {(quizStats && (quizStats.total > 0 || isActiveQuiz)) && (
                        <div className="bg-white/50 px-3 py-1 rounded-xl flex items-center gap-3 shadow-inner border border-white">
                            <div className="flex items-center gap-1 text-[#6BCB77] font-black"><Check className="w-4 h-4" /> {quizStats.correct}</div>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="flex items-center gap-1 text-[#FF6B6B] font-black"><X className="w-4 h-4" /> {quizStats.incorrect}</div>
                        </div>
                    )}
                </div>

                <div ref={scrollRef} className={`${clayInset} p-6 mb-4 overflow-y-auto flex-grow`}>
                    {/* DISPLAY USER QUERY IF EXISTS (Q&A MODE) */}
                    {userQuery && (
                        <div className="mb-4 p-4 bg-[#FF9F43]/10 border-l-4 border-[#FF9F43] rounded-r-xl">
                            <h5 className="font-bold text-[#FF9F43] text-xs uppercase mb-1 flex items-center gap-1">
                                <HelpCircle className="w-4 h-4" /> Tu Pregunta:
                            </h5>
                            <p className="text-[#2B2E4A] font-bold italic">"{userQuery}"</p>
                        </div>
                    )}

                    <h4 className="font-bold text-[#2B2E4A] mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-[#FFD93D] animate-bounce" />
                            {contentTitle}
                        </span>

                        {/* DIFFICULTY INDICATOR */}
                        {isActiveQuiz && (
                            <div className="flex items-center gap-1 bg-black/5 px-2 py-1 rounded-lg">
                                <span className="text-[10px] font-black uppercase text-[#9094A6] mr-1">Dificultad {quizLevel}:</span>
                                <Star className={`w-3 h-3 ${quizLevel >= 1 ? 'fill-[#FFD93D] text-[#FFD93D]' : 'text-gray-300'}`} />
                                <Star className={`w-3 h-3 ${quizLevel >= 2 ? 'fill-[#FFD93D] text-[#FFD93D]' : 'text-gray-300'}`} />
                                <Star className={`w-3 h-3 ${quizLevel >= 3 ? 'fill-[#FFD93D] text-[#FFD93D]' : 'text-gray-300'}`} />
                            </div>
                        )}
                    </h4>

                    <MathRenderer text={content} />

                    {apiJson && apiJson.question && (
                        <div className="mt-8 pt-6 border-t border-gray-300/50">
                            <h5 className="font-black text-[#2B2E4A] mb-4 flex items-center gap-2">
                                <span className="text-xl">Ã³aÃ³</span> DesafÃ­o RÃ¡pido:
                            </h5>
                            <div className="font-bold text-[#2B2E4A] mb-4">
                                <MathRenderer text={apiJson.question} />
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {apiJson.options && apiJson.options.map((option, index) => {
                                    const cleanOption = String(option || '').replace(/^[A-Z]\)\s*/, '').trim();
                                    const letter = ['A', 'B', 'C', 'D'][index] || String(index + 1);
                                    const isCorrectOption = index === apiJson.correctIndex;
                                    const isSelectedOption = index === selectedOption;
                                    const isIncorrectSelected = showExplanation && isSelectedOption && !isCorrectOption;

                                    let cardStyle = "w-full text-left rounded-2xl border-2 p-4 md:p-5 transition-all duration-200 shadow-sm ";
                                    if (showExplanation) {
                                        if (isCorrectOption) {
                                            cardStyle += "bg-emerald-50 border-emerald-300 shadow-emerald-100";
                                        } else if (isIncorrectSelected) {
                                            cardStyle += "bg-red-50 border-red-300 shadow-red-100";
                                        } else {
                                            cardStyle += "bg-white/70 border-gray-200 opacity-70";
                                        }
                                    } else {
                                        cardStyle += "bg-white border-[#DCE7FF] hover:border-[#4D96FF] hover:shadow-md active:scale-[0.99]";
                                    }

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => !showExplanation && handleOptionClick(index)}
                                            className={cardStyle}
                                            disabled={showExplanation}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm
                                                    ${showExplanation
                                                        ? isCorrectOption
                                                            ? 'bg-emerald-500 text-white'
                                                            : isIncorrectSelected
                                                                ? 'bg-red-500 text-white'
                                                                : 'bg-gray-100 text-gray-500'
                                                        : 'bg-[#4D96FF] text-white'
                                                    }`}>
                                                    {letter}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <MathRenderer text={cleanOption || 'Sin texto'} />
                                                </div>

                                                {showExplanation && isCorrectOption && (
                                                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                                                )}
                                                {showExplanation && isIncorrectSelected && (
                                                    <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {showExplanation && (
                                <div className="mt-6 p-4 bg-[#FFD93D]/20 border-2 border-[#FFD93D] rounded-2xl animate-fade-in relative">
                                    <h6 className="font-black text-[#C7A005] mb-2 flex items-center gap-2">
                                        <Lightbulb className="w-5 h-5" /> ExplicaciÃ³n:
                                    </h6>
                                    <MathRenderer text={apiJson.explanation} />

                                    <div className="mt-6 pt-4 border-t border-[#FFD93D]/30 flex justify-between items-center gap-2">
                                        {/* NEW CONTEXTUAL HELP BUTTON */}
                                        <button
                                            onClick={onAskDoubt}
                                            className="px-4 py-2 bg-white/50 text-[#FF9F43] font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-white transition-colors"
                                        >
                                            <HelpCircle className="w-4 h-4" /> Â¿PREGUNTAS? Ã³xÃ³
                                        </button>

                                        <button
                                            onClick={handleNextStep}
                                            className={`${clayBtnAction} w-auto px-6 py-2 text-xs`}
                                            disabled={isCallingN8N}
                                        >
                                            {isCallingN8N ? 'Pensando...' : (isCorrect ? 'Â¡Siguiente! Ã³xaÃ³' : 'Refuerzo Ã³xÃ³')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 pt-2">
                    <button
                        onClick={actionHandler}
                        className={actionColor}
                        disabled={isCallingN8N}
                    >
                        {isCallingN8N ? 'ESPERA...' : actionText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// HELPER FOR SANITIZING EXPLANATION TEXT
const sanitizeExplanation = (text, options) => {
    if (!text || !options) return text;
    let newText = text;
    const labels = ['A', 'B', 'C', 'D'];

    labels.forEach((label, index) => {
        if (options[index]) {
            const cleanOptionContent = options[index].replace(/^[A-Z]\)\s*/, '');
            // MATCH: "alternativa correcta es la D", "la respuesta es D", "D)", etc
            const regex = new RegExp(`\\b(alternativa|opciÃ³n|opcion|letra|respuesta|soluciÃ³n)(?:\\s+(?:correcta|incorrecta|es|la|el|que|sea))*\\s+\${label}(?:\\))?\\b`, 'gi');
            newText = newText.replace(regex, `la opciÃ³n "${cleanOptionContent}"`);
            const regex2 = new RegExp(`\\b(es|son|sea)\\s+la\\s+\${label}(?:\\))?\\b`, 'gi');
            newText = newText.replace(regex2, `es la opciÃ³n "${cleanOptionContent}"`);
        }
    });
    return newText;
};

// HELPER FOR SHUFFLING QUIZ OPTIONS
const shuffleQuizData = (data) => {
    if (!data || !data.options || typeof data.correctIndex === 'undefined') return data;
    const optionsWithStatus = data.options.map((opt, index) => ({
        text: opt,
        isCorrect: index === data.correctIndex
    }));
    for (let i = optionsWithStatus.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithStatus[i], optionsWithStatus[j]] = [optionsWithStatus[j], optionsWithStatus[i]];
    }
    const newOptions = optionsWithStatus.map(o => o.text);
    const newCorrectIndex = optionsWithStatus.findIndex(o => o.isCorrect);
    return { ...data, options: newOptions, correctIndex: newCorrectIndex };
};

const PHYSICS_SYLLABUS = [
    // FASE 1: ONDAS Y SONIDO
    { session: 1, unit: 'Ondas y Sonido', topic: 'IntroducciÃ³n a las Ondas: Materia vs EnergÃ­a', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 2, unit: 'Ondas y Sonido', topic: 'ClasificaciÃ³n I: MecÃ¡nicas vs ElectromagnÃ©ticas', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 3, unit: 'Ondas y Sonido', topic: 'ClasificaciÃ³n II: Transversales vs Longitudinales', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },
    { session: 4, unit: 'Ondas y Sonido', topic: 'AnatomÃ­a de la Onda', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 5, unit: 'Ondas y Sonido', topic: 'Concepto de Ciclo', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 6, unit: 'Ondas y Sonido', topic: 'Periodo y Frecuencia (TeorÃ­a)', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },
    { session: 7, unit: 'Ondas y Sonido', topic: 'Periodo y Frecuencia (CÃ¡lculo)', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 8, unit: 'Ondas y Sonido', topic: 'Longitud de Onda', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 9, unit: 'Ondas y Sonido', topic: 'Rapidez de PropagaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 10, unit: 'Ondas y Sonido', topic: 'El Sonido y sus Propiedades', videoLink: 'https://www.youtube.com/watch?v=n9O6IBVkBMM' },
    { session: 11, unit: 'Ondas y Sonido', topic: 'FenÃ³menos: ReflexiÃ³n y DifracciÃ³n', videoLink: 'https://www.youtube.com/watch?v=PFdowtChLCY' },
    { session: 12, unit: 'Ondas y Sonido', topic: 'FenÃ³menos: RefracciÃ³n y Doppler', videoLink: 'https://www.youtube.com/watch?v=-MK8v4rRMA8' },
    { session: 13, unit: 'Ondas y Sonido', topic: 'EvaluaciÃ³n Fase 1: Ondas', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },

    // FASE 2: LUZ Y OPTICA
    { session: 14, unit: 'Luz y Ã³ptica', topic: 'Dualidad Onda-PartÃ­cula y Espectro', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 15, unit: 'Luz y Ã³ptica', topic: 'PropagaciÃ³n y Velocidad de la Luz', videoLink: 'https://www.youtube.com/shorts/tvIQhjn6nm8' },
    { session: 16, unit: 'Luz y Ã³ptica', topic: 'ReflexiÃ³n en Espejos Planos', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 17, unit: 'Luz y Ã³ptica', topic: 'Espejos CÃ³ncavos (Foco Real)', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 18, unit: 'Luz y Ã³ptica', topic: 'Espejos Convexos (Foco Virtual)', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 19, unit: 'Luz y Ã³ptica', topic: 'RefracciÃ³n y Ley de Snell', videoLink: 'https://www.youtube.com/watch?v=JfDw0jRjllo' },
    { session: 20, unit: 'Luz y Ã³ptica', topic: 'ReflexiÃ³n Total Interna', videoLink: 'https://www.youtube.com/watch?v=uKfGqD-2rAs' },
    { session: 21, unit: 'Luz y Ã³ptica', topic: 'Lentes Convergentes y el Ojo', videoLink: 'https://www.youtube.com/watch?v=5hTXt8SsgBw' },
    { session: 22, unit: 'Luz y Ã³ptica', topic: 'Lentes Divergentes y MiopÃ­a', videoLink: 'https://www.youtube.com/watch?v=5hTXt8SsgBw' },
    { session: 23, unit: 'Luz y Ã³ptica', topic: 'El Ojo Humano y Defectos', videoLink: 'https://www.youtube.com/watch?v=Z6GsrLQ6H3M' },
    { session: 24, unit: 'Luz y Ã³ptica', topic: 'DispersiÃ³n CromÃ¡tica (Prisma)', videoLink: 'https://www.youtube.com/watch?v=JZt8EJH146k' },
    { session: 25, unit: 'Luz y Ã³ptica', topic: 'EvaluaciÃ³n Fase 2: Luz', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },

    // FASE 3: SISMOS
    { session: 26, unit: 'DinÃ¡mica Terrestre', topic: 'Estructura Interna de la Tierra', videoLink: 'https://www.youtube.com/watch?v=IaZfi4RitGU' },
    { session: 27, unit: 'DinÃ¡mica Terrestre', topic: 'TectÃ³nica de Placas', videoLink: 'https://www.youtube.com/watch?v=rrlwHnG3hPA' },
    { session: 28, unit: 'DinÃ¡mica Terrestre', topic: 'LÃ­mites Convergentes y Divergentes', videoLink: 'https://www.youtube.com/watch?v=rrlwHnG3hPA' },
    { session: 29, unit: 'DinÃ¡mica Terrestre', topic: 'Origen de los Sismos: Hipocentro', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 30, unit: 'DinÃ¡mica Terrestre', topic: 'Ondas P y S (Cuerpo)', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 31, unit: 'DinÃ¡mica Terrestre', topic: 'Ondas Superficiales (Rayleigh/Love)', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 32, unit: 'DinÃ¡mica Terrestre', topic: 'Escalas: Richter vs Mercalli', videoLink: 'https://www.youtube.com/watch?v=NlGb3SvyBpI' },
    { session: 33, unit: 'DinÃ¡mica Terrestre', topic: 'EvaluaciÃ³n Fase 3: Sismos', videoLink: 'https://www.youtube.com/watch?v=vQ6NzZh0SNg' },

    // FASE 4: UNIVERSO
    { session: 34, unit: 'El Universo', topic: 'Estructuras CÃ³smicas y Escalas', videoLink: 'https://www.youtube.com/watch?v=h5rS1Lfahsk' },
    { session: 35, unit: 'El Universo', topic: 'Big Bang y ExpansiÃ³n', videoLink: 'https://www.youtube.com/watch?v=h5rS1Lfahsk' },
    { session: 36, unit: 'El Universo', topic: 'Sistema Solar: Rocosos vs Gaseosos', videoLink: 'https://www.youtube.com/watch?v=idZGB2T5EPE' },
    { session: 37, unit: 'El Universo', topic: 'Leyes de Kepler (I y II)', videoLink: 'https://www.youtube.com/watch?v=a3-gU4tpjWc' },
    { session: 38, unit: 'El Universo', topic: '3ra Ley de Kepler y GravitaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=a3-gU4tpjWc' },
    { session: 39, unit: 'Repaso Integral', topic: 'Repaso Ondas y Sonido', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 40, unit: 'Repaso Integral', topic: 'Repaso Ã³ptica GeomÃ©trica', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 41, unit: 'Repaso Integral', topic: 'Repaso Sismos y Universo', videoLink: 'https://www.youtube.com/watch?v=jalVd4_I3jM' },
    { session: 42, unit: 'Cierre', topic: 'ENSAYO FINAL SIMULACIÃ³N', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 43, unit: 'Cierre', topic: 'AnÃ¡lisis de Errores y Cierre', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 44, unit: 'Cierre', topic: 'FÃ­sica Moderna', videoTitle: 'IntroducciÃ³n a FÃ­sica CuÃ¡ntica', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 45, unit: 'Cierre', topic: 'FÃ­sica y TecnologÃ­a', videoTitle: 'Aplicaciones de la FÃ­sica', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 46, unit: 'Cierre', topic: 'Gran DesafÃ­o Final', videoTitle: 'EvaluaciÃ³n Final FÃ­sica', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' }
];


const BIOLOGY_SYLLABUS = [
    // UNIDAD 1: EVOLUCIÃ³N Y BIODIVERSIDAD
    { session: 1, unit: 'EvoluciÃ³n', topic: 'TeorÃ­as Pre-Darwinianas', videoLink: 'https://www.youtube.com/watch?v=c1oJKMtVLYQ' },
    { session: 2, unit: 'EvoluciÃ³n', topic: 'Darwin y Wallace', videoLink: 'https://www.youtube.com/watch?v=J7fsT_85Ld0' },
    { session: 3, unit: 'EvoluciÃ³n', topic: 'TeorÃ­a SintÃ©tica', videoLink: 'https://www.youtube.com/watch?v=6QfDA44028s' },
    { session: 4, unit: 'EvoluciÃ³n', topic: 'Registro FÃ³sil', videoLink: 'https://www.youtube.com/watch?v=aBrypvwLLpg' },
    { session: 5, unit: 'EvoluciÃ³n', topic: 'AnatomÃ­a Comparada', videoLink: 'https://www.youtube.com/watch?v=DXlVOxWzdwQ' },
    { session: 6, unit: 'EvoluciÃ³n', topic: 'EmbriologÃ­a y BiogeografÃ­a', videoLink: 'https://www.youtube.com/watch?v=lZUX9Kv6y7s' },
    { session: 7, unit: 'EvoluciÃ³n', topic: 'EvoluciÃ³n Humana y HominizaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=9oY_Q5Gf_v4' },
    { session: 8, unit: 'EvoluciÃ³n', topic: 'Taller de IntegraciÃ³n', videoLink: 'https://www.youtube.com/watch?v=bPr6duAHk4I' },
    { session: 9, unit: 'EvoluciÃ³n', topic: 'EspeciaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=CBAwcRaVzA4' },
    { session: 10, unit: 'EvoluciÃ³n', topic: 'TaxonomÃ­a y SistemÃ¡tica', videoLink: 'https://www.youtube.com/watch?v=Ji5aYL0KQoY' },
    { session: 11, unit: 'EvoluciÃ³n', topic: 'SÃ­ntesis de la Unidad: El Origen de la Biodiversidad', videoLink: 'https://www.youtube.com/watch?v=UqQ_u5qS5r4' },
    { session: 12, unit: 'EvoluciÃ³n', topic: 'Protista y Fungi', videoLink: 'https://www.youtube.com/watch?v=6tttZ_7Q9a8' },
    { session: 13, unit: 'EvoluciÃ³n', topic: 'Atributos de una PoblaciÃ³n (Densidad y DistribuciÃ³n)', videoLink: 'https://www.youtube.com/watch?v=S0T0E9y_H0c' },

    // UNIDAD 2: ORGANISMOS EN ECOSISTEMAS
    { session: 14, unit: 'EcologÃ­a', topic: 'OrganizaciÃ³n EcolÃ³gica', videoLink: 'https://www.youtube.com/watch?v=18gqzWCPDMU' },
    { session: 15, unit: 'EcologÃ­a', topic: 'DistribuciÃ³n Espacial', videoLink: 'https://www.youtube.com/watch?v=MIiIIrZKggI' },
    { session: 16, unit: 'EcologÃ­a', topic: 'Crecimiento Poblacional: Modelos J y S', videoLink: 'https://www.youtube.com/watch?v=KzX6yK8jC8U' },
    { session: 17, unit: 'EcologÃ­a', topic: 'Crecimiento LogÃ­stico', videoLink: 'https://www.youtube.com/watch?v=2IFEZUEL7DQ' },
    { session: 18, unit: 'EcologÃ­a', topic: 'Interacciones BiolÃ³gicas (Competencia, DepredaciÃ³n)', videoLink: 'https://www.youtube.com/watch?v=XF3P8K7XpLc' },
    { session: 19, unit: 'EcologÃ­a', topic: 'RegulaciÃ³n Poblacional', videoLink: 'https://www.youtube.com/watch?v=F1_W1qRBV5M' },
    { session: 20, unit: 'EcologÃ­a', topic: 'Competencia y DepredaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=1Pqr7RVMx4A' },
    { session: 21, unit: 'EcologÃ­a', topic: 'Simbiosis', videoLink: 'https://www.youtube.com/watch?v=GJnXQjFnyxo' },
    { session: 22, unit: 'EcologÃ­a', topic: 'EcologÃ­a Humana', videoLink: 'https://www.youtube.com/watch?v=xqHjtAFuuc4' },

    // UNIDAD 3: MATERIA Y ENERGÃƒÂA
    { session: 23, unit: 'EnergÃ­a', topic: 'Metabolismo y ATP', videoLink: 'https://www.youtube.com/watch?v=q2y_0wDcTDM' },
    { session: 24, unit: 'EnergÃ­a', topic: 'FotosÃ­ntesis: Intro', videoLink: 'https://www.youtube.com/watch?v=XTVmIME0XOs' },
    { session: 25, unit: 'EnergÃ­a', topic: 'Fase Dependiente de Luz', videoLink: 'https://www.youtube.com/watch?v=y-HglExruMI' },
    { session: 26, unit: 'EnergÃ­a', topic: 'Ciclo de Calvin', videoLink: 'https://www.youtube.com/watch?v=d2DB-kWxg-w' },
    { session: 27, unit: 'EnergÃ­a', topic: 'Cadenas y Tramas TrÃ³ficas', videoLink: 'https://www.youtube.com/watch?v=cgmfiqWGLxI' },
    { session: 28, unit: 'EnergÃ­a', topic: 'RespiraciÃ³n Celular', videoLink: 'https://www.youtube.com/watch?v=YefwfJ8IpEI' },
    { session: 29, unit: 'EnergÃ­a', topic: 'IntegraciÃ³n MetabÃ³lica', videoLink: 'https://www.youtube.com/watch?v=JYSm79-IIHw' },
    { session: 30, unit: 'EnergÃ­a', topic: 'Tramas TrÃ³ficas', videoLink: 'https://www.youtube.com/watch?v=UMrU2peVKcU' },
    { session: 31, unit: 'EnergÃ­a', topic: 'Flujo de EnergÃ­a (10%)', videoLink: 'https://www.youtube.com/watch?v=6sUR80wigsU' },
    { session: 32, unit: 'EnergÃ­a', topic: 'PirÃ¡mides EcolÃ³gicas', videoLink: 'https://www.youtube.com/watch?v=cgmfiqWGLxI' },
    { session: 33, unit: 'EnergÃ­a', topic: 'Ciclos BiogeoquÃ­micos (Carbono, NitrÃ³geno, Agua)', videoLink: 'https://www.youtube.com/watch?v=hUQoF16DmNk' },
    { session: 34, unit: 'EnergÃ­a', topic: 'Ciclo del Carbono', videoLink: 'https://www.youtube.com/watch?v=6YE42IePPjM' },
    { session: 35, unit: 'EnergÃ­a', topic: 'Ciclo del NitrÃ³geno', videoLink: 'https://www.youtube.com/watch?v=iH3AI-XtNS8' },
    { session: 36, unit: 'EnergÃ­a', topic: 'Impacto AntropogÃ©nico en los Ecosistemas', videoLink: 'https://www.youtube.com/watch?v=BKS_rQbalGQ' },

    // UNIDAD 4: SUSTENTABILIDAD
    { session: 37, unit: 'Sustentabilidad', topic: 'Efecto Invernadero', videoLink: 'https://www.youtube.com/watch?v=K7MzGe6OSs0' },
    { session: 38, unit: 'Sustentabilidad', topic: 'Cambio ClimÃ¡tico', videoLink: 'https://www.youtube.com/watch?v=VoQYVGy45HY' },
    { session: 39, unit: 'Sustentabilidad', topic: 'Huella EcolÃ³gica', videoLink: 'https://www.youtube.com/watch?v=chh0sAmfCwo' },
    { session: 40, unit: 'Sustentabilidad', topic: 'ContaminaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=PH3H1x5CN5I' },
    { session: 41, unit: 'Sustentabilidad', topic: 'Matriz EnergÃ©tica', videoLink: 'https://www.youtube.com/watch?v=YWds9hX3g7c' },
    { session: 42, unit: 'Sustentabilidad', topic: 'Huella EcolÃ³gica y ConservaciÃ³n de la Biodiversidad', videoLink: 'https://www.youtube.com/watch?v=Z6z_V9XN8S4' },
    { session: 43, unit: 'Sustentabilidad', topic: 'Biodiversidad Norte/Centro', videoLink: 'https://www.youtube.com/watch?v=US074D5Y_MY' },
    { session: 44, unit: 'Sustentabilidad', topic: 'Biodiversidad Sur', videoLink: 'https://www.youtube.com/watch?v=SJeRsE9TyBk' },
    { session: 45, unit: 'Sustentabilidad', topic: 'ConservaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=KcIHCEFKloo' },
    { session: 46, unit: 'Sustentabilidad', topic: 'Cierre y ReflexiÃ³n', videoLink: 'https://www.youtube.com/watch?v=lzYAXu7Om4s' }
];


const HISTORY_SYLLABUS = [
    // UNIDAD 1: LA CONSTRUCCIÃ³N DEL ESTADO NACIÃ³N (Sesiones 1-12)
    {
        session: 1,
        unit: 'ConstrucciÃ³n Estado NaciÃ³n',
        topic: 'El Ideario Liberal y la ReconfiguraciÃ³n de Europa',
        videoTitle: 'Liberalismo y Nacionalismo - Europa Siglo XIX',
        videoLink: 'https://www.youtube.com/watch?v=YcneJFUC47s',
        readingTitle: 'SÃ­ntesis: Liberalismo y Nacionalismo',
        readingContent: `El siglo XIX europeo no puede entenderse sin la influencia de la "Doble RevoluciÃ³n". El liberalismo emergiÃ³ como la ideologÃ­a de una burguesÃ­a ascendente que demandaba libertad individual, igualdad ante la ley, separaciÃ³n de poderes y soberanÃ­a nacional. Sin embargo, es crucial problematizar que este "liberalismo clÃ¡sico" a menudo excluÃ­a a las masas populares y a las mujeres. La sesiÃ³n explora cÃ³mo estas ideas, plasmadas en textos constitucionales, socavaron la legitimidad de las monarquÃ­as absolutas. El video de Puntaje Nacional desglosa la definiciÃ³n de naciÃ³n como un acto de voluntad polÃ­tica frente a la concepciÃ³n orgÃ¡nica.`
    },
    {
        session: 2,
        unit: 'ConstrucciÃ³n Estado NaciÃ³n',
        topic: 'La Cultura Burguesa y el Mito del Progreso',
        videoTitle: 'La cultura burguesa y el progreso',
        videoLink: 'https://www.youtube.com/watch?v=yUmJIvZdknw',
        readingTitle: 'SÃ­ntesis: Cultura Burguesa',
        readingContent: `La burguesÃ­a no solo transformÃ³ la polÃ­tica, sino que impuso una hegemonÃ­a cultural. Valores como el esfuerzo individual, el ahorro, la familia nuclear patriarcal y el orden pÃºblico se convirtieron en el estÃ¡ndar moral. Esta clase social abrazÃ³ el positivismo y la fe ciega en el progreso indefinido. Es fundamental discutir cÃ³mo esta visiÃ³n optimista ocultaba las profundas desigualdades sociales. El video permite visualizar los espacios de sociabilidad burguesa.`
    },
    { session: 3, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'Nacionalismos Europeos: UnificaciÃ³n y FragmentaciÃ³n', videoTitle: 'OrÃ­genes del nacionalismo polÃ­tico europeo', videoLink: 'https://www.youtube.com/watch?v=BgYbxwNcqkc' },
    { session: 4, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'La FormaciÃ³n del Estado en AmÃ©rica', videoTitle: 'ConformaciÃ³n Estado NaciÃ³n en AmÃ©rica', videoLink: 'https://www.youtube.com/watch?v=ALA4hfPAgXM' },
    { session: 5, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'Conflictos Territoriales y Caudillismo', videoTitle: 'ConsolidaciÃ³n de Estados en CentroamÃ©rica', videoLink: 'https://www.youtube.com/watch?v=OzR6f6YI9SQ' },
    { session: 6, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'Ensayos Constitucionales en Chile (1823-1830)', videoTitle: 'Ensayos Constitucionales Chile (1823-1830)', videoLink: 'https://www.youtube.com/watch?v=pT0q2HaozEw' },
    { session: 7, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'La Guerra Civil de 1829', videoTitle: 'Crisis de 1829 y Guerra Civil', videoLink: 'https://www.youtube.com/watch?v=pwndHH_0ex8' },
    { session: 8, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'Pensamiento de Portales y ConstituciÃ³n de 1833', videoTitle: 'Pensamiento de Diego Portales', videoLink: 'https://www.youtube.com/watch?v=NVB458I4Mj4' },
    { session: 9, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'La RepÃºblica Conservadora', videoTitle: 'RepÃºblica Conservadora y Liberal', videoLink: 'https://www.youtube.com/watch?v=hf-DFfoSZOw' },
    { session: 10, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'La TransiciÃ³n Liberal y Reformas', videoTitle: 'Las Transformaciones Liberales', videoLink: 'https://www.youtube.com/watch?v=M1acYUUSLhg' },
    { session: 11, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'La Guerra contra EspaÃ±a', videoTitle: 'Guerra contra EspaÃ±a 1865', videoLink: 'https://www.youtube.com/watch?v=bU9WmMmwVgg' },
    { session: 12, unit: 'ConstrucciÃ³n Estado NaciÃ³n', topic: 'EducaciÃ³n y Cultura Siglo XIX', videoTitle: 'Desarrollo educaciÃ³n y cultura Chile siglo XIX', videoLink: 'https://www.youtube.com/watch?v=Wpu4giF84Yg' },

    // UNIDAD 2: PROGRESO, INDUSTRIALIZACIÃ³N Y CRISIS (Sesiones 13-23)
    {
        session: 13,
        unit: 'Progreso y Crisis',
        topic: 'RevoluciÃ³n Industrial: Transformaciones Productivas',
        videoTitle: 'RevoluciÃ³n Industrial y sus caracterÃ­sticas',
        videoLink: 'https://www.youtube.com/watch?v=GlLW9oB8fEQ',
        readingTitle: 'SÃ­ntesis: RevoluciÃ³n Industrial',
        readingContent: `La industrializaciÃ³n marcÃ³ el paso de una economÃ­a agraria y artesanal a una dominada por la industria mecanizada. Se distinguen dos fases: la del carbÃ³n/vapor y la del petrÃ³leo/electricidad. Este proceso cambiÃ³ irreversiblemente la relaciÃ³n del ser humano con el medio ambiente y el tiempo, consolidando el capitalismo global. Explica los factores que permitieron el despegue industrial en Inglaterra.`
    },
    { session: 14, unit: 'Progreso y Crisis', topic: 'Sociedad Industrial: BurguesÃ­a y Proletariado', videoTitle: 'Impacto social y surgimiento del proletariado', videoLink: 'https://www.youtube.com/watch?v=WMtHe2b--xU' },
    { session: 15, unit: 'Progreso y Crisis', topic: 'IdeologÃ­as y Movimiento Obrero', videoTitle: 'La CuestiÃ³n Social y el Despertar del Mundo Obrero', videoLink: 'https://www.youtube.com/watch?v=M1acYUUSLhg' },
    { session: 16, unit: 'Progreso y Crisis', topic: 'Imperialismo Europeo: Motivaciones', videoTitle: 'Imperialismo y colonialismo - Causas', videoLink: 'https://www.youtube.com/watch?v=7Q_GLFvPWoE' },
    { session: 17, unit: 'Progreso y Crisis', topic: 'El Reparto del Mundo', videoTitle: 'Imperialismo y colonialismo - Mapas', videoLink: 'https://www.youtube.com/watch?v=esTiZrPGXTU' },
    { session: 18, unit: 'Progreso y Crisis', topic: 'Impacto en Pueblos Colonizados', videoTitle: 'ReflexiÃ³n sobre el imperialismo', videoLink: 'https://www.youtube.com/watch?v=suD9G7DVpBw' },
    { session: 19, unit: 'Progreso y Crisis', topic: 'Paz Armada y Alianzas', videoTitle: 'Rivalidades imperialistas y alianzas', videoLink: 'https://www.youtube.com/watch?v=XScsA5Pyf0w' },
    { session: 20, unit: 'Progreso y Crisis', topic: 'Primera Guerra Mundial: Guerra Industrial', videoTitle: 'Primera Guerra Mundial (ContinuaciÃ³n)', videoLink: 'https://www.youtube.com/watch?v=XScsA5Pyf0w' },
    { session: 21, unit: 'Progreso y Crisis', topic: 'Ciclo del Salitre: Auge y Dependencia', videoTitle: 'Chile a finales del siglo XIX', videoLink: 'https://www.youtube.com/watch?v=v2dRu-yy-Nw' },
    { session: 22, unit: 'Progreso y Crisis', topic: 'CuestiÃ³n Social: Pampa y Ciudad', videoTitle: 'Ciclo del salitre y cuestiÃ³n social', videoLink: 'https://www.youtube.com/watch?v=vp9D91ZcP7A' },
    { session: 23, unit: 'Progreso y Crisis', topic: 'MovilizaciÃ³n Obrera y RepresiÃ³n', videoTitle: 'Matanza de Santa MarÃ­a de Iquique', videoLink: 'https://www.youtube.com/watch?v=K5n5VhyzYcc' },

    // UNIDAD 3: CONFORMACIÃ³N DEL TERRITORIO CHILENO (Sesiones 24-34)
    {
        session: 24,
        unit: 'Territorio Nacional',
        topic: 'ExploraciÃ³n CientÃ­fica y Reconocimiento',
        videoTitle: 'ExploraciÃ³n geogrÃ¡fica siglo XIX',
        videoLink: 'https://www.youtube.com/watch?v=tuPwi15_5Wc',
        readingTitle: 'SÃ­ntesis: Ciencia y SoberanÃ­a',
        readingContent: `El Estado chileno del siglo XIX necesitaba "conocer para gobernar". ContratÃ³ a cientÃ­ficos extranjeros (Claudio Gay, Pissis, Philippi) para cartografiar el territorio y descubrir sus recursos mineros y agrÃ­colas. Estas exploraciones fuer la avanzada de la ocupaciÃ³n estatal efectiva.`
    },
    { session: 25, unit: 'Territorio Nacional', topic: 'Estrategias de OcupaciÃ³n Territorial', videoTitle: 'Mecanismos de ocupaciÃ³n territorial', videoLink: 'https://www.youtube.com/watch?v=N0mdAjzdVl0' },
    { session: 26, unit: 'Territorio Nacional', topic: 'ColonizaciÃ³n Alemana en el Sur', videoTitle: 'ColonizaciÃ³n alemana en el sur', videoLink: 'https://www.youtube.com/watch?v=RFsumviRmlc' },
    { session: 27, unit: 'Territorio Nacional', topic: 'Guerra del PacÃ­fico: Causas', videoTitle: 'Guerra del PacÃ­fico: Causas', videoLink: 'https://www.youtube.com/watch?v=PQodJNKpgwg' },
    { session: 28, unit: 'Territorio Nacional', topic: 'CampaÃ±as de la Guerra del PacÃ­fico', videoTitle: 'CampaÃ±a Naval y Terrestre', videoLink: 'https://www.youtube.com/watch?v=kUmB00qBq8w' },
    { session: 29, unit: 'Territorio Nacional', topic: 'Consecuencias de la Guerra', videoTitle: 'Consecuencias Guerra del PacÃ­fico', videoLink: 'https://www.youtube.com/watch?v=o4wA_w9vQFU' },
    { session: 30, unit: 'Territorio Nacional', topic: 'OcupaciÃ³n de la AraucanÃ­a', videoTitle: 'OcupaciÃ³n de la AraucanÃ­a', videoLink: 'https://www.youtube.com/watch?v=RMbFKYd-LLI' },
    { session: 31, unit: 'Territorio Nacional', topic: 'Reducciones y Pueblo Mapuche', videoTitle: 'Tierras y Reducciones Mapuche', videoLink: 'https://www.youtube.com/watch?v=RMbFKYd-LLI' },
    { session: 32, unit: 'Territorio Nacional', topic: 'ColonizaciÃ³n de Magallanes y Selk\'nam', videoTitle: 'Conflicto en Magallanes y Selk\'nam', videoLink: 'https://www.youtube.com/watch?v=o5MRPdSSddU' },
    { session: 33, unit: 'Territorio Nacional', topic: 'IncorporaciÃ³n de Rapa Nui', videoTitle: 'Historia de la anexiÃ³n de Rapa Nui', videoLink: 'https://www.youtube.com/watch?v=90RzhcA0b0g' },
    { session: 34, unit: 'Territorio Nacional', topic: 'Tratado de 1881 con Argentina', videoTitle: 'Tratado de 1881 Chile-Argentina', videoLink: 'https://www.youtube.com/watch?v=3jypb_mjLyA' },

    // UNIDAD 4: ECONOMÃƒÂA Y CIUDADANÃƒÂA (Sesiones 35-46)
    {
        session: 35,
        unit: 'EconomÃ­a y CiudadanÃ­a',
        topic: 'El Problema EconÃ³mico: Escasez',
        videoTitle: 'Problema econÃ³mico y escasez',
        videoLink: 'https://www.youtube.com/watch?v=Y7yv3EfVpLs',
        readingTitle: 'SÃ­ntesis: EconomÃ­a y Escasez',
        readingContent: `La economÃ­a surge de una contradicciÃ³n: necesidades ilimitadas vs. recursos limitados. Esto obliga a elegir (costo de oportunidad). Es fundamental desmitificar que la escasez es solo pobreza; es una condiciÃ³n universal. El video usa ejemplos diarios para ilustrar la asignaciÃ³n de recursos.`
    },
    { session: 36, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Agentes EconÃ³micos y Flujo Circular', videoTitle: 'Agentes econÃ³micos', videoLink: 'https://www.youtube.com/watch?v=Y7yv3EfVpLs' },
    { session: 37, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Bienes, Servicios y Factores Productivos', videoTitle: 'Factores productivos y tipos de bienes', videoLink: 'https://www.youtube.com/watch?v=sdEraaf7iyk' },
    { session: 38, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Ley de Oferta y Demanda', videoTitle: 'CÃ³mo funciona la oferta y la demanda', videoLink: 'https://www.youtube.com/watch?v=QdYya8wR3m4' },
    { session: 39, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'FenÃ³menos MacroeconÃ³micos: InflaciÃ³n', videoTitle: 'InflaciÃ³n y DeflaciÃ³n', videoLink: 'https://www.youtube.com/watch?v=tzkL7GalXH0' },
    { session: 40, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Fallas de Mercado: Monopolios', videoTitle: 'Monopolio y ColusiÃ³n', videoLink: 'https://www.youtube.com/watch?v=nJHRFv6UDLE' },
    { session: 41, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Instrumentos de Ahorro e InversiÃ³n', videoTitle: 'Instrumentos para invertir (DAP)', videoLink: 'https://www.youtube.com/watch?v=D1CIp63Zw40' },
    { session: 42, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'CrÃ©dito y Endeudamiento Responsable', videoTitle: 'EducaciÃ³n financiera para jÃ³venes', videoLink: 'https://www.youtube.com/watch?v=uZX6o2Ty63w' },
    { session: 43, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Derechos del Consumidor', videoTitle: 'Derechos del consumidor - GarantÃ­a Legal', videoLink: 'https://www.youtube.com/watch?v=6eYv1jHRuY4' },
    { session: 44, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Consumo Sostenible', videoTitle: 'Acciones sustentables desde casa', videoLink: 'https://www.youtube.com/watch?v=irwnImaQCNA' },
    { session: 45, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'Desarrollo Sustentable', videoTitle: 'Desarrollo sustentable y economÃ­a ambiental', videoLink: 'https://www.youtube.com/watch?v=4y3hnYt5Zi8' },
    { session: 46, unit: 'EconomÃ­a y CiudadanÃ­a', topic: 'SÃ­ntesis Final: Historia y CiudadanÃ­a', videoTitle: 'SÃ­ntesis Historia y EconomÃ­a', videoLink: 'https://www.youtube.com/watch?v=lI5BlkzwAcA' }
];

const DEFAULT_HISTORY_ROUTE = {
    sujeto: 'Historia',
    oa_title: 'S1: El Ideario Liberal',
    color: '#E67E22', // Terracota
    icon: Globe,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video Documental', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. AnÃ¡lisis HistÃ³rico', action: 'start_route', icon: 'Globe', isComplete: false },
        { step: '3. Quiz Ciudadano', action: 'quiz', icon: 'Brain', isComplete: false },
        { step: '4. Debate', action: 'doubt', icon: 'MessageCircle', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANÃƒÂLISIS HISTÃ³RICO"
};

const getSyllabusForSubject = (subject) => {
    if (subject === 'LENGUAJE') return LANGUAGE_SYLLABUS;
    if (subject === 'FISICA') return PHYSICS_SYLLABUS;
    if (subject === 'QUIMICA') return CHEMISTRY_SYLLABUS;
    if (subject === 'BIOLOGIA') return BIOLOGY_SYLLABUS;
    if (subject === 'HISTORIA') return HISTORY_SYLLABUS;
    return MATH_SYLLABUS;
};

const distributePrepSessions = (sessions, totalQuestions) => {
    const validSessions = (sessions || []).filter(Boolean);
    if (!validSessions.length) return [];

    const distributed = [];
    for (let i = 0; i < totalQuestions; i++) {
        distributed.push(validSessions[i % validSessions.length]);
    }
    return distributed;
};

const PREP_EXAM_SUBJECT_OPTIONS = [
    { value: 'MATEMATICA', label: 'MatemÃ¡tica' },
    { value: 'LENGUAJE', label: 'Lenguaje' },
    { value: 'HISTORIA', label: 'Historia' },
    { value: 'FISICA', label: 'FÃ­sica' },
    { value: 'QUIMICA', label: 'QuÃ­mica' },
    { value: 'BIOLOGIA', label: 'BiologÃ­a' }
];

const PREP_EXAM_COUNT_OPTIONS = [15, 30, 45];

const PrepExamSetupModal = ({
    isOpen,
    onClose,
    subject,
    syllabus,
    selectedSessions,
    onToggleSession,
    onStart,
    isLoading
}) => {
    if (!isOpen) return null;

    const selectedDetails = syllabus.filter(item => selectedSessions.includes(item.session));
    const totalQuestions = 45;
    const distribution = distributePrepSessions(selectedDetails, totalQuestions);
    const distributionMap = distribution.reduce((acc, item) => {
        acc[item.session] = (acc[item.session] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-[#2B2E4A]/60 backdrop-blur-md">
            <div className="bg-[#F4F7FF] w-full max-w-4xl rounded-[32px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)] border-4 border-white">
                <div className="bg-white px-6 py-5 border-b-2 border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-[#2B2E4A]">Prueba preparatoria</h3>
                        <p className="text-sm font-bold text-[#9094A6]">
                            {subject} Ã‚Â· 45 preguntas Ã‚Â· generaciÃ³n rÃ¡pida de 5 en 5
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="grid md:grid-cols-[1.4fr_1fr] gap-0">
                    <div className="p-6 border-r border-gray-100 max-h-[70vh] overflow-y-auto">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5">
                            <p className="text-sm text-indigo-900 leading-relaxed">
                                Elige las sesiones que le van a tomar a tu hijo. Matico armarÃ¡ un ensayo
                                acumulativo balanceado y despuÃ©s te dirÃ¡ en quÃ© sesiones estÃ¡ mÃ¡s dÃ©bil.
                            </p>
                        </div>

                        <div className="grid gap-3">
                            {syllabus.map((item) => {
                                const selected = selectedSessions.includes(item.session);
                                return (
                                    <button
                                        key={item.session}
                                        onClick={() => onToggleSession(item.session)}
                                        className={`text-left rounded-2xl border-2 p-4 transition-all ${selected
                                            ? 'bg-[#4D96FF]/10 border-[#4D96FF] shadow-md'
                                            : 'bg-white border-gray-200 hover:border-[#4D96FF]/40'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-[#9094A6]">
                                                    SesiÃ³n {item.session} Ã‚Â· {item.unit || 'Unidad'}
                                                </p>
                                                <p className="text-sm md:text-base font-black text-[#2B2E4A] mt-1">
                                                    {item.topic}
                                                </p>
                                            </div>
                                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-[#4D96FF] border-[#4D96FF] text-white' : 'border-gray-300 text-gray-300'}`}>
                                                <Check className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 bg-white">
                        <div className="bg-[#F8FAFF] rounded-2xl p-4 border border-[#E5ECFF]">
                            <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6] mb-3">
                                Resumen del ensayo
                            </h4>
                            <div className="space-y-2 text-sm font-bold text-[#2B2E4A]">
                                <p>Sesiones elegidas: {selectedDetails.length}</p>
                                <p>Preguntas totales: {totalQuestions}</p>
                                <p>Formato: diagnÃ³stico + repaso guiado</p>
                            </div>
                        </div>

                        <div className="mt-5">
                            <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6] mb-3">
                                Cobertura
                            </h4>
                            {selectedDetails.length === 0 ? (
                                <p className="text-sm text-[#9094A6]">Selecciona al menos una sesiÃ³n para ver la distribuciÃ³n.</p>
                            ) : (
                                <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                                    {selectedDetails.map((item) => (
                                        <div key={item.session} className="rounded-2xl border border-gray-200 p-3">
                                            <p className="text-sm font-black text-[#2B2E4A]">SesiÃ³n {item.session}</p>
                                            <p className="text-xs text-[#9094A6] mt-1">{item.topic}</p>
                                            <p className="text-xs font-black text-[#4D96FF] mt-2">
                                                {distributionMap[item.session] || 0} preguntas asignadas
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onStart}
                            disabled={selectedDetails.length === 0 || isLoading}
                            className={`${clayBtnAction} mt-6 ${selectedDetails.length === 0 || isLoading ? '!bg-gray-300 !border-gray-400 hover:!scale-100 hover:!translate-y-0 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'ARMANDO ENSAYO...' : 'INICIAR PRUEBA PREPARATORIA'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OraclePrepModal = ({
    isOpen,
    onClose,
    subject,
    onChangeSubject,
    session,
    onChangeSession,
    prompt,
    onChangePrompt,
    questionCount,
    onChangeQuestionCount,
    onStart,
    isLoading
}) => {
    if (!isOpen) return null;

    const promptReady = Number(session) > 0 && String(subject || '').trim().length > 0;

    return (
        <div className="fixed inset-0 z-[181] flex items-center justify-center p-4 bg-[#2B2E4A]/60 backdrop-blur-md">
            <div className="bg-[#F4F7FF] w-full max-w-3xl rounded-[32px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)] border-4 border-white">
                <div className="bg-white px-6 py-5 border-b-2 border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-[#2B2E4A]">OrÃ¡culo Matico</h3>
                        <p className="text-sm font-bold text-[#9094A6]">
                            Prueba libre por materia, sesiÃ³n o libro. La IA llena los vacÃ­os si no hay banco.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                                Materia
                            </label>
                            <select
                                value={subject}
                                onChange={(e) => onChangeSubject(e.target.value)}
                                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            >
                                {PREP_EXAM_SUBJECT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                                SesiÃ³n base
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={session}
                                onChange={(e) => onChangeSession(Number(e.target.value) || 1)}
                                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#9094A6] mb-2">
                            Tema, libro o capÃ­tulo
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onChangePrompt(e.target.value)}
                            rows={5}
                            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 font-bold text-[#2B2E4A] outline-none focus:border-[#7C3AED] resize-none"
                            placeholder="Ej: El Principito, capÃ­tulos 1 al 4. Quiero preguntas de comprensiÃ³n, inferencia y vocabulario."
                        />
                    </div>

                    <div className="bg-[#F8FAFF] rounded-2xl p-4 border border-[#E5ECFF]">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6] mb-3">Cantidad de preguntas</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {PREP_EXAM_COUNT_OPTIONS.map((count) => (
                                <button
                                    key={count}
                                    onClick={() => onChangeQuestionCount(count)}
                                    className={`rounded-2xl border-2 px-3 py-3 font-black transition-all ${questionCount === count
                                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-md'
                                        : 'bg-white text-[#64748B] border-gray-200 hover:border-[#7C3AED]/40'
                                        }`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                        <p className="text-sm text-violet-900 leading-relaxed">
                            Tip: escribe un libro, un capÃ­tulo o un tema concreto. Si el banco no alcanza, el OrÃ¡culo usa IA para completar la prueba.
                        </p>
                    </div>

                    <button
                        onClick={onStart}
                        disabled={!promptReady || isLoading}
                        className={`${clayBtnAction} ${!promptReady || isLoading ? '!bg-gray-300 !border-gray-400 hover:!scale-100 hover:!translate-y-0 cursor-not-allowed' : '!bg-[#7C3AED] !border-[#6D28D9] hover:!bg-[#6D28D9]'}`}
                    >
                        {isLoading ? 'ARMANDO ORÃCULO...' : 'CREAR PRUEBA ORÃCULO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PrepExamResultsModal = ({ isOpen, onClose, report, onReview }) => {
    if (!isOpen || !report) return null;

    return (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-[#2B2E4A]/65 backdrop-blur-md">
            <div className="bg-[#F4F7FF] w-full max-w-4xl rounded-[32px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)] border-4 border-white">
                <div className="bg-white px-6 py-5 border-b-2 border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-[#2B2E4A]">DiagnÃ³stico de la prueba</h3>
                        <p className="text-sm font-bold text-[#9094A6]">
                            {report.subject} Ã‚Â· {report.totalCorrect}/{report.totalQuestions} correctas
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-green-700">Correctas</p>
                            <p className="text-3xl font-black text-green-600 mt-2">{report.totalCorrect}</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-red-700">Incorrectas</p>
                            <p className="text-3xl font-black text-red-600 mt-2">{report.totalIncorrect}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-blue-700">PrecisiÃ³n</p>
                            <p className="text-3xl font-black text-blue-600 mt-2">{report.accuracy}%</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-amber-700">Sesiones dÃ©biles</p>
                            <p className="text-3xl font-black text-amber-600 mt-2">{report.weakSessions.length}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 p-5">
                        <h4 className="text-lg font-black text-[#2B2E4A] mb-2">Lectura rÃ¡pida para apoderado</h4>
                        <p className="text-sm text-[#4B5563] leading-relaxed">{report.summary}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                        <div className="bg-white rounded-3xl border border-gray-100 p-5">
                            <h4 className="text-lg font-black text-[#2B2E4A] mb-4">Desglose por sesiÃ³n</h4>
                            <div className="space-y-3">
                                {report.breakdown.map((item) => (
                                    <div key={item.session} className="border border-gray-100 rounded-2xl p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-black text-[#2B2E4A]">SesiÃ³n {item.session}</p>
                                                <p className="text-xs text-[#9094A6] mt-1">{item.topic}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-[#4D96FF]">{item.correct}/{item.total}</p>
                                                <p className="text-xs text-[#9094A6]">{item.accuracy}% acierto</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="bg-white rounded-3xl border border-gray-100 p-5">
                                <h4 className="text-lg font-black text-[#2B2E4A] mb-3">Sesiones para reforzar</h4>
                                {report.weakSessions.length === 0 ? (
                                    <p className="text-sm text-[#4B5563]">No hay sesiones dÃ©biles marcadas. Va muy bien en este bloque.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {report.weakSessions.map((item) => (
                                            <div key={item.session} className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                                                <p className="font-black text-amber-700">SesiÃ³n {item.session}</p>
                                                <p className="text-sm text-[#4B5563] mt-1">{item.topic}</p>
                                                <p className="text-xs font-bold text-amber-700 mt-2">
                                                    {item.incorrect} errores Ã‚Â· foco: {item.focus}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-100 p-5">
                                <h4 className="text-lg font-black text-[#2B2E4A] mb-3">Conceptos que conviene repasar</h4>
                                <div className="flex flex-wrap gap-2">
                                    {report.conceptGaps.length > 0 ? report.conceptGaps.map((concept) => (
                                        <span key={concept} className="px-3 py-2 rounded-full bg-[#EEF4FF] text-[#4D96FF] text-xs font-black border border-[#DCE8FF]">
                                            {concept}
                                        </span>
                                    )) : (
                                        <p className="text-sm text-[#4B5563]">No se detectaron brechas repetidas.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-3xl border border-indigo-100 p-5">
                        <h4 className="text-lg font-black text-[#2B2E4A] mb-3">Plan de repaso sugerido</h4>
                        <div className="space-y-3">
                            {report.reviewPlan.map((step, index) => (
                                <div key={`${step.session}-${index}`} className="bg-white rounded-2xl border border-white/80 p-4">
                                    <p className="font-black text-[#2B2E4A]">SesiÃ³n {step.session} Ã‚Â· {step.topic}</p>
                                    <p className="text-sm text-[#4B5563] mt-1">{step.action}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <button onClick={onReview} className={`${clayBtnAction} !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}>
                            GENERAR REPASO GUIADO
                        </button>
                        <button onClick={onClose} className={`${clayBtnAction} !bg-[#2B2E4A] !border-[#1E293B] hover:!bg-[#1E293B]`}>
                            CERRAR DIAGNÃ³STICO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminNotebookFilesModal = ({
    isOpen,
    onClose,
    files,
    isLoading,
    onRefresh,
    onDelete
}) => {
    if (!isOpen) return null;

    const resolvePublicUrl = (value) => {
        try {
            return new URL(value, window.location.origin).toString();
        } catch {
            return value;
        }
    };

    return (
        <div className="fixed inset-0 z-[195] flex items-center justify-center p-4 bg-[#2B2E4A]/65 backdrop-blur-md">
            <div className="bg-[#F4F7FF] w-full max-w-5xl rounded-[32px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)] border-4 border-white">
                <div className="bg-white px-6 py-5 border-b-2 border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-[#2B2E4A]">Administrador de PDFs</h3>
                        <p className="text-sm font-bold text-[#9094A6]">Ver, abrir y eliminar cuadernos guardados en el VPS</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onRefresh} className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs`}>
                            RECARGAR
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[75vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-[#9094A6]">
                            <Loader className="w-8 h-8 animate-spin mb-3" />
                            <p className="font-bold">Cargando archivos...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="py-16 text-center text-[#9094A6]">
                            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="font-bold">No hay PDFs guardados todavÃ­a.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {files.map((file) => (
                                <div key={file.fileName} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-black text-[#2B2E4A] break-all">{file.fileName}</p>
                                            <p className="text-xs text-[#9094A6] mt-1 break-all">{file.absolutePath}</p>
                                            <div className="flex flex-wrap gap-3 mt-3 text-xs font-bold text-[#4B5563]">
                                                <span>{file.sizeLabel}</span>
                                                <span>{file.updatedAtLabel}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <a
                                                href={resolvePublicUrl(file.publicUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}
                                            >
                                                ABRIR <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={() => onDelete(file)}
                                                className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#FF4B4B] !border-[#D63E3E] hover:!bg-[#D63E3E]`}
                                            >
                                                ELIMINAR <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminGeneratedQuestionsModal = ({
    isOpen,
    onClose,
    items,
    isLoading,
    onRefresh,
    onDelete
}) => {
    if (!isOpen) return null;

    const exportAllJson = () => {
        const fileName = `matico_preguntas_${new Date().toISOString().slice(0, 10)}.json`;
        const payload = {
            exportedAt: new Date().toISOString(),
            count: items.length,
            items
        };
        downloadTextFile(fileName, JSON.stringify(payload, null, 2));
    };

    const exportAllCsv = () => {
        const fileName = `matico_preguntas_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadTextFile(fileName, buildGeneratedQuestionsCsv(items), 'text/csv');
    };

    const exportSingleJson = (item) => {
        const safeName = (item?.id || item?.source_action || 'pregunta')
            .toString()
            .replace(/[^a-zA-Z0-9_-]+/g, '_');
        downloadTextFile(`matico_${safeName}.json`, JSON.stringify(item, null, 2));
    };

    return (
        <div className="fixed inset-0 z-[196] flex items-center justify-center p-4 bg-[#2B2E4A]/65 backdrop-blur-md">
            <div className="bg-[#F4F7FF] w-full max-w-6xl rounded-[32px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)] border-4 border-white">
                <div className="bg-white px-6 py-5 border-b-2 border-gray-100 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-[#2B2E4A]">Banco de preguntas IA</h3>
                        <p className="text-sm font-bold text-[#9094A6]">Descarga o elimina solo las preguntas creadas por Matico</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={exportAllJson} className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}>
                            JSON <Download className="w-4 h-4" />
                        </button>
                        <button onClick={exportAllCsv} className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#2ECC71] !border-[#27AE60] hover:!bg-[#27AE60]`}>
                            CSV <Download className="w-4 h-4" />
                        </button>
                        <button onClick={onRefresh} className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs`}>
                            RECARGAR
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[75vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-[#9094A6]">
                            <Loader className="w-8 h-8 animate-spin mb-3" />
                            <p className="font-bold">Cargando banco de preguntas...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-16 text-center text-[#9094A6]">
                            <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="font-bold">No hay preguntas generadas todavÃ­a.</p>
                            <p className="text-sm mt-2">Cuando Matico cree quizzes o pruebas, aparecerÃ¡n aquÃ­ para descargarlas o borrarlas.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.id || item.signature} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                                        {item.subject || 'SIN ASIGNATURA'}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                        {item.source_action || 'generated'}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                                                        SesiÃ³n {item.source_session || 'N/A'}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        {item.occurrences || 1} veces
                                                    </span>
                                                </div>
                                                <p className="font-black text-[#2B2E4A] text-lg leading-snug whitespace-pre-wrap">{item.question}</p>
                                                <p className="text-xs text-[#9094A6] mt-2 break-all">{item.source_topic || 'Sin tema'}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => exportSingleJson(item)}
                                                    className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}
                                                >
                                                    JSON <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(item)}
                                                    className={`${clayBtnAction} !w-auto !py-2 !px-4 text-xs !bg-[#FF4B4B] !border-[#D63E3E] hover:!bg-[#D63E3E]`}
                                                >
                                                    ELIMINAR <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {['A', 'B', 'C', 'D'].map((letter) => (
                                                <div key={letter} className={`rounded-2xl border px-4 py-3 ${item.correct_answer === letter ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{letter}</p>
                                                    <p className="text-sm font-bold text-[#2B2E4A] whitespace-pre-wrap">{item.options?.[letter] || 'Sin texto'}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-2xl bg-[#F8FAFF] border border-[#E2E8F0] p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Respuesta correcta</p>
                                            <p className="text-sm font-bold text-[#2B2E4A]">{item.correct_answer || 'A'}</p>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3 mb-1">ExplicaciÃ³n</p>
                                            <p className="text-sm text-[#4B5563] whitespace-pre-wrap">{item.explanation || 'Sin explicaciÃ³n.'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [isCallingN8N, setIsCallingN8N] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(""); // Helper state for multi-stage loading
    const [loadingDiagnostics, setLoadingDiagnostics] = useState(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [readingModalOpen, setReadingModalOpen] = useState(false);
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [activeWebhookUrl, setActiveWebhookUrl] = useState(N8N_URLS.production);

    const createLoadingDiagnostics = (flow, options = {}) => {
        const publishToUi = options.publishToUi !== false;
        const startedAt = Date.now();
        const steps = [];
        let currentStepIndex = -1;

        const snapshot = (extra = {}) => {
            const finishedAt = extra.finishedAt || null;
            const totalMs = extra.totalMs ?? ((finishedAt || Date.now()) - startedAt);
            const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex]?.label || null : null;
            const data = {
                flow,
                startedAt,
                finishedAt,
                totalMs,
                currentStep,
                steps: steps.map((step) => ({ ...step })),
                ...extra
            };

            if (publishToUi) {
                setLoadingDiagnostics(data);
            }

            return data;
        };

        const closeActiveStep = (status = 'completed') => {
            if (currentStepIndex < 0) return;
            const current = steps[currentStepIndex];
            if (!current || current.durationMs != null) return;
            const finishedAt = Date.now();
            steps[currentStepIndex] = {
                ...current,
                status,
                finishedAt,
                durationMs: finishedAt - current.startedAt
            };
            currentStepIndex = -1;
        };

        const begin = (label, meta = {}) => {
            closeActiveStep('completed');
            steps.push({
                label,
                status: 'running',
                startedAt: Date.now(),
                durationMs: null,
                ...meta
            });
            currentStepIndex = steps.length - 1;
            return snapshot();
        };

        const finish = (extra = {}) => {
            closeActiveStep('completed');
            const finishedAt = Date.now();
            const data = snapshot({
                finishedAt,
                totalMs: finishedAt - startedAt,
                ...extra
            });
            console.log(`[TIMING][CLIENT][${flow}]`, data);
            return data;
        };

        const fail = (error) => {
            closeActiveStep('failed');
            const finishedAt = Date.now();
            const data = snapshot({
                finishedAt,
                totalMs: finishedAt - startedAt,
                error: error?.message || String(error || 'Error')
            });
            console.error(`[TIMING][CLIENT][${flow}]`, data);
            return data;
        };

        if (publishToUi) {
            setLoadingDiagnostics({
                flow,
                startedAt,
                finishedAt: null,
                totalMs: 0,
                currentStep: null,
                steps: []
            });
        }

        return { begin, finish, fail };
    };

    // --- DATABASE INTEGRATION START ---

    // --- AUTHENTICATION STATE ---
    const [currentUser, setCurrentUser] = useState(null);
    const [authChecking, setAuthChecking] = useState(true);

    // Check for saved session
    useEffect(() => {
        const savedUser = localStorage.getItem('MATICO_USER');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("Error parsing saved user", e);
                localStorage.removeItem('MATICO_USER');
            }
        }
        setAuthChecking(false);
    }, []);

    useEffect(() => {
        if (!isCallingN8N) {
            setLoadingDiagnostics(null);
        }
    }, [isCallingN8N]);

    const handleLogin = (userData) => {
        console.log("Logged in:", userData);
        localStorage.removeItem('MATICO_COMPLETED_SESSIONS');
        localStorage.removeItem('MATICO_QUIZ_PROGRESS');
        setCurrentUser(userData);
        localStorage.setItem('MATICO_USER', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('MATICO_USER');
        localStorage.removeItem('MATICO_COMPLETED_SESSIONS');
        localStorage.removeItem('MATICO_QUIZ_PROGRESS');
        window.location.reload(); // Clean state reset
    };

    // --- DATABASE INTEGRATION START ---
    // Use dynamic USER_ID if available, else null
    const USER_ID = currentUser ? currentUser.user_id : null;
    const completedSessionsStorageKey = USER_ID ? `MATICO_COMPLETED_SESSIONS_${USER_ID}` : 'MATICO_COMPLETED_SESSIONS_ANON';
    const quizProgressStorageKey = USER_ID ? `MATICO_QUIZ_PROGRESS_${USER_ID}` : 'MATICO_QUIZ_PROGRESS_ANON';
    const [currentSubject, setCurrentSubject] = useState("MATEMATICA");
    const ACTIVE_GRADE = '1medio';
    const [userProfile, setUserProfile] = useState({
        xp: 0,
        streak: 0,
        level: 1,
        username: 'Estudiante',
        adaptive: null,
        curriculum_context: null
    });
    const ADMIN_EMAILS = ['joseantonio.olguinr@gmail.com'];
    const isAdminUser = ADMIN_EMAILS.includes((currentUser?.email || '').toLowerCase());

    // 1. Fetch Profile on Load
    const fetchProfile = async () => {
        if (!USER_ID) return;
        
        // TIMEOUT: Abortar si tarda mÃ¡s de 3 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
            console.log("[PROFILE] Fetching latest profile for:", USER_ID);
            const response = await fetch(`${activeWebhookUrl}?accion=get_profile&user_id=${USER_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ accion: 'get_profile', user_id: USER_ID, grade: ACTIVE_GRADE, subject: currentSubject })
            });

            clearTimeout(timeoutId);
            const text = await response.text();
            const data = parseN8NResponse(text);

            console.log("[PROFILE] Raw data received:", data);

            if (data && (data.xp !== undefined || data.puntos !== undefined)) {
                // Handle different field names if necessary (e.g. pontos, xp, puntos)
                const normalized = {
                    xp: data.xp || data.puntos || 0,
                    streak: data.streak || data.racha || 0,
                    level: data.level || data.nivel || 1,
                    username: data.username || data.nombre || currentUser?.username || 'Estudiante',
                    adaptive: data.adaptive || null,
                    curriculum_context: data.curriculum_context || null,
                    grade: data.grade || ACTIVE_GRADE,
                    subject: data.subject || currentSubject
                };
                setUserProfile(normalized);
                console.log("[PROFILE] Updated state:", normalized);
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log("[PROFILE] Timeout - usando datos locales");
            } else {
                console.error("Error fetching profile:", e);
            }
            // Fallback: usar datos del usuario local si existe
            if (currentUser?.username) {
                setUserProfile(prev => ({
                    ...prev,
                    username: currentUser.username,
                    xp: prev.xp || 0,
                    streak: prev.streak || 0,
                    level: prev.level || 1
                }));
            }
        }
    };

    useEffect(() => {
        if (USER_ID) fetchProfile();
    }, [activeWebhookUrl, USER_ID, currentSubject]);

    // 2. Save Progress Function
    const saveProgress = async (type, payload) => {
        console.log("SAVING PROGRESS:", type, payload);

        // Optimistic UI Update for XP
        if (type === 'xp_gain' || type === 'theory_completed' || type === 'phase_completed' || type === 'prep_exam_completed' || type === 'prep_exam_reviewed') {
            const amount = payload.xp_reward || payload.amount || 0;
            setUserProfile(prev => ({ ...prev, xp: (prev.xp || 0) + amount }));
        }

        try {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'save_progress', // Unified to 'accion'
                    user_id: USER_ID,
                    email: currentUser?.email, // Added for n8n mapping
                    data: {
                        type: type,
                        subject: payload.subject || currentSubject,
                        grade: ACTIVE_GRADE,
                        topic: payload.topic || TODAYS_SESSION.topic,
                        timestamp: new Date().toISOString(),
                        ...payload
                    }
                })
            });
            const resultText = await response.text();
            console.log("[SAVE_PROGRESS_RESPONSE]", {
                type,
                ok: response.ok,
                status: response.status,
                body: resultText
            });

            // After successful save, refresh full profile from Sheet to ensure sync
            setTimeout(() => fetchProfile(), 1500); // Small delay to allow Sheet update
        } catch (e) {
            console.error("Error saving progress:", e);
        }
    };
    // --- DATABASE INTEGRATION END ---

    // NEW: Function to open relevant modal (Video vs Reading)
    const handleStartSession = () => {
        if (currentSubject !== 'HISTORIA' && TODAYS_SESSION.readingContent) {
            setReadingModalOpen(true);
        } else {
            setVideoModalOpen(true);
        }
    };

    const handleReadingFinish = () => {
        setReadingModalOpen(false);
        saveProgress('reading_completed', { 
            title: TODAYS_SESSION.readingTitle, 
            xp_reward: 20, 
            session: TODAYS_SESSION.session,
            subject: currentSubject
        });

        // Automatically open the Doubt modal with context
        callAgent(
            currentSubject,
            'answer_doubts',
            `[CONTEXTO LECTURA]: ${TODAYS_SESSION.readingTitle}\n\n${TODAYS_SESSION.readingContent}\n\nGenera 3 preguntas de comprensiÃ³n lectora sobre este texto para el estudiante.`,
            null,
            null,
            `Generar control de lectura para: "${TODAYS_SESSION.readingTitle}"`
        );
    };
    const [askModalOpen, setAskModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [aiContent, setAiContent] = useState("");
    const [apiJson, setApiJson] = useState(null);
    const [dailyRoute, setDailyRoute] = useState(DEFAULT_DAILY_ROUTE);
    const [todayIndex, setTodayIndex] = useState(0);

    // SERVER PROGRESS STATE
    const [serverProgress, setServerProgress] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState(() => !!USER_ID);

    // NOTIFICATION PREFERENCES
    const [_remindersEnabled, setRemindersEnabled] = useState(true);
    const [progressReportsEnabled, setProgressReportsEnabled] = useState(true);
    const [_isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

    const updateNotificationPrefs = async (type, val) => {
        setIsUpdatingPrefs(true);
        // Optimistic UI
        if (type === 'reminders') setRemindersEnabled(val);
        else setProgressReportsEnabled(val);

        try {
            await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'update_preferences',
                    user_id: USER_ID,
                    email: currentUser?.email, // Added for n8n mapping
                    type: type,
                    enabled: val
                })
            });
            console.log(`[PREFS] ${type} updated to ${val}`);
        } catch (e) {
            console.error("Error updating prefs:", e);
        } finally {
            setIsUpdatingPrefs(false);
        }
    };
    const [quizStats, setQuizStats] = useState({ correct: 0, incorrect: 0, total: 0 });
    const [quizLevel, setQuizLevel] = useState(1); // NEW: Adaptive Level State
    const [quizQuestionNumber, setQuizQuestionNumber] = useState(1); // NEW: Persistence State
    const [lastUserQuery, setLastUserQuery] = useState("");

    //NEW: CONTEXT STATE FOR VIDEO/PASTE
    const [doubtContext, setDoubtContext] = useState(null);

    // INTERACTIVE QUIZ STATE
    const [showInteractiveQuiz, setShowInteractiveQuiz] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);

    // PROGRESSIVE QUIZ STATE - SISTEMA JAPONÃ³0S/KAIZEN (3 FASES Ã³ 15 PREGUNTAS = 45 TOTAL)
    const [currentQuizPhase, setCurrentQuizPhase] = useState(1); // 1, 2, or 3 (Fase actual)
    const [backgroundQuestionsQueue, setBackgroundQuestionsQueue] = useState([]);
    const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);
    const backgroundTaskRef = useRef(null);
    const normalQuizBatchRef = useRef({
        level: '',
        nextBatchIndex: 0,
        totalBatches: QUIZ_BATCHES_PER_PHASE,
        nextPromise: null
    });
    const [allWrongAnswers, setAllWrongAnswers] = useState([]); // Acumula errores de las 3 fases

    // THEORY STATE - TEORÃƒÂA LÃ³aDICA ANTES DE CADA SUB-NIVEL
    const [showTheoryModal, setShowTheoryModal] = useState(false);
    const [theoryContent, _setTheoryContent] = useState("");
    const [theoryTitle, _setTheoryTitle] = useState("");
    const [showTheoryNotebookMission, setShowTheoryNotebookMission] = useState(false);
    const [isTheoryNotebookMandatory, setIsTheoryNotebookMandatory] = useState(false);
    const [pendingQuizQuestions, setPendingQuizQuestions] = useState([]); // Preguntas esperando despuÃ©s de la teorÃ­a
    const [missedSessionAlert, setMissedSessionAlert] = useState(null); // Alerta de "Ponerse al dÃ­a"
    const [showPrepExamSetup, setShowPrepExamSetup] = useState(false);
    const [showOraclePrepModal, setShowOraclePrepModal] = useState(false);
    const [selectedPrepSessions, setSelectedPrepSessions] = useState([]);
    const [prepExamOracleSubject, setPrepExamOracleSubject] = useState('MATEMATICA');
    const [prepExamOracleSession, setPrepExamOracleSession] = useState(1);
    const [prepExamOraclePrompt, setPrepExamOraclePrompt] = useState('');
    const [prepExamOracleQuestionCount, setPrepExamOracleQuestionCount] = useState(15);
    const [isPrepExamMode, setIsPrepExamMode] = useState(false);
    const [prepExamConfig, setPrepExamConfig] = useState(null);
    const [prepExamQuestions, setPrepExamQuestions] = useState([]);
    const [prepExamReport, setPrepExamReport] = useState(null);
    const [showPrepExamResults, setShowPrepExamResults] = useState(false);
    const [_prepExamLoadedCount, setPrepExamLoadedCount] = useState(0);
    const prepExamBatchRef = useRef(0);
    const prepExamNextBatchPromiseRef = useRef(null);
    const prepExamBackgroundLoadRef = useRef(false);
    const [showAdminFilesModal, setShowAdminFilesModal] = useState(false);
    const [adminNotebookFiles, setAdminNotebookFiles] = useState([]);
    const [isLoadingAdminFiles, setIsLoadingAdminFiles] = useState(false);
    const [showAdminGeneratedQuestionsModal, setShowAdminGeneratedQuestionsModal] = useState(false);
    const [adminGeneratedQuestions, setAdminGeneratedQuestions] = useState([]);
    const [isLoadingAdminGeneratedQuestions, setIsLoadingAdminGeneratedQuestions] = useState(false);

    // INITIAL SETUP: Resolve current subject according to Weekly Plan
    useEffect(() => {
        const { subject, index, isMissed, missedSubject } = resolveMaticoPlan();
        console.log(`[MATICO] Startup Plan: ${subject} Session ${index + 1} | Missed: ${isMissed}`);
        setCurrentSubject(subject);
        if (!USER_ID) {
            setTodayIndex(index);
        }

        if (isMissed) {
            const days = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
            const todayDayName = days[new Date().getDay()];
            setMissedSessionAlert({
                subject: missedSubject,
                session: index + 1,
                todaySubject: (WEEKLY_PLAN.find(p => p.day === (new Date()).getDay())?.subject || 'LENGUAJE'),
                todayName: todayDayName
            });
        }
    }, []);

    // FETCH SERVER PROGRESS ON LOAD
    useEffect(() => {
        const fetchProgress = async () => {
            if (!USER_ID) return;
            
            // TIMEOUT: Abortar si tarda mÃ¡s de 4 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            try {
                setLoadingProgress(true);
                console.log('[MATICO] Fetching progress from server...');

                const response = await fetch('/webhook/MATICO', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        action: 'get_progress',
                        user_id: USER_ID,
                        subject: currentSubject
                    })
                });

                clearTimeout(timeoutId);
                const data = await response.json();
                console.log('[MATICO] Server progress loaded:', data);
                setServerProgress(data);

                // Update todayIndex based on server's next_session
                if (data && data.next_session) {
                    const newIndex = Math.max(0, data.next_session - 1); // Convert to 0-indexed
                    console.log(`[MATICO] Setting session index to ${newIndex} (Session ${data.next_session})`);
                    setTodayIndex(newIndex);
                }

                // SYNC: Restaurar progreso de fases en localStorage desde el servidor
                // Esto hace que funcione al cambiar de navegador
                if (data && data.current_session_in_progress > 0 && data.current_phase > 0) {
                    const sessionNum = data.current_session_in_progress;
                    const phase = data.current_phase;
                    const subj = currentSubject;
                    const key = `${subj}_session_${sessionNum}`;

                    const existing = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');

                    // Solo restaurar si localStorage no tiene datos para esta sesiÃ³n
                    if (!existing[key] || !existing[key].completedPhases || existing[key].completedPhases.length < phase) {
                        const completedPhases = [];
                        for (let i = 1; i <= phase; i++) completedPhases.push(i);

                        existing[key] = {
                            completedPhases: completedPhases,
                            currentPhase: phase < 3 ? phase + 1 : 3,
                            scores: existing[key]?.scores || {},
                            restoredFromServer: true,
                            lastUpdated: new Date().toISOString()
                        };

                        localStorage.setItem(quizProgressStorageKey, JSON.stringify(existing));
                        console.log(`[SYNC] Ã³x Progreso restaurado desde servidor: ${key} Ã³  Fase ${phase} completada, siguiente: ${phase + 1}`);
                    }
                }

                if (data && data.current_session_in_progress > 0 && (data.current_theory_started || data.current_theory_completed)) {
                    const sessionNum = data.current_session_in_progress;
                    const key = `${currentSubject}_session_${sessionNum}`;
                    const existing = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');
                    const current = existing[key] || {
                        completedPhases: [],
                        currentPhase: 1,
                        scores: {}
                    };

                    existing[key] = {
                        ...current,
                        theoryStarted: Boolean(current.theoryStarted || data.current_theory_started || data.current_theory_completed),
                        theoryCompleted: Boolean(current.theoryCompleted || data.current_theory_completed),
                        lastUpdated: new Date().toISOString()
                    };

                    localStorage.setItem(quizProgressStorageKey, JSON.stringify(existing));
                }

                // SYNC: Marcar sesiones completadas en localStorage
                if (data && data.last_completed_session > 0) {
                    const completedKey = completedSessionsStorageKey;
                    const stored = localStorage.getItem(completedKey);
                    let completed = [];

                    // Fallback para datos corruptos
                    try {
                        completed = stored ? JSON.parse(stored) : [];
                        if (!Array.isArray(completed) && typeof stored === 'string') {
                            completed = stored.split(',').filter(s => s.trim() !== '');
                        }
                    } catch (e) {
                        if (typeof stored === 'string') {
                            completed = stored.split(',').filter(s => s.trim() !== '');
                        }
                    }

                    let changed = false;
                    for (let s = 1; s <= data.last_completed_session; s++) {
                        const sessionKey = `${currentSubject}_${s}`;
                        if (!(completed || []).includes(sessionKey)) {
                            completed.push(sessionKey);
                            changed = true;
                        }
                    }

                    if (changed) {
                        localStorage.setItem(completedKey, JSON.stringify(completed));
                        console.log(`[SYNC] Ã³x Sesiones completadas sincronizadas:`, completed);
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('[MATICO] Timeout cargando progreso - usando localStorage');
                } else {
                    console.error('[MATICO] Error fetching progress:', error);
                }
                // Fallback to Matico Plan logic only if no server progress was loaded
                if (!serverProgress?.next_session) {
                    const { index } = resolveMaticoPlan();
                    setTodayIndex(index);
                }
            } finally {
                setLoadingProgress(false);
            }
        };

        if (USER_ID) fetchProgress();
    }, [currentSubject, USER_ID]); // Reload when subject changes or user logs in


    // DYNAMIC SYLLABUS
    const ACTIVE_SYLLABUS = getSyllabusForSubject(currentSubject) || MATH_SYLLABUS;

    useEffect(() => {
        const validSessions = new Set(ACTIVE_SYLLABUS.map(item => item.session));
        setSelectedPrepSessions(prev => prev.filter(session => validSessions.has(session)));
    }, [currentSubject]);

    console.log("APP RENDER:", { currentSubject, todayIndex, syllabusLen: ACTIVE_SYLLABUS?.length });

    const RAW_SESSION = (ACTIVE_SYLLABUS && ACTIVE_SYLLABUS[todayIndex]) || (ACTIVE_SYLLABUS && ACTIVE_SYLLABUS[0]);
    const TODAYS_SESSION = RAW_SESSION || {
        session: 0,
        unit: 'Cargando...',
        topic: 'Esperando datos',
        videoTitle: '',
        videoLink: '',
        readingTitle: '',
        readingContent: ''
    };

    const TODAYS_SUBJECT = {
        name: TODAYS_SESSION.unit || 'Sin Unidad',
        color: currentSubject === 'LENGUAJE' ? '#FF9F43' : (currentSubject === 'FISICA' ? '#9D4EDD' : (currentSubject === 'QUIMICA' ? '#E84393' : (currentSubject === 'BIOLOGIA' ? '#2ECC71' : (currentSubject === 'HISTORIA' ? '#E67E22' : '#4D96FF')))),
        icon: currentSubject === 'LENGUAJE' ? BookOpen : (currentSubject === 'FISICA' ? Atom : (currentSubject === 'QUIMICA' ? FlaskConical : (currentSubject === 'BIOLOGIA' ? Dna : (currentSubject === 'HISTORIA' ? Globe : Brain)))),
        oa_title: `SesiÃ³n ${TODAYS_SESSION.session}: ${TODAYS_SESSION.topic}`,
        video_link: TODAYS_SESSION.videoLink
    };

    const adaptiveSnapshot = userProfile?.adaptive || null;
    const adaptiveWeakSessions = Array.isArray(adaptiveSnapshot?.weakSessions) ? adaptiveSnapshot.weakSessions : [];
    const adaptiveNextAction = adaptiveSnapshot?.nextAction || 'Sigue con la ruta de hoy para ir construyendo dominio.';
    const adaptiveGradeLabel = userProfile?.curriculum_context?.grade_label || '1Ã‚Â° medio';
    const getAdaptiveWeakSessionTopic = (item) => {
        const topic = repairText(item?.topic || item?.source_topic || '');
        return topic || `Sesion ${item?.session || ''}`;
    };
    const primaryAdaptiveWeakSession = adaptiveWeakSessions.find((item) => getAdaptiveWeakSessionTopic(item) && item?.session);
    const adaptiveNextActionLabel = (() => {
        const baseLabel = repairText(adaptiveNextAction);
        const primaryTopic = primaryAdaptiveWeakSession ? getAdaptiveWeakSessionTopic(primaryAdaptiveWeakSession) : '';

        if (!primaryTopic) return baseLabel;
        if (baseLabel.toLowerCase().includes(primaryTopic.toLowerCase())) return baseLabel;
        if (/^reforzar sesi[oÃ³]n\s+\d+:?$/i.test(baseLabel)) {
            return `${baseLabel.replace(/:?$/, ':')} ${primaryTopic}`;
        }
        return baseLabel;
    })();

    const adaptiveWeakTopicsDescription = (() => {
        if (adaptiveWeakSessions.length === 0) return 'Todas las sesiones estÃ¡n al dÃ­a. Â¡Sigue asÃ­!';
        const topics = adaptiveWeakSessions.slice(0, 3).map(item => {
            const topic = getAdaptiveWeakSessionTopic(item);
            return topic || `SesiÃ³n ${item?.session || '?'}`;
        }).filter(Boolean);
        if (topics.length === 0) return 'La app recuerda quÃ© sesiones le cuestan mÃ¡s y arma el prÃ³ximo repaso desde ahÃ­.';
        return `Debes repasar: ${topics.join(', ')}. Completa estas sesiones para avanzar sin huecos.`;
    })();

    const todaysSessionStorageKey = `${currentSubject}_${TODAYS_SESSION.session}`;
    const completedSessionsForSubject = (() => {
        try {
            const storedCompleted = localStorage.getItem(completedSessionsStorageKey);
            return storedCompleted ? JSON.parse(storedCompleted) : [];
        } catch {
            return [];
        }
    })();
    const isTodaysSessionCompleted = completedSessionsForSubject.includes(todaysSessionStorageKey);
    const todaysSessionCtaLabel = isCallingN8N
        ? 'CARGANDO...'
        : (isTodaysSessionCompleted
            ? `REPASAR SESIÃƒâ€œN ${TODAYS_SESSION.session}`
            : `COMPLETAR SESIÃƒâ€œN ${TODAYS_SESSION.session}`);

    const openPrepExamSetup = (seedSessions = []) => {
        setPrepExamReport(null);
        setShowPrepExamResults(false);
        setPrepExamOracleSubject(currentSubject);
        setPrepExamOracleSession(TODAYS_SESSION.session || 1);
        setPrepExamOraclePrompt('');
        setPrepExamOracleQuestionCount(15);
        const normalizedSeeds = [...new Set((seedSessions || []).map(Number).filter(Boolean))].sort((a, b) => a - b);
        setSelectedPrepSessions(prev => (
            normalizedSeeds.length > 0
                ? normalizedSeeds
                : (prev.length > 0 ? prev : [TODAYS_SESSION.session])
        ));
        setShowPrepExamSetup(true);
    };

    const togglePrepSession = (sessionNumber) => {
        setSelectedPrepSessions(prev => (
            prev.includes(sessionNumber)
                ? prev.filter(item => item !== sessionNumber)
                : [...prev, sessionNumber].sort((a, b) => a - b)
        ));
    };

    const buildPrepExamReport = (questions, wrongAnswers, config) => {
        const wrongKeySet = new Set(
            (wrongAnswers || []).map((item) => `${item.question}__${item.source_session || ''}`)
        );

        const grouped = new Map();
        questions.forEach((question) => {
            const session = question.source_session || 0;
            const topic = question.source_topic || `SesiÃ³n ${session}`;
            if (!grouped.has(session)) {
                grouped.set(session, {
                    session,
                    topic,
                    total: 0,
                    incorrect: 0
                });
            }

            const bucket = grouped.get(session);
            bucket.total += 1;

            if (wrongKeySet.has(`${question.question}__${session}`)) {
                bucket.incorrect += 1;
            }
        });

        const breakdown = Array.from(grouped.values())
            .map((item) => ({
                ...item,
                correct: item.total - item.incorrect,
                accuracy: item.total > 0 ? Math.round(((item.total - item.incorrect) / item.total) * 100) : 0
            }))
            .sort((a, b) => a.session - b.session);

        const weakSessions = breakdown
            .filter((item) => item.incorrect > 0)
            .sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy)
            .slice(0, 3)
            .map((item) => ({
                ...item,
                focus: item.accuracy < 50 ? 'reestudiar la base' : 'repasar y practicar otra vez'
            }));

        const conceptGaps = Array.from(new Set(
            (wrongAnswers || [])
                .map((item) => item.source_topic)
                .filter(Boolean)
        )).slice(0, 6);

        const totalIncorrect = wrongAnswers.length;
        const totalCorrect = questions.length - totalIncorrect;
        const accuracy = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;

        const summary = weakSessions.length > 0
            ? `Las mayores dificultades quedaron concentradas en ${weakSessions.map(item => `la sesiÃ³n ${item.session}`).join(', ')}. Conviene volver a esos contenidos antes de la prueba y luego repetir un mini ensayo corto.`
            : 'El ensayo saliÃ³ muy sÃ³lido. Solo conviene una pasada rÃ¡pida de repaso antes de la evaluaciÃ³n real.';

        const reviewPlan = (weakSessions.length > 0 ? weakSessions : breakdown.slice(0, 2)).map((item) => ({
            session: item.session,
            topic: item.topic,
            action: item.incorrect > 0
                ? `Volver a la sesiÃ³n, releer la teorÃ­a y resolver 5 preguntas extra centradas en ${item.topic}.`
                : `Mantener fresca esta sesiÃ³n con un repaso breve de conceptos clave.`
        }));

        return {
            subject: config.subject,
            sessions: config.sessions,
            totalQuestions: questions.length,
            totalCorrect,
            totalIncorrect,
            accuracy,
            breakdown,
            weakSessions,
            conceptGaps,
            reviewPlan,
            summary
        };
    };

    const startPrepExam = async (overrides = {}) => {
        const subject = overrides.subject || currentSubject;
        const selectedSourceSessions = overrides.sessions || selectedPrepSessions;
        const sortedSessions = [...selectedSourceSessions].map(Number).filter(Boolean).sort((a, b) => a - b);
        const selectedDetails = overrides.sessionDetails || ACTIVE_SYLLABUS.filter(item => sortedSessions.includes(item.session));
        const questionCount = Number(overrides.questionCount) || 45;

        if (selectedDetails.length === 0) {
            alert('Selecciona al menos una sesiÃ³n para preparar la prueba.');
            return;
        }

        setIsCallingN8N(true);
        setLoadingMessage('Armando la primera tanda de 5 preguntas...');
        const prepExamDiagnostics = createLoadingDiagnostics('prep_exam_first_batch');

        try {
            const totalBatches = Math.ceil(questionCount / 5);
            const config = {
                subject,
                sessions: sortedSessions,
                questionCount,
                totalBatches,
                topics: selectedDetails.map(item => item.topic),
                sessionDetails: selectedDetails.map(item => ({
                    session: item.session,
                    topic: item.topic,
                    readingContent: item.readingContent || ''
                }))
            };

            prepExamDiagnostics.begin('Guardando inicio de la prueba');
            await saveProgress('prep_exam_started', {
                subject,
                grade: ACTIVE_GRADE,
                session: sortedSessions.join(','),
                selected_sessions: sortedSessions.join(','),
                topic: selectedDetails.map(item => `S${item.session}: ${item.topic}`).join(' | '),
                question_count: questionCount,
                xp_reward: 0
            });

            setLoadingMessage('Pidiendo la primera tanda al servidor...');
            prepExamDiagnostics.begin('Esperando primera tanda del servidor');
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_prep_exam_batch',
                    user_id: USER_ID,
                    subject,
                    grade: ACTIVE_GRADE,
                    sessions: sortedSessions,
                    topics: selectedDetails.map(item => item.topic),
                    batch_index: 0,
                    batch_size: 5,
                    total_batches: totalBatches,
                    mode: 'diagnostic_review'
                })
            });

            setLoadingMessage('Procesando la primera tanda...');
            prepExamDiagnostics.begin('Procesando respuesta de la primera tanda');
            const text = await response.text();
            const parsed = parseN8NResponse(text);
            const firstBatchQuestions = (parsed.questions || []).map((question, index) => ({
                ...question,
                source_session: Number(question.source_session) || selectedDetails[index % selectedDetails.length]?.session || sortedSessions[0],
                source_topic: question.source_topic || selectedDetails.find(item => item.session === Number(question.source_session))?.topic || selectedDetails[index % selectedDetails.length]?.topic || ''
            }));

            if (!firstBatchQuestions.length) {
                throw new Error('La IA no devolviÃ³ preguntas vÃ¡lidas para la primera tanda.');
            }

            prepExamDiagnostics.finish({
                questionCount: firstBatchQuestions.length,
                serverTimings: parsed?.timings || null
            });

            prepExamBatchRef.current = 1;
            prepExamNextBatchPromiseRef.current = null;
            prepExamBackgroundLoadRef.current = false;
            setPrepExamConfig(config);
            setPrepExamQuestions(firstBatchQuestions);
            setPrepExamLoadedCount(firstBatchQuestions.length);
            setPrepExamReport(null);
            setShowPrepExamSetup(false);
            setIsPrepExamMode(true);
            setQuizQuestions(firstBatchQuestions);
            setShowInteractiveQuiz(true);
            setLoadingMessage('');
            setIsCallingN8N(false);

            if (totalBatches > 1) {
                prepExamBackgroundLoadRef.current = true;
                prepExamNextBatchPromiseRef.current = fetch(activeWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'generate_prep_exam_batch',
                        user_id: USER_ID,
                        subject,
                        grade: ACTIVE_GRADE,
                        sessions: sortedSessions,
                        topics: selectedDetails.map(item => item.topic),
                        batch_index: 1,
                        batch_size: 5,
                        total_batches: totalBatches,
                        mode: 'diagnostic_review'
                    })
                })
                    .then(async (batchResponse) => {
                        const batchText = await batchResponse.text();
                        return parseN8NResponse(batchText);
                    })
                    .catch((error) => {
                        console.error('[PREP_EXAM] Error precargando siguiente tanda:', error);
                        return null;
                    });
            }
            return;
        } catch (error) {
            prepExamDiagnostics.fail(error);
            console.error('[PREP_EXAM] Error iniciando prueba:', error);
            alert(`No pudimos generar la prueba preparatoria. ${error.message || 'Intenta nuevamente.'}`);
        } finally {
            setLoadingMessage('');
            setIsCallingN8N(false);
        }
    };

    const startOraclePrepExam = async () => {
        const subject = prepExamOracleSubject || currentSubject;
        const session = Math.max(1, Number(prepExamOracleSession) || 1);
        const prompt = String(prepExamOraclePrompt || '').trim();
        const topic = prompt || `${subject} - Sesion ${session}`;
        const questionCount = PREP_EXAM_COUNT_OPTIONS.includes(prepExamOracleQuestionCount)
            ? prepExamOracleQuestionCount
            : 15;

        setShowOraclePrepModal(false);
        setShowPrepExamSetup(false);
        setCurrentSubject(subject);
        await startPrepExam({
            subject,
            questionCount,
            sessions: [session],
            sessionDetails: [{
                session,
                topic,
                readingContent: prompt
            }]
        });
    };

    const requestNextPrepExamBatch = async () => {
        if (!prepExamConfig) return [];
        const nextBatchIndex = prepExamBatchRef.current;
        const totalBatches = prepExamConfig.totalBatches || Math.ceil((prepExamConfig.questionCount || 45) / 5);

        if (nextBatchIndex >= totalBatches) return [];

        let parsed = null;
        if (prepExamNextBatchPromiseRef.current) {
            parsed = await prepExamNextBatchPromiseRef.current;
        } else {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_prep_exam_batch',
                    user_id: USER_ID,
                    subject: prepExamConfig.subject,
                    grade: ACTIVE_GRADE,
                    sessions: prepExamConfig.sessions,
                    topics: prepExamConfig.sessionDetails.map(item => item.topic),
                    batch_index: nextBatchIndex,
                    batch_size: 5,
                    total_batches: totalBatches,
                    mode: 'diagnostic_review'
                })
            });
            const text = await response.text();
            parsed = parseN8NResponse(text);
        }

        prepExamBatchRef.current += 1;
        const nextQuestions = (parsed?.questions || []).map((question, index) => ({
            ...question,
            source_session: Number(question.source_session) || prepExamConfig.sessions[index % prepExamConfig.sessions.length],
            source_topic: question.source_topic || prepExamConfig.sessionDetails.find(item => item.session === Number(question.source_session))?.topic || ''
        }));

        if (nextQuestions.length > 0) {
            setPrepExamQuestions(prev => [...prev, ...nextQuestions]);
            setPrepExamLoadedCount(prev => prev + nextQuestions.length);
        }

        if (nextBatchIndex + 1 < totalBatches) {
            prepExamNextBatchPromiseRef.current = fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_prep_exam_batch',
                    user_id: USER_ID,
                    subject: prepExamConfig.subject,
                    grade: ACTIVE_GRADE,
                    sessions: prepExamConfig.sessions,
                    topics: prepExamConfig.sessionDetails.map(item => item.topic),
                    batch_index: nextBatchIndex + 1,
                    batch_size: 5,
                    total_batches: totalBatches,
                    mode: 'diagnostic_review'
                })
            })
                .then(async (batchResponse) => parseN8NResponse(await batchResponse.text()))
                .catch((error) => {
                    console.error('[PREP_EXAM] Error precargando siguiente tanda:', error);
                    return null;
                });
        } else {
            prepExamNextBatchPromiseRef.current = null;
        }

        return nextQuestions;
    };

    const requestPrepExamReview = async () => {
        if (!prepExamReport || !prepExamConfig) return;

        setIsCallingN8N(true);
        setLoadingMessage('Generando repaso guiado de las sesiones mÃ¡s dÃ©biles...');

        try {
            const weakSessions = prepExamReport.weakSessions.map(item => item.session);
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_prep_exam_review',
                    user_id: USER_ID,
                    subject: prepExamConfig.subject,
                    grade: ACTIVE_GRADE,
                    sessions: prepExamConfig.sessions,
                    weak_sessions: weakSessions,
                    wrong_answers: prepExamQuestions.filter(q => weakSessions.includes(q.source_session)).slice(0, 8).map(q => ({
                        session: q.source_session,
                        topic: q.source_topic,
                        question: q.question
                    })),
                    session_details: prepExamConfig.sessionDetails
                })
            });

            const text = await response.text();
            const parsed = parseN8NResponse(text);
            const reviewContent = parsed.output || parsed.review || parsed.summary || JSON.stringify(parsed, null, 2);

            setAiContent(reviewContent);
            setShowPrepExamResults(false);
            setAiModalOpen(true);

                await saveProgress('prep_exam_reviewed', {
                    subject: prepExamConfig.subject,
                    grade: ACTIVE_GRADE,
                    session: prepExamConfig.sessions.join(','),
                    selected_sessions: prepExamConfig.sessions.join(','),
                    score: prepExamReport.totalCorrect,
                xp_reward: 25
            });
        } catch (error) {
            console.error('[PREP_EXAM] Error generando repaso:', error);
            alert('No pudimos generar el repaso guiado. Intenta otra vez en unos segundos.');
        } finally {
            setLoadingMessage('');
            setIsCallingN8N(false);
        }
    };

    const loadAdminNotebookFiles = async () => {
        if (!isAdminUser) return;

        setIsLoadingAdminFiles(true);
        try {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list_notebook_files',
                    email: currentUser?.email,
                    user_id: USER_ID
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudieron cargar los PDFs');
            }

            setAdminNotebookFiles(data.files || []);
        } catch (error) {
            console.error('[ADMIN_FILES] Error listando PDFs:', error);
            alert(`No pudimos cargar los PDFs guardados. ${error.message || ''}`);
        } finally {
            setIsLoadingAdminFiles(false);
        }
    };

    const openAdminFilesModal = async () => {
        setShowAdminFilesModal(true);
        await loadAdminNotebookFiles();
    };

    const deleteAdminNotebookFile = async (file) => {
        if (!file?.fileName) return;
        if (!confirm(`Â¿Eliminar este PDF?\n\n${file.fileName}`)) return;

        try {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_notebook_file',
                    email: currentUser?.email,
                    user_id: USER_ID,
                    file_name: file.fileName
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudo eliminar el archivo');
            }

            setAdminNotebookFiles(prev => prev.filter(item => item.fileName !== file.fileName));
        } catch (error) {
            console.error('[ADMIN_FILES] Error eliminando PDF:', error);
            alert(`No pudimos eliminar el PDF. ${error.message || ''}`);
        }
    };

    const loadAdminGeneratedQuestions = async () => {
        if (!isAdminUser) return;

        setIsLoadingAdminGeneratedQuestions(true);
        try {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list_generated_questions',
                    email: currentUser?.email,
                    user_id: USER_ID
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudieron cargar las preguntas');
            }

            setAdminGeneratedQuestions(data.items || []);
        } catch (error) {
            console.error('[ADMIN_QUESTIONS] Error listando preguntas generadas:', error);
            alert(`No pudimos cargar las preguntas guardadas. ${error.message || ''}`);
        } finally {
            setIsLoadingAdminGeneratedQuestions(false);
        }
    };

    const openAdminGeneratedQuestionsModal = async () => {
        setShowAdminGeneratedQuestionsModal(true);
        await loadAdminGeneratedQuestions();
    };

    const deleteAdminGeneratedQuestion = async (item) => {
        if (!item?.id) return;
        if (!confirm(`Â¿Eliminar esta pregunta generada?\n\n${item.question?.slice(0, 180) || item.id}`)) return;

        try {
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_generated_question',
                    email: currentUser?.email,
                    user_id: USER_ID,
                    question_id: item.id
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'No se pudo eliminar la pregunta');
            }

            setAdminGeneratedQuestions(prev => prev.filter(entry => entry.id !== item.id));
        } catch (error) {
            console.error('[ADMIN_QUESTIONS] Error eliminando pregunta generada:', error);
            alert(`No pudimos eliminar la pregunta. ${error.message || ''}`);
        }
    };

    // --- SMART CALENDAR LOGIC (MATICO PRODUCTION PLAN) ---
    const resolveMaticoPlan = () => {
        try {
            const today = new Date();
            const diffTime = today - COURSE_START_DATE;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) return { subject: 'MATEMATICA', index: 0 };

            const completedStr = localStorage.getItem(completedSessionsStorageKey);
            const completed = completedStr ? JSON.parse(completedStr) : [];

            console.log("[CALENDAR] Resolving plan for today. Completed:", completed);

            // 1. CATCH-UP (PRIORIDAD ABSOLUTA): Escaneamos desde el primer dÃ­a hasta AYER
            for (let d = 0; d < diffDays; d++) {
                const dateOfD = new Date(COURSE_START_DATE);
                dateOfD.setDate(dateOfD.getDate() + d);
                const dayOfWeek = dateOfD.getDay();

                const plan = WEEKLY_PLAN.find(p => p.day === dayOfWeek);
                if (plan) {
                    const subject = plan.subject;
                    const weekNumber = Math.floor(d / 7);
                    const sessionKey = `${subject}_${weekNumber + 1}`;

                    if (!(completed || []).includes(sessionKey)) {
                        console.log(`[CALENDAR] BLOQUEO: SesiÃ³n pendiente detectada: ${sessionKey}`);
                        return { subject, index: weekNumber, isMissed: true, missedSubject: subject };
                    }
                }
            }

            // 2. LO DE HOY: Si todo lo anterior estÃ¡ listo, vemos quÃ© toca hoy
            const todaysDayOfWeek = today.getDay();
            const todaysPlan = WEEKLY_PLAN.find(p => p.day === todaysDayOfWeek);
            const currentWeekNumber = Math.floor(diffDays / 7);

            if (todaysPlan) {
                const todaysSubject = todaysPlan.subject;
                const todaysSessionKey = `${todaysSubject}_${currentWeekNumber + 1}`;

                if (!(completed || []).includes(todaysSessionKey)) {
                    return { subject: todaysSubject, index: currentWeekNumber, isMissed: false };
                }
            }

            // 3. FALLBACK: Todo al dÃ­a
            return {
                subject: todaysPlan ? todaysPlan.subject : 'MATEMATICA',
                index: Math.max(0, currentWeekNumber),
                isMissed: false
            };
        } catch (e) {
            console.error("Error in resolveMaticoPlan:", e);
            return { subject: 'MATEMATICA', index: 0 };
        }
    };

    const markSessionComplete = (subject, sessionId) => {
        const key = `${subject}_${sessionId}`;
        const completedStr = localStorage.getItem(completedSessionsStorageKey);
        const completed = completedStr ? JSON.parse(completedStr) : [];

        console.log(`[MATICO] markSessionComplete called:`, { subject, sessionId, key });

        if (!(completed || []).includes(key)) {
            const newCompleted = [...(completed || []), key];
            localStorage.setItem(completedSessionsStorageKey, JSON.stringify(newCompleted));
            console.log(`[MATICO] Marked ${key} as complete!`);

            // Re-calcular inmediatamente para saltar a la siguiente materia/sesiÃ³n
            const { subject: nextSubject, index: nextIndex } = resolveMaticoPlan();
            console.log(`[MATICO] Next up: ${nextSubject} (Session Index ${nextIndex})`);
            setCurrentSubject(nextSubject);
            setTodayIndex(nextIndex);
        }
    };
    // --- SMART CALENDAR LOGIC END ---
    // Helper to find the first incomplete session for a specific subject
    const getSmartSessionIndex = (subject) => {
        try {
            const completedStr = localStorage.getItem(completedSessionsStorageKey);
            const completed = completedStr ? JSON.parse(completedStr) : [];

            // Search through weeks (indices)
            for (let i = 0; i < 10; i++) { // Check up to 10 weeks
                const sessionKey = `${subject}_${i + 1}`;
                if (!(completed || []).includes(sessionKey)) {
                    return i;
                }
            }
            return 0; // Fallback to first session
        } catch (e) {
            return 0;
        }
    };

    // EFFECT: SWITCH ROUTE ON SUBJECT CHANGE
    useEffect(() => {
        if (currentSubject === 'LENGUAJE') {
            setDailyRoute(DEFAULT_LANG_ROUTE);
        } else if (currentSubject === 'QUIMICA') {
            setDailyRoute(DEFAULT_CHEM_ROUTE);
        } else if (currentSubject === 'HISTORIA') {
            setDailyRoute(DEFAULT_HISTORY_ROUTE);
        } else {
            setDailyRoute(DEFAULT_DAILY_ROUTE);
        }

        const serverSubject = serverProgress?.subject || currentSubject;
        const hasServerProgressForSubject =
            serverProgress &&
            serverSubject === currentSubject &&
            Number(serverProgress.next_session || 0) > 0;

        if (loadingProgress) {
            return;
        }

        if (hasServerProgressForSubject) {
            const serverIndex = Math.max(0, Number(serverProgress.next_session || 1) - 1);
            console.log(`Subject Change: ${currentSubject} -> Using server session index: ${serverIndex}`);
            setTodayIndex(serverIndex);
            return;
        }

        const smartIndex = getSmartSessionIndex(currentSubject);
        console.log(`Subject Change: ${currentSubject} -> Loaded Smart Session Index: ${smartIndex}`);
        setTodayIndex(smartIndex);

    }, [currentSubject, loadingProgress, serverProgress?.subject, serverProgress?.next_session]);

    const updateQuizStats = (isCorrect) => {
        setQuizStats(prev => ({
            correct: prev.correct + (isCorrect ? 1 : 0),
            incorrect: prev.incorrect + (isCorrect ? 0 : 1),
            total: prev.total + 1
        }));

        if (isCorrect) {
            saveProgress('xp_gain', { amount: 10, reason: 'quiz_correct_answer' });

            // NEW: SAVE QUIZ PROGRESS IMMEDIATELY SO AI KNOWS WE MASTERED THIS
            saveProgress('quiz_completed', {
                subject: currentSubject,
                topic: TODAYS_SESSION.topic, // Or a more specific sub-topic if available
                score: 100, // Per-question score (binary success)
                correct: 1,
                total: 1,
                question_index: quizStats.total + 1 // Track which question number this was
            });
        }
    };

    const primeNormalQuizBatchLoading = (level, firstBatchQuestions = []) => {
        const totalBatches = QUIZ_BATCHES_PER_PHASE;
        normalQuizBatchRef.current = {
            level,
            nextBatchIndex: 1,
            totalBatches,
            nextPromise: null
        };

        if ((firstBatchQuestions || []).length > 0 && totalBatches > 1) {
            normalQuizBatchRef.current.nextPromise = generateQuizSubset(level, 1, true);
        }
    };

    const requestNextNormalQuizBatch = async () => {
        const batchState = normalQuizBatchRef.current;
        if (!batchState.level) return [];
        if (batchState.nextBatchIndex >= batchState.totalBatches) return [];

        let nextQuestions = [];
        if (batchState.nextPromise) {
            nextQuestions = await batchState.nextPromise;
        } else {
            nextQuestions = await generateQuizSubset(batchState.level, batchState.nextBatchIndex, true);
        }

        if (!Array.isArray(nextQuestions) || nextQuestions.length === 0) {
            console.warn(`[QUIZ] Lote ${batchState.nextBatchIndex + 1} vacÃ­o. Reintentando fetch directo...`);
            nextQuestions = await generateQuizSubset(batchState.level, batchState.nextBatchIndex, false);
        }

        batchState.nextBatchIndex += 1;

        if (batchState.nextBatchIndex < batchState.totalBatches) {
            batchState.nextPromise = generateQuizSubset(batchState.level, batchState.nextBatchIndex, true);
        } else {
            batchState.nextPromise = null;
        }

        return nextQuestions;
    };

    const resetNormalQuizBatchLoading = () => {
        normalQuizBatchRef.current = {
            level: '',
            nextBatchIndex: 0,
            totalBatches: QUIZ_BATCHES_PER_PHASE,
            nextPromise: null
        };
    };

    const isPlaceholderOptionText = (value = '') => {
        const normalized = String(value || '').trim().toUpperCase();
        return ['A', 'B', 'C', 'D', 'AA', 'BB', 'CC', 'DD'].includes(normalized);
    };

    const buildFormattedQuizQuestions = (rawQuestions = []) => {

        const formattedQuestions = rawQuestions.slice(0, QUIZ_BATCH_SIZE).map(q => {
            let optsObj = {};
            let correctKey = 'A';

            if (Array.isArray(q.options)) {
                const letters = ['A', 'B', 'C', 'D'];
                q.options.forEach((opt, idx) => {
                    if (idx < 4) optsObj[letters[idx]] = opt;
                });
                if (q.correctIndex !== undefined) {
                    correctKey = letters[q.correctIndex] || 'A';
                }
            } else {
                optsObj = q.options || {};
                correctKey = q.correct_answer || (q.correctIndex !== undefined ? ['A', 'B', 'C', 'D'][q.correctIndex] : 'A');
            }

            return {
                question: q.question,
                options: optsObj,
                correct_answer: correctKey,
                explanation: q.explanation || 'Verificacion pendiente.'
            };
        });

        const placeholderQuestionCount = formattedQuestions.reduce((count, question) => {
            const optionValues = Object.values(question.options || {});
            const placeholderOptions = optionValues.filter(isPlaceholderOptionText);
            return count + (placeholderOptions.length >= 3 ? 1 : 0);
        }, 0);

        return {
            formattedQuestions,
            hasPlaceholderQuestions: placeholderQuestionCount > 0,
            placeholderQuestionCount
        };
    };

    const generateQuizSubset = async (level, batchIndex = 0, backgroundMode = false, retryCount = 0, requestedCount = QUIZ_BATCH_SIZE, excludeSignatures = []) => {
        if (retryCount > 1) {
            console.error(`[QUIZ] Max retries reached for subset ${level} batch ${batchIndex}.`);
            return [];
        }

        const levelConfig = {
            "Basico": {
                instruction: "RECORDAR/COMPRENDER - Preguntas directas sobre definiciones y conceptos elementales"
            },
            "AVANZADO": {
                instruction: "APLICAR - Problemas practicos de nivel avanzado"
            },
            "Critico": {
                instruction: "ANALIZAR/EVALUAR - Nivel PAES Universidad MUY DIFICIL"
            }
        };

        const config = levelConfig[level];
        if (!config) return [];
        const shouldPublishDiagnostics = !backgroundMode && retryCount === 0 && batchIndex === 0;
        const quizDiagnostics = createLoadingDiagnostics(`quiz_${level}_batch_${batchIndex + 1}_retry_${retryCount}`, {
            publishToUi: shouldPublishDiagnostics
        });

        if (shouldPublishDiagnostics) {
            setLoadingMessage(`ðŸ§  Preparando Quiz ${level}...`);
        }

        const subsetPrompt = `${TODAYS_SUBJECT.oa_title} [INSTRUCCION TECNICA:
1. Genera EXACTAMENTE ${requestedCount} (${requestedCount}) preguntas de seleccion multiple (JSON).
2. Nivel: ${config.instruction}.
3. LOTE PARCIAL ${batchIndex + 1}/${QUIZ_BATCHES_PER_PHASE}.
4. ESTRUCTURA JSON ESTRICTA: {"questions": [{"question": "...", "options": ["texto completo de la alternativa 1", "texto completo de la alternativa 2", "texto completo de la alternativa 3", "texto completo de la alternativa 4"], "correctIndex": 0, "explanation": "..."}]}.
5. LAS OPCIONES DEBEN SER TEXTO REAL DE LA RESPUESTA, NUNCA solo letras A/B/C/D ni numeros sueltos.
6. FORMATO MATH: Usa LaTeX solo para formulas matematicas ($x^2$). NO encierres oraciones de texto normal en signos de pesos.
7. NO GENERES TEORIA. SOLO JSON.]`;

        try {
            quizDiagnostics.begin('Preparando solicitud del quiz');
            const body = {
                sujeto: currentSubject,
                accion: 'Generar Quiz de Validacion',
                tema: subsetPrompt,
                nivel_estudiante: '1Ã‚Â° Medio Chile',
                user_id: USER_ID,
                session: TODAYS_SESSION.session,
                phase: level,
                batch_index: batchIndex,
                batch_size: requestedCount,
                total_batches: QUIZ_BATCHES_PER_PHASE,
                exclude_signatures: excludeSignatures
            };

            if (shouldPublishDiagnostics) {
                setLoadingMessage('âš¡ Generando preguntas del quiz...');
            }
            quizDiagnostics.begin('Esperando respuesta del servidor');
            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (shouldPublishDiagnostics) {
                setLoadingMessage('Leyendo y parseando la respuesta...');
            }
            quizDiagnostics.begin('Leyendo respuesta del servidor');
            const text = await response.text();
            const json = parseN8NResponse(text);
            quizDiagnostics.begin('Parseando preguntas recibidas');

            let qData = [];
            if (json.questions && Array.isArray(json.questions)) {
                qData = json.questions;
            } else if (json.question) {
                qData = [json];
            } else if (Array.isArray(json)) {
                qData = json.filter(q => q && (q.question || q.questions));
                if (qData.length === 0 && json.length > 0 && json[0].questions) {
                    qData = json[0].questions;
                }
            }

            if (qData.length === 0) {
                if (json.output) {
                    const sub = parseN8NResponse(json.output);
                    if (Array.isArray(sub)) qData = sub;
                    else if (sub.questions) qData = sub.questions;
                } else if (Array.isArray(json) && json.length > 0 && json[0].output) {
                    const sub = parseN8NResponse(json[0].output);
                    if (Array.isArray(sub)) qData = sub;
                    else if (sub.questions) qData = sub.questions;
                }
            }

            if (shouldPublishDiagnostics) {
                setLoadingMessage('Validando calidad de las preguntas...');
            }
            quizDiagnostics.begin('Sanitizando y validando preguntas');
            const { formattedQuestions, hasPlaceholderQuestions } = buildFormattedQuizQuestions(qData || []);
            let sanitizedQuestions = formattedQuestions.filter((question) => {
                const optionValues = Object.values(question.options || {});
                const placeholderOptions = optionValues.filter(isPlaceholderOptionText);
                return optionValues.length >= 4 && placeholderOptions.length < 3;
            });

            if (sanitizedQuestions.length >= requestedCount) {
                const finalQuestions = sanitizedQuestions.slice(0, requestedCount);
                quizDiagnostics.finish({
                    questionCount: finalQuestions.length,
                    serverTimings: json?.timings || null
                });
                return finalQuestions;
            }

            const missingCount = requestedCount - sanitizedQuestions.length;
            if (missingCount > 0 && retryCount < 1) {
                console.warn(`[QUIZ] Lote ${batchIndex + 1}/${QUIZ_BATCHES_PER_PHASE} incompleto (${sanitizedQuestions.length}/${requestedCount}). Rellenando ${missingCount} preguntas...`);
                if (shouldPublishDiagnostics) {
                    setLoadingMessage(`âœ¨ Completando ${missingCount} preguntas faltantes...`);
                }
                quizDiagnostics.begin('Solicitando preguntas faltantes');
                const seenSignatures = sanitizedQuestions.map((question) => {
                    const optionValues = Object.values(question.options || {});
                    return `${String(question.question || '').trim()} || ${optionValues.join(' || ')}`;
                });
                const refillQuestions = await generateQuizSubset(level, batchIndex, true, retryCount + 1, missingCount, [...excludeSignatures, ...seenSignatures]);
                sanitizedQuestions = [...sanitizedQuestions, ...(Array.isArray(refillQuestions) ? refillQuestions : [])];
            }

            if (sanitizedQuestions.length < Math.max(2, requestedCount - 1)) {
                if (shouldPublishDiagnostics) {
                    setLoadingMessage('ðŸ”„ Ajustando el quiz para que quede completo...');
                }
                quizDiagnostics.begin('Reintentando lote incompleto');
                const retryQuestions = await generateQuizSubset(level, batchIndex, backgroundMode, retryCount + 1, requestedCount, excludeSignatures);
                quizDiagnostics.finish({
                    questionCount: Array.isArray(retryQuestions) ? retryQuestions.length : 0,
                    serverTimings: json?.timings || null
                });
                return retryQuestions;
            }

            if (hasPlaceholderQuestions) {
                console.warn(`[QUIZ] Lote ${batchIndex + 1}/${QUIZ_BATCHES_PER_PHASE} aceptado con filtrado de placeholders (${sanitizedQuestions.length}/${requestedCount}).`);
            }

            const finalQuestions = sanitizedQuestions.slice(0, requestedCount);
            quizDiagnostics.finish({
                questionCount: finalQuestions.length,
                serverTimings: json?.timings || null
            });
            return finalQuestions;
        } catch (e) {
            quizDiagnostics.fail(e);
            console.error(`Error generando subset ${level} lote ${batchIndex}:`, e);
            return [];
        }
    };

    const prefetchNextPhaseBatch = (phaseNumber) => {
        const levelMap = { 1: 'Basico', 2: 'AVANZADO', 3: 'Critico' };
        if (phaseNumber >= 3) {
            setBackgroundQuestionsQueue([]);
            setIsLoadingNextBatch(false);
            backgroundTaskRef.current = null;
            return;
        }

        const nextLevel = levelMap[phaseNumber + 1];
        setIsLoadingNextBatch(true);
        backgroundTaskRef.current = generateQuizSubset(nextLevel, 0, true).then(q => {
            setBackgroundQuestionsQueue(Array.isArray(q) ? q : []);
            setIsLoadingNextBatch(false);
            backgroundTaskRef.current = null;
            return { questions: Array.isArray(q) ? q : [] };
        }).catch(error => {
            console.error(`[BACK] Error pre-cargando fase ${phaseNumber + 1}:`, error);
            setBackgroundQuestionsQueue([]);
            setIsLoadingNextBatch(false);
            backgroundTaskRef.current = null;
            return { questions: [] };
        });
    };

    // QUIZ PHASE PROGRESS - PERSISTENCE HELPERS (SISTEMA KAIZEN - 3 NIVELES Ã³ 15 PREGUNTAS)
    const saveQuizPhaseProgress = (phase, score) => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const existing = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');

        if (!existing[key]) {
            existing[key] = {
                completedPhases: [], // Ej: [1, 2]
                currentPhase: 1,
                scores: {},
                theoryStarted: false,
                theoryCompleted: false
            };
        }

        // Marcar fase como completada
        if (existing[key].completedPhases && !existing[key].completedPhases.includes(phase)) {
            existing[key].completedPhases.push(phase);
        }

        // Guardar score
        existing[key].scores[phase] = score;

        // Avanzar fase
        if (phase < 3) {
            existing[key].currentPhase = phase + 1;
        }

        existing[key].lastUpdated = new Date().toISOString();

        localStorage.setItem(quizProgressStorageKey, JSON.stringify(existing));
        console.log(`[PROGRESS] Fase ${phase} guardada con score ${score}`);
    };

    const getQuizProgress = () => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const progress = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');
        return progress[key] || {
            completedPhases: [],
            currentPhase: 1,
            scores: {},
            theoryStarted: false,
            theoryCompleted: false
        };
    };

    const getAccumulatedQuizCorrectAnswers = (fallbackCurrentPhase = null, fallbackPhaseScore = 0) => {
        const localProgress = getQuizProgress();
        const scores = localProgress?.scores || {};
        const totalFromStoredScores = [1, 2, 3].reduce((sum, phase) => {
            return sum + (Number(scores[phase] || 0) || 0);
        }, 0);

        if (totalFromStoredScores > 0) {
            return totalFromStoredScores;
        }

        const currentPhaseNumber = Number(fallbackCurrentPhase || currentQuizPhase || 0) || 0;
        return (Number(quizStats.correct || 0) || 0) + (currentPhaseNumber === 3 ? (Number(fallbackPhaseScore || 0) || 0) : 0);
    };

    const updateQuizProgressState = (updater) => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const allProgress = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');
        const current = allProgress[key] || {
            completedPhases: [],
            currentPhase: 1,
            scores: {},
            theoryStarted: false,
            theoryCompleted: false
        };

        allProgress[key] = updater(current) || current;
        localStorage.setItem(quizProgressStorageKey, JSON.stringify(allProgress));
        return allProgress[key];
    };

    const markTheoryStatus = ({ started = false, completed = false, phase = null } = {}) => {
        return updateQuizProgressState((current) => ({
            ...current,
            currentPhase: Math.min(3, Math.max(1, Number(phase || current.currentPhase || 1))),
            theoryStarted: current.theoryStarted || started || completed,
            theoryCompleted: current.theoryCompleted || completed,
            lastUpdated: new Date().toISOString()
        }));
    };

    const resetQuizPhaseProgress = (phase) => {
        return updateQuizProgressState((current) => {
            const completedPhases = Array.isArray(current.completedPhases)
                ? current.completedPhases.filter((item) => Number(item) !== Number(phase))
                : [];
            const scores = { ...(current.scores || {}) };
            delete scores[phase];

            return {
                ...current,
                completedPhases,
                currentPhase: Math.min(3, Math.max(1, Number(phase || 1))),
                scores,
                lastUpdated: new Date().toISOString()
            };
        });
    };

    const getSessionProtocolState = () => {
        const localProgress = getQuizProgress();
        const serverSessionInProgress = Number(serverProgress?.current_session_in_progress || 0);
        const serverPhaseCompleted = Number(serverProgress?.current_phase || 0);
        const serverTheoryStarted = Boolean(serverProgress?.current_theory_started);
        const serverTheoryCompleted = Boolean(serverProgress?.current_theory_completed);
        const currentSessionNumber = Number(TODAYS_SESSION.session || 0);
        const serverSessionCompleted = Number(serverProgress?.last_completed_session || 0) >= currentSessionNumber;

        let currentPhase = Math.min(3, Math.max(1, Number(localProgress.currentPhase || 1)));
        if (serverSessionInProgress === currentSessionNumber && serverPhaseCompleted > 0) {
            currentPhase = Math.max(currentPhase, Math.min(3, serverPhaseCompleted + 1));
        }

        const sessionStarted = Boolean(
            localProgress.theoryStarted ||
            localProgress.theoryCompleted ||
            (Array.isArray(localProgress.completedPhases) && localProgress.completedPhases.length > 0) ||
            currentPhase > 1 ||
            serverTheoryStarted ||
            serverTheoryCompleted ||
            serverSessionInProgress === currentSessionNumber
        );

        const questionsCompleted = serverSessionCompleted
            ? QUIZ_TOTAL_QUESTIONS
            : ((currentPhase - 1) * QUIZ_PHASE_QUESTIONS);

        return {
            currentPhase,
            currentLevel: QUIZ_PHASE_LEVELS[currentPhase] || 'Basico',
            sessionStarted,
            sessionCompleted: serverSessionCompleted,
            requiresMandatoryTheory: !sessionStarted && !serverSessionCompleted,
            questionsCompleted,
            localProgress
        };
    };

    const clearQuizProgress = () => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const progress = JSON.parse(localStorage.getItem(quizProgressStorageKey) || '{}');
        delete progress[key];
        localStorage.setItem(quizProgressStorageKey, JSON.stringify(progress));
        console.log(`[PROGRESS] Progreso limpiado para ${key}`);
    };

    // START FULL MULTI-STAGE QUIZ - SISTEMA KAIZEN (3 FASES Ã³ 15 PREGUNTAS)
    const openTheoryForCurrentPhase = async ({ mandatory = false } = {}) => {
        const protocol = getSessionProtocolState();
        const phaseToUse = protocol.currentPhase;
        const levelName = QUIZ_PHASE_LEVELS[phaseToUse] || 'Basico';
        const theoryTopic = `${TODAYS_SUBJECT.oa_title} [FASE ACTUAL: ${levelName}] [MODO TEORIA: ${mandatory ? 'OBLIGATORIA' : 'OPCIONAL'}]`;

        setCurrentQuizPhase(phaseToUse);
        setIsTheoryNotebookMandatory(Boolean(mandatory));
        markTheoryStatus({ started: true, phase: phaseToUse });
        await callAgent(currentSubject, 'start_route', theoryTopic, null, null, theoryTopic);
    };

    const startFullQuiz = async () => {
        const protocol = getSessionProtocolState();
        const startingPhase = protocol.currentPhase;

        if (protocol.sessionCompleted) {
            alert('Esta sesion ya fue completada. Continuemos con la siguiente ruta.');
            return;
        }

        if (protocol.requiresMandatoryTheory) {
            console.log('[QUIZ] Sesion nueva detectada. Lanzando teoria ludica obligatoria antes del quiz.');
            await openTheoryForCurrentPhase({ mandatory: true });
            return;
        }

        if (
            startingPhase === 1 &&
            Number(protocol.questionsCompleted || 0) === 0 &&
            protocol.localProgress?.theoryStarted &&
            !protocol.localProgress?.theoryCompleted
        ) {
            console.log('[QUIZ] Basico inicial detectado con teoria leida pero sin cuaderno. Abriendo cuaderno obligatorio.');
            setCurrentQuizPhase(startingPhase);
            setIsTheoryNotebookMandatory(true);
            setAiModalOpen(false);
            setShowTheoryNotebookMission(true);
            return;
        }

        setIsCallingN8N(true);
        setAiModalOpen(false);

        console.log(`[QUIZ] Protocolo detectado:`, protocol);
        console.log(`[QUIZ] Iniciando desde Fase ${startingPhase} (Carga progresiva 5 en 5)`);

        setCurrentQuizPhase(startingPhase);
        setBackgroundQuestionsQueue([]);
        setQuizStats({ correct: 0, incorrect: 0, total: 0 });
        resetNormalQuizBatchLoading();

        try {
            const currentLevel = QUIZ_PHASE_LEVELS[startingPhase];

            setLoadingMessage(`ðŸ§  Preparando Quiz ${currentLevel}...`);

            const questions = await generateQuizSubset(currentLevel, 0, false);

            if (questions && questions.length > 0) {
                setQuizQuestions(questions);
                primeNormalQuizBatchLoading(currentLevel, questions);
                setShowInteractiveQuiz(true);
                setIsCallingN8N(false);
                setLoadingMessage("");

                console.log(`[QUIZ] Preguntas iniciales cargadas. Iniciando sesiÃ³n interactiva.`);
                prefetchNextPhaseBatch(startingPhase);
            } else {
                throw new Error("No se pudo obtener la primera tanda del quiz.");
            }

        } catch (e) {
            console.error("Error iniciando quiz:", e);
            alert("Error de conexiÃ³n. Por favor intenta nuevamente.");
            setIsCallingN8N(false);
            setAiModalOpen(true);
        }
    };

    // HANDLE "CONTINUAR AL QUIZ" BUTTON - Cerrar teorÃ­a y mostrar quiz
    const launchQuizAfterTheoryNotebook = async () => {
        console.log('[THEORY] Cuaderno completado. Preparando quiz progresivo...');
        setIsCallingN8N(true);
        setLoadingMessage(`ðŸ§  Preparando las primeras ${QUIZ_BATCH_SIZE} preguntas...`);

        try {
            const currentLevel = QUIZ_PHASE_LEVELS[currentQuizPhase];
            let questions = pendingQuizQuestions;

            if (!Array.isArray(questions) || questions.length === 0) {
                questions = await generateQuizSubset(currentLevel, 0, false);
            }

            if (questions && questions.length > 0) {
                markTheoryStatus({ started: true, completed: true, phase: currentQuizPhase });
                saveProgress('theory_completed', {
                    subject: currentSubject,
                    session: TODAYS_SESSION.session,
                    phase: currentQuizPhase,
                    levelName: currentLevel,
                    xp_reward: 5
                });

                setShowTheoryModal(false);
                setQuizQuestions(questions);
                primeNormalQuizBatchLoading(currentLevel, questions);
                setShowInteractiveQuiz(true);
                setPendingQuizQuestions([]);
                setIsCallingN8N(false);
                setLoadingMessage("");
                prefetchNextPhaseBatch(currentQuizPhase);
            } else {
                throw new Error('No se pudieron cargar las preguntas.');
            }
        } catch (err) {
            console.error('Error al continuar al quiz:', err);
            alert('Vaya... no pudimos cargar las preguntas. Reintenta en un momento.');
            setIsCallingN8N(false);
        }
    };

    // --- NOTIFICACIÃ³N DE RESULTADOS ESTILO SALÃ³N ---
    const sendFinalSessionReport = async (stats, wrongAnswers = []) => {
        console.log("[REPORT] Generando reporte final con anÃ¡lisis IA de", wrongAnswers.length, "errores...");

        // Calcular porcentaje de Ã©xito basado en 45 preguntas (3 fases de 15)
        const successRate = Math.round((stats.correct / 45) * 100);
        const wrongQuestionDetails = serializeWrongQuestionDetails(wrongAnswers);
        const weakness = buildWeaknessSummary(wrongAnswers);
        const improvementPlan = buildImprovementPlan(wrongAnswers);

        const reportPrompt = `[INSTRUCCIÃ³N AGENTE DE REPORTES MATICO]:
Eres el Agente de Ã³0xito AcadÃ©mico de Matico. Tu trabajo es tomar los resultados finales de una sesiÃ³n de 45 preguntas y generar una notificaciÃ³n de confirmaciÃ³n de logros, similar al estilo profesional de 'Glow & Grace Salon'.

DATOS DEL ESTUDIANTE:
- Nombre: ${currentUser?.username || userProfile?.username || 'Estudiante'}
- Email: ${currentUser?.email || 'N/A'}
- Asignatura: ${currentSubject}
- SesiÃ³n: ${TODAYS_SESSION.session} - ${TODAYS_SESSION.topic}
- Resultado: ${stats.correct} de 45 correctas (${successRate}%)

SALIDA REQUERIDA (JSON ESTRICTO):
{
  "email": {
    "to": "${currentUser?.email || 'hola@matico.ai'}",
    "subject": "Â¡SesiÃ³n Completada! Tus logros en ${currentSubject} - SesiÃ³n ${TODAYS_SESSION.session}",
    "html_body": "Contenido HTML profesional con tabla de resultados y feedback personalizado", 
    "description": "Reporte de SesiÃ³n Matico: ${TODAYS_SESSION.topic}"
  }
}`;

        try {
            // 1. Enviar Reporte Detallado al Alumno y Apoderado (IA)
            // Nota: El servidor ya se encarga de enviarlo a ambos si estÃ¡n configurados
            await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'send_session_report',
                    user_id: USER_ID,
                    email: currentUser?.email,
                    report_prompt: reportPrompt,
                    subject: currentSubject,
                    session: TODAYS_SESSION.session,
                    topic: TODAYS_SESSION.topic,
                    stats: stats,
                    wrong_answers: wrongAnswers,
                    wrong_question_details: wrongQuestionDetails,
                    weakness,
                    improvement_plan: improvementPlan
                })
            });
            console.log("[REPORT] Ã³xÃ³ Reporte de sesiÃ³n enviado");

        } catch (err) {
            console.error("[REPORT] Error en flujo de notificaciones:", err);
        }
    };

    const serializeWrongQuestionDetails = (wrongAnswers = []) => {
        if (!Array.isArray(wrongAnswers) || wrongAnswers.length === 0) return '';

        return JSON.stringify(wrongAnswers.map((item, index) => ({
            index: index + 1,
            question: item.question || '',
            user_answer: item.user_answer || '',
            correct_answer: item.correct_answer || '',
            source_session: item.source_session ?? '',
            source_topic: item.source_topic || ''
        })));
    };

    const handleContinueToQuiz = async () => {
        if (isTheoryNotebookMandatory) {
            console.log('[THEORY] Primera entrada de la sesiÃ³n. Abriendo cuaderno obligatorio antes del quiz...');
            setShowTheoryModal(false);
            setShowTheoryNotebookMission(true);
            return;
        }

        console.log('[THEORY] Reingreso detectado. Continuando directo al quiz sin cuaderno.');
        await launchQuizAfterTheoryNotebook();
    };

    const handleTheoryNotebookComplete = async () => {
        setShowTheoryNotebookMission(false);
        setIsTheoryNotebookMandatory(false);
        await launchQuizAfterTheoryNotebook();
    };

    const handleTheoryNotebookSkip = async () => {
        setShowTheoryNotebookMission(false);
        setIsTheoryNotebookMandatory(false);
        await launchQuizAfterTheoryNotebook();
    };

    const buildWeaknessSummary = (wrongAnswers = []) => {
        const topics = [...new Set((wrongAnswers || []).map((item) => repairText(item.source_topic || '')).filter(Boolean))];
        if (topics.length === 0) return '';
        return topics.slice(0, 3).join(' | ');
    };

    const buildImprovementPlan = (wrongAnswers = []) => {
        const weaknessSummary = buildWeaknessSummary(wrongAnswers);
        if (!weaknessSummary) return `Mantener el ritmo actual y seguir practicando con lotes de ${QUIZ_BATCH_SIZE} preguntas.`;
        return `Reforzar estos focos: ${weaknessSummary}. Repetir teoria ludica y luego practicar otro lote de ${QUIZ_BATCH_SIZE} preguntas en la misma fase.`;
    };

    // HANDLE QUIZ PHASE COMPLETION - SISTEMA KAIZEN SIMPLIFICADO (3 FASES DE 15 PREGUNTAS)
    const onQuizPhaseComplete = async (phaseScore, phaseWrongAnswers = []) => {
        console.log('[QUIZ] Fase ' + currentQuizPhase + ' completada con score:', phaseScore, 'errores:', phaseWrongAnswers.length);

        setAllWrongAnswers(prev => [...prev, ...phaseWrongAnswers]);
        setQuizStats(prev => ({
            ...prev,
            correct: prev.correct + phaseScore,
            total: prev.total + QUIZ_PHASE_QUESTIONS
        }));

        saveQuizPhaseProgress(currentQuizPhase, phaseScore);

        const levelName = QUIZ_PHASE_LEVELS[currentQuizPhase];
        const wrongCount = phaseWrongAnswers.length;
        const wrongDetails = serializeWrongQuestionDetails(phaseWrongAnswers);
        const weakness = buildWeaknessSummary(phaseWrongAnswers);
        const improvementPlan = buildImprovementPlan(phaseWrongAnswers);

        await saveProgress('phase_completed', {
            subject: currentSubject,
            session: TODAYS_SESSION.session,
            phase: currentQuizPhase,
            subLevel: currentQuizPhase,
            levelName: levelName,
            score: phaseScore,
            questionsCompleted: currentQuizPhase * QUIZ_PHASE_QUESTIONS,
            totalQuestions: QUIZ_TOTAL_QUESTIONS,
            batch_index: QUIZ_BATCHES_PER_PHASE - 1,
            batch_size: QUIZ_BATCH_SIZE,
            correct_answers: phaseScore,
            wrong_answers: wrongCount,
            wrong_question_details: wrongDetails,
            weakness,
            improvement_plan: improvementPlan,
            xp_reward: 50
        });

        console.log('[SAVE] Fase ' + currentQuizPhase + ' guardada en Sheet');

        if (currentQuizPhase < 3) {
            const nextPhase = currentQuizPhase + 1;
            const nextLevel = QUIZ_PHASE_LEVELS[nextPhase];
            console.log('[QUIZ] Avanzando a Fase ' + nextPhase + ' (' + nextLevel + ')...');

            setIsCallingN8N(true);
            setShowInteractiveQuiz(false);
            resetNormalQuizBatchLoading();

            try {
                let nextQuestions = [];

                if (backgroundQuestionsQueue.length > 0) {
                    console.log('[QUIZ] Usando primera tanda pre-cargada para Fase ' + nextPhase);
                    nextQuestions = backgroundQuestionsQueue;
                    setBackgroundQuestionsQueue([]);
                } else if (isLoadingNextBatch && backgroundTaskRef.current) {
                    console.log('[BACK] Esperando primera tanda de Fase ' + nextPhase + '...');
                    setLoadingMessage(`ðŸ§  Preparando Nivel ${nextLevel}...`);
                    const result = await backgroundTaskRef.current;
                    nextQuestions = result.questions || [];
                    setBackgroundQuestionsQueue([]);
                } else {
                    console.log('[QUIZ] Generando primera tanda manual de ' + nextLevel + '...');
                    nextQuestions = await generateQuizSubset(nextLevel, 0, false);
                }

                if (nextQuestions.length > 0) {
                    setCurrentQuizPhase(nextPhase);
                    setQuizQuestions(nextQuestions);
                    primeNormalQuizBatchLoading(nextLevel, nextQuestions);
                    setIsCallingN8N(false);
                    setLoadingMessage("");
                    setShowInteractiveQuiz(true);
                    prefetchNextPhaseBatch(nextPhase);
                    console.log('[QUIZ] Fase ' + nextPhase + ' iniciada con ' + nextQuestions.length + ' preguntas iniciales');
                } else {
                    alert('Error al cargar la siguiente fase. Por favor intenta de nuevo.');
                    setIsCallingN8N(false);
                }
            } catch (err) {
                console.error('[PHASE_TRANSITION] Error:', err);
                alert('Error al preparar la siguiente fase.');
                setIsCallingN8N(false);
            }
        } else {
            console.log('[QUIZ] Todas las 3 fases completadas');
            setShowInteractiveQuiz(false);
            resetNormalQuizBatchLoading();
            setBackgroundQuestionsQueue([]);
            backgroundTaskRef.current = null;
            setIsLoadingNextBatch(false);

            const finalCorrectCount = getAccumulatedQuizCorrectAnswers(currentQuizPhase, phaseScore);
            const finalStats = { ...quizStats, correct: finalCorrectCount, total: QUIZ_TOTAL_QUESTIONS };
            const finalWrong = [...allWrongAnswers, ...phaseWrongAnswers];

            console.log('[REPORT] Enviando reporte final con score:', finalCorrectCount, 'errores:', finalWrong.length);
            await sendFinalSessionReport(finalStats, finalWrong);

            await saveProgress('session_completed', {
                subject: currentSubject,
                session: TODAYS_SESSION.session,
                topic: TODAYS_SESSION.topic,
                total_questions: QUIZ_TOTAL_QUESTIONS,
                correct_answers: finalCorrectCount,
                wrong_answers: finalWrong.length,
                wrong_question_details: serializeWrongQuestionDetails(finalWrong),
                weakness: buildWeaknessSummary(finalWrong),
                improvement_plan: buildImprovementPlan(finalWrong),
                xp_reward: 300
            });
            console.log("[SAVE] 'session_completed' guardado en Google Sheets correctamente");

            alert('SESIÃ³N COMPLETA\\n\\nHaz dominado: ' + TODAYS_SESSION.topic + '\\n\\nPuntaje Final: ' + finalStats.correct + '/' + QUIZ_TOTAL_QUESTIONS + '\\n\\n+300 XP');

            clearQuizProgress();
            setCurrentQuizPhase(1);
            setQuizStats({ correct: 0, incorrect: 0, total: 0 });
            setAllWrongAnswers([]);
            markSessionComplete(currentSubject, TODAYS_SESSION.session);
        }
    };

    const restartQuizPhaseFromZero = async (phaseNumber, wrongAnswers = []) => {
        const levelName = QUIZ_PHASE_LEVELS[phaseNumber] || 'Basico';

        resetNormalQuizBatchLoading();
        setBackgroundQuestionsQueue([]);
        setIsLoadingNextBatch(false);
        backgroundTaskRef.current = null;
        resetQuizPhaseProgress(phaseNumber);
        setCurrentQuizPhase(phaseNumber);

        await saveProgress('phase_failed', {
            subject: currentSubject,
            session: TODAYS_SESSION.session,
            phase: phaseNumber,
            subLevel: phaseNumber,
            levelName,
            score: 0,
            total_questions: QUIZ_PHASE_QUESTIONS,
            batch_index: 0,
            batch_size: QUIZ_BATCH_SIZE,
            wrong_answers: Array.isArray(wrongAnswers) ? wrongAnswers.length : 0,
            wrong_question_details: serializeWrongQuestionDetails(wrongAnswers),
            weakness: buildWeaknessSummary(wrongAnswers),
            improvement_plan: buildImprovementPlan(wrongAnswers),
            xp_reward: 0
        });

        const questions = await generateQuizSubset(levelName, 0, false);
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error(`No se pudo reiniciar la fase ${levelName}.`);
        }

        setQuizQuestions(questions);
        primeNormalQuizBatchLoading(levelName, questions);
        return questions;
    };

    // UPDATED CALL AGENT TO HANDLE IMAGES AND CONTEXT (POST)
    const callAgent = async (subject, action, topic, image = null, timestamp = null, displayTopic = null, questionNumberOverride = null) => {
        setIsCallingN8N(true);
        setCurrentSubject(subject);
        setApiJson(null);
        setAiContent("");

        // MANAGE USER QUERY STATE FOR DISPLAY
        if (action === 'answer_doubts') {
            setLastUserQuery(displayTopic || topic);
        } else {
            setLastUserQuery("");
        }

        if (askModalOpen) setAskModalOpen(false);

        if (action === 'start_route') {
            const protocol = getSessionProtocolState();
            setQuizStats({ correct: 0, incorrect: 0, total: 0 });
            setQuizLevel(1);
            setQuizQuestionNumber(1); // Reset question index
            
            // NEW: LOG THEORY STARTING EVENT
            saveProgress('theory_started', {
                subject: subject,
                session: TODAYS_SESSION.session,
                topic: TODAYS_SESSION.topic,
                phase: protocol.currentPhase,
                levelName: protocol.currentLevel,
                xp_reward: 5 // Small ritual XP for starting
            });
        }

        let n8nAction = 'Generar TeorÃ­a LÃºdica';
        if (action === 'start_route') n8nAction = 'Generar TeorÃ­a LÃºdica'; // Explicit
        if (action === 'generate_quiz') n8nAction = 'Generar Quiz de ValidaciÃ³n';
        if (action === 'deepen_knowledge') n8nAction = 'Profundizar y Desafiar';
        if (action === 'remedial_explanation') n8nAction = 'Explicar y Simplificar';
        if (action === 'answer_doubts') n8nAction = 'Responder Duda';

        // NEW: INJECT DIFFICULTY INSTRUCTIONS INTO TOPIC
        let difficultyPrompt = "";
        if (action === 'deepen_knowledge' || action === 'generate_quiz') {
            if (quizLevel === 1) difficultyPrompt = " [INSTRUCCIÃ³N: Genera una pregunta de nivel 1 (MEMORIZAR/COMPRENDER). EnfÃ³cate en definiciones claras y conceptos bÃ¡sicos. Estilo directo y sencillo.]";
            if (quizLevel === 2) difficultyPrompt = " [INSTRUCCIÃ³N: Genera una pregunta de nivel 2 (APLICAR). El estudiante debe aplicar el concepto en una situaciÃ³n prÃ¡ctica o ejemplo cotidiano. Dificultad media.]";
            if (quizLevel >= 3) difficultyPrompt = " [INSTRUCCIÃ³N: Genera una pregunta de nivel 3 (ANALIZAR/EVALUAR). Requiere pensamiento crÃ­tico, contrastar ideas o inferir conclusiones complejas. Â¡DesafÃ­a al estudiante!]";
        }

        // Fix: Don't append question number for THEORY generation
        let questionSuffix = "";
        if (action !== 'start_route' && n8nAction !== 'Generar TeorÃ­a LÃºdica') {
            questionSuffix = questionNumberOverride ? ` [PREGUNTA NRO ${questionNumberOverride}]` : ` [PREGUNTA NRO ${quizQuestionNumber}]`;
        } else {
            difficultyPrompt = " [INSTRUCCIÃ³N: GENERAR SOLO TEORÃƒÂA EXPLICATIVA LÃ³aDICA. NO GENERAR PREGUNTAS.]";
        }

        const finalTopic = topic + difficultyPrompt + questionSuffix;

        try {
            // ALWAYS USE POST
            let body = {
                sujeto: subject,
                accion: n8nAction,
                tema: finalTopic, // Use modified topic
                nivel_estudiante: "1Ã‚Â° Medio Chile",
                numero_pregunta: questionNumberOverride || quizQuestionNumber
            };

            if (image) {
                body.image = image; // Base64
            }
            if (timestamp) {
                body.video_timestamp = timestamp;
                body.video_context = `Video: ${TODAYS_SESSION.videoTitle}`;
            }

            // UNIVERSAL POST STRATEGY
            // Always send params in URL too for N8N "Query" variable compat
            // UNIVERSAL POST STRATEGY
            // Always send params in URL too for N8N "Query" variable compat
            const params = new URLSearchParams({
                sujeto: subject,
                accion: n8nAction,
                tema: finalTopic, // Use modified topic
                nivel_estudiante: "1Ã‚Â° Medio Chile"
            });

            console.log("[N8N] Calling via POST:", activeWebhookUrl);
            console.log("[N8N] Action:", n8nAction);
            console.log("[N8N] Body:", body);

            const response = await fetch(`${activeWebhookUrl}?${params.toString()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            console.log("[N8N] Response status:", response.status, response.statusText);
            const textResponse = await response.text();
            console.log("[N8N] Response length:", textResponse.length);
            console.log("[N8N] Response preview:", textResponse.substring(0, 300));
            let content = "";

            if (textResponse.trim() === "") {
                content = "Ã³aÃ³Ã¯Â¸Â MODO OFFLINE";
            } else {
                try {
                    let jsonData = parseN8NResponse(textResponse);

                    if (jsonData.refusal) {
                        content = `Ã³aÃ³Ã¯Â¸Â **No pudimos iniciar:**\n\n${jsonData.refusal}`;
                        setApiJson(null);
                    } else {

                        // FIX: N8N Deeply Nested/Escaped JSON Unboxer (v7 Recursive)
                        let rawData = jsonData;
                        let depth = 0;
                        const MAX_DEPTH = 6;

                        // 0. Initial unwrap if keys like 'output' or 'text' hold the real payload
                        if (rawData && typeof rawData === 'object') {
                            if (rawData.output) rawData = rawData.output;
                            else if (rawData.text) rawData = rawData.text;
                        }

                        // 1. Recursive Parsing Loop
                        while (typeof rawData === 'string' && depth < MAX_DEPTH) {
                            depth++;
                            let candidate = rawData.trim();

                            // Remove Markdown fences if present
                            candidate = candidate.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

                            try {
                                // Try direct clean parse
                                rawData = JSON.parse(candidate);
                            } catch (e) {
                                // Parse failed, try to recover from "Bad Escaping" (e.g. \" -> " )
                                try {
                                    // Heuristic: If it starts with "{" but failed parse, maybe it's double escaped
                                    if (candidate.startsWith('"') || candidate.startsWith("'")) {
                                        // It's a string literal representation of a string, let JSON.parse unwrap one layer of quotes
                                        // This handles "{\"foo\":...}" -> {"foo":...}
                                        rawData = JSON.parse(candidate);
                                    } else {
                                        // It's a dirty string like {\"a\":1}. Try manual regex extract
                                        const jsonMatch = candidate.match(/({[\s\S]*})/);
                                        if (jsonMatch) {
                                            // Try to clean common bad escapes in the matched block
                                            let clean = jsonMatch[0]
                                                .replace(/\\"/g, '"')
                                                .replace(/\\n/g, '\n')
                                                .replace(/\\r/g, '');
                                            rawData = JSON.parse(clean);
                                        } else {
                                            // No JSON-like structure found, stop recursion (it's real text)
                                            break;
                                        }
                                    }
                                } catch (e2) {
                                    console.log(`[Unboxer] Depth ${depth} failed. Value snippet: ${candidate.substring(0, 50)}...`);
                                    break; // Stop if we can't make sense of it
                                }
                            }
                        }

                        // 2. Commit the unboxed data back to jsonData
                        if (rawData && typeof rawData === 'object') {
                            // If we found a valid object after unboxing, USE IT.
                            // Merge carefully: simple properties overwrite, but arrays/objects replace
                            if (rawData.questions || rawData.quiz) {
                                jsonData = rawData; // Trust the inner payload completely for quizzes
                            } else {
                                jsonData = { ...jsonData, ...rawData }; // Merge for other types
                                delete jsonData.output; // partial cleanup
                            }
                        }

                        let finalData = jsonData;
                        // Shuffle if quiz
                        if (jsonData.question && jsonData.options) {
                            finalData = shuffleQuizData(jsonData);
                        }
                        // Sanitize explanation
                        if (finalData.explanation && finalData.options) {
                            try {
                                finalData.explanation = sanitizeExplanation(finalData.explanation, finalData.options);
                            } catch (err) { console.error(err); }
                        }

                        // PRESERVE QUIZ BATCH: Don't destructure if it's a multi-question quiz
                        // (The InteractiveQuiz component expects {questions: [...]})

                        setApiJson(finalData);

                        // QUIZ DETECTION & AUTO-LAUNCH
                        const isBatchQuiz = finalData.questions && Array.isArray(finalData.questions) && finalData.questions.length > 0;
                        const isSingleQuiz = finalData.question && finalData.options;

                        if (isBatchQuiz || isSingleQuiz) {
                            // AUTO-LAUNCH QUIZ
                            console.log("Ã³xaÃ³ Auto-launching Quiz!");
                            const questionsToLoad = isBatchQuiz ? finalData.questions : [finalData];

                            setQuizQuestions(questionsToLoad);
                            setShowInteractiveQuiz(true);
                            setAiContent(null); // Ensure text modal is closed
                            return; // Stop execution here, quiz handles the UI
                        }

                        // STANDARD CONTENT DISPLAY (If NOT a quiz)
                        if (finalData.title && (finalData.capsule !== undefined)) {
                            // Theory Content
                            content = `### ${finalData.title}
**Unidad:** ${finalData.unit || ''} | *${finalData.oa_label || ''}*

${finalData.capsule}`;
                        } else {
                            // Fallback / Other
                            if (action === 'generate_quiz') {
                                content = "Error de formato: la IA no envio preguntas validas.\n\n" + JSON.stringify(finalData, null, 2);
                            } else {
                                content = finalData.output || finalData.text || finalData.theory || JSON.stringify(finalData, null, 2);
                            }
                        }
                    } // End if valid object
                } catch (err) {
                    console.error("JSON Process Error:", err);
                    content = textResponse;
                }
            }
            if (content) setAiContent(content);
        } catch (e) {
            console.error(e);
            setAiContent("Error de conexion");
        } finally {
            setIsCallingN8N(false);
            setAiModalOpen(true);
        }
    };

    if (authChecking) {
        return (
            <div className="min-h-screen bg-[#E0E5EC] flex items-center justify-center">
                <Loader className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!currentUser) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen bg-[#F0F4F8] p-6 relative overflow-hidden">
            {/* ALERTA GLOBAL CENTRADA */}
            {missedSessionAlert && (
                <div className="fixed inset-0 z-[999] grid place-items-center p-4 md:p-10 bg-[#2B2E4A]/40 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-2xl animate-clay-pop">
                        <div className="bg-amber-50 border-4 border-amber-200 rounded-[40px] p-8 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-[0_40px_120px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                            {/* Background Decoration */}
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                                <Clock className="w-32 h-32 text-amber-600" />
                            </div>

                            {/* Icon Container */}
                            <div className="w-20 h-20 rounded-[30px] bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg animate-float">
                                <RotateCcw className="w-10 h-10 text-white animate-spin-slow" />
                            </div>

                            {/* Text Content */}
                            <div className="flex flex-col text-center md:text-left">
                                <h3 className="text-amber-900 font-black text-2xl leading-tight uppercase tracking-tight mb-2">
                                    OJO AL PIOJO! TIENES ALGO PENDIENTE
                                </h3>
                                <div className="bg-white/40 rounded-3xl p-5 mb-4 border border-amber-200/50">
                                    <p className="text-amber-800 font-bold text-lg leading-relaxed">
                                        Hoy es <span className="text-amber-600 font-black uppercase">{repairText(missedSessionAlert.todayName)}</span> y el plan dice <span className="text-indigo-600 font-black uppercase text-xl">{repairText(missedSessionAlert.todaySubject)}</span>...
                                        <br /><br />
                                        Pero antes de pasar a ella, debemos completar la sesion de <strong className="text-amber-900">{repairText(missedSessionAlert.subject)} (Sesion {missedSessionAlert.session})</strong> que quedo atras.
                                    </p>
                                </div>
                                <p className="text-amber-600 font-black mt-1 text-sm flex items-center justify-center md:justify-start gap-2">
                                    No dejes huecos en tu camino!
                                </p>

                                <div className="flex gap-4 mt-6">
                                    <button
                                        onClick={() => setMissedSessionAlert(null)}
                                        className="w-full py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xl font-black rounded-2xl shadow-[0_10px_25px_rgba(217,119,6,0.3)] hover:shadow-[0_15px_40px_rgba(217,119,6,0.5)] hover:-translate-y-1 active:scale-95 transition-all uppercase tracking-wide"
                                    >
                                        ENTENDIDO, VAMOS!
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AMBIENT BACKGROUND LIGHTS & MOVEMENT (JUEGO DE SOMBRAS INTENSIFICADO) */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                {/* Capa 1: Pulso base de luz */}
                <div className="absolute inset-0 bg-[#F8FAFC] animate-pulse-subtle"></div>

                {/* Capa 2: Sombras de color gigantes (Depth) - Opacidad al 20% y Color Burn */}
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-[#4F46E5]/20 rounded-full blur-[140px] animate-blob-giant mix-blend-color-burn"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-[#0EA5E9]/20 rounded-full blur-[140px] animate-blob-giant animation-delay-4000 mix-blend-color-burn"></div>

                {/* Capa 3: Luces acentuadas (Vibrancy) - Opacidad al 15% */}
                <div className="absolute top-[20%] right-[10%] w-[50%] h-[60%] bg-[#E84393]/15 rounded-full blur-[110px] animate-blob-drift opacity-80 mix-blend-screen"></div>
                <div className="absolute bottom-[20%] left-[10%] w-[50%] h-[60%] bg-[#7C3AED]/15 rounded-full blur-[110px] animate-blob-drift animation-delay-2000 opacity-80 mix-blend-screen"></div>

                {/* Capa 4: Textura de lujo */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.06] mix-blend-overlay"></div>

                {/* Capa 5: Marco de sombra (Vignette Profundo) */}
                <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(43,46,74,0.15)] pointer-events-none"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* LOADING SCREEN WHILE FETCHING PROGRESS */}
                {loadingProgress && (
                    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
                        <div className="text-center">
                            <Loader className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-gray-800 mb-2">Cargando tu progreso...</h2>
                            <p className="text-gray-600">Conectando con el servidor</p>
                        </div>
                    </div>
                )}

                <VideoModal
                    isOpen={videoModalOpen}
                    onClose={() => setVideoModalOpen(false)}
                    videoUrl={TODAYS_SUBJECT.video_link}
                    title={TODAYS_SESSION.videoTitle}
                    onDoubt={(context) => {
                        setDoubtContext(context);
                        // setVideoModalOpen(false); // Close video (DISABLED FOR CONTEXT)
                        setAskModalOpen(true);    // Open ask modal
                    }}
                    onFinish={async () => {
                        setVideoModalOpen(false);
                        await saveProgress('video_completed', { title: TODAYS_SESSION.videoTitle, xp_reward: 50, session: TODAYS_SESSION.session });
                        const protocol = getSessionProtocolState();
                        if (protocol.requiresMandatoryTheory) {
                            await openTheoryForCurrentPhase({ mandatory: true });
                        }
                    }}
                />

                <ReadingModal
                    isOpen={readingModalOpen}
                    onClose={() => setReadingModalOpen(false)}
                    title={TODAYS_SESSION.readingTitle || "Lectura"}
                    content={TODAYS_SESSION.readingContent || ""}
                    onFinish={handleReadingFinish}
                />

                {/* THEORY MODAL - TeorÃ­a LÃºdica antes de cada sub-nivel */}
                <ReadingModal
                    isOpen={showTheoryModal}
                    onClose={() => setShowTheoryModal(false)}
                    title={theoryTitle}
                    content={theoryContent}
                    onFinish={handleContinueToQuiz}
                    buttonText="INICIAR QUIZ COMPLETO"
                />

                {showTheoryNotebookMission && (
                    <CuadernoMission
                        sessionId={TODAYS_SESSION.session}
                        subject={currentSubject}
                        topic={theoryTitle || TODAYS_SUBJECT.oa_title || 'TeorÃ­a lÃºdica'}
                        readingContent={theoryContent || aiContent || TODAYS_SESSION.readingContent || ''}
                        onComplete={handleTheoryNotebookComplete}
                        onSkip={isTheoryNotebookMandatory ? null : handleTheoryNotebookSkip}
                        userEmail={currentUser?.email}
                        userId={USER_ID}
                    />
                )}

                <QuestionModal
                    isOpen={askModalOpen}
                    onClose={() => {
                        setAskModalOpen(false);
                        setDoubtContext(null); // Clear context on close
                    }}
                    onSubmit={(question, image, timestamp, context) => {
                        setAskModalOpen(false); // Close explicitly to show loading/result over video
                        // Combine question with context details for the 'topic' argument
                        let fullTopic = question;
                        if (context && context.type === 'video') {
                            fullTopic = `[Context: Video "${context.title}"] ${question}`;
                        }
                        callAgent(currentSubject, 'answer_doubts', fullTopic, image, timestamp);
                    }}
                    isCallingN8N={isCallingN8N}
                    initialContext={doubtContext}
                />

                {/* NEW LOADING OVERLAY */}
                <LoadingOverlay isOpen={isCallingN8N} message={loadingMessage} diagnostics={loadingDiagnostics} />

                <AIContentModal
                    isOpen={aiModalOpen}
                    onClose={() => setAiModalOpen(false)}
                    content={aiContent}
                    subject={currentSubject}
                    callAgent={callAgent}
                    isCallingN8N={isCallingN8N}
                routeTitle={repairText(TODAYS_SUBJECT.oa_title)}
                    apiJson={apiJson}
                    quizStats={quizStats}
                    updateQuizStats={updateQuizStats}
                    quizLevel={quizLevel} // Pass Level
                    setQuizLevel={setQuizLevel}
                    quizQuestionNumber={quizQuestionNumber}
                    setQuizQuestionNumber={setQuizQuestionNumber}
                    userQuery={lastUserQuery}
                    onAskDoubt={() => { setLastUserQuery(""); setAskModalOpen(true); }}
                    onStartQuiz={startFullQuiz}
                    quizProgress={getQuizProgress()} // NEW: Pass quiz progress for UI
                />

                <div className="space-y-6 max-w-5xl mx-auto animate-fade-in relative">
                    <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 mb-8 animate-fade-in-up">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
                            {/* RADIAL GLOW BEHIND MATICO */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#4F46E5]/10 rounded-full blur-3xl animate-pulse"></div>

                            <div className="relative">
                                <MaticoAvatar
                                    mood={isCallingN8N ? 'thinking' : 'excited'}
                                    size="md"
                                    isThinking={isCallingN8N}
                                    onClick={() => setAskModalOpen(true)}
                                />
                            </div>

                            <div className="flex flex-col items-center md:items-start text-center md:text-left pt-2 relative z-10">
                                <h1 className="text-4xl font-black text-[#2B2E4A] mb-1 drop-shadow-sm">
                                    Hola, {repairText(currentUser?.username || userProfile?.username || 'Estudiante')}!
                                </h1>
                                <p className="text-[#9094A6] font-bold text-base max-w-md leading-tight mb-6">
                                    Sistema activo. Hoy dedicaremos la hora completa a:{' '}
                                    <span className="text-[#2B2E4A] bg-white px-2 py-0.5 rounded-lg shadow-sm border border-white/50 font-black inline-block mt-1" style={{ color: TODAYS_SUBJECT.color }}>
                                        {repairText(TODAYS_SUBJECT.name)}
                                    </span>
                                </p>


                                <button
                                    onClick={() => setAskModalOpen(true)}
                                    className="group relative flex items-center gap-3 px-5 py-3 bg-white text-[#4F46E5] rounded-2xl border border-[#D9E1FF] shadow-[0_8px_18px_rgba(79,70,229,0.08)] hover:bg-[#F7F8FF] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.99] overflow-hidden max-w-md"
                                >
                                    <div className="relative flex items-center justify-center w-9 h-9 bg-[#EEF2FF] rounded-xl group-hover:rotate-12 transition-transform">
                                        <MessageCircle className="w-5 h-5 text-[#4F46E5]" />
                                    </div>
                                    <div className="flex flex-col items-start leading-tight text-left">
                                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#7C83B9]">AYUDA RAPIDA</span>
                                        <span className="text-sm font-black tracking-tight">Tengo una duda</span>
                                    </div>
                                    <ArrowRight className="w-5 h-5 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                            </div>
                        </div>

                        {/* STATS & SETTINGS BACK TO THE RIGHT SIDE */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-4 mt-4 md:mt-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                            <div className="inline-flex items-center gap-2 bg-[#1E293B] text-[#FACC15] px-5 py-2.5 rounded-2xl font-black text-sm shadow-[0_10px_20px_rgba(30,41,59,0.2)] border-2 border-[#334155] animate-float">
                                <Star className="w-5 h-5 fill-current" />
                                {userProfile?.xp || 0} XP
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSettingsOpen(true)} className="p-3.5 bg-white rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.05)] border-2 border-white transition-all hover:shadow-xl hover:-translate-y-1 group hover:border-indigo-100" title="Configuracion">
                                    <Settings className="w-8 h-8 text-[#64748B] group-hover:text-indigo-600 transition-transform group-hover:rotate-90" />
                                </button>
                                <button onClick={() => fetchProfile()} className="p-3.5 bg-white rounded-2xl shadow-[0_10px_20_rgba(0,0,0,0.05)] border-2 border-white transition-all hover:shadow-xl hover:-translate-y-1 group hover:border-blue-100" title="Actualizar Progreso">
                                    <RotateCcw className={`w-7 h-7 text-[#64748B] group-hover:text-blue-500 ${isCallingN8N ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#7C3AED]">Mas opciones</p>
                                <h3 className="text-lg font-black text-[#2B2E4A]">Cambiar materia si hace falta</h3>
                            </div>
                            <p className="text-xs font-semibold text-[#6F7688] max-w-lg">
                                Lo principal es la sesion de hoy. Estas materias solo cambian el foco cuando quieras otra ruta.
                            </p>
                        </div>

                        {/* NEW: HORIZONTAL SUBJECT LINE (Web Format) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-7">
                            <button
                                onClick={() => setCurrentSubject('MATEMATICA')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'MATEMATICA' ? 'hover:brightness-110 !bg-[#4D96FF] !text-white !border-[#3B80E6] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(77,150,255,0.6)]' : '!bg-[#4D96FF]/10 !text-[#4D96FF] !border-[#4D96FF]/30'}`}
                            >
                                Mate
                            </button>
                            <button
                                onClick={() => setCurrentSubject('LENGUAJE')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'LENGUAJE' ? 'hover:brightness-110 !bg-[#FF7675] !text-white !border-[#E84393] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,118,117,0.6)]' : '!bg-[#FF7675]/10 !text-[#FF7675] !border-[#FF7675]/30'}`}
                            >
                                Lenguaje
                            </button>
                            <button
                                onClick={() => setCurrentSubject('FISICA')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'FISICA' ? 'hover:brightness-110 !bg-[#9D4EDD] !text-white !border-[#8A3CC2] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(157,78,221,0.6)]' : '!bg-[#9D4EDD]/10 !text-[#9D4EDD] !border-[#9D4EDD]/30'}`}
                            >
                                Fisica
                            </button>
                            <button
                                onClick={() => setCurrentSubject('QUIMICA')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'QUIMICA' ? 'hover:brightness-110 !bg-[#E84393] !text-white !border-[#C23678] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(232,67,147,0.6)]' : '!bg-[#E84393]/10 !text-[#E84393] !border-[#E84393]/30'}`}
                            >
                                Quimica
                            </button>
                            <button
                                onClick={() => setCurrentSubject('BIOLOGIA')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'BIOLOGIA' ? 'hover:brightness-110 !bg-[#2ECC71] !text-white !border-[#27AE60] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(46,204,113,0.6)]' : '!bg-[#2ECC71]/10 !text-[#2ECC71] !border-[#2ECC71]/30'}`}
                            >
                                Biologia
                            </button>
                            <button
                                onClick={() => setCurrentSubject('HISTORIA')}
                                className={`${clayBtnPrimary} !w-full !py-2.5 !px-1 !text-xs ${currentSubject === 'HISTORIA' ? 'hover:brightness-110 !bg-[#E67E22] !text-white !border-[#D35400] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(230,126,34,0.6)]' : '!bg-[#E67E22]/10 !text-[#E67E22] !border-[#E67E22]/30'}`}
                            >
                                Historia
                            </button>
                        </div>

                        <div className="w-full">
                            <AnnualRaceBar currentDay={TODAYS_SESSION.session} totalDays={43} />
                        </div>
                    </div>

                    <div className="mt-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <div className="space-y-8">
                            <div className={`${clayCard} relative overflow-visible`}>
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-[#2B2E4A] mb-1" style={{ color: TODAYS_SUBJECT.color }}>
                                            Ruta extendida de {repairText(TODAYS_SUBJECT.name)}: <span className="text-base font-bold text-[#9094A6] block">{repairText(TODAYS_SUBJECT.oa_title)}</span>
                                        </h2>
                                        <p className="text-[#9094A6] font-bold text-sm">Sesion {TODAYS_SESSION.session}: {repairText(TODAYS_SESSION.topic)}</p>

                                        {/* INDICADOR DE PROGRESO KAIZEN */}
                                        {(() => {
                                            const progress = getQuizProgress();
                                            const phaseNames = { 1: "Basico", 2: "Avanzado", 3: "Critico" };
                                            const phaseColors = {
                                                1: "bg-green-100 text-green-700 border-green-300",
                                                2: "bg-yellow-100 text-yellow-700 border-yellow-300",
                                                3: "bg-red-100 text-red-700 border-red-300"
                                            };

                                            if (progress.currentPhase <= 3) {
                                                const questionsCompleted = (progress.currentPhase - 1) * QUIZ_PHASE_QUESTIONS;
                                                return (
                                                    <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs font-black border-2 ${phaseColors[progress.currentPhase]} animate-pulse`}>
                                                        Siguiente Nivel: {phaseNames[progress.currentPhase]} | {questionsCompleted}/{QUIZ_TOTAL_QUESTIONS} preguntas completadas
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <div className="w-14 h-14 rounded-full bg-[#E0E5EC] flex items-center justify-center">
                                        <TODAYS_SUBJECT.icon className="w-8 h-8 animate-float" style={{ color: TODAYS_SUBJECT.color }} />
                                    </div>
                                </div>

                                                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-[#7C3AED]">
                                    <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                                    Continuar plan
                                </div>
                                <p className="mb-6 text-sm font-semibold text-[#6F7688]">
                                    Aqui continuas con la ruta diaria completa y las opciones avanzadas.
                                </p>

                                {/* ROUTE STEPS RENDERER (HORIZONTAL) */}
                                <div className="py-6">
                                    <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                                        {dailyRoute.daily_route_steps.map((step, idx) => {
                                            const IconComponent = step.icon === "Play" ? Play : (step.icon === "Brain" ? Brain : (step.icon === "MessageCircle" ? MessageCircle : Lock));

                                            const handleClick = () => {
                                                if (idx === 0) handleStartSession();
                                                if (idx === 1) openTheoryForCurrentPhase({ mandatory: false });
                                                if (idx === 2) startFullQuiz();
                                                if (idx === 3) setAskModalOpen(true);
                                            };

                                            let btnStyle = "bg-[#E5E5E5] border-[#CECECE] text-[#AFAFAF]";
                                            if (idx === 0) btnStyle = "bg-[#58CC02] border-[#46A302] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(88,204,2,0.6)]";
                                            else if (idx === 1) btnStyle = "bg-[#1CB0F6] border-[#1899D6] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(28,176,246,0.6)]";
                                            else if (idx === 2) btnStyle = "bg-[#FFD900] border-[#E5C300] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,217,0,0.6)]";
                                            else btnStyle = "bg-[#FF4B4B] border-[#D63E3E] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,75,75,0.6)]";

                                            const subtitle = idx === 0
                                                ? "CLASE DE HOY"
                                                : (idx === 1 ? "TEORIA IA" : (idx === 3 ? "CONSULTA" : "45 PREGUNTAS KAIZEN"));

                                            return (
                                                <div key={idx} className="snap-start shrink-0 w-[260px]">
                                                    <div className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-4 shadow-sm h-full">
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={handleClick}
                                                                className={`w-20 h-20 rounded-full flex items-center justify-center border-b-8 transition-all duration-300 hover:scale-105 active:border-b-0 active:translate-y-1 ${btnStyle}`}
                                                            >
                                                                <IconComponent className="w-9 h-9" fill="currentColor" />
                                                            </button>
                                                            <div className="min-w-0">
                                                                <h3 className="font-black text-[#2B2E4A] text-base leading-tight uppercase">
                                                                    {repairText(step.step)}
                                                                </h3>
                                                                <p className="text-[#9094A6] text-xs font-bold mt-1 uppercase">
                                                                    {subtitle}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-12">
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={openPrepExamSetup}
                                            className={`${clayBtnAction} !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}
                                            disabled={isCallingN8N}
                                        >
                                            MAS OPCIONES: PRUEBA PREPARATORIA 45 <Flag className="w-5 h-5 ml-2" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#4D96FF]">Practica de apoyo</p>
                                            <h3 className="text-lg font-black text-[#2B2E4A]">Refuerzo y prueba a tu medida</h3>
                                        </div>
                                        <p className="text-xs font-semibold text-[#6F7688] max-w-lg">
                                            Primero sesion diaria (recomendado), pero puedes practicar cuando lo necesites.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="rounded-[28px] border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 md:p-6 shadow-[0_12px_28px_rgba(77,150,255,0.08)]">
                                            <div className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr] 2xl:items-center">
                                                <div className="space-y-3">
                                                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-[#4D96FF]">
                                                        <span className="h-2 w-2 rounded-full bg-[#4D96FF]" />
                                                        Ruta adaptativa - {repairText(adaptiveGradeLabel)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xl md:text-2xl font-black leading-tight text-[#2B2E4A]">
                                                            {adaptiveNextActionLabel}
                                                        </p>
                                                        <p className="mt-2 text-sm md:text-[15px] font-semibold leading-relaxed text-[#6F7688] max-w-xl">
                                                            {adaptiveWeakTopicsDescription}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-stretch gap-4">
                                                    <button
                                                        onClick={() => openPrepExamSetup(adaptiveWeakSessions.map(item => Number(item.session)).filter(Boolean))}
                                                        className={`${clayBtnAction} !w-full !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6] !min-h-[58px] !text-base`}
                                                    >
                                                        <span>REPASAR SESIONES DEBILES</span>
                                                        <ArrowRight className="w-5 h-5 ml-2" />
                                                    </button>

                                                    <div className="flex flex-wrap gap-2">
                                                        {adaptiveWeakSessions.length > 0 ? adaptiveWeakSessions.slice(0, 4).map((item) => (
                                                            <span
                                                                key={`${item.subject || currentSubject}-${item.session}`}
                                                                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-indigo-100 px-3 py-1.5 text-xs font-black text-[#4D96FF] shadow-sm"
                                                                title={`${getAdaptiveWeakSessionTopic(item)} · Sesion ${item.session}`}
                                                            >
                                                                <span className="h-2 w-2 rounded-full bg-[#4D96FF]/70" />
                                                                {getAdaptiveWeakSessionTopic(item)} · S{item.session}
                                                            </span>
                                                        )) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-600 shadow-sm">
                                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                Sin sesiones debiles marcadas todavia
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[28px] border-2 border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 md:p-6 shadow-[0_12px_28px_rgba(124,58,237,0.08)]">
                                            <div className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr] 2xl:items-center">
                                                <div className="space-y-3">
                                                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-[#7C3AED]">
                                                        <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                                                        Oraculo Matico
                                                    </div>
                                                    <div>
                                                        <p className="text-xl md:text-2xl font-black leading-tight text-[#2B2E4A]">
                                                            Prueba a tu medida, incluso si el libro o tema no esta en las sesiones de tu curso
                                                        </p>
                                                        <p className="mt-2 text-sm md:text-[15px] font-semibold leading-relaxed text-[#6F7688] max-w-xl">
                                                            Si necesitas practicar una materia, un libro o un capitulo especifico, entra al Oraculo y Matico te arma una prueba para que practiques.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-stretch gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setPrepExamOracleSubject(currentSubject);
                                                            setPrepExamOracleSession(TODAYS_SESSION.session || 1);
                                                            setPrepExamOraclePrompt('');
                                                            setPrepExamOracleQuestionCount(15);
                                                            setShowOraclePrepModal(true);
                                                        }}
                                                        className={`${clayBtnAction} !w-full !bg-[#7C3AED] !border-[#6D28D9] hover:!bg-[#6D28D9] !min-h-[58px] !text-base`}
                                                    >
                                                        <span>ORACULO MATICO</span>
                                                        <MessageCircle className="w-5 h-5 ml-2" />
                                                    </button>
                                                    <p className="text-xs font-bold text-[#6F7688] leading-relaxed px-1">
                                                        Ideal para pruebas de libro, ensayo por materia o practica extra cuando no hay contenido cargado.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interactive Quiz Modal */}
                {
                    showInteractiveQuiz && quizQuestions && quizQuestions.length > 0 && (
                        <InteractiveQuiz
                            questions={quizQuestions}
                            phase={isPrepExamMode ? undefined : currentQuizPhase}
                            sessionId={isPrepExamMode ? (prepExamConfig?.sessions || []).join(',') : todayIndex + 1}
                            subject={currentSubject}
                            readingContent=""
                            quizMode={isPrepExamMode ? 'prep_exam' : 'normal'}
                            totalQuestions={isPrepExamMode ? (prepExamConfig?.questionCount || 45) : 15}
                            onRequestNextBatch={isPrepExamMode ? requestNextPrepExamBatch : requestNextNormalQuizBatch}
                            userEmail={currentUser?.email}
                            userId={USER_ID}
                            onComplete={async (score, wrongAnswers, completionMeta = {}) => {
                                if (isPrepExamMode) {
                                    const finalWrongAnswers = wrongAnswers || [];
                                    const report = buildPrepExamReport(prepExamQuestions, finalWrongAnswers, prepExamConfig);

                                    await saveProgress('prep_exam_completed', {
                                        subject: prepExamConfig.subject,
                                        session: prepExamConfig.sessions.join(','),
                                        selected_sessions: prepExamConfig.sessions.join(','),
                                        score: report.totalCorrect,
                                        total_questions: report.totalQuestions,
                                        weak_sessions: report.weakSessions.map(item => item.session).join(','),
                                        xp_reward: 150
                                    });

                                    setPrepExamReport(report);
                                    setShowPrepExamResults(true);
                                    return;
                                }

                                if (completionMeta.failedByLives) {
                                    const restartedQuestions = await restartQuizPhaseFromZero(currentQuizPhase, wrongAnswers || []);
                                    return {
                                        restartPhase: true,
                                        questions: restartedQuestions
                                    };
                                }

                                console.log(`Quiz Fase ${currentQuizPhase} completado:`, score, 'errores:', wrongAnswers?.length);
                                await onQuizPhaseComplete(score, wrongAnswers || []);
                            }}
                            onClose={() => {
                                setShowInteractiveQuiz(false);
                                resetNormalQuizBatchLoading();
                                setBackgroundQuestionsQueue([]);
                                setIsLoadingNextBatch(false);
                                backgroundTaskRef.current = null;
                                if (isPrepExamMode) {
                                    setIsPrepExamMode(false);
                                    setQuizQuestions([]);
                                    setPrepExamLoadedCount(0);
                                    prepExamBatchRef.current = 0;
                                    prepExamNextBatchPromiseRef.current = null;
                                    prepExamBackgroundLoadRef.current = false;
                                    return;
                                }
                                window.location.reload();
                            }}
                        />
                    )
                }
                <PrepExamSetupModal
                    isOpen={showPrepExamSetup}
                    onClose={() => setShowPrepExamSetup(false)}
                    subject={currentSubject}
                    syllabus={ACTIVE_SYLLABUS}
                    selectedSessions={selectedPrepSessions}
                    onToggleSession={togglePrepSession}
                    onStart={startPrepExam}
                    isLoading={isCallingN8N}
                />

                <OraclePrepModal
                    isOpen={showOraclePrepModal}
                    onClose={() => setShowOraclePrepModal(false)}
                    subject={prepExamOracleSubject}
                    onChangeSubject={setPrepExamOracleSubject}
                    session={prepExamOracleSession}
                    onChangeSession={setPrepExamOracleSession}
                    prompt={prepExamOraclePrompt}
                    onChangePrompt={setPrepExamOraclePrompt}
                    questionCount={prepExamOracleQuestionCount}
                    onChangeQuestionCount={setPrepExamOracleQuestionCount}
                    onStart={startOraclePrepExam}
                    isLoading={isCallingN8N}
                />

                <PrepExamResultsModal
                    isOpen={showPrepExamResults}
                    report={prepExamReport}
                    onClose={() => {
                        setShowPrepExamResults(false);
                        setIsPrepExamMode(false);
                        setPrepExamQuestions([]);
                    }}
                    onReview={requestPrepExamReview}
                />

                <AdminNotebookFilesModal
                    isOpen={showAdminFilesModal}
                    onClose={() => setShowAdminFilesModal(false)}
                    files={adminNotebookFiles}
                    isLoading={isLoadingAdminFiles}
                    onRefresh={loadAdminNotebookFiles}
                    onDelete={deleteAdminNotebookFile}
                />

                <AdminGeneratedQuestionsModal
                    isOpen={showAdminGeneratedQuestionsModal}
                    onClose={() => setShowAdminGeneratedQuestionsModal(false)}
                    items={adminGeneratedQuestions}
                    isLoading={isLoadingAdminGeneratedQuestions}
                    onRefresh={loadAdminGeneratedQuestions}
                    onDelete={deleteAdminGeneratedQuestion}
                />

                {/* SETTINGS MODAL */}
                {settingsOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2B2E4A]/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-[#F4F7FF] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border-4 border-white animate-clay-pop">
                            {/* Modal Header */}
                            <div className="bg-white px-6 py-4 border-b-2 border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-[#2B2E4A]" />
                                    <h3 className="text-lg font-black text-[#2B2E4A]">Configuracion</h3>
                                </div>
                                <button
                                    onClick={() => setSettingsOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                                {/* USER PROFILE SECTION */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Brain className="w-3 h-3" /> Perfil de Usuario
                                    </h4>
                                    <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl shadow-inner border border-blue-200">
                                                    @
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">Email</span>
                                                    <span className="text-sm font-bold text-gray-700 truncate">{currentUser?.email}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl shadow-inner border border-purple-200">
                                                    #
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">User ID</span>
                                                    <span className="text-[10px] font-mono text-gray-500 break-all">{currentUser?.user_id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* NOTIFICATION PREFERENCES */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Lock className="w-3 h-3" /> Alertas Diario
                                    </h4>
                                    <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm space-y-4">
                                        {/* LOCKED MANDATORY ALARM */}
                                        <div className="flex items-center justify-between opacity-80 cursor-not-allowed">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                                                    <RotateCcw className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">Morning Alarms</span>
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Obligatorio</span>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <div className="block w-10 h-6 rounded-full bg-blue-500/50"></div>
                                                <div className="absolute left-5 top-1 bg-white w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                                    <Lock className="w-2 h-2 text-blue-500" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* OPTIONAL DAILY PROGRESS REPORTS */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">Daily Reports</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Reporte Nocturno</span>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={progressReportsEnabled}
                                                    onChange={(e) => updateNotificationPrefs('progress_reports', e.target.checked)}
                                                />
                                                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 shadow-inner"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* SYSTEM & ENVIRONMENT */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Server className="w-3 h-3" /> Sistema y Entorno
                                    </h4>
                                    <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-gray-700">Modo de Conexion</span>
                                            <button
                                                onClick={() => setActiveWebhookUrl(prev => prev === N8N_URLS.test ? N8N_URLS.production : N8N_URLS.test)}
                                                className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all border-2 ${activeWebhookUrl === N8N_URLS.test
                                                    ? 'bg-gray-100 text-gray-500 border-gray-200'
                                                    : 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                                                    }`}
                                            >
                                                {activeWebhookUrl === N8N_URLS.test ? 'TEST MODE' : 'PRODUCTION'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const fiveDaysAgo = new Date();
                                                fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
                                                localStorage.setItem('MATICO_START_DATE', fiveDaysAgo.toISOString());
                                                localStorage.removeItem(completedSessionsStorageKey);
                                                localStorage.removeItem(quizProgressStorageKey);
                                                alert("Simulacion: inicio hace 5 dias. Debes ponerte al dia.");
                                                window.location.reload();
                                            }}
                                            className="w-full text-[10px] font-black text-blue-500 uppercase tracking-widest py-2 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                            SIMULAR ATRASO (5 DIAS)
                                        </button>
                                    </div>
                                </div>

                                {isAdminUser && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Shield className="w-3 h-3" /> Administrador
                                        </h4>
                                        <div className="bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm flex flex-col gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                                                    <FileText className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">PDFs del cuaderno</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Ver y borrar archivos del VPS</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={openAdminFilesModal}
                                                className={`${clayBtnAction} !bg-[#E67E22] !border-[#D35400] hover:!bg-[#D35400]`}
                                            >
                                                VER PDFS DEL VPS <FileText className="w-5 h-5" />
                                            </button>

                                            <div className="h-px bg-gray-100" />

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                                                    <Database className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">Banco de preguntas IA</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Descargar o eliminar preguntas generadas</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={openAdminGeneratedQuestionsModal}
                                                className={`${clayBtnAction} !bg-[#4D96FF] !border-[#3B80E6] hover:!bg-[#3B80E6]`}
                                            >
                                                VER BANCO IA <Database className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* LOGOUT */}
                                <button
                                    onClick={() => {
                                        handleLogout();
                                    }}
                                    className="w-full py-4 bg-red-50 text-red-600 font-black rounded-2xl border-2 border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Cerrar Sesion
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;




