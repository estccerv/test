import functions from '@google-cloud/functions-framework';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

// Configuración CORS - ¡AJUSTA ESTO PARA PRODUCCIÓN!
// Para pruebas locales con `npx http-server` en WebAppDemo, el origen podría ser http://localhost:8080 o similar.
// Para un sitio desplegado, usa el origen de ese sitio.
const corsMiddleware = cors({ origin: true }); // Permite todos los orígenes para demo, ¡NO PARA PRODUCCIÓN!

// --- Configuración de la Función ---
const GEMINI_MODEL_NAME = 'gemini-1.5-flash-latest';
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT; // GCP Project ID
const GEMINI_API_KEY_SECRET_NAME = 'GEMINI_API_KEY'; // El nombre del secreto en Secret Manager
const GEMINI_API_KEY_SECRET_VERSION = 'latest'; // La versión del secreto

let geminiApiKey;
const secretManagerClient = new SecretManagerServiceClient();

async function getGeminiApiKey() {
    if (geminiApiKey) {
        return geminiApiKey;
    }
    if (!PROJECT_ID) {
        console.error('Error: GCP_PROJECT o GOOGLE_CLOUD_PROJECT no está configurado en el entorno.');
        throw new Error('Configuración del proyecto de GCP faltante.');
    }
    const secretPath = `projects/${PROJECT_ID}/secrets/${GEMINI_API_KEY_SECRET_NAME}/versions/${GEMINI_API_KEY_SECRET_VERSION}`;
    try {
        console.log(`Accediendo al secreto: ${secretPath}`)
        const [version] = await secretManagerClient.accessSecretVersion({ name: secretPath });
        geminiApiKey = version.payload.data.toString('utf8');
        console.log('Clave API de Gemini obtenida de Secret Manager.');
        return geminiApiKey;
    } catch (error) {
        console.error(`Error al acceder al secreto ${secretPath} desde Secret Manager:`, error.message);
        console.error('Asegúrate de que el secreto exista, tenga la versión 'latest' y la cuenta de servicio de esta función tenga el rol "Descriptor de acceso a los secretos de Secret Manager".');
        throw new Error('No se pudo obtener la clave API de Gemini.');
    }
}

async function loadNluPrompt(agentType) {
    const promptFileName = agentType === 'gastos' ? 'expense_nlu_prompt.txt' : 'ewallet_nlu_prompt.txt';
    // __dirname no está disponible en módulos ES por defecto de la misma manera, usar import.meta.url
    const currentModuleUrl = import.meta.url;
    const currentModulePath = path.dirname(new URL(currentModuleUrl).pathname);
    const promptPath = path.join(currentModulePath, 'prompts', promptFileName);
    try {
        return fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error(`Error al leer el archivo de prompt NLU en ${promptPath}: ${error.message}`);
        throw new Error(`No se pudo cargar el prompt para ${agentType}`);
    }
}

functions.http('nluProxyAgent', async (req, res) => {
    // Aplicar middleware CORS
    await new Promise((resolve, reject) => {
        corsMiddleware(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    // Manejar preflight request de CORS (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Método no permitido. Usa POST.');
        return;
    }

    const { userText, agentType } = req.body;

    if (!userText || !agentType) {
        res.status(400).send('Faltan los parámetros "userText" o "agentType".');
        return;
    }

    if (agentType !== 'gastos' && agentType !== 'billetera') {
        res.status(400).send('"agentType" inválido. Debe ser "gastos" o "billetera".');
        return;
    }

    try {
        const apiKey = await getGeminiApiKey();
        const nluPromptContent = await loadNluPrompt(agentType);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

        const fullPrompt = `${nluPromptContent}

Usuario: ${userText}
Salida:`;
        
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
        const generationConfig = { temperature: 0.25 };

        console.log(`Enviando a Gemini para agente ${agentType}: ${userText}`);
        const result = await model.generateContent({
            contents: [{ parts: [{ text: fullPrompt }] }],
            safetySettings,
            generationConfig
        });

        if (!result.response || !result.response.candidates || !result.response.candidates.length === 0 || !result.response.candidates[0].content) {
            console.error(`ERROR: La respuesta de la API de Gemini no tiene la estructura esperada para el agente ${agentType}.`);
            console.dir(result.response, { depth: null });
            res.status(500).send({ error: "Respuesta inválida de la API de Gemini." });
            return;
        }

        const analysisText = result.response.candidates[0].content.parts[0].text;
        console.log(`Respuesta cruda de Gemini para agente ${agentType}: ${analysisText}`);

        let parsedResult;
        try {
            let jsonString = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            const jsonMatch = jsonString.match(/^.*?({.*}).*?$/s);
            if (jsonMatch && jsonMatch[1]) {
                jsonString = jsonMatch[1];
            }
            parsedResult = JSON.parse(jsonString);
            console.log(`JSON Extraído para agente ${agentType}:`, parsedResult);
            res.status(200).send(parsedResult);
        } catch (e) {
            console.error(`Error al parsear la respuesta de Gemini como JSON para el agente ${agentType}: ${e.message}`);
            console.log(`Texto que intentó parsear: ${analysisText}`);
            res.status(500).send({ error: "No se pudo parsear la respuesta de Gemini como JSON.", raw_response: analysisText });
        }

    } catch (error) {
        console.error(`Error procesando la solicitud NLU para el agente ${agentType}: ${error.message}`);
        res.status(500).send({ error: `Fallo al procesar la solicitud NLU: ${error.message}` });
    }
});
