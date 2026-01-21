import React, { useState, useEffect, useRef } from 'react';
import MathRenderer from './components/MathRenderer';
import InteractiveQuiz from './components/InteractiveQuiz';
import LoginPage from './components/LoginPage';
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
    PieChart,
    Server,
    Database,
    Lightbulb,
    Wifi,
    WifiOff,
    ExternalLink,
    HelpCircle,
    Loader,
    Image as ImageIcon, Maximize, Minimize
    , FlaskConical, Globe
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

const parseMarkdown = (text) => {
    if (!text) return '';

    // Helper to process markdown on TEXT sections only
    const processText = (t) => {
        return t
            .replace(/\\n/g, '<br />')
            .replace(/\n/g, '<br />')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/####\s*(.*?)(<br \/>|$)/g, '<h4 class="font-bold text-lg text-[#2B2E4A] mt-4 mb-2">$1</h4>')
            .replace(/###\s*(.*?)(<br \/>|$)/g, '<h3 class="font-black text-xl text-[#2B2E4A] mt-6 mb-3">$1</h3>');
    };

    // Split by Math delimiters: $$, \[, \(, and SINGLE $
    // Order matters: match double dollar first to avoid incorrect split
    // Regex: (Double Dollar | Display Bracket | Inline Bracket | Single Dollar)
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[\s\S]*?\$)/g);

    return parts.map(part => {
        // Identify if part is math. Steps:
        // 1. Starts with $$
        // 2. Starts with \[
        // 3. Starts with \(
        // 4. Starts with $ (and ends with $, length > 1)

        if (part.startsWith('$$') || part.startsWith('\\[') || part.startsWith('\\(')) {
            return part;
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
            return part;
        }

        return processText(part);
    }).join('');
};

// MathRenderer moved to ./components/MathRenderer.jsx

const N8N_URLS = {
    production: "/webhook/MATICO",
    test: "/webhook-test/MATICO"
};

