console.log('app.js: Script inicializado');

document.addEventListener('DOMContentLoaded', () => {
    console.log('app.js: DOMContentLoaded');

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

    let currentAgent = null;
    let currentAgentFullName = 'Selecciona un Bot';
    let GEMINI_API_KEY = '';
    const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=';
    const GEMINI_REQUEST_TIMEOUT_MS = 20000;

    let userSimulatedData = {
        saldo: 1234.56, 
        moneda: 'USD',
        transacciones: [
            { tipo: 'credito', descripcion: 'Carga de saldo inicial', monto: 50.00, fecha: '2024-07-29' },
            { tipo: 'debito', descripcion: 'Netflix', monto: 15.99, fecha: '2024-07-28' },
            { tipo: 'debito', descripcion: 'Transferencia a Juan P.', monto: 25.00, fecha: '2024-07-28' },
            { tipo: 'credito', descripcion: 'Pago de Ana G.', monto: 75.00, fecha: '2024-07-27' },
            { tipo: 'debito', descripcion: 'Supermercado', monto: 63.20, fecha: '2024-07-26' },
            { tipo: 'credito', descripcion: 'Depósito nómina', monto: 800.00, fecha: '2024-07-25' },
            { tipo: 'debito', descripcion: 'Recarga celular', monto: 10.00, fecha: '2024-07-25' },
            { tipo: 'debito', descripcion: 'Pago Luz', monto: 33.50, fecha: '2024-07-24' },
            { tipo: 'credito', descripcion: 'Reembolso tienda X', monto: 12.00, fecha: '2024-07-23' },
            { tipo: 'debito', descripcion: 'Café matutino', monto: 3.50, fecha: '2024-07-22' },
            { tipo: 'credito', descripcion: 'Venta artículo Y', monto: 40.00, fecha: '2024-07-21' },
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    };

        // --- PROMPTS ---
    // CORREGIDO: Manejo cuidadoso de los ejemplos JSON dentro de los template literals.
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
${"```json"}
{
  "intencion": "saludo",
  "entidades": null,
  "respuesta_amigable": "¡Hola! ¿Cómo puedo ayudarte a registrar tus gastos hoy?",
  "error_mensaje": null
}
${"```"}

Ejemplo de texto del usuario: "Ayer pagué 35000 pesos por la cena en el restaurante italiano"
Salida JSON esperada:
${"```json"}
{
  "intencion": "registrar_gasto",
  "entidades": {
    "amount": 35000,
    "currency": "pesos",
    "category": "Comida",
    "description": "Cena en restaurante italiano",
    "date_reference": "ayer"
  },
  "respuesta_amigable": "Entendido. Voy a registrar una cena en restaurante italiano por 35000 pesos para ayer. Haz clic en el botón de abajo para abrir el WhatsApp Flow y confirmar o añadir detalles.",
  "error_mensaje": null
}
${"```"}
` ,
        billetera: `Eres un asistente NLU amigable para una billetera electrónica en WhatsApp. Tu tarea es analizar el texto del usuario, identificar su intención principal y las entidades relevantes, y proporcionar una respuesta conversacional.
Si el usuario saluda (ej. "hola"), responde amablemente y pregunta en qué puede ayudar con su billetera.
Si el usuario pregunta por tus funciones, explica brevemente las operaciones de billetera que manejas.

Intenciones Posibles:
- crear_cuenta
- ver_saldo
- cargar_saldo
- retirar_saldo
- transferir_dinero
- solicitar_pago
- aceptar_pago
- definir_pincode
- ver_ultimas_transacciones
- saludo_billetera
- ayuda_billetera
- intencion_desconocida

Entidades a Extraer (si aplican a la intención):
- monto, moneda, destinatario, deudor, concepto, nombre_usuario, pincode.

Formato de Salida Estricto (JSON):
Devuelve un objeto JSON con "intencion", "entidades", "respuesta_amigable", y "error_mensaje".
"respuesta_amigable" debe ser una frase completa y amable para el usuario, indicando si se mostrará un formulario.
"error_mensaje" es para cuando falten datos cruciales.

Ejemplos:
Usuario: "Hola"
Salida:
${"```json"}
{
  "intencion": "saludo_billetera",
  "entidades": {},
  "respuesta_amigable": "¡Hola! Soy tu asistente de Billetera Electrónica. ¿Qué operación te gustaría realizar hoy?",
  "error_mensaje": null
}
${"```"}

Usuario: "Ver mi saldo"
Salida:
${"```json"}
{
  "intencion": "ver_saldo",
  "entidades": {},
  "respuesta_amigable": "Consultando tu saldo...",
  "error_mensaje": null
}
${"```"}

Usuario: "Muéstrame mis últimos movimientos"
Salida:
${"```json"}
{
  "intencion": "ver_ultimas_transacciones",
  "entidades": {},
  "respuesta_amigable": "Claro, aquí están tus últimas transacciones:",
  "error_mensaje": null
}
${"```"}

Usuario: "transferir"
Salida:
${"```json"}
{
  "intencion": "transferir_dinero",
  "entidades": {},
  "respuesta_amigable": "Entendido, quieres transferir dinero. Para ayudarte mejor, ¿podrías decirme el monto y a quién deseas transferir? Luego podrás completar los detalles en el WhatsApp Flow.",
  "error_mensaje": "Faltan detalles para la transferencia (monto, destinatario)."
}
${"```"}
` ,
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
${"```json"}
{
  "intencion": "saludo_recargas_pagos",
  "entidades": {},
  "respuesta_amigable": "¡Hola! Soy tu asistente para Recargas y Pagos. ¿En qué te puedo ayudar hoy?",
  "error_mensaje": null
}
${"```"}

Usuario: "quiero pagar la luz con referencia 12345"
Salida:
${"```json"}
{
  "intencion": "pagar_servicio_basico",
  "entidades": {"tipo_servicio_basico": "luz", "referencia_pago": "12345"},
  "respuesta_amigable": "Entendido, quieres pagar el servicio de luz con referencia 12345. Haz clic abajo para abrir el WhatsApp Flow y completar los detalles.",
  "error_mensaje": null
}
${"```"}
`
    };
    // --- FIN PROMPTS ---


    const INTENT_TO_FLOW_MAP = {
        'registrar_gasto': 'expense_flow_registrar_gasto.html',
        'crear_cuenta': 'ewallet_flow_crear_cuenta.html',
        'cargar_saldo': 'ewallet_flow_cargar_saldo.html',
        'retirar_saldo': 'ewallet_flow_retirar_saldo.html',
        'transferir_dinero': 'ewallet_flow_transferir_dinero.html',
        'solicitar_pago': 'ewallet_flow_solicitar_pago.html',
        'aceptar_pago': 'ewallet_flow_aceptar_pago.html',
        'definir_pincode': 'ewallet_flow_definir_pincode.html',
        'ver_saldo': 'ewallet_flow_ver_saldo.html',
        'recargar_tiempo_aire': 'payments_recharges_flow_recarga_telefono.html',
        'comprar_paquete_movil': 'payments_recharges_flow_recarga_telefono.html',
        'recargar_servicio_online': 'payments_recharges_flow_recarga_online.html',
        'pagar_servicio_basico': 'payments_recharges_flow_pago_servicio_basico.html',
    };

    window.setApiKeyAndStart = () => {
        const apiKey = geminiApiKeyInput.value.trim();
        if (!apiKey) {
            apiKeyStatusP.textContent = 'Por favor, ingresa una clave API.';
            return;
        }
        GEMINI_API_KEY = apiKey;
        apiKeySetupDiv.style.display = 'none';
        chatAppContainerDiv.style.display = 'flex';
        currentApiKeyDisplaySpan.textContent = `***${apiKey.slice(-4)}`;
        apiKeyStatusP.textContent = '¡Clave guardada!';
        addBotMessage('Bienvenido. Por favor, selecciona un bot de la izquierda para comenzar.');
    };

    window.selectAgent = (agent) => {
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
            greetingMessage = 'Hola, soy el Bot de Billetera. ¿Qué operación de billetera deseas realizar? (Ej: "ver saldo", "últimos movimientos")';
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

    window.sendMessage = () => {
        const messageText = messageInput.value.trim();
        if (messageText === '' || !currentAgent) return;
        if (!GEMINI_API_KEY) {
            addBotMessage('Error: La clave API de Gemini no ha sido configurada.');
            apiKeySetupDiv.style.display = 'flex';
            chatAppContainerDiv.style.display = 'none';
            return;
        }
        addUserMessage(messageText);
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
        addBotMessage('Pensando con Gemini...', { isThinking: true });
        processUserMessageWithGemini(messageText);
    };

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') sendMessage();
    });

    async function processUserMessageWithGemini(text) {
        const selectedPrompt = PROMPTS[currentAgent];
        if (!selectedPrompt) {
            addBotMessage('Error: No hay un prompt configurado para este agente.');
            removeThinkingMessage();
            messageInput.disabled = false; sendButton.disabled = false;
            return;
        }
        const fullPrompt = `${selectedPrompt}

Usuario: "${text}"
Salida:
`;

        const requestBody = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 500, topP: 0.8, topK: 40, }
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`${GEMINI_API_URL_BASE}${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            removeThinkingMessage();
            messageInput.disabled = false; sendButton.disabled = false; messageInput.focus();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                let errorMsg = `Error con Gemini (${response.status})`;
                if (errorData.error && errorData.error.message) errorMsg += `: ${errorData.error.message.substring(0, 200)}`;
                addBotMessage(`${errorMsg}. Revisa la clave API y la consola.`);
                return;
            }

            const geminiResponse = await response.json();
            let nluResult = {};
            let rawNluOutput = '';
            if (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts?.[0]?.text) {
                rawNluOutput = geminiResponse.candidates[0].content.parts[0].text;
            } else {
                addBotMessage('No se pudo obtener una respuesta NLU válida de Gemini.');
                console.error('Estructura de respuesta de Gemini inesperada:', geminiResponse);
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
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                    }
                    nluResult = JSON.parse(cleanJson);
                }
            } catch (e) {
                console.error('Error al parsear JSON de Gemini:', e, 'Salida Cruda:', rawNluOutput);
                addBotMessage(`Problema procesando NLU. Crudo: ${escapeHTML(rawNluOutput.substring(0,300))}`);
                return;
            }

            const { intencion, entidades, respuesta_amigable, error_mensaje } = nluResult;
            let flowDetails = null;
            let finalBotResponse = respuesta_amigable || "Entendido.";

            if (intencion === 'intencion_desconocida' || intencion === 'desconocido' || !intencion) {
                finalBotResponse = respuesta_amigable || "Lo siento, no estoy seguro de cómo ayudarte. ¿Podrías reformularlo?";
            } else if (error_mensaje && intencion !== 'saludo' && !intencion?.startsWith('saludo_') && intencion !== 'ayuda_gastos' && !intencion?.startsWith('ayuda_')) {
                finalBotResponse = respuesta_amigable ? `${respuesta_amigable} ${error_mensaje}` : error_mensaje;
            }

            if (currentAgent === 'billetera') {
                if (intencion === 'ver_saldo') {
                    finalBotResponse = `Tu saldo actual es: ${userSimulatedData.saldo.toFixed(2)} ${userSimulatedData.moneda}.`;
                    if (INTENT_TO_FLOW_MAP[intencion]) {
                         flowDetails = { flowFileName: INTENT_TO_FLOW_MAP[intencion], flowData: { saldo: userSimulatedData.saldo, moneda: userSimulatedData.moneda }, buttonText: 'Ver Detalle Saldo (Flow)' };
                    }
                } else if (intencion === 'ver_ultimas_transacciones') {
                    // MODIFICADO: Formatear transacciones como HTML para preservar saltos de línea
                    let transaccionesHtml = (respuesta_amigable || "Aquí están tus últimas transacciones:") + "<br>";
                    const ultimasDiez = userSimulatedData.transacciones.slice(0, 10);
                    if (ultimasDiez.length === 0) {
                        transaccionesHtml += "No tienes transacciones recientes.";
                    } else {
                        ultimasDiez.forEach(t => {
                            const signo = t.tipo === 'credito' ? '🟢 +' : '🔴 -';
                            transaccionesHtml += `📅 ${t.fecha}: ${signo}${t.monto.toFixed(2)} ${userSimulatedData.moneda} (${escapeHTML(t.descripcion)})<br>`;
                        });
                    }
                    finalBotResponse = transaccionesHtml;
                    flowDetails = null; 
                }
            }

            const debeAbrirFlow = INTENT_TO_FLOW_MAP[intencion] && 
                                  (intencion !== 'saludo' && !intencion?.startsWith('saludo_')) &&
                                  (intencion !== 'ayuda_gastos' && !intencion?.startsWith('ayuda_')) &&
                                  (intencion !== 'ver_ultimas_transacciones');
            
            if (debeAbrirFlow && !(currentAgent === 'billetera' && intencion === 'ver_saldo' && flowDetails)) {
                const flowFileName = INTENT_TO_FLOW_MAP[intencion];
                const flowData = entidades || {}; 
                flowDetails = { flowFileName, flowData, buttonText: 'Abrir WhatsApp Flow' };
            }
            
            addBotMessage(finalBotResponse, { flowDetails, isHTML: (currentAgent === 'billetera' && intencion === 'ver_ultimas_transacciones') });

        } catch (error) {
            clearTimeout(timeoutId);
            removeThinkingMessage();
            let errorText = 'Error procesando tu mensaje.';
            if (error.name === 'AbortError') errorText = 'La solicitud a Gemini tardó demasiado.';
            else console.error('Error catastrófico en processUserMessageWithGemini:', error);
            addBotMessage(errorText);
            messageInput.disabled = false; sendButton.disabled = false;
        }
    }

    function addThinkingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot', 'thinking');
        messageDiv.innerHTML = `<p>...</p>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function removeThinkingMessage() {
        const thinkingMessage = chatMessages.querySelector('.message.bot.thinking');
        if (thinkingMessage) thinkingMessage.remove();
    }

    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.innerHTML = `<p>${escapeHTML(text)}</p><span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addBotMessage(textOrHtml, options = {}) {
        const { isThinking = false, flowDetails = null, isHTML = false } = options;
        if (isThinking) {
            addThinkingMessage();
            return;
        }
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        // MODIFICADO: Usar textOrHtml directamente si isHTML es true, sino escapar.
        let htmlContent = isHTML ? textOrHtml : `<p>${escapeHTML(textOrHtml)}</p>`;
        
        if (flowDetails && flowDetails.flowFileName) {
            const buttonId = `flow-button-${Date.now()}`;
            // No añadir <p> alrededor del botón si el contenido principal ya es HTML complejo.
            const buttonHtml = `<button id="${buttonId}" class="flow-trigger-button">${escapeHTML(flowDetails.buttonText || 'Abrir WhatsApp Flow')}</button>`;
            if (isHTML) {
                 // Si el contenido principal es HTML, adjuntar el botón de manera más controlada o como parte del mismo.
                 // Por simplicidad, lo añadiremos después del HTML principal, pero esto podría necesitar ajustes de estilo.
                 htmlContent += buttonHtml; 
            } else {
                htmlContent += buttonHtml;
            }
            
            setTimeout(() => {
                const buttonElement = document.getElementById(buttonId);
                if (buttonElement) buttonElement.onclick = () => showFlow(flowDetails.flowFileName, flowDetails.flowData);
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
        let src = `flows/${flowFileName}`;
        const queryParams = new URLSearchParams();
        if (flowData && typeof flowData === 'object') {
            for (const key in flowData) {
                if (Object.prototype.hasOwnProperty.call(flowData, key) && flowData[key] !== null && flowData[key] !== undefined && String(flowData[key]).trim() !== '') {
                    queryParams.append(key, String(flowData[key]));
                }
            }
        }
        if (queryParams.toString()) src += `?${queryParams.toString()}`;
        flowIframe.src = src;
        flowContainer.style.display = 'flex';
    }

    window.closeFlow = () => {
        flowIframe.src = 'about:blank';
        flowContainer.style.display = 'none';
        if (currentAgent) messageInput.focus();
    };

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    apiKeySetupDiv.style.display = 'flex';
    chatAppContainerDiv.style.display = 'none';
    messageInput.disabled = true;
    sendButton.disabled = true;
    console.log('app.js: UI inicializada.');
});

console.log('app.js: Script Finalizado.');
