// Script de prueba para computeNotebookStrictScore
// Ejecutar con: node test_scoring.js

const tokenizeNotebookText = (value = '', { minLength = 3, skipStopwords = true } = {}) => {
    const NOTEBOOK_STOPWORDS = new Set([
        'a', 'al', 'algo', 'ante', 'como', 'con', 'contra', 'cual', 'cuando', 'de', 'del', 'desde',
        'donde', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'eramos', 'es', 'esa', 'ese',
        'eso', 'esta', 'estaba', 'estamos', 'este', 'esto', 'estos', 'fue', 'ha', 'hace', 'hacia',
        'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis',
        'muy', 'no', 'nos', 'nosotros', 'o', 'para', 'pero', 'por', 'porque', 'que', 'se', 'segun',
        'ser', 'si', 'sin', 'sobre', 'son', 'su', 'sus', 'tambien', 'te', 'tiene', 'todo', 'tu',
        'tus', 'un', 'una', 'uno', 'unos', 'y', 'ya'
    ]);

    const normalizeNotebookText = (value = '') => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalized = normalizeNotebookText(value);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => token.length >= minLength)
        .filter((token) => !skipStopwords || !NOTEBOOK_STOPWORDS.has(token));
};

const uniqueTokens = (tokens = []) => Array.from(new Set(tokens.filter(Boolean)));
const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const computeNotebookStrictScore = ({
    isHandwritten = false,
    aiScore = 0,
    ocrText = '',
    theoryText = '',
    pageCount = 1,
    detectedConcepts = [],
    missingConcepts = []
} = {}) => {
    const safePageCount = Math.max(1, Number(pageCount) || 1);
    const safeAiScore = clampNumber(Number(aiScore) || 0, 0, 100);
    if (!isHandwritten) {
        return {
            finalScore: 0,
            strictScore: 0,
            aiScore: safeAiScore,
            ocrWordCount: 0,
            theoryCoverage: 0,
            expectedWordsByPages: safePageCount * 75
        };
    }

    const ocrTokens = tokenizeNotebookText(ocrText, { minLength: 2, skipStopwords: false });
    const ocrWordCount = ocrTokens.length;
    const ocrSignalTokens = uniqueTokens(tokenizeNotebookText(ocrText, { minLength: 4, skipStopwords: true }));
    const theorySignalTokens = uniqueTokens(tokenizeNotebookText(theoryText, { minLength: 4, skipStopwords: true }))
        .slice(0, 140);

    const theoryTokenSet = new Set(theorySignalTokens);
    const overlapCount = ocrSignalTokens.reduce((count, token) => (theoryTokenSet.has(token) ? count + 1 : count), 0);
    const theoryCoverage = theorySignalTokens.length
        ? clampNumber(overlapCount / theorySignalTokens.length, 0, 1)
        : 0;

    const expectedWordsByPages = safePageCount * 75;
    const lengthScore = clampNumber(ocrWordCount / expectedWordsByPages, 0, 1);

    const detectedCount = Array.isArray(detectedConcepts) ? detectedConcepts.length : 0;
    const missingCount = Array.isArray(missingConcepts) ? missingConcepts.length : 0;
    const conceptScore = (detectedCount + missingCount) > 0
        ? clampNumber(detectedCount / (detectedCount + missingCount), 0, 1)
        : 0.5;

    // CASO ESPECIAL: Si el estudiante copió TODO el texto de la teoría (cobertura >= 95%),
    // el puntaje debe ser 100% aunque haya agregado palabras adicionales con sus propias palabras.
    if (theoryCoverage >= 0.95) {
        const finalScore = clampNumber(Math.min(safeAiScore, 100), 0, 100);
        return {
            finalScore,
            strictScore: 100,
            aiScore: safeAiScore,
            ocrWordCount,
            theoryCoverage: Number(theoryCoverage.toFixed(3)),
            expectedWordsByPages
        };
    }

    let strictScore = Math.round((theoryCoverage * 0.55 + lengthScore * 0.25 + conceptScore * 0.20) * 100);

    if (ocrWordCount < 25) strictScore = Math.min(strictScore, 40);
    if (safePageCount === 1 && ocrWordCount < 40) strictScore = Math.min(strictScore, 60);
    if (theoryCoverage < 0.2) strictScore = Math.min(strictScore, 65);

    const finalScore = clampNumber(Math.min(safeAiScore, strictScore), 0, 100);

    return {
        finalScore,
        strictScore: clampNumber(strictScore, 0, 100),
        aiScore: safeAiScore,
        ocrWordCount,
        theoryCoverage: Number(theoryCoverage.toFixed(3)),
        expectedWordsByPages
    };
};

// ==========================================
// CASOS DE PRUEBA
// ==========================================

console.log('=== PRUEBAS DE SCORING ===\n');

// CASO 1: Copia textual exacta (debería dar 100%)
const teoria1 = 'La fraccion es una parte de un todo. El numerador es la parte de arriba y el denominador es la parte de abajo.';
const cuaderno1 = 'La fraccion es una parte de un todo. El numerador es la parte de arriba y el denominador es la parte de abajo.';