// SELECT ACTIVE URL HERE


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
        unit: 'Diagnóstico',
        topic: 'Comprensión Lectora: La vida simplemente',
        videoTitle: 'Contexto Histórico (Opcional)',
        videoLink: 'https://www.youtube.com/watch?v=Fyy9nGemSqU',
        readingTitle: 'La vida simplemente (Resumen y Análisis)',
        readingContent: `En las profundidades de la ciudad de Rancagua, durante las primeras décadas del siglo XX, la existencia parecía transcurrir bajo una ley distinta a la del resto del mundo, una ley dictada por la geografía del desamparo y el peso del lodo. Allí se extendía el legendario "Callejón de la Muerte", un rincón donde la dignidad humana libraba una batalla diaria contra la precariedad y el olvido. Roberto, el protagonista de este relato, creció respirando el aire cargado de humedad de este callejón, donde las viviendas no eran más que precarias estructuras de tablas y latas que apenas lograban sostenerse en pie sobre un suelo que, con cada lluvia, se convertía en un pantano voraz. Para Roberto, el barro no era simplemente suciedad en los zapatos; era un elemento vivo, una presencia constante que simbolizaba la inmovilidad de la pobreza, esa fuerza que parecía querer succionar cualquier sueño de libertad que intentara elevarse por encima de los techos de zinc.

El centro del universo de Roberto era una casa de remolienda, un burdel que funcionaba bajo la administración implacable de su tía, Doña Munda. Aquella mujer era el pilar de un negocio que florecía en medio de la miseria, una figura de autoridad que se movía entre el estrépito de las botellas, el humo denso de los cigarrillos "Yolanda" y las risas fingidas de las mujeres que allí trabajaban. Munda entendía la vida como un sistema de engranajes donde el dinero era el único aceite capaz de evitar el colapso, y su carácter se había forjado con la dureza de quien sabe que en el callejón no hay espacio para la debilidad. En un rincón opuesto de esa misma casa habitaba la madre de Roberto, una presencia de dulzura casi milagrosa en aquel ambiente. Ella era la cara de la resignación amorosa, una mujer que se desgastaba físicamente para que su hijo tuviera lo que el entorno le negaba: un rastro de limpieza en su ropa y una barrera protectora, aunque fuera frágil, contra la crudeza de lo que sucedía tras las cortinas del burdel. Roberto creció observando esta dualidad: la fuerza de la tía que garantizaba la supervivencia y la ternura de la madre que alimentaba su alma.

Durante su primera infancia, el mundo de Roberto se limitaba a los límites del callejón y al vasto "pajonal", un terreno baldío donde la naturaleza salvaje se mezclaba con los desperdicios de la ciudad. Allí, junto a otros niños de rodillas costrosas y mirada despierta, Roberto descubría los secretos de la vida a través del juego. En el pajonal, los niños eran reyes de reinos invisibles, pero también eran receptores de los miedos colectivos que los adultos sembraban para controlarlos. Historias sobre el "Viejo del Saco" o el "Culebrón" poblaban sus pesadillas nocturnas, dándole una forma fantástica a los peligros reales que acechaban en la oscuridad. Sin embargo, a medida que Roberto dejaba de ser un niño pequeño, empezó a notar que los hombres que llegaban a la casa de su tía eran más aterradores que cualquier monstruo de cuento; eran hombres consumidos por el alcohol, por el trabajo agotador en las minas o en el campo, que buscaban un momento de olvido en los brazos de mujeres que, al igual que ellos, solo intentaban sobrevivir un día más.

El gran quiebre en la vida de Roberto, el momento en que su horizonte dejó de ser una pared de madera podrida, fue su entrada en la escuela pública. Al principio, la escuela representaba un lugar extraño, con sus reglas rígidas y su atmósfera de orden que contrastaba violentamente con el caos del callejón. Pero fue allí donde Roberto se encontró con el poder transformador de las letras. Su profesor, un hombre que supo detectar la inteligencia vivaz que se escondía tras la apariencia humilde del niño, se convirtió en su mentor silencioso. Roberto descubrió que las palabras eran herramientas, llaves capaces de abrir celdas invisibles. Cada libro que caía en sus manos —desde cuentos de aventuras hasta poemas de grandes autores— era una invitación a un mundo donde la justicia no era un concepto abstracto y donde la belleza no estaba prohibida para los pobres. La lectura despertó en él una sensibilidad que lo alejaba de sus pares; mientras otros niños aceptaban su destino como obreros o delincuentes en potencia, Roberto empezaba a soñar con ser escritor, con tener una voz que pudiera narrar el dolor de su gente.

Sin embargo, este despertar intelectual trajo consigo el veneno de la conciencia de clase. Al salir de su barrio para ir a la escuela o al centro de Rancagua, Roberto comenzó a percibir las miradas de los "otros". Notaba cómo las personas de las casas sólidas y jardines cuidados se apartaban al paso de alguien que venía del callejón, cómo la policía trataba con sospecha a cualquiera que tuviera el rastro del barro en su vestimenta. Surgió entonces una contradicción dolorosa en su pecho: el amor profundo y la gratitud que sentía por su madre y su tía se mezclaban con una vergüenza punzante por el origen de su sustento. Se sentía un traidor al avergonzarse de la casa donde recibía alimento, pero no podía evitar el asco moral que le producía el negocio de la prostitución y la degradación humana que veía a diario. Esta lucha interna marcó su paso de la niñez a la adolescencia, convirtiéndolo en un observador melancólico de su propia realidad.

A medida que Roberto crecía, también veía cómo sus amigos de la infancia eran devorados por la maquinaria del callejón. Algunos terminaban en la cárcel, otros se perdían en el vicio del juego y el aguardiente, y muchos simplemente desaparecían en la mediocridad de un trabajo que les robaba la juventud. Roberto veía en ellos su propio reflejo si decidía rendirse. La novela detalla cómo las experiencias de Roberto en el burdel le enseñaron sobre la naturaleza humana más que cualquier manual de psicología: vio la soledad de los hombres, la desesperación de las mujeres y la fragilidad de las promesas. Todo ese cúmulo de experiencias fue fermentando en su interior. Comprendió que la frase "la vida simplemente" era lo que la gente decía para justificar su falta de lucha, para aceptar que el mundo era así y nada podía cambiarse. Pero él, armado con la educación que tanto le costó conseguir y con la pluma que empezaba a manejar con destreza, decidió que su vida no sería "simplemente" lo que el azar decidió.

Hacia el final de su proceso de formación, Roberto logra una madurez que lo sitúa por encima de sus circunstancias. Comprende que no necesita borrar su pasado ni renegar de su madre para ser alguien; por el contrario, su origen es su mayor fuente de verdad. El libro concluye con una imagen de esperanza contenida: Roberto sabe que el camino hacia afuera del callejón es largo y que todavía tendrá que pisar mucho barro, pero su mente ya ha cruzado el pajonal y ha llegado a las estrellas. Ha entendido que la educación no es solo acumular datos, sino la capacidad de entender el mundo para transformarlo. Al final, Roberto se convierte en el cronista de los olvidados, en aquel que dará testimonio de que en el Callejón de la Muerte también hubo amor, sueños y una lucha incansable por la dignidad. La historia termina no con un final feliz de cuento de hadas, sino con la victoria real de un joven que ha conquistado su propia identidad y que está listo para escribir su destino, dejando atrás la resignación para abrazar la posibilidad de una vida que sea mucho más que "simplemente" existir.`
    },
    {
        session: 2,
        unit: 'Narrativa',
        topic: 'Narrador y Conflicto: Frankenstein',
        videoTitle: 'LENGUAJE | El Narrador | Clase N°4',
        videoLink: 'https://www.youtube.com/watch?v=0Vv5aIgDp9c',
        readingTitle: 'Frankenstein (Fragmento)',
        readingContent: `La historia de Victor Frankenstein no comienza en un laboratorio oscuro, sino en la idílica y refinada ciudad de Ginebra, rodeado de una familia que personificaba la bondad y el orden. Victor fue un niño amado, el hijo primogénito de Alphonse Frankenstein, un hombre de leyes respetado, y de Caroline Beaufort, una mujer cuya compasión la llevaba a buscar a los más necesitados. Fue en uno de esos viajes de caridad donde la familia adoptó a Elizabeth Lavenza, una niña de una belleza casi angelical que se convirtió en la compañera inseparable de Victor y, con el tiempo, en el amor de su vida. Junto a ellos creció también Henry Clerval, un joven de espíritu noble y poético que representaba la humanidad y el arte, en contraste con la mente analítica y curiosa de Victor. Esta infancia perfecta, sin embargo, sembró en el joven Frankenstein una sed de conocimiento que no conocía límites. Mientras sus amigos se interesaban por la política o la literatura, Victor se sumergía en los textos antiguos de alquimistas como Cornelio Agrippa y Paracelso, buscando en sus páginas el secreto para dominar la vida y la muerte.

La tragedia golpeó su hogar cuando la fiebre escarlatina se llevó a su madre, cuya última voluntad fue ver a Victor y Elizabeth unidos en matrimonio. Este dolor, en lugar de detenerlo, impulsó a Victor hacia la Universidad de Ingolstadt en Alemania, donde su mente brillante se enfrentó a la ciencia moderna. Allí, bajo la tutela del profesor Waldman, quien lo alentó a explorar los misterios de la creación, Victor se sumergió en una obsesión que lo aisló del mundo. Durante dos años, dejó de escribir a su familia, descuidó su salud y pasó noches enteras en cementerios y salas de disección, estudiando la descomposición de la carne para entender cómo devolverle la chispa de la vida. Su meta era ambiciosa: quería crear una nueva especie que bendijera a su creador, una raza de seres que no conocieran la enfermedad ni la muerte prematura. En su ceguera científica, no se detuvo a pensar en las consecuencias morales de jugar a ser Dios.

La culminación de sus esfuerzos llegó en una lúgubre noche de noviembre, mientras la lluvia golpeaba las ventanas de su laboratorio. Utilizando una mezcla de química, galvanismo y restos humanos que había recolectado con gran esfuerzo, Victor logró lo imposible. Al aplicar la descarga final, vio cómo el cuerpo gigantesco que había construido abría sus ojos de un amarillo apagado. Pero en ese instante de triunfo, la belleza de su sueño se transformó en una pesadilla insoportable. Al ver la piel amarillenta que apenas cubría los músculos y las arterias, el cabello negro lustroso y los dientes de una blancura aterradora, Victor sintió un asco que le recorrió la médula. No pudo soportar la visión de aquel ser que él mismo había diseñado para ser hermoso y que ahora le devolvía una mirada de muda súplica. Preso del pánico, Victor huyó de la habitación, abandonando a su creación a su suerte, esperando que el olvido o la muerte se llevaran aquel error. Sin embargo, cuando regresó a su habitación escoltado por su amigo Henry Clerval, quien acababa de llegar a Ingolstadt, la criatura había desaparecido.

Mientras Victor caía en una fiebre nerviosa que lo mantuvo postrado durante meses, la criatura iniciaba su propio y doloroso viaje por el mundo. Dotado de una fuerza sobrehumana y una resistencia increíble, el ser vagó por los bosques, sufriendo el acoso del hambre, la sed y el frío. Su mente, inicialmente como la de un niño recién nacido, procesaba los sonidos de los pájaros y el calor del sol con una mezcla de asombro y miedo. Su primer contacto con la humanidad fue desastroso: al entrar en una aldea buscando comida, fue recibido con piedras y gritos de terror. Comprendió rápidamente que su apariencia era una barrera insuperable. Buscando refugio, se escondió en un cobertizo adosado a una pequeña cabaña en el bosque, donde vivía la familia De Lacey. A través de una grieta en la pared, el ser se convirtió en un observador invisible de la vida de esta familia compuesta por un anciano ciego, su hijo Felix y su hija Agatha.

Durante casi un año, el monstruo vivió en las sombras, alimentándose de las sobras y ayudando a los De Lacey de forma anónima, recolectando leña por las noches para que Felix no tuviera que esforzarse tanto. Al observar a los humanos, aprendió el significado de las palabras, los conceptos de propiedad, familia y amor. La llegada de Safie, una joven extranjera, le permitió aprender a hablar y leer al mismo ritmo que ella mientras Felix le enseñaba. El ser encontró tres libros en el bosque: "El paraíso perdido", "Las vidas de Plutarco" y "Las cuitas del joven Werther", los cuales leyó con una sed voraz. Estas obras le enseñaron sobre la historia de las naciones, los sentimientos humanos y, fatalmente, sobre la creación y el abandono. Al leer los diarios de Victor que había guardado en su abrigo al huir del laboratorio, comprendió finalmente su origen: él no era un hijo amado, sino un monstruo despreciado por su propio padre. Su corazón, inicialmente lleno de benevolencia, comenzó a llenarse de una amargura profunda.

El punto de no retorno ocurrió cuando la criatura intentó presentarse ante el anciano De Lacey, confiando en que su ceguera le permitiría juzgarlo por su voz y no por su aspecto. El anciano lo escuchó con amabilidad, pero cuando el resto de la familia regresó, el horror se desató. Felix, creyendo que el monstruo atacaba a su padre, lo golpeó con furia. El ser huyó hacia el bosque, pero esta vez la tristeza se había transformado en un odio ardiente. Al ver que incluso los humanos más nobles lo rechazaban, decidió declarar una guerra eterna contra la especie humana y, especialmente, contra su creador. En su camino hacia Ginebra, salvó a una niña de morir ahogada, solo para recibir un disparo de su padre, quien creyó que el monstruo intentaba hacerle daño. Este fue el último clavo en la tumba de su bondad. Al llegar a las afueras de Ginebra, se encontró con un niño pequeño, William Frankenstein. Al saber que el niño era pariente de su creador, lo asesinó con sus propias manos y colocó un retrato que el niño llevaba en el vestido de Justine, una joven sirvienta de la familia, para incriminarla.

Victor, destrozado por la muerte de su hermano y la posterior ejecución de la inocente Justine, buscó consuelo en las montañas. Fue en el glaciar de Montanvert donde creador y criatura se encontraron cara a cara. Allí, en un discurso de una elocuencia desgarradora, el monstruo le relató sus sufrimientos y le hizo una única petición: "Soy malvado porque soy infeliz. Hazme una compañera tan deforme como yo para que podamos vivir aislados del hombre". Victor, movido por la compasión y el miedo, aceptó el trato. Viajó a Inglaterra y luego a las remotas islas Orcadas en Escocia para comenzar su segunda obra. Sin embargo, mientras trabajaba en la nueva criatura, lo asaltaron dudas atroces: ¿y si ella fuera más malvada que el primero? ¿y si procreaban una raza de demonios? Al ver al monstruo observándolo a través de la ventana con una sonrisa macabra, Victor destruyó el cuerpo de la mujer frente a sus ojos. El ser juró venganza con una frase que sellaría el destino de Victor: "Estaré contigo en tu noche de bodas".

La venganza fue sistemática y cruel. Primero, la criatura asesinó a Henry Clerval, haciendo que Victor fuera arrestado injustamente en Irlanda. Tras recuperar su libertad, Victor regresó a Ginebra para casarse con Elizabeth, esperando que el matrimonio fuera un refugio contra la sombra que lo perseguía. Pero en la noche de bodas, mientras Victor buscaba al monstruo por la casa armado con pistolas, escuchó el grito agónico de su esposa. El ser había cumplido su promesa, estrangulando a Elizabeth en su propia cama. La muerte de Elizabeth provocó también el fallecimiento del padre de Victor, quien no pudo soportar tanto dolor. Habiéndolo perdido todo, Victor Frankenstein transformó su remordimiento en una furia ciega y dedicó sus últimos días a perseguir a su creación por todo el mundo, desde los desiertos de la Tartaria hasta los hielos eternos del Polo Norte.

La persecución terminó cuando un Victor exhausto y moribundo fue rescatado por el barco del capitán Robert Walton, un explorador que buscaba el paso del norte. Victor le confió su historia como una advertencia sobre los peligros de la ambición intelectual sin ética. Tras la muerte de Victor a bordo del barco, Walton encontró a la criatura llorando sobre el cadáver de su creador. En un último monólogo lleno de desesperación, el ser confesó que su odio había sido el resultado de una soledad que ningún humano podía imaginar. Afirmó que su crimen más grande había sido el asesinato de su propia alma. Sin nadie más en el mundo que le diera sentido a su existencia, la criatura le prometió a Walton que se dirigiría al extremo más lejano del írtico para construir una pira funeraria y arrojarse a las llamas, terminando así con el sufrimiento de haber sido el único de su especie. La criatura desapareció en la oscuridad y la distancia, dejando tras de sí la advertencia eterna sobre la responsabilidad que conlleva dar vida a lo que no estamos dispuestos a amar.`
    },
    {
        session: 3,
        unit: 'Narrativa',
        topic: 'Terror Gótico: Drácula',
        videoTitle: 'Intertextualidad-Clase N°16',
        videoLink: 'https://www.youtube.com/watch?v=NBNdpV4AG1g',
        readingTitle: 'Drácula (Resumen y Análisis)',
        readingContent: `La historia de la oscuridad más antigua comienza en las páginas del diario de Jonathan Harker, un joven y ambicioso abogado inglés que emprende un viaje agotador hacia los confines de Europa del Este. Su destino son los montes Cárpatos, en la región de Transilvania, donde debe cerrar un negocio inmobiliario con un noble local: el Conde Drácula. A medida que el tren se interna en paisajes cada vez más salvajes y neblinosos, Jonathan percibe un cambio en la atmósfera. Los campesinos locales, al enterarse de su destino final, lo miran con una mezcla de lástima y terror absoluto; le entregan crucifijos, rosarios y ramos de ajo, murmurando oraciones para protegerlo de algo que llaman el "Vurdalak". A pesar de su escepticismo inglés y su fe en la razón moderna, Jonathan empieza a sentir una inquietud creciente cuando, al llegar al desfiladero de Borgo en medio de una noche cerrada, es recogido por un carruaje conducido por un hombre cuya fuerza física parece sobrehumana y cuya mirada brilla con un fulgor rojizo bajo la luz de las antorchas.

Al llegar al imponente y ruinoso castillo de Drácula, Jonathan es recibido por el mismo Conde, un hombre de edad avanzada, vestido de negro de pies a cabeza, con un rostro extremadamente pálido, labios inusualmente rojos y dedos largos que terminan en uñas afiladas. Los primeros días transcurren bajo una cortesía aristocrática, pero pronto el abogado descubre que el castillo es una prisión de piedra. Jonathan nota con horror que Drácula no tiene reflejo en los espejos, que posee una fuerza capaz de doblar barras de hierro y que nunca se le ve comer ni beber. Una tarde, al observar por la ventana, ve al Conde trepar por los muros verticales del castillo como si fuera una lagartija gigante, lo que finalmente le confirma que está ante un ser que no pertenece al mundo de los vivos. Su terror alcanza el clímax cuando, tras desobedecer las advertencias del Conde, es atacado por tres mujeres fantasmales de una belleza letal que habitan en las sombras de las salas prohibidas, seres sedientos de sangre que solo son detenidos por la intervención del propio Drácula, quien les promete que Jonathan será de ellas una vez que sus negocios en Londres hayan concluido.

Mientras Jonathan busca desesperadamente una salida de aquella fortaleza rodeada por el aullido constante de los lobos, la acción se traslada a Inglaterra, específicamente a la pintoresca costa de Whitby. Allí, Mina Murray, la virtuosa prometida de Jonathan, espera noticias de su amado mientras acompaña a su mejor amiga, Lucy Westenra, una joven de gran belleza que acaba de recibir tres propuestas de matrimonio simultáneas. La calma se rompe durante una tormenta de proporciones apocalípticas que trae consigo al Demeter, un barco ruso que llega a puerto sin un solo tripulante vivo a bordo. El capitán yace muerto, atado al timón con un rosario entre las manos, y un enorme perro negro salta desde la cubierta desapareciendo entre la niebla. Nadie sospecha que en las bodegas del barco viajan cincuenta cajas llenas de tierra sagrada de Transilvania, el sustento vital que el Conde Drácula necesita para establecer su imperio de terror en la populosa Londres.

Poco después del desembarco, la salud de Lucy empieza a deteriorarse de una manera que desafía toda lógica médica. Se vuelve sonámbula y, una noche, Mina la encuentra desmayada en un banco del acantilado bajo la luz de la luna, con una figura oscura inclinada sobre ella. A partir de ese momento, Lucy se vuelve cada vez más pálida y débil, y en su cuello aparecen dos pequeñas marcas rojas que parecen negarse a cicatrizar. Su prometido, Arthur Holmwood, ahora Lord Godalming, pide ayuda a su amigo el doctor John Seward, quien dirige un manicomio cercano. Seward, desconcertado por el caso de Lucy y por el extraño comportamiento de uno de sus pacientes, un hombre llamado Renfield que devora moscas y arañas creyendo que así absorbe su fuerza vital, decide convocar a su antiguo maestro en ímsterdam: el eminente profesor Abraham Van Helsing.

Van Helsing representa la síntesis perfecta entre la ciencia moderna y el conocimiento de las tradiciones antiguas. Al examinar a Lucy, comprende de inmediato que no se enfrenta a una anemia común, sino a un depredador sobrenatural. A pesar de realizar múltiples transfusiones de sangre de todos los hombres del grupo y de rodear la habitación de Lucy con flores de ajo y crucifijos, el Conde Drácula logra burlar las defensas utilizando sus poderes para controlar a los animales y la niebla. Lucy muere, pero para Van Helsing su fallecimiento es solo el inicio de una transformación aterradora. El profesor debe convencer a Arthur, Seward y al aventurero estadounidense Quincey Morris de que Lucy se ha convertido en una "No-Muerta" que ahora acecha a los niños de la ciudad bajo el nombre de la "Dama de Blanco". En una de las escenas más intensas de la obra, el grupo desciende a la cripta de los Westenra, donde Arthur, guiado por la mano de Van Helsing, atraviesa el corazón de su amada con una estaca de madera para liberar su alma de la maldición del vampirismo.

Tras el descanso eterno de Lucy, el grupo de hombres se une a Jonathan Harker, quien ha logrado escapar de Transilvania, y a Mina, quien se convierte en el cerebro logístico del equipo. Mina organiza todos los diarios, cartas y recortes de prensa en un registro cronológico que les permite entender los movimientos del Conde. Descubren que Drácula ha comprado una propiedad llamada Carfax, justo al lado del manicomio de Seward, y que está ocultando allí sus cajas de tierra. El Conde, al sentirse acorralado por la inteligencia del grupo, decide atacar a su eslabón más fuerte: Mina. Entra en sus aposentos y, tras asesinar a Renfield por intentar protegerla, obliga a Mina a beber sangre de su propio pecho, creando un vínculo místico y maldito. Drácula le advierte que ahora ella es de su misma sangre y que, tras su muerte, se convertirá en una de sus compañeras eternas.

Este acto de crueldad se convierte en el mayor error del Conde. Van Helsing descubre que, debido al "bautismo de sangre", Mina puede entrar en un estado de hipnosis al amanecer y al anochecer, permitiéndole ver y oír lo que el Conde percibe. Con esta información, el grupo comienza una frenética cacería por todo Londres, purificando con hostias consagradas cada una de las cajas de tierra de Drácula, dejándolo sin refugios donde esconderse durante el día. Sintiéndose vulnerable en una tierra que ya no le es propicia, el Conde huye de regreso a Transilvania por mar, creyendo que su antiguo castillo le devolverá la seguridad. Sin embargo, los cazadores inician una carrera contra el tiempo a través de Europa, viajando por tierra y río para interceptar el carromato de Drácula antes de que el sol se ponga en las faldas de los Cárpatos.

El clímax de la novela ocurre bajo la sombra del imponente castillo de Drácula, en medio de una tormenta de nieve. El grupo se ha dividido: Van Helsing y Mina viajan directamente al castillo, donde el profesor logra destruir a las tres mujeres vampiras en sus tumbas, mientras que Jonathan, Arthur, Seward y Quincey persiguen al carromato protegido por gitanos que transporta el ataúd del Conde. Justo cuando los últimos rayos del sol están por desaparecer y el poder de Drácula alcanzaría su máximo esplendor, se desata una batalla feroz. Quincey Morris resulta herido de muerte, pero en un último esfuerzo de valentía, Jonathan Harker corta el cuello del Conde con su gran cuchillo mientras el puñal de Quincey atraviesa el corazón del monstruo. En un suspiro de alivio absoluto, el cuerpo del Conde Drácula se desintegra convirtiéndose en cenizas, y la marca roja de la maldición en la frente de Mina desaparece para siempre. La historia concluye con el sacrificio de Quincey y una reflexión años después sobre cómo el amor, la lealtad y la unión de la ciencia con la fe lograron vencer a la oscuridad más profunda, dejando un legado de paz para las futuras generaciones.`
    },
    {
        session: 4,
        unit: 'Narrativa',
        topic: 'Realismo Social: Subterra',
        videoTitle: 'El género lírico-Hablante y Objeto',
        videoLink: 'https://www.youtube.com/watch?v=ldjVCmsAfhM',
        readingTitle: 'Subterra (Resumen y Análisis)',
        readingContent: `En las entrañas de la tierra, donde el sol es un recuerdo lejano y el aire se vuelve un enemigo pesado y denso, se desarrolla la crónica de una de las épocas más oscuras de la historia trabajadora: la vida en las minas de carbón de Lota, en Chile. La obra maestra de Baldomero Lillo, titulada Subterra, no es solo una colección de relatos, sino un grito de protesta y un retrato descarnado de la condición humana frente a la explotación industrial de principios del siglo XX. El escenario principal es la mina, un monstruo de piedra y sombras que devora hombres, jóvenes y niños por igual, devolviendo a cambio solo miseria, pulmones enfermos y corazones rotos. En este mundo subterráneo, la oscuridad no es solo la ausencia de luz, sino una presencia tangible que envuelve la existencia de miles de familias que dependen del "oro negro" para no morir de hambre, aunque ese mismo carbón sea el que finalmente les robe la vida.

La historia nos sumerge inicialmente en la desgarradora realidad de la infancia perdida a través de uno de sus relatos más icónicos: "La compuerta número 12". Aquí conocemos a Pablo, un niño de apenas ocho años, cuyo destino queda sellado cuando su padre, un minero envejecido prematuramente por el esfuerzo, lo lleva por primera vez a las galerías profundas. El padre sabe que está entregando a su hijo a una esclavitud moderna, pero la extrema pobreza y la necesidad de aumentar los ingresos familiares no le dejan otra opción. El trabajo de Pablo consiste en ser un "atendedor" de compuerta, sentado en la oscuridad absoluta durante horas interminables, con la única misión de abrir y cerrar una puerta de madera cada vez que pasan los carros cargados de carbón. El llanto del niño al verse abandonado en aquel túnel húmedo y negro, donde el silencio solo es roto por el goteo del agua y el eco de las máquinas, representa la inocencia triturada por un sistema económico despiadado. El padre, al amarrar a su propio hijo para que no huya del miedo, simboliza la tragedia de una clase social que se ve obligada a sacrificar a sus propias semillas para asegurar un mendrugo de pan.

A medida que nos internamos más en la narración, la obra explora el concepto del "determinismo social", la idea de que quien nace en la mina está condenado a morir en ella. Lillo nos presenta el "Chiflón del Diablo", una de las galerías más peligrosas y temidas debido a su inestabilidad y a la frecuencia de los derrumbes. En este lugar, la muerte acecha en cada crujido de las vigas de madera. Conocemos la historia de los mineros que, por la falta de trabajo en otras secciones, se ven obligados a aceptar turnos en el Chiflón, sabiendo que las probabilidades de salir con vida son escasas. La tensión se traslada también a la superficie, donde las madres, esposas e hijas esperan con el corazón en un hilo el sonido de la sirena que anuncia un accidente. Cuando la tragedia finalmente ocurre, el autor describe con maestría el desfile de cuerpos inertes y la desesperación de las mujeres que buscan entre los rostros cubiertos de hollín a sus seres queridos, evidenciando que el dolor de la mina se extiende mucho más allá de las galerías subterráneas, envenenando la vida de toda la comunidad.

Otro aspecto fundamental de la obra es la crítica feroz a la "pulpería" y al sistema de pago mediante fichas. En el relato "El pago", se detalla cómo el esfuerzo infrahumano de los mineros es recompensado con salarios miserables que apenas alcanzan para pagar las deudas contraídas en los almacenes de la propia compañía minera. Los trabajadores viven atrapados en un círculo vicioso de deuda eterna; el dinero nunca llega a sus manos de forma real, sino que es devuelto inmediatamente a los dueños de la mina a través de precios inflados y multas arbitrarias. Lillo retrata a los capataces y administradores no solo como jefes, sino como verdugos que vigilan cada movimiento de los mineros, buscando cualquier excusa en "El registro" para confiscar sus pertenencias o humillarlos, demostrando que en Lota el minero no era considerado un ciudadano, sino una herramienta reemplazable, menos valiosa incluso que las mulas que arrastraban los carros.

La atmósfera de peligro constante se eleva a su máximo punto con el relato de "El Grisú". El grisú es un gas invisible, inodoro y altamente explosivo que se acumula en las galerías mal ventiladas. Es el asesino silencioso de la mina. El autor utiliza este elemento para mostrar la negligencia de la administración, que prefiere arriesgar la vida de cientos de hombres antes que invertir en sistemas de seguridad adecuados. Cuando la explosión ocurre, la descripción es dantesca: el fuego recorre los túneles como una bestia furiosa, calcinando todo a su paso. Este evento no solo elimina vidas físicas, sino que destruye las esperanzas de las familias, dejando a viudas y huérfanos en la más absoluta desprotección, ya que la compañía minera rara vez asumía responsabilidad alguna por las muertes, culpando a menudo a la "imprudencia" de los propios trabajadores para evitar pagar indemnizaciones.

Sin embargo, en medio de tanta oscuridad, Lillo también rescata destellos de humanidad y solidaridad. A través de personajes como Juan Fariña, en el relato "Juan Fariña", el autor introduce elementos de misterio y leyenda. Fariña es un minero con una fuerza y una capacidad de trabajo que parecen sobrenaturales, despertando el recelo y la admiración de sus compañeros. Se rumorea que tiene un pacto con el diablo, pero en realidad, su figura representa la resistencia física y espiritual del trabajador chileno. Su historia termina en un acto de rebelión final contra la mina: se dice que inundó las galerías para detener la explotación, prefiriendo destruir la fuente de trabajo antes que permitir que siguiera devorando la dignidad de sus hermanos. Este tinte legendario sirve para elevar la lucha del minero a una dimensión épica, donde el hombre se enfrenta a fuerzas que parecen divinas o demoníacas.

Hacia el final de la obra, queda una sensación de melancolía profunda pero también de una urgente necesidad de cambio. Baldomero Lillo no ofrece finales felices porque la realidad de Lota no los permitía. Su objetivo era conmover la conciencia de la sociedad chilena de su tiempo, mostrando que el progreso industrial y la riqueza de unos pocos estaban construidos sobre el sufrimiento, la sangre y el sudor de miles de seres humanos enterrados vivos. Subterra concluye como un testimonio eterno de la lucha de clases, donde la mina es una metáfora de un sistema social que ciega a los hombres y les roba el futuro. La imagen final es la de un sol que brilla afuera, hermoso y cálido, pero que para el minero es un extraño, pues su "vida simplemente" se ha convertido en una sombra perpetua bajo la tierra, esperando que algún día la justicia logre penetrar en las profundidades de la compuerta número 12 y liberar a los hijos del carbón de su destino de hollín y silencio.`
    },
    {
        session: 5,
        unit: 'Lírica',
        topic: 'Alegoría Política: Rebelión en la granja',
        videoTitle: 'Figuras literarias, parte III',
        videoLink: 'https://www.youtube.com/watch?v=YZqoA6dyqCc',
        readingTitle: 'Rebelión en la granja (Resumen y Análisis)',
        readingContent: `La historia comienza en la Granja Solariega, una propiedad rural en Inglaterra bajo el mando del señor Jones, un granjero que, sumido en el alcoholismo y la negligencia, ha dejado de preocuparse por el bienestar de sus animales. La chispa del cambio surge una noche cuando el Viejo Mayor, un cerdo premiado y respetado por todos, convoca a una reunión secreta en el granero principal. En un discurso que cambiaría el destino de la granja, Mayor comparte un sueño que tuvo sobre un mundo donde los animales viven libres de la tiranía del hombre, sin látigos, sin cadenas y sin ser sacrificados para el beneficio humano. El Viejo Mayor les enseña una canción revolucionaria titulada "Bestias de Inglaterra", que se convierte en el himno de su esperanza, y les explica que el hombre es el único ser que consume sin producir, siendo la causa de todas sus miserias. Aunque Mayor muere pocos días después, sus palabras germinan en la mente de los animales más inteligentes, especialmente en los cerdos, quienes empiezan a organizar un sistema de pensamiento llamado Animalismo.

La rebelión ocurre de manera imprevista cuando el señor Jones, tras una borrachera monumental, olvida alimentar a los animales durante un día entero. Impulsados por el hambre y la desesperación, los animales rompen los cierres de los depósitos de comida y, cuando Jones y sus peones intentan reprimirlos con látigos, los animales contraatacan con una furia incontenible, expulsando a los humanos de la propiedad. En un instante de júbilo absoluto, la Granja Solariega pasa a llamarse Granja de los Animales. Bajo el liderazgo de dos cerdos jóvenes, Snowball y Napoleón, se establecen los Siete Mandamientos en la pared del granero, leyes sagradas que dictan que lo que camina sobre dos piernas es enemigo, lo que camina sobre cuatro piernas o tiene alas es amigo, y que ningún animal debe usar ropa, dormir en camas, beber alcohol o matar a otro animal. El mandamiento final y más importante resume todo el espíritu de la revuelta: "Todos los animales son iguales".

Al principio, la granja prospera bajo una autogestión ejemplar. Snowball, un líder brillante, elocuente y lleno de ideas innovadoras, organiza comités para educar a los animales y diseña planes para mejorar la productividad. Por su parte, Napoleón es un personaje más silencioso, sombrío y calculador, que prefiere actuar en las sombras. La tensión entre ambos crece constantemente, representando dos visiones opuestas del poder. Mientras Snowball propone la construcción de un molino de viento para generar electricidad y reducir la jornada laboral, Napoleón se opone ferozmente, argumentando que lo importante es centrarse en la producción de alimentos inmediata. Durante la defensa de la granja en la "Batalla del Establo", donde Jones intenta recuperar su propiedad por la fuerza, Snowball demuestra un heroísmo asombroso liderando la carga, mientras que Napoleón apenas participa. Sin embargo, la rivalidad llega a su punto crítico cuando Napoleón utiliza a una jauría de perros enormes y feroces, que él mismo había criado en secreto, para expulsar a Snowball de la granja bajo amenaza de muerte.

Tras la expulsión de Snowball, Napoleón asume el control absoluto y elimina las asambleas dominicales, declarando que todas las decisiones serán tomadas por un comité de cerdos presidido por él mismo. Utiliza a Squealer, un cerdo con una habilidad extraordinaria para la manipulación verbal, para convencer al resto de los animales de que Snowball siempre fue un traidor y un agente secreto del señor Jones. Squealer es la pieza clave de la propaganda: es capaz de convencer a los animales de que sus recuerdos son falsos y de que la realidad es la que Napoleón dicta. El proyecto del molino de viento, al que Napoleón se había opuesto, es retomado ahora como una idea propia de él, alegando que Snowball se la había robado. Los animales comienzan a trabajar jornadas extenuantes, enfrentando el hambre y el frío, pero lo hacen con el consuelo de que ahora trabajan para sí mismos y no para un amo humano.

La corrupción del poder se vuelve evidente a medida que los cerdos comienzan a otorgarse privilegios especiales, como mudarse a la casa del señor Jones y dormir en camas. Cuando los animales notan que esto viola los mandamientos, descubren que las leyes en la pared han sido alteradas sutilmente; ahora el mandamiento dice que no se puede dormir en una cama "con sábanas". Esta táctica de modificación gradual se aplica a todas las leyes. La figura de Napoleón se vuelve cada vez más distante y sagrada, rodeado siempre por su guardia pretoriana de perros. Comienzan las purgas internas, donde animales confiesan crímenes inexistentes bajo presión y son ejecutados frente a todos, violando el mandamiento de no matar a otros animales, el cual ahora reza: "Ningún animal matará a otro animal sin causa". El terror se instala en la granja, y la canción "Bestias de Inglaterra" es prohibida, sustituida por himnos que glorifican la figura de Napoleón como el "Padre de todos los animales".

El personaje de Boxer, el caballo de tiro, representa la tragedia de la clase trabajadora más noble y sacrificada. Su lema, "Trabajaré más fuerte", es el motor que permite la construcción del molino una y otra vez tras derrumbes y ataques externos. Sin embargo, cuando Boxer cae enfermo debido al agotamiento extremo, Napoleón promete enviarlo a un hospital humano para que lo curen. El horror estalla cuando los animales ven que el furgón que se lleva a Boxer tiene escrito en un costado "Fábrica de Cola y Descuartizador de Caballos". Squealer logra calmar los ánimos con más mentiras, asegurando que el vehículo simplemente no había sido repintado por el veterinario, pero la verdad es amarga: Napoleón vendió al trabajador más leal de la granja para comprarse una caja de whisky.

Años después, la granja es más rica que nunca, pero solo para los cerdos y los perros. Los Siete Mandamientos han desaparecido por completo, sustituidos por una única y cínica sentencia: "Todos los animales son iguales, pero algunos animales son más iguales que otros". Los cerdos empiezan a caminar sobre dos patas, a usar ropa y a llevar látigos en sus manos para supervisar el trabajo. El clímax de la historia ocurre cuando Napoleón invita a los granjeros humanos de los alrededores a una cena de celebración. Desde las ventanas, el resto de los animales observa con asombro cómo cerdos y hombres brindan por la prosperidad mutua y por el regreso de la disciplina férrea en la granja, que vuelve a llamarse Granja Solariega. Mientras estalla una pelea por una trampa en una partida de cartas, los animales miran los rostros de los cerdos y luego los de los hombres, y se dan cuenta de algo aterrador: ya no pueden distinguir quién es quién. La revolución ha terminado convirtiéndose exactamente en aquello que juró destruir, cerrando un círculo de opresión donde los cerdos han reemplazado a los humanos en su tiranía.`
    },
    {
        session: 6,
        unit: 'Lírica',
        topic: 'Tragedia Griega: Antígona',
        videoTitle: 'Post PAES Competencia Lectora',
        videoLink: 'https://www.youtube.com/watch?v=0KBmmhtwHlE',
        readingTitle: 'Antígona (Resumen y Análisis)',
        readingContent: `La tragedia de Antígona comienza en la mítica ciudad de Tebas, una ciudad que aún sangra por las heridas de una guerra civil fratricida. Tras la caída y el exilio de Edipo, sus dos hijos varones, Eteocles y Polinices, acordaron turnarse en el trono de la ciudad. Sin embargo, la ambición rompió el pacto: Eteocles se negó a ceder el poder al cumplirse su año, lo que llevó a Polinices a buscar refugio en Argos y regresar con un ejército extranjero para reclamar su derecho por la fuerza. La batalla terminó en una tragedia simétrica a las puertas de Tebas, donde los dos hermanos se dieron muerte el uno al otro en un combate singular. Con la línea sucesoria masculina interrumpida por la sangre, el trono recae en Creonte, tío de los fallecidos, quien asume el mando con la firme intención de restaurar el orden y la autoridad del Estado en una ciudad devastada por el conflicto.

El primer acto de Creonte como rey es promulgar un edicto que sacude los cimientos morales de la ciudad: Eteocles, defensor de Tebas, recibirá todos los honores fúnebres correspondientes a un héroe; pero Polinices, el invasor, es declarado traidor y su cuerpo debe quedar a la intemperie, sin sepultura, para ser devorado por las aves y los perros. En la mentalidad griega, negar los ritos funerarios no era solo un insulto físico, sino una condena espiritual eterna, ya que el alma del difunto no podría encontrar descanso en el Hades. Es aquí donde surge la figura de Antígona, la hermana de los fallecidos, quien decide que no puede permitir que la ley de un hombre pase por encima de las leyes divinas y los lazos de sangre. La obra se abre con una tensa conversación entre Antígona y su hermana Ismene. Mientras Antígona personifica la valentía y el deber sagrado, Ismene representa la prudencia y el miedo frente al poder absoluto, negándose a participar en el entierro por temor a la ejecución pública decretada por Creonte.

Antígona, solitaria en su resolución, acude al campo de batalla y cubre el cuerpo de Polinices con una fina capa de polvo y ritos simbólicos. Poco después, un guardia aterrorizado informa a Creonte de lo sucedido. El rey, cuya psicología está dominada por la inseguridad de un gobernante nuevo y el miedo a la anarquía, reacciona con paranoia, sospechando que sus enemigos políticos han sobornado a los guardias. Sin embargo, Antígona es capturada cuando intenta realizar los ritos por segunda vez bajo la luz del día. Al ser llevada ante Creonte, se produce uno de los debates más profundos de la literatura universal. Antígona no niega su acto; por el contrario, lo defiende con una altivez desafiante. Ella sostiene que el edicto de Creonte no tiene fuerza para anular las "leyes no escritas e inquebrantables de los dioses", que dictan el respeto a los muertos. Por su parte, Creonte argumenta que el bienestar de la ciudad depende de la obediencia ciega a la ley y que un traidor no puede ser tratado igual que un patriota, ni siquiera en la muerte.

La ceguera de Creonte lo lleva a condenar a Antígona a ser encerrada viva en una tumba de piedra, un castigo que busca evitar que la ciudad se manche con su sangre directa, pero que en la práctica es un entierro en vida. En este punto aparece Hemón, hijo de Creonte y prometido de Antígona. Hemón intenta razonar con su padre, actuando como la voz del pueblo que admira el valor de la joven. Le advierte que un gobernante que no escucha y que cree ser el único poseedor de la verdad termina por destruir el Estado que intenta salvar. La discusión escala en violencia verbal: Creonte acusa a su hijo de estar esclavizado por una mujer, mientras Hemón le advierte que la muerte de Antígona arrastrará consigo otra muerte. La obstinación de Creonte, conocida como hubris o orgullo excesivo, lo ciega ante las señales de peligro.

El giro trágico final es desencadenado por el profeta ciego Tiresias, quien acude al palacio para advertir a Creonte que los dioses están furiosos. Las aves de rapiña, saciadas con la carne de Polinices, están contaminando los altares, y los sacrificios no son aceptados. Tiresias profetiza que, si Creonte no rectifica, pagará "cadáver por cadáver" de su propia estirpe. Solo ante la amenaza sobrenatural, Creonte cede y decide liberar a Antígona y enterrar a Polinices. Sin embargo, el destino ya está sellado. Cuando Creonte llega a la tumba de piedra, descubre que Antígona se ha ahorcado con su propio velo para evitar la lenta agonía de la inanición. Hemón, destrozado por el dolor, intenta atacar a su padre y, al fallar, se suicida abrazando el cuerpo de su prometida.

La noticia del suicidio de Hemón llega al palacio y provoca la tragedia final: Eurídice, la esposa de Creonte y madre de Hemón, se quita la vida maldiciendo a su marido por ser el causante de la muerte de sus hijos. La obra termina con un Creonte devastado, quien ha pasado de ser un monarca autoritario que creía controlar el destino de Tebas a ser un hombre roto que suplica por su propia muerte, comprendiendo demasiado tarde que la sabiduría consiste en no desafiar las leyes sagradas ni los sentimientos humanos más básicos. El Coro cierra la tragedia reflexionando sobre cómo el orgullo de los hombres es castigado con grandes golpes de la fortuna, y cómo solo a través del sufrimiento se aprende, finalmente, la sensatez. Antígona queda como el símbolo eterno de la desobediencia civil y la primacía de la conciencia individual sobre la arbitrariedad del poder político.`
    },
    {
        session: 7,
        unit: 'Lírica',
        topic: 'Drama Moderno: Casa de muñecas',
        videoTitle: 'Análisis: La Canción del Pirata',
        videoLink: 'https://www.youtube.com/watch?v=xtOya7BLCiY',
        readingTitle: 'Casa de muñecas (Resumen y Análisis)',
        readingContent: `La obra comienza en la calidez de un hogar burgués noruego a finales del siglo XIX, durante los preparativos para la celebración de la Navidad. El ambiente inicial destila una aparente felicidad y estabilidad financiera, marcada por el reciente ascenso de Torvald Helmer a la dirección de un banco. Nora Helmer, su esposa, entra en escena cargada de paquetes y dulces, personificando la imagen de la mujer ideal de la época: alegre, despreocupada y dedicada al consumo y al embellecimiento del hogar. Desde los primeros diálogos, se establece una dinámica de poder desigual y paternalista; Torvald se dirige a Nora con apodos condescendientes como "alondra", "ardillita" o "pajarito", tratándola más como a una mascota o una posesión preciada que como a una compañera intelectual. Nora acepta este papel con una mezcla de coquetería y sumisión, reforzando la idea de que su única función es ser una fuente de entretenimiento y alegría para su marido, una figura decorativa en lo que parece ser una vida perfecta.

Sin embargo, tras esta fachada de ligereza, Nora oculta un secreto que ha guardado con celo durante años y que constituye el motor de la tragedia. Años atrás, cuando Torvald cayó gravemente enfermo y los médicos advirtieron que solo un viaje al sur podría salvar su vida, Nora se vio en la desesperada necesidad de conseguir una gran suma de dinero. Dado que las leyes y las convenciones sociales de la época impedían que una mujer solicitara un préstamo sin el consentimiento de su marido o su padre, Nora se vio obligada a actuar en la sombra. Falsificó la firma de su padre, que acababa de morir, para obtener un crédito del procurador Nils Krogstad. Desde entonces, Nora ha trabajado en secreto, ahorrando de su gasto doméstico y realizando trabajos de copia manual para pagar las cuotas de la deuda, viendo este acto como una prueba de su amor heroico y sacrificio personal, convencida de que, si Torvald llegara a saberlo, lo vería como un gesto sublime de devoción.

La trama se complica con la llegada de Kristine Linde, una antigua amiga de Nora que ha enviudado recientemente y busca empleo. A través de la conversación con Kristine, Nora revela su secreto, buscando reconocimiento por su valentía. Sin embargo, la realidad golpea con la aparición de Krogstad, quien trabaja en el banco de Torvald y está a punto de ser despedido. Krogstad, consciente de que su reputación social está en juego, visita a Nora para chantajearla: si ella no logra convencer a Torvald de mantenerlo en su puesto, él revelará el fraude y la falsificación a su marido y a la justicia. Nora intenta interceder por él, pero Torvald, movido por un rígido sentido de la moralidad y un profundo desprecio por la falta de integridad de Krogstad, se niega rotundamente, argumentando que la presencia de un hombre deshonesto en el banco contaminaría el ambiente y la educación de sus propios hijos.

A medida que el chantaje de Krogstad avanza, Nora experimenta un torbellino de angustia y desesperación. Considera diversas salidas, desde pedir dinero al Dr. Rank, un amigo cercano de la familia que está secretamente enamorado de ella y que sufre una enfermedad terminal, hasta el suicidio. Sin embargo, Nora se aferra a la esperanza de lo que ella llama "el milagro": la convicción de que, cuando Torvald descubra la verdad, asumirá toda la responsabilidad, se sacrificará por ella y la protegerá frente al mundo, demostrando que su amor es tan grande como el de ella. Esta fe ciega en la nobleza de su marido es lo que la sostiene mientras ensaya frenéticamente la tarantela, un baile que simboliza su agitación interna y su lucha por mantener el control mientras el mundo que ha construido se desmorona bajo sus pies.

La tensión alcanza su punto máximo durante la fiesta de disfraces en el piso superior. Tras el baile, Krogstad deja una carta detallando todo el asunto en el buzón cerrado de Torvald. Kristine Linde, quien tuvo una relación sentimental con Krogstad en el pasado, intenta interceder, logrando que el chantajista se arrepienta y decida devolver el documento de la deuda. Sin embargo, Kristine decide que es necesario que los Helmer se enfrenten a la verdad para que su matrimonio deje de ser una mentira. Cuando Torvald finalmente lee la carta, la reacción no es el "milagro" que Nora esperaba. En lugar de protegerla, Torvald estalla en una furia egoísta y violenta. La acusa de criminal, de mentirosa y de haber destruido su reputación y su futuro. Le prohíbe educar a sus hijos, considerándola una presencia corruptora, y declara que su matrimonio ha terminado, aunque deben mantener las apariencias externas para salvar el prestigio social. En este momento, la venda cae de los ojos de Nora: comprende que el hombre con el que ha vivido ocho años y con el que ha tenido tres hijos es un extraño que no la ama, sino que ama la imagen de ella que él ha creado.

El giro final de la obra ocurre cuando llega una segunda carta de Krogstad devolviendo el documento de la deuda. Al ver que el peligro ha pasado, la actitud de Torvald cambia instantáneamente. Recupera su tono paternal y "perdona" a Nora, atribuyendo sus actos a su "debilidad femenina" y expresando su deseo de volver a la normalidad de su "casa de muñecas". Pero Nora ya no es la misma. Se quita su disfraz de fiesta y, por primera vez en su vida, se sienta a hablar seriamente con su marido. Nora analiza su existencia y llega a la conclusión de que siempre ha sido tratada como un objeto: primero por su padre, quien la llamaba su "muñeca", y luego por Torvald, quien la ha mantenido en una minoría de edad perpetua. Se da cuenta de que ha pasado de manos de uno a otro sin haber desarrollado nunca una identidad propia, y que sus supuestos deberes hacia su esposo y sus hijos son secundarios frente a su deber más sagrado: el deber hacia sí misma.

Nora decide abandonar el hogar, a su marido y a sus hijos, comprendiendo que no está capacitada para educarlos si antes no se educa a sí misma y descubre quién es en realidad. Torvald, desesperado, apela a la religión, a la moral y a la ley, pero Nora rebate cada argumento con una lógica aplastante basada en su experiencia personal. Ella declara que no puede creer en lo que dicen los libros si su corazón y su razón le dicen algo distinto. La obra termina con una de las escenas más famosas de la historia del teatro: Nora sale de la casa y cierra la puerta tras de sí con un golpe seco, un sonido que resonó en toda Europa como el inicio de una nueva era para los derechos y la autonomía de la mujer. Nora deja atrás la seguridad de la "casa de muñecas" para enfrentarse a un mundo incierto, pero libre, dejando a un Torvald devastado que solo puede quedarse preguntándose si algún día ocurrirá "el milagro más grande": que ambos cambien tanto que su convivencia pueda convertirse en un verdadero matrimonio.`
    },
    {
        session: 8,
        unit: 'Lírica',
        topic: 'Tragedia Rural: Bodas de sangre',
        videoTitle: 'Repaso General PAES Lectura',
        videoLink: 'https://www.youtube.com/watch?v=ysWK6sbI4Dw',
        readingTitle: 'Bodas de sangre (Resumen y Análisis)',
        readingContent: `La tragedia de Federico García Lorca comienza en el paisaje árido y caluroso de la Andalucía rural, un entorno donde la tierra, el honor y la sangre dictan las leyes de la existencia. La obra se abre con una conversación cargada de presagios entre la Madre y su hijo, el Novio. Desde los primeros versos, la Madre se presenta como una figura marcada por el dolor y el luto perpetuo; ha perdido a su marido y a otro de sus hijos en una disputa violenta con la familia de los Félix. Para ella, la vida es una frágil tregua que puede romperse con el brillo de una navaja, un objeto que desprecia y teme por su capacidad de segar la vida de "un hombre que es un sol". El Novio, ajeno a estos temores ancestrales, anuncia su deseo de casarse con una joven que vive en las lejanías de los secanos. Aunque la Madre acepta con resignación el deseo de su hijo de continuar la estirpe, la sombra de la muerte y el recuerdo de la familia enemiga planean sobre la escena como nubarrones negros.

El conflicto se profundiza cuando se revela el pasado de la Novia. A través de las conversaciones de la vecindad y el servicio, nos enteramos de que la joven mantuvo hace años una relación apasionada con Leonardo, un miembro de la familia Félix. Leonardo es el único personaje de la obra que posee un nombre propio, lo que subraya su individualidad rebelde y su papel como motor de la tragedia. Actualmente, Leonardo está casado con la prima de la Novia y tiene un hijo, pero su fuego interno no se ha apagado. Lo vemos aparecer en escenas cargadas de tensión, llegando a la casa de la Novia en su caballo, que corre hasta reventar, simbolizando una pasión desbocada que no puede ser contenida por las convenciones sociales ni por los lazos del matrimonio. El caballo de Leonardo es un símbolo lorquiano del deseo sexual y la fuerza instintiva que arrastra a los personajes hacia su destino.

La trama avanza hacia el día de la boda, un evento que debería ser de alegría pero que está impregnado de una atmósfera asfixiante. La Novia se debate en una lucha interna desgarradora: por un lado, desea la estabilidad y el honor que le ofrece el Novio, un hombre bueno y trabajador; por otro lado, se siente irremediablemente atraída por la fuerza oscura y salvaje de Leonardo. En la mañana de la ceremonia, Leonardo visita a la Novia en su alcoba mientras ella se prepara, y en un diálogo lleno de reproches y deseo contenido, ambos reconocen que el fuego que los une sigue vivo a pesar de los años y de la sangre derramada entre sus familias. La Novia intenta resistir, afirmando que se casará para encerrarse "con su marido" y levantar un muro contra el pasado, pero sus palabras carecen de la fuerza necesaria para convencerse a sí misma.

La boda se celebra con toda la pompa rural, entre cantos de azahar y bailes, pero la tensión es palpable. Tras la ceremonia, mientras los invitados festejan, la tragedia estalla: la Novia y Leonardo huyen juntos a lomos del caballo, escapando hacia el bosque. Este acto de rebelión máxima rompe todas las leyes de la honra y desata la furia de las dos familias. La Madre, al enterarse de la fuga y de que el hombre involucrado es un Félix, instiga a su hijo a la persecución, transformando su miedo inicial en una sed de justicia y sangre. "Ha llegado otra vez la hora de la sangre", exclama, marcando el inicio de una cacería humana en la que el Novio debe defender su honor y el de su linaje en una tierra que no perdona la traición.

El tercer acto de la obra se traslada a un bosque nocturno y mágico, donde Lorca abandona el realismo para introducir elementos simbólicos y poéticos. Aparecen los Leñadores, que actúan como un coro griego comentando el destino de los fugitivos, y dos figuras sobrenaturales: la Luna y la Mendiga (que representa a la Muerte). La Luna, personificada como un joven leñador de cara blanca, anhela sangre para calentar su luz fría y se convierte en cómplice de la tragedia al iluminar el camino de los perseguidores. La Mendiga, por su parte, guía al Novio hacia su rival, asegurándose de que el encuentro sea fatal. En este bosque, el tiempo parece detenerse y la pasión de Leonardo y la Novia alcanza su cénit lírico; ambos saben que su amor es una condena a muerte, pero aceptan su destino con una entrega absoluta, afirmando que "la culpa es de la tierra" y de la fuerza de la sangre que corre por sus venas.

El clímax ocurre fuera de escena, pero su impacto es devastador. Leonardo y el Novio se encuentran y se dan muerte mutuamente con navajas, cumpliendo el temor inicial de la Madre. La obra termina con un cuadro de dolor universal. La Novia regresa a la casa de la Madre, con el vestido blanco manchado de sangre y el alma destrozada, pidiendo ser sacrificada para demostrar que, aunque huyó, su cuerpo sigue siendo "puro" porque fue arrastrada por una fuerza superior a su voluntad. La Madre, sin embargo, ya no tiene espacio para el odio o el perdón; se queda sola en su casa, rodeada de las mujeres de luto, aceptando que ya no tiene hijos que perder y que su única compañía será el recuerdo de "ese pequeño cuchillo que apenas cabe en la mano, pero que penetra frío por las carnes asombradas". Bodas de sangre concluye así como una reflexión sobre el ciclo inevitable de la violencia, la imposibilidad de escapar al destino y la fuerza de una pasión que, como un río de sangre, termina por desbordar y destruir todo a su paso.`
    },
    {
        session: 9,
        unit: 'Narrativa',
        topic: 'Narrativa Contemporánea: El curioso incidente...',
        videoTitle: 'El texto argumentativo',
        videoLink: 'https://www.youtube.com/watch?v=5bZ42hoiYh8',
        readingTitle: 'El curioso incidente del perro a medianoche (Resumen y Análisis)',
        readingContent: `La historia comienza en una calle tranquila de Swindon, Inglaterra, durante una medianoche que cambiaría para siempre la percepción del mundo de Christopher John Francis Boone. Christopher es un joven de quince años con una mente prodigiosa para las matemáticas y la lógica, pero que experimenta el mundo de una manera radicalmente distinta a la mayoría de las personas debido a un trastorno del espectro autista, probablemente síndrome de Asperger, aunque nunca se menciona explícitamente en el texto. Para Christopher, el mundo es un caos de estímulos sensoriales que debe ser ordenado meticulosamente a través de reglas, números primos y hechos comprobables. Esa noche, Christopher descubre el cadáver de Wellington, el caniche de su vecina la señora Shears, atravesado por una horca de jardín en medio del césped. Este evento, que para otros podría ser un incidente lamentable pero menor, se convierte para Christopher en el punto de partida de un enigma que debe resolver, decidiendo escribir un libro sobre su investigación, al estilo de sus admiradas historias de Sherlock Holmes.

La vida de Christopher está regida por una estructura rígida diseñada para protegerlo del abrumador ruido del mundo exterior. No soporta que lo toquen, no comprende las metáforas —porque las considera mentiras— y juzga la calidad de su día basándose en el color de los coches que ve desde el autobús escolar: cuatro coches rojos seguidos significan un "Buen Día", mientras que cuatro coches amarillos presagian un "Día Negro" en el que no hablará con nadie. Su principal apoyo es Siobhan, su tutora en la escuela, quien le enseña a descifrar las complejas emociones humanas a través de dibujos de caras y le anima a seguir escribiendo su crónica detectivesca. Sin embargo, su padre, Ed Boone, reacciona con una furia desproporcionada y angustiante cuando descubre que su hijo está haciendo preguntas sobre la muerte del perro, prohibiéndole terminantemente continuar con su investigación y exigiéndole que deje de meter las narices en los asuntos de los vecinos.

A pesar de la prohibición de su padre, la curiosidad lógica de Christopher lo lleva a desobedecer. Durante sus pesquisas, descubre verdades que los adultos a su alrededor han intentado ocultar bajo capas de silencio y engaño. La más devastadora de estas verdades se revela cuando Christopher, buscando su libro de notas que su padre le había confiscado, encuentra una caja con cartas escondidas en el armario de Ed. Al leerlas, su mundo lógico se colapsa: las cartas están escritas por su madre, Judy, y tienen fechas posteriores al momento en que su padre le dijo que ella había muerto de un ataque al corazón en el hospital. Christopher descubre que su madre no está muerta, sino que vive en Londres con el señor Shears, el exmarido de su vecina. La revelación de que su padre le ha mentido durante años sobre el hecho más fundamental de su vida rompe el único vínculo de confianza que Christopher poseía, llevándolo a un estado de pánico y parálisis emocional.

La situación alcanza un punto de no retorno cuando Ed, en un intento desesperado de reconciliación y honestidad tras ser descubierto, confiesa a Christopher que fue él quien mató a Wellington. La confesión de su padre no es recibida como un acto de redención, sino como una amenaza mortal para Christopher. En su lógica binaria, si su padre es capaz de matar a un perro, también es capaz de matarlo a él porque él también es un ser vivo que puede ser impredecible. Aterrorizado y sintiéndose inseguro en su propio hogar, Christopher toma una decisión que desafía todas sus limitaciones: viajar solo a Londres para encontrar a su madre. Este viaje representa una odisea épica para alguien que nunca ha ido más allá de su propia calle sin compañía y que se desorienta en lugares desconocidos y ruidosos.

El viaje a Londres es una de las partes más intensas y detalladas de la narración. Christopher debe enfrentarse a la estación de tren, un lugar que describe como un ataque masivo a sus sentidos, donde los anuncios, la multitud y el movimiento constante lo obligan a sentarse en el suelo y taparse los oídos para no "explotar". A través de un esfuerzo intelectual sobrehumano, utiliza sus conocimientos de matemáticas y su capacidad para crear mapas mentales para navegar por el metro de Londres, enfrentándose a la policía y al agotamiento. Esta parte de la historia permite al lector experimentar la angustia y la valentía silenciosa de Christopher, quien a pesar de su terror paralizante, sigue adelante porque su lógica le dice que es la única forma de sobrevivir.

Al llegar finalmente al apartamento de su madre, el encuentro provoca un caos emocional en la vida de Judy y del señor Shears. Judy, que se sentía incapaz de cuidar a Christopher años atrás debido a sus propias crisis de ansiedad y a la dificultad de manejar el comportamiento de su hijo, se ve inundada por la culpa y el amor. El regreso de Christopher a su vida fuerza la ruptura de su relación con el señor Shears y la obliga a regresar a Swindon para asegurar el bienestar de su hijo. La tensión entre Ed y Judy es constante y dolorosa, reflejando el impacto que tiene en una pareja la crianza de un niño con necesidades especiales cuando no existe la comunicación adecuada.

El final de la obra muestra a un Christopher que ha crecido internamente a través del trauma. A pesar de la inestabilidad que lo rodea, logra cumplir uno de sus mayores sueños: presentarse al examen de Bachillerato de Matemáticas de Nivel A, obteniendo la calificación máxima. Este logro académico es para él la prueba de que puede hacer cualquier cosa, incluso vivir solo y convertirse en un científico. Su padre, Ed, intenta recuperar su confianza poco a poco, regalándole un cachorro de Golden Retriever llamado Sandy para reemplazar la pérdida de Wellington y demostrando su compromiso de no volver a mentirle. Aunque la relación familiar no se repara de forma mágica y el futuro de Christopher sigue presentando desafíos significativos, la novela termina con una nota de esperanza basada en la autonomía. Christopher ha resuelto el misterio, ha sobrevivido a un viaje aterrador y ha descubierto la verdad sobre su familia, concluyendo que su mente única, lejos de ser una limitación, es la herramienta que le permitirá conquistar su propio destino.`
    },
    {
        session: 10,
        unit: 'Narrativa',
        topic: 'Narrativa/Crónica: Crónica de una muerte anunciada',
        videoTitle: 'Hecho y opinión',
        videoLink: 'https://www.youtube.com/watch?v=UsiqUeoyIaw',
        readingTitle: 'Crónica de una muerte anunciada (Resumen y Análisis)',
        readingContent: `El día en que lo iban a matar, Santiago Nasar se levantó a las cinco y media de la mañana para esperar el buque en que llegaba el obispo. Había tenido un sueño confuso sobre árboles de higuerón y una llovizna tierna, un presagio que su madre, Plácida Linero, experta en interpretar sueños ajenos, no alcanzó a descifrar como una señal de peligro. Santiago era un joven apuesto, heredero de una fortuna considerable y con un talento natural para el manejo de las armas y la cetrería, rasgos que había aprendido de su padre árabe, Ibrahim Nasar. Aquella mañana fatídica, el pueblo entero estaba conmocionado por la visita del obispo, pero bajo esa capa de fervor religioso se gestaba una tragedia de honor que ya era de dominio público, menos para el propio Santiago. La fatalidad comenzó meses atrás con la llegada de Bayardo San Román, un hombre de aspecto galante y recursos ilimitados que llegó al pueblo con el único propósito de casarse. Bayardo eligió a íngela Vicario, la hija menor de una familia de escasos recursos pero de honor rígido, y tras un cortejo ostentoso que incluyó la compra de la casa más hermosa del pueblo a un viudo reacio, se celebró la boda más grande que la región recordara.

Sin embargo, la noche de bodas terminó en un escándalo que marcaría el destino de todos. Bayardo San Román descubrió que íngela Vicario no era virgen y, siguiendo las leyes del honor de la época, la devolvió a la casa de sus padres en la madrugada. Bajo la presión de los golpes de su madre y el interrogatorio desesperado de sus hermanos gemelos, Pedro y Pablo Vicario, íngela pronunció un nombre: Santiago Nasar. Nunca se supo con certeza si Santiago era realmente el responsable, pues íngela siempre mantuvo su versión pero las pruebas circunstanciales sugerían que podría estar protegiendo a alguien a quien realmente amaba. Para los gemelos Vicario, la respuesta fue inmediata y obligatoria según los códigos sociales que regían su mundo: debían matar a Santiago Nasar para lavar la honra de su hermana. Lo que siguió fue una secuencia de eventos absurdos donde la voluntad humana pareció disolverse frente a un destino que se negaba a ser evitado.

Los gemelos Vicario no eran asesinos por naturaleza; eran hombres de paz que se sintieron empujados por el deber. Por esta razón, hicieron todo lo posible para que alguien los detuviera. Durante horas, anunciaron sus intenciones a voz en cuello en el mercado y en la tienda de leche de Clotilde Armenta. Afilaban sus cuchillos de destazar cerdos a la vista de todos, esperando que la autoridad o algún vecino les impidiera cometer el crimen. El pueblo, sin embargo, reaccionó con una mezcla de incredulidad, morbo y negligencia. Algunos pensaron que era una bravuconada de borrachos; otros creyeron que Santiago Nasar ya sabía y estaba protegido, y hubo quienes simplemente consideraron que los asuntos de honor eran privados y no debían interferir. El coronel Lázaro Aponte les quitó los cuchillos una vez, creyendo que con eso bastaba, pero los gemelos regresaron con otros nuevos, reafirmando que su compromiso no era con la muerte, sino con su propia dignidad.

A medida que avanzaba la mañana, la red de advertencias fallidas se volvía más compleja. Santiago Nasar salió de su casa por la puerta principal, la cual solía estar cerrada pero que ese día estaba abierta por la visita del obispo. Caminó por el pueblo saludando a la gente, ajeno al hecho de que los gemelos lo esperaban frente a la tienda de Clotilde. Hubo mensajes que nunca llegaron, personas que intentaron advertirle pero se cruzaron en el camino equivocado, y puertas que se cerraron en el momento menos oportuno. Incluso su novia, Flora Miguel, despechada por los rumores del escándalo, lo recibió con ira en lugar de protegerlo. Cuando Santiago finalmente comprendió que lo buscaban para matarlo, entró en un estado de confusión total, corriendo hacia su casa mientras el pueblo observaba la persecución como si fuera una función de teatro.

El clímax de la tragedia ocurrió frente a la puerta de su propia casa. Su madre, Plácida Linero, creyendo que Santiago ya estaba adentro, cerró la puerta principal justo cuando él intentaba entrar huyendo de los cuchillos de los gemelos. Los hermanos Vicario lo alcanzaron contra la madera de la puerta y lo apuñalaron con una saña que parecía dictada por una fuerza externa. Santiago Nasar, con las vísceras en las manos, logró caminar un corto trecho, entró por la puerta de la cocina y cayó muerto en el centro de su hogar. El asesinato no fue solo un acto de los Vicario, sino una ejecución colectiva permitida por la pasividad de una comunidad que aceptaba el sacrificio humano como una forma de mantener el equilibrio moral. La autopsia, realizada de manera rústica por el párroco debido a la ausencia del médico, fue un segundo ultraje al cuerpo de Santiago, convirtiendo su cadáver en una carnicería técnica que solo aumentó el horror de los testigos.

Los años siguientes no trajeron paz al pueblo. Los gemelos Vicario fueron absueltos por la justicia bajo el argumento del honor, pero sus vidas quedaron marcadas por el insomnio y la culpa. Bayardo San Román desapareció en un estado de postración, convertido en un fantasma de su antigua gloria. íngela Vicario, exiliada en un pueblo remoto, descubrió que su amor por Bayardo nació precisamente en el momento del rechazo. Durante décadas, le escribió miles de cartas que él nunca contestó, hasta que un día, ya ancianos, Bayardo regresó a ella con todas las cartas sin abrir, demostrando que el destino, aunque cruel, también tiene formas extrañas de cerrar sus ciclos. La crónica de la muerte de Santiago Nasar quedó grabada en la memoria colectiva no como un misterio por resolver, sino como la prueba de que, en ocasiones, todos somos cómplices de las tragedias que vemos venir y que nadie tiene la voluntad suficiente para detener.`
    },
    {
        session: 11,
        unit: 'Narrativa',
        topic: 'Narrativa del Terror: Edgar Allan Poe',
        videoTitle: 'El narrador y el conflicto',
        videoLink: '',
        readingTitle: 'El gato negro (Edgar Allan Poe)',
        readingContent: 'Ni espero ni solicito que crean el relato muy salvaje, y sin embargo muy hogareño, que voy a escribir. Estaría loco si lo esperase, en un caso donde mis propios sentidos rechazan su propio testimonio. No obstante, no estoy loco, y con toda seguridad no sueño. Pero mañana moriré, y hoy quiero aliviar mi alma...',
        pages: 18,
        examDate: '2026-02-15'
    },
    {
        session: 12,
        unit: 'Lírica',
        topic: 'Romanticismo: Gustavo Adolfo Bécquer',
        videoTitle: 'El lenguaje figurado y los símbolos',
        videoLink: '',
        readingTitle: 'Rimas y Leyendas (Selección)',
        readingContent: 'Volverán las oscuras golondrinas/en tu balcón sus nidos a colgar,/y otra vez con el ala a sus cristales/jugando llamarán./Pero aquellas que el vuelo refrenaron/tu hermosura y mi dicha a contemplar,/aquellas que aprendieron nuestros nombres.../¡esas... no volverán!',
        pages: 25,
        examDate: '2026-03-01'
    },
    {
        session: 13,
        unit: 'Argumentación',
        topic: 'Prensa y Opinión: Cartas al Director',
        videoTitle: 'Veracidad y consistencia de la información',
        videoLink: '',
        readingTitle: 'Selección de Columnas (Libertad y Ciudadanía)',
        readingContent: 'Señor Director: La libertad de expresión no es un cheque en blanco para la desinformación. En tiempos de crisis, la ciudadanía requiere certezas, no rumores esparcidos por redes sociales...',
        pages: 12,
        examDate: '2026-03-15'
    },
    {
        session: 14,
        unit: 'Dramático',
        topic: 'Tragedia Griega: Edipo Rey',
        videoTitle: 'Fragmentos de tragedias griegas',
        videoLink: '',
        readingTitle: 'Edipo Rey (Fragmento)',
        readingContent: 'EDIPO: ¡Oh hijos, descendencia nueva del antiguo Cadmo! ¿Por qué estáis en actitud suplicante ante mis altares, coronados con ramos de olivo? La ciudad está llena de incienso, y a la vez de peanes y de lamentos...',
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
        readingContent: '¿Existe una sola identidad en América Latina o somos un mosaico de culturas superpuestas? Desde la llegada de los barcos europeos hasta la globalización digital, nuestra región ha sido un laboratorio de mestizaje...',
        pages: 20,
        examDate: '2026-04-15'
    },
    { session: 16, unit: 'Repaso', topic: 'Deep Review Semestral', videoTitle: 'Estrategias de Lectura PAES', videoLink: 'https://www.youtube.com/watch?v=D-r_y4b4BO8' },
    { session: 17, unit: 'Teatro', topic: 'Estructura Dramática', videoTitle: 'Estructura interna obra dramática', videoLink: 'https://www.youtube.com/watch?v=Tn4XSVX5Ais' },
    { session: 18, unit: 'Teatro', topic: 'Visión de Mundo (Tragedia)', videoTitle: 'Género Dramático: Tragedia', videoLink: 'https://www.youtube.com/watch?v=tXWk5TcEAAc' },
    { session: 19, unit: 'Teatro', topic: 'Evolución de Personajes', videoTitle: 'El lenguaje dramático', videoLink: 'https://www.youtube.com/watch?v=NhHbymnMAR0' },
    { session: 20, unit: 'Teatro', topic: 'Crítica de Obra', videoTitle: 'Puesta en Escena y Virtualidad', videoLink: 'https://www.youtube.com/watch?v=_PB3SSNzwCQ' }
];

