import OpenAI from 'openai';

const openai = new OpenAI({ 
    apiKey: 'sk-5d5881f0246044129e98ca3cccc70d90',
    baseURL: 'https://api.deepseek.com'
});

async function test() {
    try {
        console.log("Enviando request a DeepSeek...");
        const start = Date.now();
        const comp = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "Hola, ¿funcionas?" }],
            max_tokens: 10
        });
        console.log("Respuesta en", Date.now() - start, "ms:", comp.choices[0].message.content);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