const resultado1 = computeNotebookStrictScore({
    isHandwritten: true,
    aiScore: 95,
    ocrText: cuaderno1,
    theoryText: teoria1,
    pageCount: 1,
    detectedConcepts: ['fraccion', 'numerador', 'denominador'],
    missingConcepts: []
});

console.log('CASO 1: Copia textual exacta');
console.log(`  Teoría: "${teoria1}"`);
console.log(`  Cuaderno: "${cuaderno1}"`);
console.log(`  Resultado: finalScore=${resultado1.finalScore}, strictScore=${resultado1.strictScore}, theoryCoverage=${resultado1.theoryCoverage}`);
console.log(`  ESPERADO: finalScore=95 (limitado por aiScore), strictScore=100, theoryCoverage=1.0\n`);

// CASO 2: Copia textual + explicación con propias palabras (debería dar 100% strictScore)
const teoria2 = 'El porcentaje es una forma de expresar una cantidad como parte de 100. Se usa para comparar cantidades.';
const cuaderno2 = 'El porcentaje es una forma de expresar una cantidad como parte de 100. Se usa para comparar cantidades. Por ejemplo, si tengo 50 de 100, eso es 50%. También sirve para calcular descuentos en las tiendas.';

const resultado2 = computeNotebookStrictScore({
    isHandwritten: true,
    aiScore: 98,
    ocrText: cuaderno2,
    theoryText: teoria2,
    pageCount: 1,
    detectedConcepts: ['porcentaje', 'comparar'],
    missingConcepts: []
});

console.log('CASO 2: Copia textual + explicación extendida');
console.log(`  Teoría: "${teoria2}"`);
console.log(`  Cuaderno: "${cuaderno2}"`);
console.log(`  Resultado: finalScore=${resultado2.finalScore}, strictScore=${resultado2.strictScore}, theoryCoverage=${resultado2.theoryCoverage}`);
console.log(`  ESPERADO: finalScore=98, strictScore=100 (cobertura >= 95%)\n`);

// CASO 3: Copia parcial (debería calcular normal)
const teoria3 = 'La suma es una operacion matematica que combina dos o mas numeros para obtener un total. Los numeros que se suman se llaman sumandos.';
const cuaderno3 = 'La suma es una operacion matematica. Los numeros se llaman sumandos.';

const resultado3 = computeNotebookStrictScore({
    isHandwritten: true,
    aiScore: 70,
    ocrText: cuaderno3,
    theoryText: teoria3,
    pageCount: 1,
    detectedConcepts: ['suma', 'sumandos'],
    missingConcepts: ['total', 'combinar']
});

console.log('CASO 3: Copia parcial (50% aproximadamente)');
console.log(`  Teoría: "${teoria3}"`);
console.log(`  Cuaderno: "${cuaderno3}"`);
console.log(`  Resultado: finalScore=${resultado3.finalScore}, strictScore=${resultado3.strictScore}, theoryCoverage=${resultado3.theoryCoverage}`);
console.log(`  ESPERADO: finalScore < 70, strictScore < 100, theoryCoverage ~ 0.5\n`);

// CASO 4: Copia casi completa (> 95%)
const teoria4 = 'La resta es una operacion que quita una cantidad de otra. El primer numero es el minuendo, el segundo es el sustraendo, y el resultado es la diferencia.';
const cuaderno4 = 'La resta es una operacion que quita una cantidad de otra. El primer numero es el minuendo, el segundo es el sustraendo, y el resultado es la diferencia';

const resultado4 = computeNotebookStrictScore({
    isHandwritten: true,
    aiScore: 92,
    ocrText: cuaderno4,
    theoryText: teoria4,
    pageCount: 1,
    detectedConcepts: ['resta', 'minuendo', 'sustraendo', 'diferencia'],
    missingConcepts: []
});

console.log('CASO 4: Copia casi completa (> 95% cobertura)');
console.log(`  Teoría: "${teoria4}"`);
console.log(`  Cuaderno: "${cuaderno4}"`);
console.log(`  Resultado: finalScore=${resultado4.finalScore}, strictScore=${resultado4.strictScore}, theoryCoverage=${resultado4.theoryCoverage}`);
console.log(`  ESPERADO: finalScore=92, strictScore=100 (cobertura >= 95%)\n`);

// CASO 5: No es manuscrito (debería dar 0)
const resultado5 = computeNotebookStrictScore({
    isHandwritten: false,
    aiScore: 90,
    ocrText: 'texto impreso',
    theoryText: teoria1,
    pageCount: 1,
    detectedConcepts: [],
    missingConcepts: []
});

console.log('CASO 5: No es manuscrito');
console.log(`  Resultado: finalScore=${resultado5.finalScore}, strictScore=${resultado5.strictScore}`);
console.log(`  ESPERADO: finalScore=0, strictScore=0\n`);

console.log('=== FIN DE PRUEBAS ===');