// --- COMPONENTS ---

const clayCard = 'bg-white rounded-[32px] border-2 border-white/50 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.02)] transition-transform duration-500 hover:-translate-y-2';
const clayBtnPrimary = 'bg-[#FFC800] text-white font-black rounded-2xl border-b-4 border-[#E0B000] hover:bg-[#FFD700] active:border-b-0 active:translate-y-1 transition-all duration-200 w-full py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_10px_rgba(0,0,0,0.05)] hover:scale-105 hover:-translate-y-1 active:scale-95';
const clayBtnAction = 'bg-[#58CC02] text-white font-black rounded-2xl border-b-4 border-[#46A302] hover:bg-[#46A302] active:border-b-0 active:translate-y-1 transition-all duration-100 w-full py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-[inset_0_4px_4px_rgba(255,255,255,0.4),0_10px_20px_rgba(88,204,2,0.3)] hover:scale-[1.05] hover:-translate-y-1 active:scale-95';
const clayInset = 'bg-[#F7F7F7] rounded-2xl border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]';

const MATH_SYLLABUS = [
    { session: 1, unit: 'Números', topic: 'Racionales: Concepto y Conversión', videoTitle: 'Matemática-Clase N°1-Racionales', videoLink: 'https://www.youtube.com/watch?v=1-vOmO4Ss5Y' },
    { session: 2, unit: 'Números', topic: 'Operatoria Combinada en Q', videoTitle: 'Operatoria combinada con racionales', videoLink: 'https://www.youtube.com/watch?v=vbh4lcMtpoI' },
    { session: 3, unit: 'Números', topic: 'Multiplicación y División Q', videoTitle: 'Capsule-Rational Numbers', videoLink: 'https://www.youtube.com/watch?v=M6qOX1Xj_tY' },
    { session: 4, unit: 'Números', topic: 'Potencias: Definición', videoTitle: 'Ayudantía PTU-Potencias', videoLink: 'https://www.youtube.com/watch?v=0BILyJ_NyDA' },
    { session: 5, unit: 'Números', topic: 'Propiedades de Potencias', videoTitle: '#PruebadeInvierno Matemática-POTENCIAS', videoLink: 'https://www.youtube.com/watch?v=9VCg25rf7xg' },
    { session: 6, unit: 'Números', topic: 'Exponente Cero y Negativo', videoTitle: 'Potencias y sus propiedades (Segmento)', videoLink: 'https://www.youtube.com/watch?v=Cdti7efBqVc' },
    { session: 7, unit: 'Números', topic: 'Crecimiento Exponencial', videoTitle: 'Matemática-Potencias 1° Medio', videoLink: 'https://www.youtube.com/watch?v=1RjOhQwPJB4' },
    { session: 8, unit: 'Números', topic: 'Raíces Enésimas', videoTitle: 'Prueba de Transición-Raíces', videoLink: 'https://www.youtube.com/watch?v=xMYFzXcFYns' },
    { session: 9, unit: 'Números', topic: 'Operatoria con Raíces', videoTitle: 'Capsule-Roots', videoLink: 'https://www.youtube.com/watch?v=HwxfKSq0lh8' },
    { session: 10, unit: 'Números', topic: 'Porcentajes', videoTitle: 'PAES M1-Porcentaje', videoLink: 'https://www.youtube.com/watch?v=YJ9l1Ew_rns' },
    { session: 11, unit: 'ílgebra', topic: 'Lenguaje Algebraico', videoTitle: 'EXPRESIONES ALGEBRAICAS Clase Níâ€šÃ‚º3', videoLink: 'https://www.youtube.com/watch?v=lojCGXH4Odk' },
    { session: 12, unit: 'ílgebra', topic: 'Cuadrado de Binomio', videoTitle: 'Cuadrado de binomio', videoLink: 'https://www.youtube.com/watch?v=IjL5zOyxs20' },
    { session: 13, unit: 'ílgebra', topic: 'Suma por Diferencia', videoTitle: 'Suma por diferencia', videoLink: 'https://www.youtube.com/watch?v=-w_lg-r7pDg' },
    { session: 14, unit: 'ílgebra', topic: 'Binomio con Término Común', videoTitle: 'Clase 6: ílgebra y funciones', videoLink: 'https://www.youtube.com/watch?v=CvgRtkMJ7ao' },
    { session: 15, unit: 'ílgebra', topic: 'Factorización: Factor Común', videoTitle: 'Factorización', videoLink: 'https://www.youtube.com/watch?v=JpYUEEqYxbU' },
    { session: 16, unit: 'ílgebra', topic: 'Factorización de Trinomios', videoTitle: 'Mathematical Factorization Criteria', videoLink: 'https://www.youtube.com/watch?v=pKwJBMHSeAY' },
    { session: 17, unit: 'ílgebra', topic: 'Ecuaciones Lineales', videoTitle: 'PAES M1-Ecuaciones lineales', videoLink: 'https://www.youtube.com/watch?v=vnjowqDBGB8' },
    { session: 18, unit: 'ílgebra', topic: 'Sistemas Ecuaciones (Intro)', videoTitle: 'Sistemas de ecuaciones (Casos)', videoLink: 'https://www.youtube.com/watch?v=AFKpBTCc6oU' },
    { session: 19, unit: 'ílgebra', topic: 'Método de Sustitución', videoTitle: 'Sistemas de ecuaciones-Sustitución', videoLink: 'https://www.youtube.com/watch?v=aBmuYyKeWaE' },
    { session: 20, unit: 'ílgebra', topic: 'Método de Reducción', videoTitle: 'INTENSIVO SISTEMAS DE ECUACIONES', videoLink: 'https://www.youtube.com/watch?v=J2dRZ2iM3sY' },
    { session: 21, unit: 'ílgebra', topic: 'Método de Igualación', videoTitle: 'METODO DE IGUALACIÓN', videoLink: 'https://www.youtube.com/watch?v=tr78m4H9BIw' },
    { session: 22, unit: 'ílgebra', topic: 'Problemas de Planteo', videoTitle: 'PLANTEO DE PROBLEMAS', videoLink: 'https://www.youtube.com/watch?v=780RStmengs' },
    { session: 23, unit: 'ílgebra', topic: 'Función Lineal', videoTitle: 'FUNCIÓN LINEAL Y AFíN', videoLink: 'https://www.youtube.com/watch?v=XC6VLf8pOVg' },
    { session: 24, unit: 'ílgebra', topic: 'Función Afín', videoTitle: 'Función lineal y afín (Parte 2)', videoLink: 'https://www.youtube.com/watch?v=TU0NMpLS88U' },
    { session: 25, unit: 'Geometría', topic: 'Vectores', videoTitle: 'Vectores en el plano cartesiano', videoLink: 'https://www.youtube.com/watch?v=fjKr9TnAKYs' },
    { session: 26, unit: 'Geometría', topic: 'Transformaciones Isométricas', videoTitle: 'TRANSFORMACIONES ISOMíÆ’Ã¢â‚¬°TRICAS', videoLink: 'https://www.youtube.com/watch?v=_tIaG3tmVgI' },
    { session: 27, unit: 'Geometría', topic: 'Homotecia: Concepto', videoTitle: 'Homotecia', videoLink: 'https://www.youtube.com/watch?v=_rJoKG8MLg8' },
    { session: 28, unit: 'Geometría', topic: 'Homotecia: Propiedades', videoTitle: 'Homotecia de figuras planas', videoLink: 'https://www.youtube.com/watch?v=OTGPT5AG2ww' },
    { session: 29, unit: 'Geometría', topic: 'Congruencia de Triángulos', videoTitle: 'Congruencia de triángulos', videoLink: 'https://www.youtube.com/watch?v=PX9FjNz7yR8' },
    { session: 30, unit: 'Geometría', topic: 'Criterios de Congruencia', videoTitle: 'Guía de ejercicios Congruencia', videoLink: 'https://www.youtube.com/watch?v=uuQ31qlYNaQ' },
    { session: 31, unit: 'Geometría', topic: 'Semejanza de Triángulos', videoTitle: 'Estudia para la PSU-Semejanza', videoLink: 'https://www.youtube.com/watch?v=S8RVnQG2q3I' },
    { session: 32, unit: 'Geometría', topic: 'Teorema de Thales', videoTitle: 'TEOREMA DE THALES Clase N°27', videoLink: 'https://www.youtube.com/watch?v=2ExAmja3378' },
    { session: 33, unit: 'Geometría', topic: 'Aplicación de Thales', videoTitle: 'Prueba de Transición-Teorema Thales', videoLink: 'https://www.youtube.com/watch?v=AhUyh4IZmHI' },
    { session: 34, unit: 'Geometría', topic: 'Ecuación de la Recta', videoTitle: 'Ecuación de la recta', videoLink: 'https://www.youtube.com/watch?v=-_MUgcyh3Ig' },
    { session: 35, unit: 'Datos', topic: 'Tablas de Frecuencia', videoTitle: 'Tablas de Frecuencia-Clase N°24', videoLink: 'https://www.youtube.com/watch?v=1EZyGLlUQGw' },
    { session: 36, unit: 'Datos', topic: 'Medidas Tendencia Central', videoTitle: 'Medidas tendencia central y rango', videoLink: 'https://www.youtube.com/watch?v=Vb5AzDzQcwo' },
    { session: 37, unit: 'Datos', topic: 'Medidas de Posición', videoTitle: 'Medidas de posición Clase N°28', videoLink: 'https://www.youtube.com/watch?v=jCfQjycgwdM' },
    { session: 38, unit: 'Datos', topic: 'Diagrama de Cajón', videoTitle: 'Diagrama de cajón y bigotes', videoLink: 'https://www.youtube.com/watch?v=GBNpyyApgdA' },
    { session: 39, unit: 'Datos', topic: 'Medidas de Dispersión', videoTitle: 'Medidas de dispersión', videoLink: 'https://www.youtube.com/watch?v=uwHz-WYYVpQ' },
    { session: 40, unit: 'Datos', topic: 'Probabilidad (Laplace)', videoTitle: 'Regla de Laplace', videoLink: 'https://www.youtube.com/watch?v=bazKrpT91kY' },
    { session: 41, unit: 'Datos', topic: 'Regla Aditiva', videoTitle: 'Probabilidades (Unión)', videoLink: 'https://www.youtube.com/watch?v=zI6Aly68P0Q' },
    { session: 42, unit: 'Datos', topic: 'Regla Multiplicativa', videoTitle: 'Probabilidad condicional', videoLink: 'https://www.youtube.com/watch?v=ZyF6TtT6hwo' },
    { session: 43, unit: 'Datos', topic: 'Técnicas de Conteo', videoTitle: 'TíÆ’Ã¢â‚¬°CNICAS DE CONTEO', videoLink: 'https://www.youtube.com/watch?v=klUzWXgLBRM' }
];

