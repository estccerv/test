// ewallet_test_nlu_local.js
const fs = require('fs');
const path = require('path');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- Configuración ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest"; 
const NLU_PROMPT_PATH = path.join(__dirname, '../gemini_prompts/ewallet_nlu_prompt.txt');
const INTENT_TO_FLOW_MAP = {
    'crear_cuenta': 'flow_crear_cuenta.html',
    'ver_saldo': 'flow_ver_saldo.html',
    'cargar_saldo': 'flow_cargar_saldo.html',
    'retirar_saldo': 'flow_retirar_saldo.html',
    'transferir_dinero': 'flow_transferir_dinero.html',
    'solicitar_pago': 'flow_solicitar_pago.html',
    'aceptar_pago': 'flow_aceptar_pago.html',
    'definir_pincode': 'flow_definir_pincode.html',
};
// --------------------->

if (!GOOGLE_API_KEY) {
    console.error(`ERROR: La variable de entorno GOOGLE_API_KEY no está configurada.`);
    console.log(`Por favor, ejecútala en tu terminal con: export GOOGLE_API_KEY="TU_CLAVE_API_AQUI"`);
    process.exit(1);
}

let nluPromptContent = '';
try {
    nluPromptContent = fs.readFileSync(NLU_PROMPT_PATH, 'utf-8');
} catch (error) {
    console.error(`Error al leer el archivo de prompt NLU en ${NLU_PROMPT_PATH}: ${error.message}`);
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

async function analyzeTextWithGemini(userText) {
    console.log(`\n💬  Analizando texto con Gemini para E-Wallet...`); 
    try {
        // CORREGIDO: Usar backticks para la construcción del prompt multilínea
        const fullPrompt = `${nluPromptContent}\n\nUsuario: ${userText}\nSalida:`;

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
        const generationConfig = { temperature: 0.25 };

        const result = await model.generateContent({
            contents: [{ parts: [{ text: fullPrompt }] }],
            safetySettings,
            generationConfig
        });

        if (!result.response || !result.response.candidates || result.response.candidates.length === 0 || !result.response.candidates[0].content) {
            console.error(`ERROR: La respuesta de la API de Gemini no tiene la estructura esperada.`);
            console.dir(result.response, { depth: null });
            return { error: "Respuesta inválida de la API de Gemini." };
        }

        const analysisText = result.response.candidates[0].content.parts[0].text;
        console.log(`📝  Respuesta cruda de Gemini:`);
        console.log(analysisText);

        let parsedResult;
        try {
            let jsonString = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            const jsonMatch = jsonString.match(/^.*?({.*}).*?$/s);
            if (jsonMatch && jsonMatch[1]) {
                jsonString = jsonMatch[1];
            }
            parsedResult = JSON.parse(jsonString);
            console.log(`\n✅  JSON Extraído:`);
            console.log(JSON.stringify(parsedResult, null, 2));

            if (parsedResult.intencion && INTENT_TO_FLOW_MAP[parsedResult.intencion]) {
                const flowFile = INTENT_TO_FLOW_MAP[parsedResult.intencion];
                console.log(`\n💡  Sugerencia de Flow: Deberías mostrar el Flow simulado en 'flows_html/${flowFile}'`);
                console.log(`   (Abre manualmente: ewallet-chatapp/PreviewTesting/flows_html/${flowFile} en tu navegador)`);
            } else if (parsedResult.intencion === 'ayuda_billetera') {
                console.log(`\n💡  Respuesta sugerida: "Puedo ayudarte a ver tu saldo, cargar, retirar, transferir, solicitar pagos, y definir tu PIN. ¿Qué te gustaría hacer?"`);
            }

            return parsedResult;
        } catch (e) {
            console.error(`\n❌  Error al parsear la respuesta de Gemini como JSON: ${e.message}`);
            console.log(`    (Puede que el prompt necesite ajustes o que la limpieza del JSON necesite mejorar)`);
            console.log(`    Texto que intentó parsear: ${analysisText}`);
            return { error: "No se pudo parsear la respuesta de Gemini como JSON.", raw_response: analysisText };
        }

    } catch (error) {
        console.error(`\n❌  Error al llamar a la API de Gemini: ${error.message}`);
        if (error.message && error.message.includes("API key not valid")) {
            console.error(`    Error específico: La clave API de Google no es válida o no tiene permisos para el modelo Gemini.`);
        } else if (error.message && (error.message.includes("Could not find model") || error.message.includes("is not found for API version"))) {
            console.error(`    Error específico: El modelo '${GEMINI_MODEL_NAME}' no se encontró o no es compatible.`);
        }
        return { error: "Fallo al analizar el mensaje con IA.", details: error.message };
    }
}

function askForInput() {
    readline.question(
        `\n-------------------------------------------------------\nEscribe una frase para la billetera (o 'salir' para terminar):\n> `,
        (userText) => {
            if (userText.toLowerCase() === 'salir') {
                readline.close();
                return;
            }
            if (userText.trim() === '') {
                console.log(`Por favor, escribe algo.`);
                askForInput();
                return;
            }
            analyzeTextWithGemini(userText).then(() => {
                askForInput();
            });
        }
    );
}

console.log(`🧪  Test Local de NLU para E-Wallet con Gemini 🧪`);
if (!GOOGLE_API_KEY) {
    // Ya se maneja al inicio
} else if (!nluPromptContent) {
    // Ya se maneja al inicio
} else {
    console.log(`Usando el modelo: ${GEMINI_MODEL_NAME}`);
    console.log(`Usando el prompt de: ${NLU_PROMPT_PATH}`);
    console.log(`Asegúrate de haber configurado la variable de entorno GOOGLE_API_KEY.`);
    askForInput();
}
