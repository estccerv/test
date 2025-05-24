console.log('app.js: Script 시작 - Cargando...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('app.js: DOMContentLoaded evento disparado.');

    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const agentGastosButton = document.getElementById('agent-gastos');
    const agentBilleteraButton = document.getElementById('agent-billetera');
    const agentRecargasPagosButton = document.getElementById('agent-recargas-pagos');
    const chatAgentName = document.getElementById('chat-agent-name');
    const chatAvatar = document.getElementById('chat-avatar');
    const flowContainer = document.getElementById('flow-container');
    const flowIframe = document.getElementById('flow-iframe');
    const apiKeySetupDiv = document.getElementById('api-key-setup');
    const chatAppContainerDiv = document.getElementById('chat-app-container');
    const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
    const apiKeyStatusP = document.getElementById('api-key-status');
    const currentApiKeyDisplaySpan = document.getElementById('current-api-key-display');

    console.log('app.js: Constantes y variables iniciales declaradas.');

    let currentAgent = null; // 'gastos', 'billetera' o 'recargas_pagos'
    let currentAgentFullName = 'Selecciona un Bot';
    let GEMINI_API_KEY = '';
    const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=';
    const GEMINI_REQUEST_TIMEOUT_MS = 15000; // 15 segundos de tiempo de espera

    // --- PROMPTS ---
    const PROMPTS = {
        gastos: `Eres un asistente amigable para una aplicación de seguimiento de gastos por WhatsApp.
Tu tarea principal es analizar la solicitud del usuario para registrar un gasto y extraer los datos relevantes.
Si el usuario simplemente saluda (ej. "hola", "buenos días"), responde amablemente y pregunta cómo puedes ayudar con sus gastos.
Si el usuario pregunta qué puedes hacer, explica brevemente que puedes ayudar a registrar gastos y pide que describa el gasto.

Extrae los siguientes datos del texto del usuario si la intención es registrar un gasto:
- Monto (solo el número, sin símbolos de moneda)
- Moneda (si se menciona, por ejemplo "pesos", "USD", "EUR". Si no se menciona, intenta inferir o deja vacío si no es posible)
- Categoría (si se menciona o es inferible de forma clara y común, por ejemplo "Comida", "Transporte", "Ocio", "Supermercado", "Servicios". Si no es claro, deja vacío o asigna "General")
- Descripción (una descripción concisa del gasto, excluyendo palabras como "gasté", "pagué", "añade", "registra").
- Fecha (si se menciona explícitamente, como "ayer", "hoy", "el martes pasado", "25 de diciembre". Si no se menciona, indica que se debe usar la fecha actual).

Considera variaciones comunes y lenguaje coloquial.

Formatea la respuesta estrictamente como un objeto JSON con las siguientes claves:
"intencion": string ("registrar_gasto", "saludo", "ayuda_gastos", "desconocido")
"entidades": object (con amount, currency, category, description, date_reference si es registrar_gasto) | null
"respuesta_amigable": string (un mensaje amigable para el usuario, especialmente para saludos o si falta información)
"error_mensaje": string | null (si falta un dato crucial como el monto para un gasto, o si la solicitud no parece ser un registro de gasto claro y no es un saludo/ayuda)

Ejemplo de texto del usuario: "Hola"
Salida JSON esperada:
\`\`\`json
{
  "intencion": "saludo",
  "entidades": null,
  "respuesta_amigable": "¡Hola! ¿Cómo puedo ayudarte a registrar tus gastos hoy?",
  "error_mensaje": null
}
\`\`\`

Ejemplo de texto del usuario: "Ayer pagué 35000 pesos por la cena en el restaurante italiano"
Salida JSON esperada:
\`\`\`json
{
  "intencion": "registrar_gasto",
  "entidades": {
    "amount": 35000,
    "currency": "pesos",
    "category": "Comida",
    "description": "Cena en restaurante italiano",
    "date_reference": "ayer"
  },
  "respuesta_amigable": "Entendido. Voy a registrar una cena en restaurante italiano por 35000 pesos para ayer. Haz clic en el botón de abajo para abrir el formulario y confirmar o añadir detalles.",
  "error_mensaje": null
}
\`\`\`

Ejemplo de texto del usuario: "registra un pago"
Salida JSON esperada:
\`\`\`json
{
  "intencion": "desconocido",
  "entidades": null,
  "respuesta_amigable": "Para registrar un gasto, necesito un poco más de información, como el monto y de qué fue el gasto. Por ejemplo: 'gasté 500 en comida'.",
  "error_mensaje": "Faltan detalles para registrar el gasto. Por favor, especifica el monto y la descripción."
}
\`\`\`

Ejemplo de texto del usuario: "que haces"
Salida JSON esperada:
\`\`\`json
{
  "intencion": "ayuda_gastos",
  "entidades": null,
  "respuesta_amigable": "Soy tu asistente de gastos. Puedo ayudarte a registrar tus gastos. Solo dime algo como 'gasté 100 en taxi hoy'.",
  "error_mensaje": null
}
\`\`\`
`,
        billetera: `Eres un asistente NLU amigable para una billetera electrónica en WhatsApp. Tu tarea es analizar el texto del usuario, identificar su intención principal y las entidades relevantes, y proporcionar una respuesta conversacional.
Si el usuario saluda (ej. "hola"), responde amablemente y pregunta en qué puede ayudar con su billetera.
Si el usuario pregunta por tus funciones, explica brevemente las operaciones de billetera que manejas.

Intenciones Posibles:
- crear_cuenta: El usuario quiere abrir o registrar una nueva cuenta de billetera.
- ver_saldo: El usuario quiere saber cuánto dinero tiene.
- cargar_saldo: El usuario quiere añadir dinero a su billetera.
- retirar_saldo: El usuario quiere sacar dinero de su billetera.
- transferir_dinero: El usuario quiere enviar dinero a otra persona/usuario de la billetera.
- solicitar_pago: El usuario quiere pedir dinero a otra persona/usuario.
- aceptar_pago: El usuario confirma que quiere proceder con un pago que se le ha presentado.
- definir_pincode: El usuario quiere establecer o cambiar su PIN de seguridad.
- saludo_billetera: El usuario envía un saludo.
- ayuda_billetera: El usuario pide ayuda general sobre cómo usar la billetera o sus funciones.
- intencion_desconocida: No se puede determinar una intención clara de la lista anterior.

Entidades a Extraer (si aplican a la intención):
- monto: Cantidad numérica de dinero.
- moneda: Símbolo o código de la moneda (ej. USD, EUR, pesos, S/, $).
- destinatario: Persona o número de teléfono a quien se envía dinero.
- deudor: Persona o número de teléfono de quien se solicita dinero.
- concepto: Breve descripción o motivo de una transferencia o solicitud (opcional).
- nombre_usuario: Nombre que el usuario quiere para su cuenta (opcional para crear_cuenta).
- pincode: Número PIN de 4 a 6 dígitos para seguridad.

Formato de Salida Estricto (JSON):
Devuelve un objeto JSON con "intencion", "entidades", "respuesta_amigable", y "error_mensaje".
"respuesta_amigable" debe ser una frase completa y amable para el usuario, indicando que se mostrará un formulario si aplica.
"error_mensaje" es para cuando falten datos cruciales para una intención que no sea saludo o ayuda.

Ejemplos:
Usuario: "Hola"
Salida:
\`\`\`json
{
  "intencion": "saludo_billetera",
  "entidades": {},
  "respuesta_amigable": "¡Hola! Soy tu asistente de Billetera Electrónica. ¿Qué operación te gustaría realizar hoy?",
  "error_mensaje": null
}
\`\`\`

Usuario: "Quiero abrir mi cuenta con el nombre Juan Perez"
Salida:
\`\`\`json
{
  "intencion": "crear_cuenta",
  "entidades": {"nombre_usuario": "Juan Perez"},
  "respuesta_amigable": "¡Excelente, Juan Perez! Vamos a crear tu cuenta. Haz clic en el botón para abrir el formulario y completar algunos datos más.",
  "error_mensaje": null
}
\`\`\`

Usuario: "transferir"
Salida:
\`\`\`json
{
  "intencion": "transferir_dinero",
  "entidades": {},
  "respuesta_amigable": "Entendido, quieres transferir dinero. Para ayudarte mejor, ¿podrías decirme el monto y a quién deseas transferir? Si todo está claro, luego te mostraré el botón para abrir el formulario.",
  "error_mensaje": "Faltan detalles para la transferencia (monto, destinatario)."
}
\`\`\`
`,
        recargas_pagos: `Eres un asistente NLU amigable para un servicio de Recargas y Pagos en WhatsApp. Analiza el texto del usuario, identifica su intención y entidades, y responde de forma conversacional.
Si el usuario saluda (ej. "buenas"), responde amablemente y pregunta cómo puedes ayudar con sus recargas o pagos.
Si el usuario pregunta por tus funciones, explica los servicios que ofreces.

Intenciones Posibles:
- recargar_tiempo_aire
- comprar_paquete_movil
- recargar_servicio_online
- pagar_servicio_basico
- consultar_factura_servicio
- saludo_recargas_pagos
- ayuda_pagos_recargas
- intencion_desconocida

Entidades a Extraer:
- monto, moneda, operador_telefono, numero_telefono, nombre_paquete, nombre_servicio_online, nombre_juego, id_usuario_juego, tipo_servicio_basico, empresa_servicio, referencia_pago.

Formato de Salida Estricto (JSON):
Devuelve un objeto JSON con "intencion", "entidades", "respuesta_amigable", y "error_mensaje".
"respuesta_amigable" es la frase para el usuario, indicando que se mostrará un formulario si aplica.

Ejemplos:
Usuario: "Hola bot"
Salida:
\`\`\`json
{
  "intencion": "saludo_recargas_pagos",
  "entidades": {},
  "respuesta_amigable": "¡Hola! Soy tu asistente para Recargas y Pagos. ¿En qué te puedo ayudar hoy?",
  "error_mensaje": null
}
\`\`\`

Usuario: "quiero pagar la luz con referencia 12345"
Salida:
\`\`\`json
{
  "intencion": "pagar_servicio_basico",
  "entidades": {"tipo_servicio_basico": "luz", "referencia_pago": "12345"},
  "respuesta_amigable": "Entendido, quieres pagar el servicio de luz con referencia 12345. Haz clic abajo para abrir el formulario y completar los detalles.",
  "error_mensaje": null
}
\`\`\`

Usuario: "recargar"
Salida:
\`\`\`json
{
  "intencion": "recargar_tiempo_aire",
  "entidades": {},
  "respuesta_amigable": "Claro, puedo ayudarte con eso. ¿Quieres hacer una recarga de tiempo aire o comprar un paquete? Dime el número y el monto o paquete que deseas. Cuando tengamos los datos, te mostraré el botón para el formulario.",
  "error_mensaje": "Necesito más detalles para la recarga (número, monto/paquete)."
}
\`\`\`
`
    };
    console.log('app.js: Objeto PROMPTS definido.');
    // --- FIN PROMPTS ---

    const INTENT_TO_FLOW_MAP = {
        // Gastos
        'registrar_gasto': 'expense_flow_registrar_gasto.html',
        // Billetera
        'crear_cuenta': 'ewallet_flow_crear_cuenta.html',
        'cargar_saldo': 'ewallet_flow_cargar_saldo.html',
        'retirar_saldo': 'ewallet_flow_retirar_saldo.html',
        'transferir_dinero': 'ewallet_flow_transferir_dinero.html',
        'solicitar_pago': 'ewallet_flow_solicitar_pago.html',
        'aceptar_pago': 'ewallet_flow_aceptar_pago.html',
        'definir_pincode': 'ewallet_flow_definir_pincode.html',
        // Recargas y Pagos
        'recargar_tiempo_aire': 'payments_recharges_flow_recarga_telefono.html',
        'comprar_paquete_movil': 'payments_recharges_flow_recarga_telefono.html',
        'recargar_servicio_online': 'payments_recharges_flow_recarga_online.html',
        'pagar_servicio_basico': 'payments_recharges_flow_pago_servicio_basico.html',
    };
    console.log('app.js: Objeto INTENT_TO_FLOW_MAP definido.');

    window.setApiKeyAndStart = () => {
        console.log('app.js: setApiKeyAndStart() llamada.');
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) {
            apiKeyStatusP.textContent = 'Por favor, ingresa una clave API.';
            console.warn('app.js: setApiKeyAndStart() - API Key vacía.');
            return;
        }
        GEMINI_API_KEY = apiKey;
        apiKeySetupDiv.style.display = 'none';
        chatAppContainerDiv.style.display = 'flex';
        currentApiKeyDisplaySpan.textContent = `***${apiKey.slice(-4)}`;
        apiKeyStatusP.textContent = '¡Clave guardada!';
        addBotMessage('Bienvenido. Por favor, selecciona un bot de la izquierda para comenzar.');
        console.log('app.js: setApiKeyAndStart() - API Key guardada y UI actualizada.');
    };
    console.log('app.js: window.setApiKeyAndStart definida.');

    window.selectAgent = (agent) => {
        console.log(`app.js: selectAgent('${agent}') llamado.`);
        currentAgent = agent;
        messageInput.disabled = false;
        sendButton.disabled = false;
        chatMessages.innerHTML = '';
        closeFlow();

        [agentGastosButton, agentBilleteraButton, agentRecargasPagosButton].forEach(btn => btn.classList.remove('active'));

        let greetingMessage = 'Hola, soy tu Asistente. ¿En qué puedo ayudarte?';
        if (agent === 'gastos') {
            currentAgentFullName = '🤖 Bot de Gastos (Gemini)';
            chatAvatar.textContent = '💸';
            agentGastosButton.classList.add('active');
            greetingMessage = 'Hola, soy el Bot de Gastos. ¿Qué gasto deseas registrar hoy? (Ej: "cena de 500 pesos ayer")';
        } else if (agent === 'billetera') {
            currentAgentFullName = '💳 Bot de Billetera (Gemini)';
            chatAvatar.textContent = '🏦';
            agentBilleteraButton.classList.add('active');
            greetingMessage = 'Hola, soy el Bot de Billetera. ¿Qué operación de billetera deseas realizar? (Ej: "ver saldo")';
        } else if (agent === 'recargas_pagos') {
            currentAgentFullName = '🔌 Bot de Recargas y Pagos (Gemini)';
            chatAvatar.textContent = '💡';
            agentRecargasPagosButton.classList.add('active');
            greetingMessage = 'Hola, soy tu Agente de Recargas y Pagos. ¿Qué deseas hacer? (Ej: "recargar cel" o "pagar luz")';
        }
        chatAgentName.textContent = currentAgentFullName;
        addBotMessage(greetingMessage);
        messageInput.focus();
    };
    console.log('app.js: window.selectAgent definida.');

    window.sendMessage = () => {
        console.log('app.js: sendMessage() llamado.');
        const messageText = messageInput.value.trim();
        if (messageText === '' || !currentAgent) {
            console.warn('app.js: sendMessage() - Mensaje vacío o agente no seleccionado.');
            return;
        }

        if (!GEMINI_API_KEY) {
            addBotMessage('Error: La clave API de Gemini no ha sido configurada. Ve a la configuración inicial.');
            apiKeySetupDiv.style.display = 'flex';
            chatAppContainerDiv.style.display = 'none';
            console.error('app.js: sendMessage() - GEMINI_API_KEY no configurada.');
            return;
        }

        addUserMessage(messageText);
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
        addBotMessage('Pensando con Gemini...', { isThinking: true });
        processUserMessageWithGemini(messageText);
    };
    console.log('app.js: window.sendMessage definida.');

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    console.log('app.js: Event listener para messageInput (keypress) añadido.');

    async function processUserMessageWithGemini(text) {
        console.log(`app.js: processUserMessageWithGemini("${text}") llamado.`);
        const selectedPrompt = PROMPTS[currentAgent];
        if (!selectedPrompt) {
            addBotMessage('Error: No hay un prompt configurado para este agente.');
            removeThinkingMessage();
            messageInput.disabled = false;
            sendButton.disabled = false;
            console.error('app.js: processUserMessageWithGemini - Prompt no encontrado para el agente: ', currentAgent);
            return;
        }

        const fullPrompt = `${selectedPrompt}

Usuario: "${text}"
Salida:
\`\`\`json
`;

        const requestBody = {
            contents: [{
                parts: [{ text: fullPrompt }]
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 350,
                topP: 0.8,
                topK: 40,
            }
        };
        console.log('app.js: processUserMessageWithGemini - Cuerpo de la solicitud a Gemini:', JSON.stringify(requestBody));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.warn('app.js: processUserMessageWithGemini - Timeout de la solicitud a Gemini.');
        }, GEMINI_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`${GEMINI_API_URL_BASE}${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal // Añadir AbortSignal a la solicitud
            });
            
            clearTimeout(timeoutId); // Limpiar el timeout si la respuesta llega a tiempo
            console.log('app.js: processUserMessageWithGemini - Respuesta inicial de fetch recibida.');

            removeThinkingMessage();
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                console.error('Error de la API de Gemini:', response.status, errorData);
                let errorMessageText = `Error con Gemini (${response.status})`;
                if (errorData.error && errorData.error.message) {
                    errorMessageText += `: ${errorData.error.message.substring(0, 200)}`;
                }
                addBotMessage(errorMessageText + ". Revisa la clave API y los detalles del error en la consola.");
                return;
            }

            const geminiResponse = await response.json();
            console.log('Respuesta completa de Gemini:', geminiResponse);

            let nluResult = {};
            let rawNluOutput = '';

            if (geminiResponse.candidates && geminiResponse.candidates.length > 0 &&
                geminiResponse.candidates[0].content && geminiResponse.candidates[0].content.parts &&
                geminiResponse.candidates[0].content.parts.length > 0) {
                rawNluOutput = geminiResponse.candidates[0].content.parts[0].text;
                console.log('app.js: processUserMessageWithGemini - Salida NLU cruda de Gemini:', rawNluOutput);
            } else {
                addBotMessage('No se pudo obtener una respuesta válida de Gemini (estructura inesperada). Revisa la consola.');
                console.error('app.js: processUserMessageWithGemini - Estructura de respuesta de Gemini inesperada.', geminiResponse);
                return;
            }

            try {
                const jsonMatch = rawNluOutput.match(/```json\s*([\s\S]+?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    nluResult = JSON.parse(jsonMatch[1]);
                } else {
                    let cleanJson = rawNluOutput.trim();
                    const firstBrace = cleanJson.indexOf('{');
                    const lastBrace = cleanJson.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                    }
                    nluResult = JSON.parse(cleanJson);
                }
                 console.log('app.js: processUserMessageWithGemini - NLU Result parseado:', nluResult);
            } catch (e) {
                console.error('Error al parsear JSON de Gemini:', e, 'Raw output:', rawNluOutput);
                addBotMessage('Hubo un problema procesando la respuesta de Gemini. Asegúrate de que tu API Key y el modelo son correctos. Salida cruda: ' + escapeHTML(rawNluOutput.substring(0,300)));
                return;
            }

            const { intencion, entidades, respuesta_amigable, error_mensaje } = nluResult;
            let flowDetails = null;

            console.log(`app.js: NLU - Intención: ${intencion}, Entidades:`, entidades, `Respuesta Amigable: ${respuesta_amigable}, Error: ${error_mensaje}`);

            let finalBotResponse = respuesta_amigable;

            if (intencion === 'intencion_desconocida' || intencion === 'desconocido' || !intencion) {
                if (!finalBotResponse) {
                    finalBotResponse = "Lo siento, no estoy seguro de cómo ayudarte con eso. ¿Podrías intentarlo de otra manera?";
                    if (currentAgent === 'gastos') finalBotResponse += " Intenta decirme el gasto que quieres registrar.";
                    else if (currentAgent === 'billetera') finalBotResponse += " Puedo ayudarte con operaciones de tu billetera.";
                    else if (currentAgent === 'recargas_pagos') finalBotResponse += " Puedo ayudarte con recargas o pagos de servicios.";
                }
            } else if (error_mensaje &&
                       intencion !== 'saludo' && !intencion?.startsWith('saludo_') &&
                       intencion !== 'ayuda_gastos' && !intencion?.startsWith('ayuda_')) {
                if(!finalBotResponse) finalBotResponse = error_mensaje;
            }

            if (currentAgent === 'billetera' && intencion === 'ver_saldo') {
                 finalBotResponse = respuesta_amigable || "Consultando tu saldo... (Simulado: $1,234.56 USDT). No necesitas llenar ningún formulario para esto.";
                 addBotMessage(finalBotResponse);
                 return;
            }
            
            if (intencion && INTENT_TO_FLOW_MAP[intencion] &&
                intencion !== 'saludo' && !intencion?.startsWith('saludo_') &&
                intencion !== 'ayuda_gastos' && !intencion?.startsWith('ayuda_') &&
                !error_mensaje) {
                
                const flowFileName = INTENT_TO_FLOW_MAP[intencion];
                const flowData = currentAgent === 'gastos' ? entidades : (entidades || {});
                flowDetails = { flowFileName, flowData, buttonText: 'Abrir Formulario' };
                console.log(`app.js: Preparando botón para flujo ${flowFileName} con datos:`, flowData);
            }

            addBotMessage(finalBotResponse || "Entendido. ¿Necesitas algo más?", { flowDetails });

        } catch (error) {
            clearTimeout(timeoutId); // Limpiar el timeout también en caso de otros errores de fetch
            console.error('Error catastrófico en processUserMessageWithGemini:', error);
            removeThinkingMessage();
            if (error.name === 'AbortError') {
                addBotMessage('La solicitud a Gemini tardó demasiado y fue cancelada. Verifica tu conexión o la clave API.');
            } else {
                addBotMessage('Lo siento, ocurrió un error MUY inesperado al procesar tu mensaje. Revisa la consola para más detalles.');
            }
            messageInput.disabled = false;
            sendButton.disabled = false;
        }
    }
    console.log('app.js: processUserMessageWithGemini definida.');

    function addThinkingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot', 'thinking');
        messageDiv.innerHTML = `<p>...</p>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function removeThinkingMessage() {
        const thinkingMessage = chatMessages.querySelector('.message.bot.thinking');
        if (thinkingMessage) {
            chatMessages.removeChild(thinkingMessage);
        }
    }

    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.innerHTML = `<p>${escapeHTML(text)}</p><span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addBotMessage(text, options = {}) {
        const { isThinking = false, flowDetails = null } = options;

        if (isThinking) {
            addThinkingMessage();
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        
        let htmlContent = `<p>${escapeHTML(text)}</p>`;

        if (flowDetails && flowDetails.flowFileName) {
            const buttonId = `flow-button-${Date.now()}`;
            htmlContent += `<button id="${buttonId}" class="flow-trigger-button">${escapeHTML(flowDetails.buttonText || 'Abrir Formulario')}</button>`;
            
            setTimeout(() => {
                const buttonElement = document.getElementById(buttonId);
                if (buttonElement) {
                    buttonElement.onclick = () => {
                        showFlow(flowDetails.flowFileName, flowDetails.flowData);
                    };
                }
            }, 0);
        }

        messageDiv.innerHTML = `${htmlContent}<span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    window.showFlow = (flowFileName, flowData = {}) => {
        console.log(`app.js: showFlow('${flowFileName}') llamado. Datos:`, flowData);
        let src = `flows/${flowFileName}`;
        
        const queryParams = new URLSearchParams();
        if (flowData && typeof flowData === 'object') {
            for (const key in flowData) {
                if (Object.prototype.hasOwnProperty.call(flowData, key) && flowData[key] !== null && flowData[key] !== undefined && String(flowData[key]).trim() !== '') {
                    queryParams.append(key, String(flowData[key]));
                }
            }
        }
        if (queryParams.toString()) {
            src += `?${queryParams.toString()}`;
        }

        flowIframe.src = src;
        flowContainer.style.display = 'flex';
        console.log("Mostrando iframe con src:", src);
    }
    console.log('app.js: Funciones auxiliares (addThinkingMessage, etc.) y showFlow definidas.');

    window.closeFlow = () => {
        console.log('app.js: closeFlow() llamado.');
        flowIframe.src = 'about:blank';
        flowContainer.style.display = 'none';
        if (currentAgent) {
            messageInput.focus();
        }
    };
    console.log('app.js: window.closeFlow definida.');

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
    console.log('app.js: escapeHTML definida.');

    apiKeySetupDiv.style.display = 'flex';
    chatAppContainerDiv.style.display = 'none';
    messageInput.disabled = true;
    sendButton.disabled = true;
    console.log('app.js: UI inicializada.');

}); // Fin de DOMContentLoaded

console.log('app.js: Script Finalizado.');