const DEFAULT_DAILY_ROUTE = {
    sujeto: 'Matemática',
    oa_title: 'S1: Racionales: Concepto y Conversión',
    color: '#4D96FF',
    icon: Brain,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video de la Clase', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. Teoría Lúdica IA', action: 'start_route', icon: 'Brain', isComplete: false },
        { step: '3. Quiz de 30 Preguntas', action: 'quiz', icon: 'Lock', isComplete: false }
    ],
    recommended_action_text: "INICIAR ESTUDIO DE HOY (TEORíA)"
};

const DEFAULT_LANG_ROUTE = {
    sujeto: 'Lenguaje',
    oa_title: 'S1: Nivelación y Diagnóstico',
    color: '#FF9F43',
    icon: BookOpen,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video Análisis', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. Crítica Literaria IA', action: 'start_route', icon: 'BookOpen', isComplete: false },
        { step: '3. Redacción/Quiz', action: 'quiz', icon: 'Star', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANíLISIS CRíTICO"
};


const CHEMISTRY_SYLLABUS = [
    // UNIDAD 1: REACCIONES (Sesiones 1-10)
    { session: 1, unit: 'Reacciones', topic: 'Transformaciones Físicas vs. Químicas', videoTitle: 'Cambios Físicos y Químicos', videoLink: 'https://www.youtube.com/watch?v=Zz0xuNCpAQc' },
    { session: 2, unit: 'Reacciones', topic: 'Evidencias Empíricas de Reacción', videoTitle: 'Reacciones cotidianas', videoLink: 'https://www.curriculumnacional.cl/docente/629/w3-article-34461.html' },
    { session: 3, unit: 'Reacciones', topic: 'Teoría de las Colisiones', videoTitle: 'Teoría de Colisiones', videoLink: 'https://www.youtube.com/watch?v=-RQIfEefAzg' },
    { session: 4, unit: 'Reacciones', topic: 'Energía de Activación', videoTitle: 'Perfil de Energía', videoLink: 'https://www.youtube.com/watch?v=vkNZKYPfBss' },
    { session: 5, unit: 'Reacciones', topic: 'La Ecuación Química', videoTitle: 'Anatomía de la Ecuación', videoLink: 'https://www.youtube.com/watch?v=G4kiAaLiigI' },
    { session: 6, unit: 'Reacciones', topic: 'Síntesis y Descomposición', videoTitle: 'Tipos de Reacción I', videoLink: 'https://www.youtube.com/shorts/hsWclMOU6Hs' },
    { session: 7, unit: 'Reacciones', topic: 'Sustitución y Desplazamiento', videoTitle: 'Tipos de Reacción II', videoLink: 'https://www.youtube.com/watch?v=Qz0ipe5qc8I' },
    { session: 8, unit: 'Reacciones', topic: 'Neutralización Ãcido-Base', videoTitle: 'Neutralización', videoLink: 'https://www.youtube.com/watch?v=mHJsc1tnAnk' },
    { session: 9, unit: 'Reacciones', topic: 'Exotérmicas y Endotérmicas', videoTitle: 'Termodinámica Básica', videoLink: 'https://www.youtube.com/watch?v=G7TFOnQoU8w' },
    { session: 10, unit: 'Reacciones', topic: 'Taller de Clasificación', videoTitle: 'Ejercicios Tipos de Reacción', videoLink: 'https://www.youtube.com/watch?v=rTzSYDg2NU4' },

    // UNIDAD 2: LEYES Y BALANCEO (Sesiones 11-22)
    { session: 11, unit: 'Leyes Ponderales', topic: 'Ley de Lavoisier', videoTitle: 'Conservación de la Masa', videoLink: 'https://www.youtube.com/watch?v=kJpWo_KNH3s' },
    { session: 12, unit: 'Leyes Ponderales', topic: 'Ley de Proust', videoTitle: 'Proporciones Definidas', videoLink: 'https://www.youtube.com/watch?v=X3p48ApI0hg' },
    { session: 13, unit: 'Leyes Ponderales', topic: 'Resolución de Problemas', videoTitle: 'Ejercicios Leyes Ponderales', videoLink: 'https://www.youtube.com/watch?v=s0F71jI-Qq0' },
    { session: 14, unit: 'Balanceo', topic: 'Fundamentos del Balanceo', videoTitle: 'Intro al Balanceo', videoLink: 'https://www.youtube.com/watch?v=XfEZQ8ens80' },
    { session: 15, unit: 'Balanceo', topic: 'Método de Tanteo', videoTitle: 'Balanceo por Tanteo', videoLink: 'https://www.youtube.com/watch?v=OQ4mjedkr0M' },
    { session: 16, unit: 'Balanceo', topic: 'Práctica Intensiva Tanteo', videoTitle: 'Ejercicios Tanteo', videoLink: 'https://www.youtube.com/watch?v=AteEPYCMGDE' },
    { session: 17, unit: 'Balanceo', topic: 'Método Algebraico Intro', videoTitle: 'Intro Algebraico', videoLink: 'https://www.youtube.com/watch?v=VxgyhjojvGI' },
    { session: 18, unit: 'Balanceo', topic: 'Sistemas de Ecuaciones Químicas', videoTitle: 'Resolución Algebraica', videoLink: 'https://www.youtube.com/watch?v=ZYUMX1DO4tY' },
    { session: 19, unit: 'Balanceo', topic: 'Balanceo Complejo', videoTitle: 'Algebraico Avanzado', videoLink: 'https://www.youtube.com/watch?v=MCEc0e-bDt4' },
    { session: 20, unit: 'Nomenclatura', topic: 'Óxidos Básicos y Ãcidos', videoTitle: 'Nomenclatura Óxidos', videoLink: 'https://www.youtube.com/watch?v=pH9acFVTlM8' },
    { session: 21, unit: 'Nomenclatura', topic: 'Hidruros y Sales Binarias', videoTitle: 'Binarios', videoLink: 'https://www.youtube.com/watch?v=OUvUaQE8G8Q' },
    { session: 22, unit: 'Nomenclatura', topic: 'Compuestos Ternarios', videoTitle: 'Hidróxidos y Oxácidos', videoLink: 'https://www.youtube.com/watch?v=-L-g5vR1gV0' },

    // UNIDAD 3: EL MOL (Sesiones 23-34)
    { session: 23, unit: 'Estequiometría', topic: 'Concepto de Mol', videoTitle: '¿Qué es un Mol?', videoLink: 'https://www.youtube.com/watch?v=zzUBFrHYNu4' },
    { session: 24, unit: 'Estequiometría', topic: 'Número de Avogadro', videoTitle: 'Dimensionando el Mol', videoLink: 'https://www.youtube.com/watch?v=Ds8cSbdXghs' },
    { session: 25, unit: 'Estequiometría', topic: 'Masa Atómica', videoTitle: 'Tabla Periódica y Masa', videoLink: 'https://www.youtube.com/watch?v=A8qq0U9LkTE' },
    { session: 26, unit: 'Estequiometría', topic: 'Masa Molar Compuestos', videoTitle: 'Cálculo Masa Molar', videoLink: 'https://www.youtube.com/watch?v=kBXSRIm8uBc' },
    { session: 27, unit: 'Estequiometría', topic: 'Conversión Gramos a Moles', videoTitle: 'Conversiones Básicas', videoLink: 'https://www.youtube.com/watch?v=TwRQUj8cEBw' },
    { session: 28, unit: 'Estequiometría', topic: 'Conversión Masa-Mol-Ãtomos', videoTitle: 'Conversiones Avanzadas', videoLink: 'https://www.youtube.com/watch?v=7bxHKDtW5tQ' },
    { session: 29, unit: 'Estequiometría', topic: 'Compuestos Hidratados', videoTitle: 'Masa Molar Compleja', videoLink: 'https://www.youtube.com/watch?v=3pamhajW65s' },
    { session: 30, unit: 'Estequiometría', topic: 'Composición Porcentual', videoTitle: 'Porcentaje en Masa', videoLink: 'https://www.youtube.com/watch?v=ni4KlRkBoVg' },
    { session: 31, unit: 'Estequiometría', topic: 'Fórmula Empírica y Molecular', videoTitle: 'Deducción de Fórmulas', videoLink: 'https://www.youtube.com/watch?v=MnafInl0GQw' },
    { session: 32, unit: 'Estequiometría', topic: 'Relaciones Molares', videoTitle: 'Estequiometría Mol-Mol', videoLink: 'https://www.youtube.com/watch?v=lx_Rahu3sVw' },
    { session: 33, unit: 'Estequiometría', topic: 'Cálculo Masa-Masa', videoTitle: 'Estequiometría Masa-Masa', videoLink: 'https://www.youtube.com/watch?v=oAG6uyyVKEg' },
    { session: 34, unit: 'Estequiometría', topic: 'Taller Estequiometría', videoTitle: 'Ejercicios Mixtos', videoLink: 'https://www.youtube.com/watch?v=oAG6uyyVKEg' },

    // UNIDAD 4: SOLUCIONES Y CINÃ‰TICA (Sesiones 35-46)
    { session: 35, unit: 'Estequiometría Real', topic: 'Reactivo Limitante Concepto', videoTitle: 'Intro Reactivo Limitante', videoLink: 'https://www.youtube.com/watch?v=_rts32wOiv0' },
    { session: 36, unit: 'Estequiometría Real', topic: 'Cálculo Reactivo Limitante', videoTitle: 'Cálculo RL', videoLink: 'https://www.youtube.com/watch?v=bOrVhbELagw' },
    { session: 37, unit: 'Estequiometría Real', topic: 'Rendimiento de Reacción', videoTitle: 'Porcentaje de Rendimiento', videoLink: 'https://www.youtube.com/watch?v=iAATyWldpqs' },
    { session: 38, unit: 'Estequiometría Real', topic: 'Pureza de Reactivos', videoTitle: 'Ejercicios con Pureza', videoLink: 'https://www.youtube.com/watch?v=urHXCP2gUf8' },
    { session: 39, unit: 'Soluciones', topic: 'Introducción Soluciones', videoTitle: 'Soluto y Solvente', videoLink: 'https://www.youtube.com/watch?v=stzzdORx1vM' },
    { session: 40, unit: 'Soluciones', topic: 'Unidades Físicas', videoTitle: 'Concentración %', videoLink: 'https://www.youtube.com/watch?v=stzzdORx1vM' },
    { session: 41, unit: 'Soluciones', topic: 'Molaridad', videoTitle: 'Concentración Molar', videoLink: 'https://www.youtube.com/watch?v=LDs8dhIIr-g' },
    { session: 42, unit: 'Cinética', topic: 'Factores de Velocidad I', videoTitle: 'Temp y Superficie', videoLink: 'https://www.youtube.com/watch?v=HROvz_OQnx8' },
    { session: 43, unit: 'Cinética', topic: 'Factores de Velocidad II', videoTitle: 'Catalizadores', videoLink: 'https://www.youtube.com/watch?v=vJ7bk49kA9g' },
    { session: 44, unit: 'Cinética', topic: 'Exp. Virtual Cinética', videoTitle: 'Laboratorio Virtual', videoLink: 'https://www.youtube.com/watch?v=TuA_8006jCM' },
    { session: 45, unit: 'Integración', topic: 'Lluvia Ãcida', videoTitle: 'Química Ambiental', videoLink: 'https://www.youtube.com/watch?v=YsEqU2TuvaI' },
    { session: 46, unit: 'Cierre', topic: 'Síntesis Final', videoTitle: 'Resumen PAES', videoLink: 'https://www.youtube.com/watch?v=Zz0xuNCpAQc' }
];

