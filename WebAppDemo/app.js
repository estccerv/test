console.log('app.js: Script inicializado. Timestamp:', Date.now());

document.addEventListener('DOMContentLoaded', () => {
    console.log('app.js: DOMContentLoaded. Timestamp:', Date.now());

    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const agentGastosButton = document.getElementById('agent-gastos');
    const agentBilleteraButton = document.getElementById('agent-billetera');
    const agentRecargasPagosButton = document.getElementById('agent-recargas-pagos');
    const agentEscrowButton = document.getElementById('agent-escrow');
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
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
        escrowAgreements: [
            {
                id: "ESCROW123",
                status: "FONDOS_DEPOSITADOS",
                descripcion_bien_servicio: "Laptop Gamer AlienFX",
                monto: 1200,
                moneda: "USD",
                iniciador_nombre: "Carlos V.",
                contraparte_nombre: "Ana R.",
                fecha_creacion: "2024-07-25",
                ultima_actualizacion: "2024-07-28"
            }
        ]
    };

    const PROMPTS = {
        gastos: `Eres un asistente amigable para una aplicación de seguimiento de gastos por WhatsApp.
Tu tarea principal es analizar la solicitud del usuario para registrar un gasto y extraer los datos relevantes.
Formatea la respuesta estrictamente como un objeto JSON.

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
  "respuesta_amigable": "Entendido. Voy a registrarlo. Completa los detalles en el Flow.",
  "error_mensaje": null
}
${"```"}
`,
        billetera: `Eres un asistente NLU amigable para una billetera electrónica en WhatsApp.
Intenciones Posibles: crear_cuenta, ver_saldo, cargar_saldo, etc.
Formato de Salida Estricto (JSON).

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
`,
        recargas_pagos: `Eres un asistente NLU amigable para un servicio de Recargas y Pagos en WhatsApp.
Intenciones: recargar_tiempo_aire, pagar_servicio_basico, etc.
Formato de Salida Estricto (JSON).

Usuario: "quiero pagar la luz con referencia 12345"
Salida:
${"```json"}
{
  "intencion": "pagar_servicio_basico",
  "entidades": {"tipo_servicio_basico": "luz", "referencia_pago": "12345"},
  "respuesta_amigable": "Entendido, pagar servicio de luz. Completa los detalles en el Flow.",
  "error_mensaje": null
}
${"```"}
`,
        escrow: `Eres un asistente NLU avanzado y amigable para un servicio de Pagos Escrow por WhatsApp. Tu función es interpretar la solicitud del usuario para iniciar, gestionar o consultar acuerdos de escrow, guiándolo de forma conversacional.
Si el usuario simplemente saluda (ej. "hola", "buenas"), responde amablemente y ofrece ayuda específica para escrow.
Si el usuario pregunta qué puedes hacer (ej. "ayuda", "¿qué haces?"), explica brevemente las funciones principales de escrow que manejas.
Si la intención no es clara o es muy genérica, intenta clarificar o guiar al usuario.

Intenciones Principales Posibles:
- crear_acuerdo_escrow (Ej: "quiero crear un acuerdo con @vendedor para un laptop de 500 USD")
- revisar_acuerdo_escrow (Ej: "revisar el acuerdo ESCROW123")
- depositar_fondos_escrow (Ej: "pagar el acuerdo ESCROW123")
- confirmar_recepcion_escrow (Ej: "ya recibí el producto del acuerdo ESCROW123")
- iniciar_disputa_escrow (Ej: "tengo un problema con ESCROW123")
- ver_estado_escrow (Ej: "cómo va mi acuerdo ESCROW123?")
- saludo_escrow
- ayuda_escrow
- intencion_desconocida

Entidades Clave a Extraer (según la intención):
- acuerdo_id (el ID único del acuerdo escrow)
- monto (solo el número)
- moneda (ej. USD, EUR, MXN)
- descripcion_bien_servicio
- identificador_contraparte (ej: número de teléfono, email, o @usuario)
- motivo_disputa, detalles_disputa

Formato de Salida Estricto (JSON):
Devuelve un objeto JSON con "intencion", "entidades" (con las entidades extraídas), "respuesta_amigable", y "error_mensaje".
"respuesta_amigable" debe ser una frase completa y amable. Si se va a abrir un Flow, debe indicarlo. Si faltan datos para una acción, debe pedirlos amablemente.
"error_mensaje" es para cuando faltan datos cruciales y la "respuesta_amigable" ya intenta obtenerlos pero se quiere ser más explícito o es un error técnico.

Ejemplos Detallados:

Usuario: "Hola"
Salida:
${"```json"}
{
  "intencion": "saludo_escrow",
  "entidades": {},
  "respuesta_amigable": "¡Hola! Soy tu asistente de Pagos Escrow. ¿Cómo puedo ayudarte hoy? ¿Quizás crear un nuevo acuerdo o consultar uno existente?",
  "error_mensaje": null
}
${"```"}

Usuario: "Ayuda"
Salida:
${"```json"}
{
  "intencion": "ayuda_escrow",
  "entidades": {},
  "respuesta_amigable": "Claro. Puedo ayudarte a crear acuerdos de pago seguro (escrow), revisar propuestas, depositar fondos, confirmar la recepción de bienes/servicios, iniciar disputas si algo sale mal, o ver el estado de tus transacciones escrow. ¿Qué te gustaría hacer?",
  "error_mensaje": null
}
${"```"}

Usuario: "Quiero hacer un pago seguro"
Salida:
${"```json"}
{
  "intencion": "crear_acuerdo_escrow",
  "entidades": {},
  "respuesta_amigable": "Entendido, quieres crear un acuerdo de pago seguro (escrow). Para comenzar, necesitaré algunos detalles: ¿Con quién es el acuerdo (su teléfono o email)?, ¿Cuál es el bien o servicio involucrado?, y ¿Cuál es el monto y la moneda del acuerdo? Luego te guiaré para completar la información en un formulario seguro de WhatsApp.",
  "error_mensaje": "Faltan detalles para crear el acuerdo (contraparte, descripción, monto)."
}
${"```"}

Usuario: "Crear un acuerdo con Juan Pérez para un servicio de diseño por 300 EUR"
Salida:
${"```json"}
{
  "intencion": "crear_acuerdo_escrow",
  "entidades": {
    "identificador_contraparte": "Juan Pérez",
    "descripcion_bien_servicio": "servicio de diseño",
    "monto": 300,
    "moneda": "EUR"
  },
  "respuesta_amigable": "Entendido. Vamos a crear un acuerdo escrow con Juan Pérez para un servicio de diseño por 300 EUR. Por favor, completa los detalles adicionales en el formulario de WhatsApp que se abrirá.",
  "error_mensaje": null
}
${"```"}

Usuario: "Consultar estado de ESCROWID789"
Salida:
${"```json"}
{
  "intencion": "ver_estado_escrow",
  "entidades": {
    "acuerdo_id": "ESCROWID789"
  },
  "respuesta_amigable": "Consultando el estado del acuerdo ESCROWID789. Un momento...",
  "error_mensaje": null
}
${"```"}

Usuario: "Pagar el acuerdo ESCROWID789"
Salida:
${"```json"}
{
  "intencion": "depositar_fondos_escrow",
  "entidades": {
    "acuerdo_id": "ESCROWID789"
  },
  "respuesta_amigable": "De acuerdo, vamos a proceder con el depósito de fondos para el acuerdo ESCROWID789. Te mostraré el formulario para completar el pago.",
  "error_mensaje": null
}
${"```"}

Usuario: "Ya me llegó la laptop del trato EXTORDER555"
Salida:
${"```json"}
{
  "intencion": "confirmar_recepcion_escrow",
  "entidades": {
    "acuerdo_id": "EXTORDER555",
    "descripcion_bien_servicio": "laptop"
  },
  "respuesta_amigable": "¡Excelente! Vamos a confirmar la recepción de la laptop para el acuerdo EXTORDER555. Por favor, usa el formulario para confirmar.",
  "error_mensaje": null
}
${"```"}

Usuario: "No sé qué hacer"
Salida:
${"```json"}
{
  "intencion": "ayuda_escrow",
  "entidades": {},
  "respuesta_amigable": "No te preocupes. Estoy aquí para ayudarte con pagos escrow. Puedes decirme si quieres crear un nuevo acuerdo, verificar uno que ya tienes, o quizás hacer un pago. ¿Qué tienes en mente?",
  "error_mensaje": null
}
${"```"}

Usuario: "blablabla algo sin sentido"
Salida:
${"```json"}
{
  "intencion": "intencion_desconocida",
  "entidades": {},
  "respuesta_amigable": "Lo siento, no entendí muy bien. ¿Podrías reformularlo? Recuerda que te puedo ayudar con la creación, consulta o gestión de pagos escrow.",
  "error_mensaje": null
}
${"```"}
`
    };
    console.log('app.js: PROMPTS object defined.');

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
        'crear_acuerdo_escrow': 'escrow/flow_escrow_create_agreement.html',
        'revisar_acuerdo_escrow': 'escrow/flow_escrow_review_agreement.html',
        'depositar_fondos_escrow': 'escrow/flow_escrow_fund.html',
        'confirmar_recepcion_escrow': 'escrow/flow_escrow_buyer_confirmation.html',
        'iniciar_disputa_escrow': 'escrow/flow_escrow_initiate_dispute.html',
        'ver_estado_escrow': 'escrow/flow_escrow_view_status.html',
    };

    // Renamed from setSettingsAndStart, simplified
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
        console.log('app.js: API Key guardada.');
    };

    window.selectAgent = (agent) => {
        console.log('app.js: selectAgent called with:', agent);
        currentAgent = agent;
        messageInput.disabled = false;
        sendButton.disabled = false;
        chatMessages.innerHTML = '';
        closeFlow();
        [agentGastosButton, agentBilleteraButton, agentRecargasPagosButton, agentEscrowButton].forEach(btn => {
            if(btn) btn.classList.remove('active');
        });
        let greetingMessage = 'Hola, soy tu Asistente. ¿En qué puedo ayudarte?';
        if (agent === 'gastos') {
            currentAgentFullName = '🤖 Bot de Gastos (Gemini)';
            chatAvatar.textContent = '💸';
            if(agentGastosButton) agentGastosButton.classList.add('active');
            greetingMessage = 'Hola, soy el Bot de Gastos. ¿Qué gasto deseas registrar hoy?';
        } else if (agent === 'billetera') {
            currentAgentFullName = '💳 Bot de Billetera (Gemini)';
            chatAvatar.textContent = '🏦';
            if(agentBilleteraButton) agentBilleteraButton.classList.add('active');
            greetingMessage = 'Hola, soy el Bot de Billetera. ¿Qué operación deseas realizar?';
        } else if (agent === 'recargas_pagos') {
            currentAgentFullName = '🔌 Bot de Recargas y Pagos (Gemini)';
            chatAvatar.textContent = '💡';
            if(agentRecargasPagosButton) agentRecargasPagosButton.classList.add('active');
            greetingMessage = 'Hola, soy tu Agente de Recargas y Pagos. ¿Qué deseas hacer?';
        } else if (agent === 'escrow') {
            currentAgentFullName = '🛡️ Bot Pagos Escrow (Gemini)';
            chatAvatar.textContent = '🛡️';
            if(agentEscrowButton) agentEscrowButton.classList.add('active');
            greetingMessage = 'Hola, soy el Bot de Pagos Escrow. ¿Qué deseas hacer hoy?';
        }
        chatAgentName.textContent = currentAgentFullName;
        addBotMessage(greetingMessage);
        messageInput.focus();
        console.log('app.js: currentAgent set to:', currentAgent);
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
        console.log('app.js: processUserMessageWithGemini for agent:', currentAgent);
        const selectedPrompt = PROMPTS[currentAgent];
        if (!selectedPrompt) {
            addBotMessage('Error: No hay un prompt configurado para este agente.');
            console.error('Error crítico: Prompt no encontrado para agente:', currentAgent);
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
                addBotMessage(`Error con Gemini (${response.status}): ${errorData.error?.message || response.statusText}.`);
                return;
            }

            const geminiResponse = await response.json();
            let nluResult = {};
            let rawNluOutput = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

            try {
                const jsonMatch = rawNluOutput.match(/```json\s*([\s\S]+?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    nluResult = JSON.parse(jsonMatch[1]);
                } else {
                    let cleanJson = rawNluOutput.trim();
                    if (cleanJson.startsWith('```') && cleanJson.endsWith('```')) {
                        cleanJson = cleanJson.substring(3, cleanJson.length - 3);
                    }
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
            let isHTMLResponse = false;

            if (intencion === 'intencion_desconocida' || !intencion) {
                finalBotResponse = respuesta_amigable || "Lo siento, no estoy seguro de cómo ayudarte.";
            } else if (error_mensaje && !intencion?.startsWith('saludo_') && !intencion?.startsWith('ayuda_')) {
                finalBotResponse = respuesta_amigable ? `${respuesta_amigable} ${error_mensaje}` : error_mensaje;
            }

            if (currentAgent === 'billetera') {
                if (intencion === 'ver_saldo') {
                    finalBotResponse = `Tu saldo actual es: ${userSimulatedData.saldo.toFixed(2)} ${userSimulatedData.moneda}.`;
                    if (INTENT_TO_FLOW_MAP[intencion]) {
                         flowDetails = { flowFileName: INTENT_TO_FLOW_MAP[intencion], flowData: { saldo: userSimulatedData.saldo, moneda: userSimulatedData.moneda }, buttonText: 'Ver Detalle Saldo (Flow)' };
                    }
                } else if (intencion === 'ver_ultimas_transacciones') {
                    let transaccionesHtml = (respuesta_amigable || "Aquí están tus últimas transacciones:") + "<br>";
                    userSimulatedData.transacciones.slice(0, 10).forEach(t => {
                        transaccionesHtml += `📅 ${t.fecha}: ${t.tipo === 'credito' ? '🟢 +' : '🔴 -'}${t.monto.toFixed(2)} ${userSimulatedData.moneda} (${escapeHTML(t.descripcion)})<br>`;
                    });
                    finalBotResponse = transaccionesHtml;
                    isHTMLResponse = true;
                    flowDetails = null;
                }
            } else if (currentAgent === 'escrow') {
                 if (intencion === 'ver_estado_escrow' && entidades && entidades.acuerdo_id) {
                    const acuerdo = userSimulatedData.escrowAgreements.find(a => a.id === entidades.acuerdo_id);
                    finalBotResponse = acuerdo ? `Estado de ${escapeHTML(acuerdo.id)}: **${escapeHTML(acuerdo.status)}**.` : `No encontré acuerdo ${escapeHTML(entidades.acuerdo_id)}.`;
                 }
            }

            const debeAbrirFlow = INTENT_TO_FLOW_MAP[intencion] && !intencion?.startsWith('saludo_') && !intencion?.startsWith('ayuda_') && intencion !== 'ver_ultimas_transacciones';

            if (debeAbrirFlow) {
                if (!flowDetails) {
                    const flowFileName = INTENT_TO_FLOW_MAP[intencion];
                    let flowData = entidades || {};
                    if (currentAgent === 'escrow' && entidades && entidades.acuerdo_id) {
                        const acuerdo = userSimulatedData.escrowAgreements.find(a => a.id === entidades.acuerdo_id);
                        if (acuerdo) flowData = { ...flowData, ...acuerdo }; // Merge acuerdo data if found
                    }
                    flowDetails = { flowFileName, flowData, buttonText: 'Abrir Formulario WhatsApp' };
                }
            }
            addBotMessage(finalBotResponse, { flowDetails, isHTML: isHTMLResponse });
        } catch (error) {
            clearTimeout(timeoutId);
            removeThinkingMessage();
            addBotMessage(error.name === 'AbortError' ? 'La solicitud a Gemini tardó demasiado.' : 'Error procesando tu mensaje.');
            console.error('Error en processUserMessageWithGemini:', error);
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
        let htmlContent = isHTML ? textOrHtml : `<p>${escapeHTML(textOrHtml)}</p>`;

        if (flowDetails && flowDetails.flowFileName) {
            const buttonId = `flow-button-${Date.now()}`;
            const buttonHtml = `<button id="${buttonId}" class="flow-trigger-button">${escapeHTML(flowDetails.buttonText || 'Abrir WhatsApp Flow')}</button>`;
            htmlContent += buttonHtml;
            
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
        // Siempre usa el modo placeholder por ahora, cargando el HTML directamente.
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
        console.log('app.js: Showing flow (Placeholder Mode):', src, 'with data:', flowData);
        const flowTitleDisplay = document.getElementById('flow-title-display');
        if(flowTitleDisplay) flowTitleDisplay.textContent = flowFileName.replace('.html', '').replace(/_/g, ' ').replace('escrow/', '').toUpperCase();
        flowIframe.src = src;
        flowContainer.style.display = 'flex';
    }

    window.closeFlow = () => {
        flowIframe.src = 'about:blank';
        flowContainer.style.display = 'none';
        if (currentAgent) messageInput.focus();
    };

    function escapeHTML(str) {
        if (typeof str !== 'string') return String(str);
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    apiKeySetupDiv.style.display = 'flex';
    chatAppContainerDiv.style.display = 'none';
    messageInput.disabled = true;
    sendButton.disabled = true;
    console.log('app.js: UI inicializada. Esperando clave API.');
});

console.log('app.js: Script Finalizado. Timestamp:', Date.now());