const DEFAULT_CHEM_ROUTE = {
    sujeto: 'Química',
    oa_title: 'S1: Transformaciones Físicas vs. Químicas',
    color: '#E84393',
    icon: FlaskConical,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video Análisis', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. Laboratorio Virtual', action: 'start_route', icon: 'FlaskConical', isComplete: false },
        { step: '3. Quiz de Reacciones', action: 'quiz', icon: 'Atom', isComplete: false }
    ],
    recommended_action_text: "INICIAR EXPERIMENTO"
};


const VideoModal = ({ isOpen, onClose, videoUrl, title, onDoubt, onFinish }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    if (!isOpen || !videoUrl) return null;

    const getVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
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
                        {isLoading ? '⏳ Guardando...' : '✅ Terminar Video'}
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
const ReadingModal = ({ isOpen, onClose, title, content, onFinish }) => {
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
                    {content}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#2B2E4A]/10 rounded-b-3xl flex justify-end">
                    <button
                        onClick={onFinish}
                        className="bg-[#2B2E4A] text-white font-bold rounded-xl py-3 px-8 shadow-lg hover:bg-[#34385a] transition-all flex items-center gap-2"
                    >
                        <span>Terminar y Analizar</span>
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
                setQuestion("Explícame paso a paso este ejercicio que aparece en el video.");
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
                    ¿Tienes alguna duda?
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
                        : "Pregúntale a Matico sobre cualquier concepto."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onPaste={handlePaste}
                            className={`${clayInset} w-full h-32 p-4 text-[#2B2E4A] font-bold resize-none focus:outline-none focus:ring-2 focus:ring-[#4D96FF]/50`}
                            placeholder={isVideoContext ? "Describe el ejercicio o pega una imagen..." : "Ej: ¿Por qué todo número elevado a 0 es 1?"}
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
                            Tip: Presiona <span className="font-bold bg-gray-200 px-1 rounded">ImpPnt</span> y luego <span className="font-bold bg-gray-200 px-1 rounded">Ctrl + V</span> aquí.
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`${clayBtnAction} w-full`}
                        disabled={isCallingN8N || (!question.trim() && !pastedImage)}
                    >
                        {isCallingN8N ? 'Pensando...' : (pastedImage ? '✅ Confirmar y Analizar Imagen' : 'Preguntar a Matico 🚀')}
                    </button>
                </form>
            </div >
        </div >
    );
};

// NEW: CUSTOM LOADING OVERLAY
const LoadingOverlay = ({ isOpen, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2B2E4A]/60 backdrop-blur-md animate-fade-in">
            <div className={`${clayCard} !bg-[#FFC300] flex flex-col items-center p-8 animate-bounce max-w-sm`}>
                <Brain className="w-16 h-16 text-[#2B2E4A] animate-spin mb-4" />
                <h2 className="text-2xl font-black text-[#2B2E4A] text-center uppercase tracking-widest whitespace-pre-line">
                    {message || "✋ ESPÉRATE...\nESTOY PENSANDO 🤔"}
                </h2>
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
                    <Flag className="w-4 h-4 text-[#FF6B6B] animate-wiggle" /> La Gran Carrera (Meta {totalDays} Días)
                </h3>
                <div className="text-right">
                    <span className="font-black text-2xl text-[#4D96FF]">{currentDay}</span>
                    <span className="font-bold text-[#9094A6] text-xs">/ {totalDays} Días</span>
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
            <button onClick={() => setIsActive(!isActive)} className={isActive ? clayBtnAction : clayBtnPrimary}>{isActive ? 'PAUSAR' : 'INICIAR'}</button>
        </div>
    );
};


const cleanLatex = (text) => {
    if (typeof text !== 'string') return text;
    // Fix double-escaped dollars: \$ -> $
    let clean = text.replace(/\\\$\$/g, '$$');
    // Fix double-escaped inline dollars: \$ -> $
    clean = clean.replace(/\\$/g, '$');
    return clean;
};

// HELPER FOR ROBUST N8N JSON PARSING
const parseN8NResponse = (textResponse) => {
    let jsonData = {};
    try {
        // First try standard parse cleaning logic
        try {
            jsonData = JSON.parse(textResponse.replace(/\\(?![\\/u"bfnrt\\])/g, '\\\\'));
        } catch (e) {
            const jsonMatch = textResponse.match(/{[\s\S]*}/);
            if (jsonMatch) {
                jsonData = JSON.parse(jsonMatch[0].replace(/\\(?![\\/u"bfnrt\\])/g, '\\\\'));
            } else {
                throw e;
            }
        }

        // Handle recursive encoded JSON inside .output
        if (jsonData.output && typeof jsonData.output === 'string') {
            let raw = jsonData.output;
            raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

            const sanitized = raw
                .replace(/\\"/g, '"')
                .replace(/[\u000A\u000D]/g, "\\n")
                .replace(/\\(.)/g, (match, char) => {
                    if (char === '$') return '$';
                    if ('"\\/nrtu'.includes(char)) return match;
                    return '\\\\' + char;
                });

            try {
                const parsed = JSON.parse(sanitized);
                if (parsed && typeof parsed === 'object') {
                    jsonData = { ...jsonData, ...parsed };
                }
            } catch (e) {
                try {
                    const parsedRaw = JSON.parse(raw);
                    if (parsedRaw && typeof parsedRaw === 'object') {
                        jsonData = { ...jsonData, ...parsedRaw };
                    }
                } catch (e2) { }
            }
        }
        return jsonData;
    } catch (error) {
        console.error("Parse Error:", error);
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

    const isQuiz = content.includes('QUIZ DE VALIDACIÓN');
    const isReview = content.includes('Módulo de Refuerzo');
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
        actionText = 'SIGUIENTE PREGUNTA ➡ ';
        actionColor = clayBtnAction;
        actionHandler = () => {
            callAgent(subject, 'deepen_knowledge', `${routeTitle}-Continuación`);
        };
    } else if (isQuiz) {
        actionText = 'COMENZAR QUIZ';
        actionColor = 'bg-[#4D96FF] text-white shadow-[6px_6px_12px_#2a6bc7,-6px_-6px_12px_#70b9ff] hover:bg-[#3f80d6]';
        actionHandler = onStartQuiz ? onStartQuiz : () => callAgent(subject, 'generate_quiz', routeTitle);
    }

    const contentTitle = isTheory ? `Teoría Lúdica por Matico (${routeTitle}):` : (isActiveQuiz ? '¡Quiz en Progreso!' : 'Plan de Refuerzo:');

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
            callAgent(subject, 'deepen_knowledge', `${routeTitle}-Nivel Avanzado`, null, null, null, nextQ);
        } else {
            // OPTIONAL: KEEP LEVEL OR DECREASE? FOR NOW KEEP TO REINFORCE
            callAgent(subject, 'remedial_explanation', `${routeTitle}-Refuerzo Concepto`);
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
                            <h3 className="font-black text-[#2B2E4A] text-lg">Agente de {subject}</h3>
                            <p className="text-[#9094A6] text-xs font-bold uppercase">Contenido Generado por IA</p>
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
                                <span className="text-xl">🧠 </span>⚡ Desafío Rápido:
                            </h5>
                            <div className="font-bold text-[#2B2E4A] mb-4">
                                <MathRenderer text={apiJson.question} />
                            </div>

                            <div className="space-y-3">
                                {apiJson.options && apiJson.options.map((option, index) => {
                                    const cleanOption = option.replace(/^[A-Z]\)\s*/, '');
                                    let btnStyle = "w-full text-left p-4 rounded-xl transition-all duration-200 font-bold text-sm border-2 ";
                                    if (showExplanation) {
                                        if (index === apiJson.correctIndex) {
                                            btnStyle += "bg-[#6BCB77]/20 border-[#6BCB77] text-[#2B2E4A]";
                                        } else if (index === selectedOption) {
                                            btnStyle += "bg-[#FF6B6B]/20 border-[#FF6B6B] text-[#2B2E4A]";
                                        } else {
                                            btnStyle += "bg-white/50 border-transparent text-gray-400";
                                        }
                                    } else {
                                        btnStyle += "bg-[#E0E5EC] border-white hover:border-[#4D96FF] hover:bg-white shadow-[4px_4px_8px_#a3b1c6,-4px_-4px_8px_#ffffff] active:shadow-inner text-[#2B2E4A]";
                                    }
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => !showExplanation && handleOptionClick(index)}
                                            className={btnStyle}
                                            disabled={showExplanation}
                                        >
                                            <span className="opacity-60 mr-2">{index === 0 ? 'A)' : index === 1 ? 'B)' : index === 2 ? 'C)' : 'D)'}</span>
                                            <MathRenderer text={cleanOption} />
                                            {showExplanation && index === apiJson.correctIndex && <Check className="inline w-4 h-4 ml-2 text-[#6BCB77]" />}
                                            {showExplanation && index === selectedOption && index !== apiJson.correctIndex && <X className="inline w-4 h-4 ml-2 text-[#FF6B6B]" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {showExplanation && (
                                <div className="mt-6 p-4 bg-[#FFD93D]/20 border-2 border-[#FFD93D] rounded-2xl animate-fade-in relative">
                                    <h6 className="font-black text-[#C7A005] mb-2 flex items-center gap-2">
                                        <Lightbulb className="w-5 h-5" /> Explicación:
                                    </h6>
                                    <MathRenderer text={apiJson.explanation} />

                                    <div className="mt-6 pt-4 border-t border-[#FFD93D]/30 flex justify-between items-center gap-2">
                                        {/* NEW CONTEXTUAL HELP BUTTON */}
                                        <button
                                            onClick={onAskDoubt}
                                            className="px-4 py-2 bg-white/50 text-[#FF9F43] font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-white transition-colors"
                                        >
                                            <HelpCircle className="w-4 h-4" /> ¿PREGUNTAS? 🤔
                                        </button>

                                        <button
                                            onClick={handleNextStep}
                                            className={`${clayBtnAction} w-auto px-6 py-2 text-xs`}
                                            disabled={isCallingN8N}
                                        >
                                            {isCallingN8N ? 'Pensando...' : (isCorrect ? '¡Siguiente! 🚀' : 'Refuerzo ➡ï¸')}
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
            const regex = new RegExp(`\\b(alternativa|opción|opcion|letra|respuesta|solución)(?:\\s+(?:correcta|incorrecta|es|la|el|que|sea))*\\s+\${label}(?:\\))?\\b`, 'gi');
            newText = newText.replace(regex, `la opción "${cleanOptionContent}"`);
            const regex2 = new RegExp(`\\b(es|son|sea)\\s+la\\s+\${label}(?:\\))?\\b`, 'gi');
            newText = newText.replace(regex2, `es la opción "${cleanOptionContent}"`);
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
    { session: 1, unit: 'Ondas y Sonido', topic: 'Introducción a las Ondas: Materia vs Energía', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 2, unit: 'Ondas y Sonido', topic: 'Clasificación I: Mecánicas vs Electromagnéticas', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 3, unit: 'Ondas y Sonido', topic: 'Clasificación II: Transversales vs Longitudinales', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },
    { session: 4, unit: 'Ondas y Sonido', topic: 'Anatomía de la Onda', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 5, unit: 'Ondas y Sonido', topic: 'Concepto de Ciclo', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 6, unit: 'Ondas y Sonido', topic: 'Periodo y Frecuencia (Teoría)', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },
    { session: 7, unit: 'Ondas y Sonido', topic: 'Periodo y Frecuencia (Cálculo)', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 8, unit: 'Ondas y Sonido', topic: 'Longitud de Onda', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 9, unit: 'Ondas y Sonido', topic: 'Rapidez de Propagación', videoLink: 'https://www.youtube.com/watch?v=Q9kKWQa9Trs' },
    { session: 10, unit: 'Ondas y Sonido', topic: 'El Sonido y sus Propiedades', videoLink: 'https://www.youtube.com/watch?v=n9O6IBVkBMM' },
    { session: 11, unit: 'Ondas y Sonido', topic: 'Fenómenos: Reflexión y Difracción', videoLink: 'https://www.youtube.com/watch?v=PFdowtChLCY' },
    { session: 12, unit: 'Ondas y Sonido', topic: 'Fenómenos: Refracción y Doppler', videoLink: 'https://www.youtube.com/watch?v=-MK8v4rRMA8' },
    { session: 13, unit: 'Ondas y Sonido', topic: 'Evaluación Fase 1: Ondas', videoLink: 'https://www.youtube.com/watch?v=P-kbPkWC8CI' },

    // FASE 2: LUZ Y OPTICA
    { session: 14, unit: 'Luz y Óptica', topic: 'Dualidad Onda-Partícula y Espectro', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 15, unit: 'Luz y Óptica', topic: 'Propagación y Velocidad de la Luz', videoLink: 'https://www.youtube.com/shorts/tvIQhjn6nm8' },
    { session: 16, unit: 'Luz y Óptica', topic: 'Reflexión en Espejos Planos', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 17, unit: 'Luz y Óptica', topic: 'Espejos Cóncavos (Foco Real)', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 18, unit: 'Luz y Óptica', topic: 'Espejos Convexos (Foco Virtual)', videoLink: 'https://www.youtube.com/watch?v=6nsIQW3kByo' },
    { session: 19, unit: 'Luz y Óptica', topic: 'Refracción y Ley de Snell', videoLink: 'https://www.youtube.com/watch?v=JfDw0jRjllo' },
    { session: 20, unit: 'Luz y Óptica', topic: 'Reflexión Total Interna', videoLink: 'https://www.youtube.com/watch?v=uKfGqD-2rAs' },
    { session: 21, unit: 'Luz y Óptica', topic: 'Lentes Convergentes y el Ojo', videoLink: 'https://www.youtube.com/watch?v=5hTXt8SsgBw' },
    { session: 22, unit: 'Luz y Óptica', topic: 'Lentes Divergentes y Miopía', videoLink: 'https://www.youtube.com/watch?v=5hTXt8SsgBw' },
    { session: 23, unit: 'Luz y Óptica', topic: 'El Ojo Humano y Defectos', videoLink: 'https://www.youtube.com/watch?v=Z6GsrLQ6H3M' },
    { session: 24, unit: 'Luz y Óptica', topic: 'Dispersión Cromática (Prisma)', videoLink: 'https://www.youtube.com/watch?v=JZt8EJH146k' },
    { session: 25, unit: 'Luz y Óptica', topic: 'Evaluación Fase 2: Luz', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },

    // FASE 3: SISMOS
    { session: 26, unit: 'Dinámica Terrestre', topic: 'Estructura Interna de la Tierra', videoLink: 'https://www.youtube.com/watch?v=IaZfi4RitGU' },
    { session: 27, unit: 'Dinámica Terrestre', topic: 'Tectónica de Placas', videoLink: 'https://www.youtube.com/watch?v=rrlwHnG3hPA' },
    { session: 28, unit: 'Dinámica Terrestre', topic: 'Límites Convergentes y Divergentes', videoLink: 'https://www.youtube.com/watch?v=rrlwHnG3hPA' },
    { session: 29, unit: 'Dinámica Terrestre', topic: 'Origen de los Sismos: Hipocentro', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 30, unit: 'Dinámica Terrestre', topic: 'Ondas P y S (Cuerpo)', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 31, unit: 'Dinámica Terrestre', topic: 'Ondas Superficiales (Rayleigh/Love)', videoLink: 'https://www.youtube.com/watch?v=myeotjlSDkc' },
    { session: 32, unit: 'Dinámica Terrestre', topic: 'Escalas: Richter vs Mercalli', videoLink: 'https://www.youtube.com/watch?v=NlGb3SvyBpI' },
    { session: 33, unit: 'Dinámica Terrestre', topic: 'Evaluación Fase 3: Sismos', videoLink: 'https://www.youtube.com/watch?v=vQ6NzZh0SNg' },

    // FASE 4: UNIVERSO
    { session: 34, unit: 'El Universo', topic: 'Estructuras Cósmicas y Escalas', videoLink: 'https://www.youtube.com/watch?v=h5rS1Lfahsk' },
    { session: 35, unit: 'El Universo', topic: 'Big Bang y Expansión', videoLink: 'https://www.youtube.com/watch?v=h5rS1Lfahsk' },
    { session: 36, unit: 'El Universo', topic: 'Sistema Solar: Rocosos vs Gaseosos', videoLink: 'https://www.youtube.com/watch?v=idZGB2T5EPE' },
    { session: 37, unit: 'El Universo', topic: 'Leyes de Kepler (I y II)', videoLink: 'https://www.youtube.com/watch?v=a3-gU4tpjWc' },
    { session: 38, unit: 'El Universo', topic: '3ra Ley de Kepler y Gravitación', videoLink: 'https://www.youtube.com/watch?v=a3-gU4tpjWc' },
    { session: 39, unit: 'Repaso Integral', topic: 'Repaso Ondas y Sonido', videoLink: 'https://www.youtube.com/watch?v=fbY_p2MoykA' },
    { session: 40, unit: 'Repaso Integral', topic: 'Repaso Óptica Geométrica', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 41, unit: 'Repaso Integral', topic: 'Repaso Sismos y Universo', videoLink: 'https://www.youtube.com/watch?v=jalVd4_I3jM' },
    { session: 42, unit: 'Cierre', topic: 'ENSAYO FINAL SIMULACIÓN', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' },
    { session: 43, unit: 'Cierre', topic: 'Análisis de Errores y Cierre', videoLink: 'https://www.youtube.com/watch?v=qy5j64ebAYQ' }
];


const BIOLOGY_SYLLABUS = [
    // UNIDAD 1: EVOLUCIÓN Y BIODIVERSIDAD
    { session: 1, unit: 'Evolución', topic: 'Teorías Pre-Darwinianas', videoLink: 'https://www.youtube.com/watch?v=c1oJKMtVLYQ' },
    { session: 2, unit: 'Evolución', topic: 'Darwin y Wallace', videoLink: 'https://www.youtube.com/watch?v=J7fsT_85Ld0' },
    { session: 3, unit: 'Evolución', topic: 'Teoría Sintética', videoLink: 'https://www.youtube.com/watch?v=6QfDA44028s' },
    { session: 4, unit: 'Evolución', topic: 'Registro Fósil', videoLink: 'https://www.youtube.com/watch?v=aBrypvwLLpg' },
    { session: 5, unit: 'Evolución', topic: 'Anatomía Comparada', videoLink: 'https://www.youtube.com/watch?v=DXlVOxWzdwQ' },
    { session: 6, unit: 'Evolución', topic: 'Embriología y Biogeografía', videoLink: 'https://www.youtube.com/watch?v=lZUX9Kv6y7s' },
    { session: 7, unit: 'Evolución', topic: 'EvoluciÃƒ³n Humana y HominizaciÃƒ³n', videoLink: 'https://www.youtube.com/watch?v=9oY_Q5Gf_v4' },
    { session: 8, unit: 'Evolución', topic: 'Taller de Integración', videoLink: 'https://www.youtube.com/watch?v=bPr6duAHk4I' },
    { session: 9, unit: 'Evolución', topic: 'Especiación', videoLink: 'https://www.youtube.com/watch?v=CBAwcRaVzA4' },
    { session: 10, unit: 'Evolución', topic: 'Taxonomía y Sistemática', videoLink: 'https://www.youtube.com/watch?v=Ji5aYL0KQoY' },
    { session: 11, unit: 'Evolución', topic: 'SÃƒ­ntesis de la Unidad: El Origen de la Biodiversidad', videoLink: 'https://www.youtube.com/watch?v=UqQ_u5qS5r4' },
    { session: 12, unit: 'Evolución', topic: 'Protista y Fungi', videoLink: 'https://www.youtube.com/watch?v=6tttZ_7Q9a8' },
    { session: 13, unit: 'Evolución', topic: 'Atributos de una PoblaciÃƒ³n (Densidad y DistribuciÃƒ³n)', videoLink: 'https://www.youtube.com/watch?v=S0T0E9y_H0c' },

    // UNIDAD 2: ORGANISMOS EN ECOSISTEMAS
    { session: 14, unit: 'Ecología', topic: 'Organización Ecológica', videoLink: 'https://www.youtube.com/watch?v=18gqzWCPDMU' },
    { session: 15, unit: 'Ecología', topic: 'Distribución Espacial', videoLink: 'https://www.youtube.com/watch?v=MIiIIrZKggI' },
    { session: 16, unit: 'Ecología', topic: 'Crecimiento Poblacional: Modelos J y S', videoLink: 'https://www.youtube.com/watch?v=KzX6yK8jC8U' },
    { session: 17, unit: 'Ecología', topic: 'Crecimiento Logístico', videoLink: 'https://www.youtube.com/watch?v=2IFEZUEL7DQ' },
    { session: 18, unit: 'Ecología', topic: 'Interacciones BiolÃƒ³gicas (Competencia, DepredaciÃƒ³n)', videoLink: 'https://www.youtube.com/watch?v=XF3P8K7XpLc' },
    { session: 19, unit: 'Ecología', topic: 'Regulación Poblacional', videoLink: 'https://www.youtube.com/watch?v=F1_W1qRBV5M' },
    { session: 20, unit: 'Ecología', topic: 'Competencia y Depredación', videoLink: 'https://www.youtube.com/watch?v=1Pqr7RVMx4A' },
    { session: 21, unit: 'Ecología', topic: 'Simbiosis', videoLink: 'https://www.youtube.com/watch?v=GJnXQjFnyxo' },
    { session: 22, unit: 'Ecología', topic: 'Ecología Humana', videoLink: 'https://www.youtube.com/watch?v=xqHjtAFuuc4' },

    // UNIDAD 3: MATERIA Y ENERGÃA
    { session: 23, unit: 'Energía', topic: 'Metabolismo y ATP', videoLink: 'https://www.youtube.com/watch?v=q2y_0wDcTDM' },
    { session: 24, unit: 'Energía', topic: 'Fotosíntesis: Intro', videoLink: 'https://www.youtube.com/watch?v=XTVmIME0XOs' },
    { session: 25, unit: 'Energía', topic: 'Fase Dependiente de Luz', videoLink: 'https://www.youtube.com/watch?v=y-HglExruMI' },
    { session: 26, unit: 'Energía', topic: 'Ciclo de Calvin', videoLink: 'https://www.youtube.com/watch?v=d2DB-kWxg-w' },
    { session: 27, unit: 'Energía', topic: 'Cadenas y Tramas TrÃƒ³ficas', videoLink: 'https://www.youtube.com/watch?v=cgmfiqWGLxI' },
    { session: 28, unit: 'Energía', topic: 'Respiración Celular', videoLink: 'https://www.youtube.com/watch?v=YefwfJ8IpEI' },
    { session: 29, unit: 'Energía', topic: 'Integración Metabólica', videoLink: 'https://www.youtube.com/watch?v=JYSm79-IIHw' },
    { session: 30, unit: 'Energía', topic: 'Tramas Tróficas', videoLink: 'https://www.youtube.com/watch?v=UMrU2peVKcU' },
    { session: 31, unit: 'Energía', topic: 'Flujo de Energía (10%)', videoLink: 'https://www.youtube.com/watch?v=6sUR80wigsU' },
    { session: 32, unit: 'Energía', topic: 'Pirámides Ecológicas', videoLink: 'https://www.youtube.com/watch?v=cgmfiqWGLxI' },
    { session: 33, unit: 'Energía', topic: 'Ciclos BiogeoquÃƒ­micos (Carbono, NitrÃƒ³geno, Agua)', videoLink: 'https://www.youtube.com/watch?v=hUQoF16DmNk' },
    { session: 34, unit: 'Energía', topic: 'Ciclo del Carbono', videoLink: 'https://www.youtube.com/watch?v=6YE42IePPjM' },
    { session: 35, unit: 'Energía', topic: 'Ciclo del Nitrógeno', videoLink: 'https://www.youtube.com/watch?v=iH3AI-XtNS8' },
    { session: 36, unit: 'Energía', topic: 'Impacto AntropogÃƒ©nico en los Ecosistemas', videoLink: 'https://www.youtube.com/watch?v=BKS_rQbalGQ' },

    // UNIDAD 4: SUSTENTABILIDAD
    { session: 37, unit: 'Sustentabilidad', topic: 'Efecto Invernadero', videoLink: 'https://www.youtube.com/watch?v=K7MzGe6OSs0' },
    { session: 38, unit: 'Sustentabilidad', topic: 'Cambio Climático', videoLink: 'https://www.youtube.com/watch?v=VoQYVGy45HY' },
    { session: 39, unit: 'Sustentabilidad', topic: 'Huella Ecológica', videoLink: 'https://www.youtube.com/watch?v=chh0sAmfCwo' },
    { session: 40, unit: 'Sustentabilidad', topic: 'Contaminación', videoLink: 'https://www.youtube.com/watch?v=PH3H1x5CN5I' },
    { session: 41, unit: 'Sustentabilidad', topic: 'Matriz Energética', videoLink: 'https://www.youtube.com/watch?v=YWds9hX3g7c' },
    { session: 42, unit: 'Sustentabilidad', topic: 'Huella EcolÃƒ³gica y ConservaciÃƒ³n de la Biodiversidad', videoLink: 'https://www.youtube.com/watch?v=Z6z_V9XN8S4' },
    { session: 43, unit: 'Sustentabilidad', topic: 'Biodiversidad Norte/Centro', videoLink: 'https://www.youtube.com/watch?v=US074D5Y_MY' },
    { session: 44, unit: 'Sustentabilidad', topic: 'Biodiversidad Sur', videoLink: 'https://www.youtube.com/watch?v=SJeRsE9TyBk' },
    { session: 45, unit: 'Sustentabilidad', topic: 'Conservación', videoLink: 'https://www.youtube.com/watch?v=KcIHCEFKloo' },
    { session: 46, unit: 'Sustentabilidad', topic: 'Cierre y Reflexión', videoLink: 'https://www.youtube.com/watch?v=lzYAXu7Om4s' }
];


const HISTORY_SYLLABUS = [
    // UNIDAD 1: LA CONSTRUCCIÓN DEL ESTADO NACIÓN (Sesiones 1-12)
    {
        session: 1,
        unit: 'Construcción Estado Nación',
        topic: 'El Ideario Liberal y la Reconfiguración de Europa',
        videoTitle: 'Liberalismo y Nacionalismo - Europa Siglo XIX',
        videoLink: 'https://www.youtube.com/watch?v=YcneJFUC47s',
        readingTitle: 'Síntesis: Liberalismo y Nacionalismo',
        readingContent: `El siglo XIX europeo no puede entenderse sin la influencia de la "Doble Revolución". El liberalismo emergió como la ideología de una burguesía ascendente que demandaba libertad individual, igualdad ante la ley, separación de poderes y soberanía nacional. Sin embargo, es crucial problematizar que este "liberalismo clásico" a menudo excluía a las masas populares y a las mujeres. La sesión explora cómo estas ideas, plasmadas en textos constitucionales, socavaron la legitimidad de las monarquías absolutas. El video de Puntaje Nacional desglosa la definición de nación como un acto de voluntad política frente a la concepción orgánica.`
    },
    {
        session: 2,
        unit: 'Construcción Estado Nación',
        topic: 'La Cultura Burguesa y el Mito del Progreso',
        videoTitle: 'La cultura burguesa y el progreso',
        videoLink: 'https://www.youtube.com/watch?v=yUmJIvZdknw',
        readingTitle: 'Síntesis: Cultura Burguesa',
        readingContent: `La burguesía no solo transformó la política, sino que impuso una hegemonía cultural. Valores como el esfuerzo individual, el ahorro, la familia nuclear patriarcal y el orden público se convirtieron en el estándar moral. Esta clase social abrazó el positivismo y la fe ciega en el progreso indefinido. Es fundamental discutir cómo esta visión optimista ocultaba las profundas desigualdades sociales. El video permite visualizar los espacios de sociabilidad burguesa.`
    },
    { session: 3, unit: 'Construcción Estado Nación', topic: 'Nacionalismos Europeos: Unificación y Fragmentación', videoTitle: 'Orígenes del nacionalismo político europeo', videoLink: 'https://www.youtube.com/watch?v=BgYbxwNcqkc' },
    { session: 4, unit: 'Construcción Estado Nación', topic: 'La Formación del Estado en América', videoTitle: 'Conformación Estado Nación en América', videoLink: 'https://www.youtube.com/watch?v=ALA4hfPAgXM' },
    { session: 5, unit: 'Construcción Estado Nación', topic: 'Conflictos Territoriales y Caudillismo', videoTitle: 'Consolidación de Estados en Centroamérica', videoLink: 'https://www.youtube.com/watch?v=OzR6f6YI9SQ' },
    { session: 6, unit: 'Construcción Estado Nación', topic: 'Ensayos Constitucionales en Chile (1823-1830)', videoTitle: 'Ensayos Constitucionales Chile (1823-1830)', videoLink: 'https://www.youtube.com/watch?v=pT0q2HaozEw' },
    { session: 7, unit: 'Construcción Estado Nación', topic: 'La Guerra Civil de 1829', videoTitle: 'Crisis de 1829 y Guerra Civil', videoLink: 'https://www.youtube.com/watch?v=pwndHH_0ex8' },
    { session: 8, unit: 'Construcción Estado Nación', topic: 'Pensamiento de Portales y Constitución de 1833', videoTitle: 'Pensamiento de Diego Portales', videoLink: 'https://www.youtube.com/watch?v=NVB458I4Mj4' },
    { session: 9, unit: 'Construcción Estado Nación', topic: 'La República Conservadora', videoTitle: 'República Conservadora y Liberal', videoLink: 'https://www.youtube.com/watch?v=hf-DFfoSZOw' },
    { session: 10, unit: 'Construcción Estado Nación', topic: 'La Transición Liberal y Reformas', videoTitle: 'Las Transformaciones Liberales', videoLink: 'https://www.youtube.com/watch?v=M1acYUUSLhg' },
    { session: 11, unit: 'Construcción Estado Nación', topic: 'La Guerra contra España', videoTitle: 'Guerra contra España 1865', videoLink: 'https://www.youtube.com/watch?v=bU9WmMmwVgg' },
    { session: 12, unit: 'Construcción Estado Nación', topic: 'Educación y Cultura Siglo XIX', videoTitle: 'Desarrollo educación y cultura Chile siglo XIX', videoLink: 'https://www.youtube.com/watch?v=Wpu4giF84Yg' },

    // UNIDAD 2: PROGRESO, INDUSTRIALIZACIÓN Y CRISIS (Sesiones 13-23)
    {
        session: 13,
        unit: 'Progreso y Crisis',
        topic: 'Revolución Industrial: Transformaciones Productivas',
        videoTitle: 'Revolución Industrial y sus características',
        videoLink: 'https://www.youtube.com/watch?v=GlLW9oB8fEQ',
        readingTitle: 'Síntesis: Revolución Industrial',
        readingContent: `La industrialización marcó el paso de una economía agraria y artesanal a una dominada por la industria mecanizada. Se distinguen dos fases: la del carbón/vapor y la del petróleo/electricidad. Este proceso cambió irreversiblemente la relación del ser humano con el medio ambiente y el tiempo, consolidando el capitalismo global. Explica los factores que permitieron el despegue industrial en Inglaterra.`
    },
    { session: 14, unit: 'Progreso y Crisis', topic: 'Sociedad Industrial: Burguesía y Proletariado', videoTitle: 'Impacto social y surgimiento del proletariado', videoLink: 'https://www.youtube.com/watch?v=WMtHe2b--xU' },
    { session: 15, unit: 'Progreso y Crisis', topic: 'Ideologías y Movimiento Obrero', videoTitle: 'La Cuestión Social y el Despertar del Mundo Obrero', videoLink: 'https://www.youtube.com/watch?v=M1acYUUSLhg' },
    { session: 16, unit: 'Progreso y Crisis', topic: 'Imperialismo Europeo: Motivaciones', videoTitle: 'Imperialismo y colonialismo - Causas', videoLink: 'https://www.youtube.com/watch?v=7Q_GLFvPWoE' },
    { session: 17, unit: 'Progreso y Crisis', topic: 'El Reparto del Mundo', videoTitle: 'Imperialismo y colonialismo - Mapas', videoLink: 'https://www.youtube.com/watch?v=esTiZrPGXTU' },
    { session: 18, unit: 'Progreso y Crisis', topic: 'Impacto en Pueblos Colonizados', videoTitle: 'Reflexión sobre el imperialismo', videoLink: 'https://www.youtube.com/watch?v=suD9G7DVpBw' },
    { session: 19, unit: 'Progreso y Crisis', topic: 'Paz Armada y Alianzas', videoTitle: 'Rivalidades imperialistas y alianzas', videoLink: 'https://www.youtube.com/watch?v=XScsA5Pyf0w' },
    { session: 20, unit: 'Progreso y Crisis', topic: 'Primera Guerra Mundial: Guerra Industrial', videoTitle: 'Primera Guerra Mundial (Continuación)', videoLink: 'https://www.youtube.com/watch?v=XScsA5Pyf0w' },
    { session: 21, unit: 'Progreso y Crisis', topic: 'Ciclo del Salitre: Auge y Dependencia', videoTitle: 'Chile a finales del siglo XIX', videoLink: 'https://www.youtube.com/watch?v=v2dRu-yy-Nw' },
    { session: 22, unit: 'Progreso y Crisis', topic: 'Cuestión Social: Pampa y Ciudad', videoTitle: 'Ciclo del salitre y cuestión social', videoLink: 'https://www.youtube.com/watch?v=vp9D91ZcP7A' },
    { session: 23, unit: 'Progreso y Crisis', topic: 'Movilización Obrera y Represión', videoTitle: 'Matanza de Santa María de Iquique', videoLink: 'https://www.youtube.com/watch?v=K5n5VhyzYcc' },

    // UNIDAD 3: CONFORMACIÓN DEL TERRITORIO CHILENO (Sesiones 24-34)
    {
        session: 24,
        unit: 'Territorio Nacional',
        topic: 'Exploración Científica y Reconocimiento',
        videoTitle: 'Exploración geográfica siglo XIX',
        videoLink: 'https://www.youtube.com/watch?v=tuPwi15_5Wc',
        readingTitle: 'Síntesis: Ciencia y Soberanía',
        readingContent: `El Estado chileno del siglo XIX necesitaba "conocer para gobernar". Contrató a científicos extranjeros (Claudio Gay, Pissis, Philippi) para cartografiar el territorio y descubrir sus recursos mineros y agrícolas. Estas exploraciones fuer la avanzada de la ocupación estatal efectiva.`
    },
    { session: 25, unit: 'Territorio Nacional', topic: 'Estrategias de Ocupación Territorial', videoTitle: 'Mecanismos de ocupación territorial', videoLink: 'https://www.youtube.com/watch?v=N0mdAjzdVl0' },
    { session: 26, unit: 'Territorio Nacional', topic: 'Colonización Alemana en el Sur', videoTitle: 'Colonización alemana en el sur', videoLink: 'https://www.youtube.com/watch?v=RFsumviRmlc' },
    { session: 27, unit: 'Territorio Nacional', topic: 'Guerra del Pacífico: Causas', videoTitle: 'Guerra del Pacífico: Causas', videoLink: 'https://www.youtube.com/watch?v=PQodJNKpgwg' },
    { session: 28, unit: 'Territorio Nacional', topic: 'Campañas de la Guerra del Pacífico', videoTitle: 'Campaña Naval y Terrestre', videoLink: 'https://www.youtube.com/watch?v=kUmB00qBq8w' },
    { session: 29, unit: 'Territorio Nacional', topic: 'Consecuencias de la Guerra', videoTitle: 'Consecuencias Guerra del Pacífico', videoLink: 'https://www.youtube.com/watch?v=o4wA_w9vQFU' },
    { session: 30, unit: 'Territorio Nacional', topic: 'Ocupación de la Araucanía', videoTitle: 'Ocupación de la Araucanía', videoLink: 'https://www.youtube.com/watch?v=RMbFKYd-LLI' },
    { session: 31, unit: 'Territorio Nacional', topic: 'Reducciones y Pueblo Mapuche', videoTitle: 'Tierras y Reducciones Mapuche', videoLink: 'https://www.youtube.com/watch?v=RMbFKYd-LLI' },
    { session: 32, unit: 'Territorio Nacional', topic: 'Colonización de Magallanes y Selk\'nam', videoTitle: 'Conflicto en Magallanes y Selk\'nam', videoLink: 'https://www.youtube.com/watch?v=o5MRPdSSddU' },
    { session: 33, unit: 'Territorio Nacional', topic: 'Incorporación de Rapa Nui', videoTitle: 'Historia de la anexión de Rapa Nui', videoLink: 'https://www.youtube.com/watch?v=90RzhcA0b0g' },
    { session: 34, unit: 'Territorio Nacional', topic: 'Tratado de 1881 con Argentina', videoTitle: 'Tratado de 1881 Chile-Argentina', videoLink: 'https://www.youtube.com/watch?v=3jypb_mjLyA' },

    // UNIDAD 4: ECONOMÃA Y CIUDADANÃA (Sesiones 35-46)
    {
        session: 35,
        unit: 'Economía y Ciudadanía',
        topic: 'El Problema Económico: Escasez',
        videoTitle: 'Problema económico y escasez',
        videoLink: 'https://www.youtube.com/watch?v=Y7yv3EfVpLs',
        readingTitle: 'Síntesis: Economía y Escasez',
        readingContent: `La economía surge de una contradicción: necesidades ilimitadas vs. recursos limitados. Esto obliga a elegir (costo de oportunidad). Es fundamental desmitificar que la escasez es solo pobreza; es una condición universal. El video usa ejemplos diarios para ilustrar la asignación de recursos.`
    },
    { session: 36, unit: 'Economía y Ciudadanía', topic: 'Agentes Económicos y Flujo Circular', videoTitle: 'Agentes económicos', videoLink: 'https://www.youtube.com/watch?v=Y7yv3EfVpLs' },
    { session: 37, unit: 'Economía y Ciudadanía', topic: 'Bienes, Servicios y Factores Productivos', videoTitle: 'Factores productivos y tipos de bienes', videoLink: 'https://www.youtube.com/watch?v=sdEraaf7iyk' },
    { session: 38, unit: 'Economía y Ciudadanía', topic: 'Ley de Oferta y Demanda', videoTitle: 'Cómo funciona la oferta y la demanda', videoLink: 'https://www.youtube.com/watch?v=QdYya8wR3m4' },
    { session: 39, unit: 'Economía y Ciudadanía', topic: 'Fenómenos Macroeconómicos: Inflación', videoTitle: 'Inflación y Deflación', videoLink: 'https://www.youtube.com/watch?v=tzkL7GalXH0' },
    { session: 40, unit: 'Economía y Ciudadanía', topic: 'Fallas de Mercado: Monopolios', videoTitle: 'Monopolio y Colusión', videoLink: 'https://www.youtube.com/watch?v=nJHRFv6UDLE' },
    { session: 41, unit: 'Economía y Ciudadanía', topic: 'Instrumentos de Ahorro e Inversión', videoTitle: 'Instrumentos para invertir (DAP)', videoLink: 'https://www.youtube.com/watch?v=D1CIp63Zw40' },
    { session: 42, unit: 'Economía y Ciudadanía', topic: 'Crédito y Endeudamiento Responsable', videoTitle: 'Educación financiera para jóvenes', videoLink: 'https://www.youtube.com/watch?v=uZX6o2Ty63w' },
    { session: 43, unit: 'Economía y Ciudadanía', topic: 'Derechos del Consumidor', videoTitle: 'Derechos del consumidor - Garantía Legal', videoLink: 'https://www.youtube.com/watch?v=6eYv1jHRuY4' },
    { session: 44, unit: 'Economía y Ciudadanía', topic: 'Consumo Sostenible', videoTitle: 'Acciones sustentables desde casa', videoLink: 'https://www.youtube.com/watch?v=irwnImaQCNA' },
    { session: 45, unit: 'Economía y Ciudadanía', topic: 'Desarrollo Sustentable', videoTitle: 'Desarrollo sustentable y economía ambiental', videoLink: 'https://www.youtube.com/watch?v=4y3hnYt5Zi8' },
    { session: 46, unit: 'Economía y Ciudadanía', topic: 'Síntesis Final: Historia y Ciudadanía', videoTitle: 'Síntesis Historia y Economía', videoLink: 'https://www.youtube.com/watch?v=lI5BlkzwAcA' }
];

const DEFAULT_HISTORY_ROUTE = {
    sujeto: 'Historia',
    oa_title: 'S1: El Ideario Liberal',
    color: '#E67E22', // Terracota
    icon: Globe,
    video_link: 'https://youtube.com',
    daily_route_steps: [
        { step: '1. Video Documental', action: 'video', icon: 'Play', isComplete: false },
        { step: '2. Análisis Histórico', action: 'start_route', icon: 'Globe', isComplete: false },
        { step: '3. Quiz Ciudadano', action: 'quiz', icon: 'Brain', isComplete: false },
        { step: '4. Debate', action: 'doubt', icon: 'MessageCircle', isComplete: false }
    ],
    recommended_action_text: "INICIAR ANÃLISIS HISTÓRICO"
};

const App = () => {
    const [isCallingN8N, setIsCallingN8N] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(""); // Helper state for multi-stage loading
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [readingModalOpen, setReadingModalOpen] = useState(false);
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [activeWebhookUrl, setActiveWebhookUrl] = useState(N8N_URLS.production);

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

    const handleLogin = (userData) => {
        console.log("Logged in:", userData);
        setCurrentUser(userData);
        localStorage.setItem('MATICO_USER', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('MATICO_USER');
        window.location.reload(); // Clean state reset
    };

    // --- DATABASE INTEGRATION START ---
    // Use dynamic USER_ID if available, else null
    const USER_ID = currentUser ? currentUser.user_id : null;
    const [userProfile, setUserProfile] = useState({ xp: 0, streak: 0, level: 1, username: 'Estudiante' });

    // 1. Fetch Profile on Load
    useEffect(() => {
        const fetchProfile = async () => {
            if (!USER_ID) return; // Don't fetch if no user
            try {
                const response = await fetch(`${activeWebhookUrl}?action=get_profile&user_id=${USER_ID}`);
                const data = await response.json();
                if (data && data.xp !== undefined) {
                    setUserProfile(data);
                    // Sync internal quiz stats roughly with XP if needed, or just rely on profile
                }
            } catch (e) {
                console.error("Error fetching profile:", e);
            }
        };
        if (USER_ID) fetchProfile();
    }, [activeWebhookUrl, USER_ID]);

    // 2. Save Progress Function
    const saveProgress = async (type, payload) => {
        console.log("SAVING PROGRESS:", type, payload);

        // Optimistic UI Update
        if (type === 'xp_gain') {
            setUserProfile(prev => ({ ...prev, xp: prev.xp + payload.amount }));
        }

        try {
            await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_progress',
                    user_id: USER_ID,
                    data: {
                        type: type,
                        subject: currentSubject,
                        timestamp: new Date().toISOString(),
                        ...payload
                    }
                })
            });
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
        saveProgress('reading_completed', { title: TODAYS_SESSION.readingTitle, xp_reward: 20, session: TODAYS_SESSION.session });

        // Automatically open the Doubt modal with context
        callAgent(
            currentSubject,
            'answer_doubts',
            `[CONTEXTO LECTURA]: ${TODAYS_SESSION.readingTitle}\n\n${TODAYS_SESSION.readingContent}\n\nGenera 3 preguntas de comprensión lectora sobre este texto para el estudiante.`,
            null,
            null,
            `Generar control de lectura para: "${TODAYS_SESSION.readingTitle}"`
        );
    };
    const [askModalOpen, setAskModalOpen] = useState(false);
    const [aiContent, setAiContent] = useState("");
    const [apiJson, setApiJson] = useState(null);
    const [currentSubject, setCurrentSubject] = useState("MATEMATICA");
    const [dailyRoute, setDailyRoute] = useState(DEFAULT_DAILY_ROUTE);
    const [todayIndex, setTodayIndex] = useState(0);

    // SERVER PROGRESS STATE
    const [serverProgress, setServerProgress] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState(false);
    const [quizStats, setQuizStats] = useState({ correct: 0, incorrect: 0, total: 0 });
    const [quizLevel, setQuizLevel] = useState(1); // NEW: Adaptive Level State
    const [quizQuestionNumber, setQuizQuestionNumber] = useState(1); // NEW: Persistence State
    const [lastUserQuery, setLastUserQuery] = useState("");

    //NEW: CONTEXT STATE FOR VIDEO/PASTE
    const [doubtContext, setDoubtContext] = useState(null);

    // INTERACTIVE QUIZ STATE
    const [showInteractiveQuiz, setShowInteractiveQuiz] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);

    // PROGRESSIVE QUIZ STATE (3 PHASES)
    const [currentQuizPhase, setCurrentQuizPhase] = useState(1); // 1, 2, or 3
    const [backgroundQuestionsQueue, setBackgroundQuestionsQueue] = useState([]);
    const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);

    // FETCH SERVER PROGRESS ON LOAD
    useEffect(() => {
        const fetchProgress = async () => {
            if (!USER_ID) return;
            try {
                setLoadingProgress(true);
                console.log('[MATICO] Fetching progress from server...');

                const response = await fetch('https://n8n-n8n.cwf1hb.easypanel.host/webhook/MATICO', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'get_progress',
                        user_id: USER_ID,
                        subject: currentSubject
                    })
                });

                const data = await response.json();
                console.log('[MATICO] ✅ Server progress loaded:', data);
                setServerProgress(data);

                // Update todayIndex based on server's next_session
                if (data && data.next_session) {
                    const newIndex = data.next_session - 1; // Convert to 0-indexed
                    console.log(`[MATICO] Setting session index to ${newIndex} (Session ${data.next_session})`);
                    setTodayIndex(newIndex);
                }
            } catch (error) {
                console.error('[MATICO] ❌ Error fetching progress:', error);
                // Fallback to localStorage if server fails
                const fallbackIndex = getSmartSessionIndex(currentSubject);
                setTodayIndex(fallbackIndex);
            } finally {
                setLoadingProgress(false);
            }
        };

        if (USER_ID) fetchProgress();
    }, [currentSubject, USER_ID]); // Reload when subject changes or user logs in

    // DYNAMIC SYLLABUS
    const ACTIVE_SYLLABUS = currentSubject === 'LENGUAJE' ? LANGUAGE_SYLLABUS : (currentSubject === 'FISICA' ? PHYSICS_SYLLABUS : (currentSubject === 'QUIMICA' ? CHEMISTRY_SYLLABUS : (currentSubject === 'BIOLOGIA' ? BIOLOGY_SYLLABUS : (currentSubject === 'HISTORIA' ? HISTORY_SYLLABUS : MATH_SYLLABUS))));

    console.log("APP RENDER:", { currentSubject, todayIndex, syllabusLen: ACTIVE_SYLLABUS?.length });

    const RAW_SESSION = ACTIVE_SYLLABUS[todayIndex] || ACTIVE_SYLLABUS[0];
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
        oa_title: `Sesión ${TODAYS_SESSION.session}: ${TODAYS_SESSION.topic}`,
        video_link: TODAYS_SESSION.videoLink
    };

    // --- SMART CALENDAR LOGIC START ---
    const getSmartSessionIndex = (subject) => {
        // Use exact same syllabus reference logic as ACTIVE_SYLLABUS
        const syllabus = subject === 'LENGUAJE' ? LANGUAGE_SYLLABUS : (subject === 'FISICA' ? (typeof PHYSICS_SYLLABUS !== 'undefined' ? PHYSICS_SYLLABUS : []) : (subject === 'QUIMICA' ? CHEMISTRY_SYLLABUS : (subject === 'BIOLOGIA' ? (typeof BIOLOGY_SYLLABUS !== 'undefined' ? BIOLOGY_SYLLABUS : []) : (subject === 'HISTORIA' ? HISTORY_SYLLABUS : MATH_SYLLABUS))));

        if (!syllabus || syllabus.length === 0) return 0;

        // 1. Get or Init Start Date (Simulation of "User Started Course On...")
        let startDateStr = localStorage.getItem('MATICO_START_DATE');
        if (!startDateStr) {
            startDateStr = new Date().toISOString();
            localStorage.setItem('MATICO_START_DATE', startDateStr);
        }
        const startDate = new Date(startDateStr);
        const today = new Date();

        // Calculate days passed (floored)
        const diffTime = Math.max(0, today - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // 2. Get Completed Sessions
        const completedStr = localStorage.getItem('MATICO_COMPLETED_SESSIONS');
        const completed = completedStr ? JSON.parse(completedStr) : [];

        // 3. Catch-up Logic: Find first incomplete session up to today's target
        // We check from Session 0 up to Session [diffDays]
        for (let i = 0; i <= diffDays; i++) {
            if (i >= syllabus.length) break;
            const session = syllabus[i];
            const sessionKey = `${subject}_${session.session}`;

            // If this past/current session is NOT complete, we must do it now (Catch-up)
            if (!completed.includes(sessionKey)) {
                console.log(`SmartCalendar: Catch-up Mode! Found incomplete session ${i + 1} for day ${diffDays}`);
                return i;
            }
        }

        // 4. If all up to today are done, return today's index (capped)
        return Math.min(diffDays, syllabus.length - 1);
    };

    const markSessionComplete = (subject, sessionId) => {
        const key = `${subject}_${sessionId}`;
        const completedStr = localStorage.getItem('MATICO_COMPLETED_SESSIONS');
        const completed = completedStr ? JSON.parse(completedStr) : [];

        console.log(`[MATICO] markSessionComplete called:`, { subject, sessionId, key, currentCompleted: completed });

        if (!completed.includes(key)) {
            const newCompleted = [...completed, key];
            localStorage.setItem('MATICO_COMPLETED_SESSIONS', JSON.stringify(newCompleted));
            console.log(`[MATICO] ✅ Marked ${key} as complete!`);
            console.log(`[MATICO] Updated completed list:`, newCompleted);

            // Trigger Re-calc immediately to show next session if applicable
            const newIndex = getSmartSessionIndex(subject);
            console.log(`[MATICO] Calculated new session index: ${newIndex} (was: ${todayIndex})`);
            setTodayIndex(newIndex);
        } else {
            console.log(`[MATICO] ℹ️ Session ${key} already marked as complete`);
        }
    };
    // --- SMART CALENDAR LOGIC END ---

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

        // NEW: Load the smart session index instead of resetting to 0
        const smartIndex = getSmartSessionIndex(currentSubject);
        console.log(`Subject Change: ${currentSubject} -> Loaded Smart Session Index: ${smartIndex}`);
        setTodayIndex(smartIndex);

    }, [currentSubject]);

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

    // GENERATE QUIZ BATCH (5 questions per level) - PROGRESSIVE LOADING
    const generateQuizBatch = async (level, backgroundMode = false) => {
        const levelConfig = {
            "BASICO": {
                name: "Nivel Básico",
                instruction: "RECORDAR/COMPRENDER - Preguntas directas sobre definiciones y conceptos elementales",
                count: 5
            },
            "AVANZADO": {
                name: "Nivel Avanzado",
                instruction: "APLICAR - Problemas prácticos de nivel avanzado",
                count: 5
            },
            "CRITICO": {
                name: "Nivel Crítico Universitario",
                instruction: "ANALIZAR/EVALUAR - Nivel PAES Universidad MUY DIFÍCIL",
                count: 5
            }
        };

        const config = levelConfig[level];
        if (!backgroundMode) {
            setLoadingMessage(`Generando ${config.name}...`);
        }


        const bulkPrompt = `${TODAYS_SUBJECT.oa_title} [INSTRUCCION MATEMÁTICA CRÍTICA:
1. Genera EXACTAMENTE ${config.count} preguntas de selección múltiple (JSON). Nivel: ${config.instruction}.
2. VERIFICACIÓN OBLIGATORIA: Resuelve el problema paso a paso internamente. La opción correcta DEBE coincidir exactamente con el cálculo matemático. Revisa signos y paréntesis.
3. Evita errores de alucinación (ej: no digas que 72=14).
4. ESTRUCTURA JSON ESTRICTA: {"questions": [{"question": "texto", "options": ["A", "B", "C", "D"], "correctIndex": 0-3, "explanation": "Explicación paso a paso real"}]}.
5. NO GENERES TEORIA. NO USES MARKDOWN. SOLO JSON PURO.]`;

        try {
            const body = {
                sujeto: currentSubject,
                accion: 'Generar Quiz de Validación',
                tema: bulkPrompt,
                nivel_estudiante: "1° Medio Chile"
            };

            const response = await fetch(activeWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const text = await response.text();
            const json = parseN8NResponse(text);

            let questions = [];
            if (json.questions && Array.isArray(json.questions)) {
                questions = json.questions;
            } else if (json.question) {
                questions = [json];
            } else if (json[0] && json[0].question) {
                questions = json;
            }

            const formattedQuestions = questions.map(q => {
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
                    optsObj = q.options;
                    correctKey = q.correct_answer || 'A';
                }

                return {
                    question: q.question,
                    options: optsObj,
                    correct_answer: correctKey,
                    explanation: q.explanation
                };
            });

            return formattedQuestions;
        } catch (e) {
            console.error(`Error generando batch ${level}:`, e);
            return [];
        }
    };

    // QUIZ PHASE PROGRESS - PERSISTENCE HELPERS
    const saveQuizPhaseProgress = (phase, score) => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const existing = JSON.parse(localStorage.getItem('MATICO_QUIZ_PROGRESS') || '{}');

        if (!existing[key]) {
            existing[key] = {
                completedPhases: [],
                currentPhase: 1,
                scores: { phase1: null, phase2: null, phase3: null }
            };
        }

        // Marcar fase como completada
        if (!existing[key].completedPhases.includes(phase)) {
            existing[key].completedPhases.push(phase);
        }

        // Guardar score
        existing[key].scores[`phase${phase}`] = score;

        // Actualizar siguiente fase
        existing[key].currentPhase = phase < 3 ? phase + 1 : 3;
        existing[key].lastUpdated = new Date().toISOString();

        localStorage.setItem('MATICO_QUIZ_PROGRESS', JSON.stringify(existing));
        console.log(`[PROGRESS] Fase ${phase} guardada para ${key}:`, existing[key]);
    };

    const getQuizProgress = () => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const progress = JSON.parse(localStorage.getItem('MATICO_QUIZ_PROGRESS') || '{}');
        return progress[key] || {
            completedPhases: [],
            currentPhase: 1,
            scores: { phase1: null, phase2: null, phase3: null }
        };
    };

    const clearQuizProgress = () => {
        const key = `${currentSubject}_session_${TODAYS_SESSION.session}`;
        const progress = JSON.parse(localStorage.getItem('MATICO_QUIZ_PROGRESS') || '{}');
        delete progress[key];
        localStorage.setItem('MATICO_QUIZ_PROGRESS', JSON.stringify(progress));
        console.log(`[PROGRESS] Progreso limpiado para ${key}`);
    };

    // START FULL MULTI-STAGE QUIZ
    const startFullQuiz = async () => {
        setIsCallingN8N(true);
        setAiModalOpen(false);

        // CHECK FOR SAVED PROGRESS
        const savedProgress = getQuizProgress();
        const startingPhase = savedProgress.currentPhase;

        console.log(`[QUIZ] Progreso detectado:`, savedProgress);
        console.log(`[QUIZ] Iniciando desde Fase ${startingPhase}`);

        setLoadingMessage(`Iniciando Quiz - Fase ${startingPhase}...`);
        setCurrentQuizPhase(startingPhase);
        setBackgroundQuestionsQueue([]);
        setQuizStats({ correct: 0, incorrect: 0, total: 0 });

        try {
            // Determinar qué nivel generar según fase
            const levelMap = { 1: "BASICO", 2: "AVANZADO", 3: "CRITICO" };
            const currentLevel = levelMap[startingPhase];

            console.log(`[QUIZ] Generando Fase ${startingPhase}: ${currentLevel} (5 preguntas)`);
            const currentPhaseQuestions = await generateQuizBatch(currentLevel, false);

            if (currentPhaseQuestions.length > 0) {
                console.log(`[QUIZ] ✓ Fase ${startingPhase} lista, iniciando quiz...`);
                setQuizQuestions(currentPhaseQuestions);
                setShowInteractiveQuiz(true);
                setIsCallingN8N(false);
                setLoadingMessage("");

                // Generar siguiente fase en background (si no es la última)
                if (startingPhase < 3) {
                    const nextLevel = levelMap[startingPhase + 1];
                    console.log(`[QUIZ] Generando Fase ${startingPhase + 1} (${nextLevel}) en background...`);
                    setIsLoadingNextBatch(true);
                    generateQuizBatch(nextLevel, true).then(nextQuestions => {
                        console.log(`[QUIZ] ✓ Fase ${startingPhase + 1} lista`);
                        setBackgroundQuestionsQueue(nextQuestions);
                        setIsLoadingNextBatch(false);
                    }).catch(err => {
                        console.error(`[QUIZ] Error Fase ${startingPhase + 1}:`, err);
                        setIsLoadingNextBatch(false);
                    });
                }
            } else {
                alert("No se pudieron generar preguntas. Intenta de nuevo.");
                setIsCallingN8N(false);
                setAiModalOpen(true);
            }

        } catch (e) {
            console.error("Quiz Error", e);
            alert("Error de conexión durante la generación del quiz.");
            setIsCallingN8N(false);
            setAiModalOpen(true);
        }
    };

    // HANDLE QUIZ PHASE COMPLETION - PROGRESSIVE SYSTEM
    const onQuizPhaseComplete = async (phaseScore) => {
        console.log(`[QUIZ] Fase ${currentQuizPhase} completada con score:`, phaseScore);

        // GUARDAR PROGRESO DE FASE COMPLETADA
        saveQuizPhaseProgress(currentQuizPhase, phaseScore);

        if (currentQuizPhase === 1) {
            // TRANSITION TO PHASE 2
            if (backgroundQuestionsQueue.length > 0) {
                console.log("[QUIZ] Iniciando Fase 2 con preguntas en background");
                setCurrentQuizPhase(2);
                setQuizQuestions(backgroundQuestionsQueue);
                setBackgroundQuestionsQueue([]);
                setIsLoadingNextBatch(true);
                generateQuizBatch("CRITICO", true).then(phase3Questions => {
                    console.log("[QUIZ] ✓ Fase 3 (Crítico) lista");
                    setBackgroundQuestionsQueue(phase3Questions);
                    setIsLoadingNextBatch(false);
                }).catch(err => console.error("[QUIZ] Error Fase 3:", err));
            } else {
                setShowInteractiveQuiz(false);
                setIsCallingN8N(true);
                setLoadingMessage("Preparando Fase 2: Nivel Avanzado...");

                const phase2Questions = await generateQuizBatch("AVANZADO", false);
                setQuizQuestions(phase2Questions);
                setCurrentQuizPhase(2);
                setShowInteractiveQuiz(true);
                setIsCallingN8N(false);
                setLoadingMessage("");

                setIsLoadingNextBatch(true);
                generateQuizBatch("CRITICO", true).then(p3 => {
                    setBackgroundQuestionsQueue(p3);
                    setIsLoadingNextBatch(false);
                });
            }

        } else if (currentQuizPhase === 2) {
            // TRANSITION TO PHASE 3
            if (backgroundQuestionsQueue.length > 0) {
                setCurrentQuizPhase(3);
                setQuizQuestions(backgroundQuestionsQueue);
                setBackgroundQuestionsQueue([]);
            } else {
                setShowInteractiveQuiz(false);
                setIsCallingN8N(true);
                setLoadingMessage("Preparando Fase 3: Nivel Crítico...");

                const phase3Questions = await generateQuizBatch("CRITICO", false);
                setQuizQuestions(phase3Questions);
                setCurrentQuizPhase(3);
                setShowInteractiveQuiz(true);
                setIsCallingN8N(false);
                setLoadingMessage("");
            }

        } else if (currentQuizPhase === 3) {
            // ALL PHASES COMPLETE
            console.log("[QUIZ] ✅ TODAS LAS FASES COMPLETADAS!");
            setShowInteractiveQuiz(false);

            // LIMPIAR PROGRESO LOCAL (ya completó todas las fases)
            clearQuizProgress();

            markSessionComplete(currentSubject, TODAYS_SESSION.session);

            saveProgress('session_completed', {
                subject: currentSubject,
                session: TODAYS_SESSION.session,
                topic: TODAYS_SESSION.topic,
                total_questions: quizStats.total,
                correct_answers: quizStats.correct,
                xp_reward: 100
            });

            alert(`🎉 ¡Sesión Completa! Has dominado: ${TODAYS_SESSION.topic}\n\nPuntaje: ${quizStats.correct}/${quizStats.total}\n+100 XP`);
        }
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
            setQuizStats({ correct: 0, incorrect: 0, total: 0 });
            setQuizLevel(1);
            setQuizQuestionNumber(1); // Reset question index
        }

        let n8nAction = 'Generar Teoría Lúdica';
        if (action === 'start_route') n8nAction = 'Generar Teoría Lúdica'; // Explicit
        if (action === 'generate_quiz') n8nAction = 'Generar Quiz de Validación';
        if (action === 'deepen_knowledge') n8nAction = 'Profundizar y Desafiar';
        if (action === 'remedial_explanation') n8nAction = 'Explicar y Simplificar';
        if (action === 'answer_doubts') n8nAction = 'Responder Duda';

        // NEW: INJECT DIFFICULTY INSTRUCTIONS INTO TOPIC
        let difficultyPrompt = "";
        if (action === 'deepen_knowledge' || action === 'generate_quiz') {
            if (quizLevel === 1) difficultyPrompt = " [INSTRUCCIÓN: Genera una pregunta de nivel 1 (MEMORIZAR/COMPRENDER). Enfócate en definiciones claras y conceptos básicos. Estilo directo y sencillo.]";
            if (quizLevel === 2) difficultyPrompt = " [INSTRUCCIÓN: Genera una pregunta de nivel 2 (APLICAR). El estudiante debe aplicar el concepto en una situación práctica o ejemplo cotidiano. Dificultad media.]";
            if (quizLevel >= 3) difficultyPrompt = " [INSTRUCCIÓN: Genera una pregunta de nivel 3 (ANALIZAR/EVALUAR). Requiere pensamiento crítico, contrastar ideas o inferir conclusiones complejas. ¡Desafía al estudiante!]";
        }

        // Fix: Don't append question number for THEORY generation
        let questionSuffix = "";
        if (action !== 'start_route' && n8nAction !== 'Generar Teoría Lúdica') {
            questionSuffix = questionNumberOverride ? ` [PREGUNTA NRO ${questionNumberOverride}]` : ` [PREGUNTA NRO ${quizQuestionNumber}]`;
        } else {
            difficultyPrompt = " [INSTRUCCIÓN: GENERAR SOLO TEORÍA EXPLICATIVA LÚDICA. NO GENERAR PREGUNTAS.]";
        }

        const finalTopic = topic + difficultyPrompt + questionSuffix;

        try {
            // ALWAYS USE POST
            let body = {
                sujeto: subject,
                accion: n8nAction,
                tema: finalTopic, // Use modified topic
                nivel_estudiante: "1° Medio Chile",
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
                nivel_estudiante: "1° Medio Chile"
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
                content = "âš ï¸ MODO OFFLINE";
            } else {
                try {
                    let jsonData;
                    try {
                        jsonData = JSON.parse(textResponse.replace(/\\(?![\\/u"bfnrt\\])/g, '\\\\'));
                    } catch (e) {
                        const jsonMatch = textResponse.match(/{[\s\S]*}/);
                        if (jsonMatch) {
                            jsonData = JSON.parse(jsonMatch[0].replace(/\\(?![\\/u"bfnrt\\])/g, '\\\\'));
                        } else {
                            throw e;
                        }
                    }

                    // LOGIC FIX: Handle Refusal & Data Processing
                    if (jsonData.refusal) {
                        content = `âš ï¸ **No pudimos iniciar:**\n\n${jsonData.refusal}`;
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
                            console.log("🚀 Auto-launching Quiz!");
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
                                content = "⚠️ **Error de Formato:** La IA no envió preguntas válidas.\n\n" + JSON.stringify(finalData, null, 2);
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
            setAiContent("âš ï¸ Error de Conexión");
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
        <div className="min-h-screen bg-[#E0E5EC] p-6 relative">
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
                    // NEW: AUTO-START THEORY AFTER VIDEO
                    callAgent(currentSubject, "start_route", TODAYS_SUBJECT.oa_title);
                }}
            />

            <ReadingModal
                isOpen={readingModalOpen}
                onClose={() => setReadingModalOpen(false)}
                title={TODAYS_SESSION.readingTitle || "Lectura"}
                content={TODAYS_SESSION.readingContent || ""}
                onFinish={handleReadingFinish}
            />

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
            <LoadingOverlay isOpen={isCallingN8N} message={loadingMessage} />

            <AIContentModal
                isOpen={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                content={aiContent}
                subject={currentSubject}
                callAgent={callAgent}
                isCallingN8N={isCallingN8N}
                routeTitle={TODAYS_SUBJECT.oa_title}
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
                <div className="flex flex-col items-center text-center md:flex-row md:text-left md:justify-between gap-6 mb-2 animate-fade-in-up">
                    <div className="flex flex-row items-center gap-4">
                        <MaticoAvatar
                            mood={isCallingN8N ? 'thinking' : 'excited'}
                            size="lg"
                            isThinking={isCallingN8N}
                            onClick={() => setAskModalOpen(true)}
                        />
                        <div className="text-left">
                            <div className="inline-flex items-center gap-2 bg-[#FFD93D] text-[#2B2E4A] px-3 py-1 rounded-full font-black text-xs mb-2 shadow-sm animate-bounce-subtle">
                                <Star className="w-4 h-4 fill-current" />
                                {userProfile?.xp || 0} XP
                            </div>
                            <h1 className="text-4xl font-black text-[#2B2E4A] mb-1">¡Hola, Matico! 👋</h1>
                            <p className="text-[#9094A6] font-bold text-sm max-w-md">
                                Sistema activo. Hoy dedicaremos la hora completa a:{' '}
                                <span className="text-[#2B2E4A] bg-white px-2 py-1 rounded-lg shadow-sm border border-white/50 font-black" style={{ color: TODAYS_SUBJECT.color }}>
                                    {TODAYS_SUBJECT.name}
                                </span>.
                            </p>
                            <button
                                onClick={() => setAskModalOpen(true)}
                                className="mt-2 text-xs font-black text-[#FF9F43] uppercase tracking-widest hover:text-[#FFD93D] flex items-center gap-1 transition-colors"
                            >
                                <MessageCircle className="w-4 h-4" /> 💁‍♀️ Tengo una Duda
                            </button>
                        </div>
                    </div>

                    {/* RESPONSIVE SUBJECT TOGGLES */}
                    <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-3 mt-4 md:mt-0">
                        {/* TEST/PROD TOGGLE SEPARATE */}
                        <button
                            onClick={() => setActiveWebhookUrl(prev => prev === N8N_URLS.test ? N8N_URLS.production : N8N_URLS.test)}
                            className={`text-xs font-black px-3 py-1 rounded-full transition-all border-2 mb-1 ${activeWebhookUrl === N8N_URLS.test
                                ? 'bg-gray-200 text-gray-500 border-gray-300'
                                : 'bg-red-100 text-red-600 border-red-200 animate-pulse shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_10px_rgba(255,0,0,0.2)]'
                                }`}
                        >
                            {activeWebhookUrl === N8N_URLS.test ? '🧪 TEST' : '🚨 PROD'}
                        </button>

                        {/* DEV: SIMULATE 5 DAY DELAY */}
                        <button
                            onClick={() => {
                                const fiveDaysAgo = new Date();
                                fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
                                localStorage.setItem('MATICO_START_DATE', fiveDaysAgo.toISOString());
                                localStorage.removeItem('MATICO_COMPLETED_SESSIONS');
                                alert("Simulación: Inicio hace 5 días. Debes ponerte al día.");
                                window.location.reload();
                            }}
                            className="text-[10px] font-bold text-blue-500 underline mb-2"
                        >
                            Simular Atraso (5 Días)
                        </button>

                        {/* GRID 3 COLS */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setCurrentSubject('MATEMATICA')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'MATEMATICA' ? 'hover:brightness-110 !bg-[#4D96FF] !text-white !border-[#3B80E6] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(77,150,255,0.6)]' : ''}`}
                            >
                                🔢 Mate
                            </button>
                            <button
                                onClick={() => setCurrentSubject('LENGUAJE')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'LENGUAJE' ? 'hover:brightness-110 !bg-[#FF9F43] !text-white !border-[#E68A35] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,159,67,0.6)]' : ''}`}
                            >
                                📖 Lenguaje
                            </button>
                            <button
                                onClick={() => setCurrentSubject('FISICA')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'FISICA' ? 'hover:brightness-110 !bg-[#9D4EDD] !text-white !border-[#8A3CC2] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(157,78,221,0.6)]' : ''}`}
                            >
                                ⚛️ Física
                            </button>
                            <button
                                onClick={() => setCurrentSubject('QUIMICA')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'QUIMICA' ? 'hover:brightness-110 !bg-[#E84393] !text-white !border-[#C23678] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(232,67,147,0.6)]' : ''}`}
                            >
                                🧪 Química
                            </button>
                            <button
                                onClick={() => setCurrentSubject('BIOLOGIA')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'BIOLOGIA' ? 'hover:brightness-110 !bg-[#2ECC71] !text-white !border-[#27AE60] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(46,204,113,0.6)]' : ''}`}
                            >
                                🧬 Biología
                            </button>
                            <button
                                onClick={() => setCurrentSubject('HISTORIA')}
                                className={`${clayBtnPrimary} !w-auto !py-2 !px-4 ${currentSubject === 'HISTORIA' ? 'hover:brightness-110 !bg-[#E67E22] !text-white !border-[#D35400] shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(230,126,34,0.6)]' : ''}`}
                            >
                                📜 Historia
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <div className="lg:col-span-3">
                        <AnnualRaceBar currentDay={TODAYS_SESSION.session} totalDays={43} />
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <div className={`${clayCard} relative overflow-visible`}>
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-[#2B2E4A] mb-1" style={{ color: TODAYS_SUBJECT.color }}>
                                        Ruta de {TODAYS_SUBJECT.name}: <span className="text-base font-bold text-[#9094A6] block">{TODAYS_SUBJECT.oa_title}</span>
                                    </h2>
                                    <p className="text-[#9094A6] font-bold text-sm">Basado en el video: {TODAYS_SESSION.videoTitle}</p>

                                    {/* QUIZ PROGRESS INDICATOR */}
                                    {(() => {
                                        const progress = getQuizProgress();
                                        const phaseNames = { 1: "Básico", 2: "Avanzado", 3: "Crítico" };
                                        const phaseColors = {
                                            1: "bg-blue-100 text-blue-700 border-blue-300",
                                            2: "bg-purple-100 text-purple-700 border-purple-300",
                                            3: "bg-red-100 text-red-700 border-red-300"
                                        };

                                        if (progress.completedPhases.length > 0 && progress.currentPhase <= 3) {
                                            return (
                                                <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs font-black border-2 ${phaseColors[progress.currentPhase]} animate-pulse`}>
                                                    🎯 Continuar Quiz - Fase {progress.currentPhase}: {phaseNames[progress.currentPhase]}
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

                            {/* ROUTE STEPS RENDERER */}
                            <div className="flex flex-col items-center gap-8 relative py-8 min-h-[400px]">
                                {/* CONNECTOR LINE */}
                                <div className="absolute top-0 bottom-0 w-4 bg-[#E5E5E5] rounded-full z-0"></div>

                                {dailyRoute.daily_route_steps.map((step, idx) => {
                                    const IconComponent = step.icon === "Play" ? Play : (step.icon === "Brain" ? Brain : (step.icon === "MessageCircle" ? MessageCircle : Lock));

                                    const handleClick = () => {
                                        if (idx === 0) handleStartSession();
                                        if (idx === 1) callAgent(currentSubject, "start_route", TODAYS_SUBJECT.oa_title);
                                        if (idx === 2) callAgent(currentSubject, 'generate_quiz', TODAYS_SUBJECT.oa_title);
                                        if (idx === 3) setAskModalOpen(true);
                                    };

                                    // STYLE LOGIC
                                    let btnStyle = "bg-[#E5E5E5] border-[#CECECE] text-[#AFAFAF]"; // Locked/Future
                                    let isCurrent = idx === 0; // Default current?
                                    // Simple logic for demo: Step 0 is completed/current, others locked? 
                                    // Better: visual variety based on index

                                    if (idx === 0) btnStyle = "bg-[#58CC02] border-[#46A302] text-white animate-bounce-subtle z-20 shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(88,204,2,0.6)]"; // Active
                                    else if (idx === 1) btnStyle = "bg-[#1CB0F6] border-[#1899D6] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(28,176,246,0.6)]"; // Next
                                    else if (idx === 2) btnStyle = "bg-[#FFD900] border-[#E5C300] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,217,0,0.6)]"; // Quiz
                                    else btnStyle = "bg-[#FF4B4B] border-[#D63E3E] text-white shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),0_6px_14px_rgba(255,75,75,0.6)]"; // Practice

                                    // Alternating offset
                                    const offsetClass = idx % 2 === 0 ? "-translate-x-12" : "translate-x-12";
                                    const labelSide = idx % 2 === 0 ? "left-28" : "right-28 text-right";
                                    const labelOrigin = idx % 2 === 0 ? "origin-left" : "origin-right flex-row-reverse";

                                    return (
                                        <div key={idx} className={`relative z-10 group ${offsetClass}`}>
                                            <button
                                                onClick={handleClick}
                                                className={`w-24 h-24 rounded-full flex items-center justify-center border-b-8 transition-all duration-300 hover:scale-110 hover:-translate-y-2 hover:z-30 active:border-b-0 active:translate-y-2 shadow-sm ${btnStyle}`}
                                            >
                                                <IconComponent className="w-10 h-10" fill="currentColor" />

                                                {/* CROWN/STAR for detailed polish */}
                                                <div className="absolute top-1 right-2 w-3 h-3 bg-white/30 rounded-full"></div>
                                            </button>

                                            {/* FLOATING LABEL */}
                                            <div className={`absolute top-6 ${idx % 2 === 0 ? "left-28" : "right-28"} bg-white border-2 border-gray-200 px-4 py-2 rounded-2xl shadow-sm min-w-[140px] transition-transform hover:scale-105`}>
                                                <h3 className="font-black text-[#3C3C3C] text-sm uppercase">{step.step}</h3>
                                                <p className="text-[#AFAFAF] text-xs font-bold">{
                                                    idx === 0 ? "CLASE DE HOY" :
                                                        (idx === 1 ? "TEORÃA IA" :
                                                            (idx === 3 ? "CONSULTA" : "PRÃCTICA"))
                                                }</p>

                                                {/* TRIANGLE POINTER */}
                                                <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-b-2 border-l-2 border-gray-200 transform rotate-45 ${idx % 2 === 0 ? "-left-[7px]" : "-right-[7px] border-l-0 border-b-0 border-t-2 border-r-2"}`}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-12">
                                <button
                                    onClick={() => setVideoModalOpen(true)}
                                    className={`${clayBtnAction} ${(localStorage.getItem('MATICO_COMPLETED_SESSIONS') || '').includes(`${currentSubject}_${TODAYS_SESSION.session}`) ? '!bg-green-500 !border-green-600 hover:!bg-green-400' : ''}`}
                                    disabled={isCallingN8N}
                                >
                                    {isCallingN8N ? 'CARGANDO...' : ((localStorage.getItem('MATICO_COMPLETED_SESSIONS') || '').includes(`${currentSubject}_${TODAYS_SESSION.session}`) ? "SESIÓN COMPLETADA (Repasar)" : "INICIAR SESIÓN " + TODAYS_SESSION.session)} <Play className="w-5 h-5 ml-2" fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-8">

                        <PomodoroTimer />
                    </div>
                </div>
            </div>

            {/* Interactive Quiz Modal */}
            {showInteractiveQuiz && quizQuestions && quizQuestions.length > 0 && (
                <InteractiveQuiz
                    questions={quizQuestions}
                    phase={currentQuizPhase}
                    onComplete={(score) => {
                        console.log(`Quiz Fase ${currentQuizPhase} completado:`, score);
                        // Call progressive quiz handler instead of manual close
                        onQuizPhaseComplete(score);
                    }}
                    onClose={() => {
                        // Allow manual emergency close
                        setShowInteractiveQuiz(false);
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
};

export default App;















