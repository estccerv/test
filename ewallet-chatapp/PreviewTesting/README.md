# Pruebas Locales del Demo de E-Wallet

Esta carpeta contiene los archivos para probar la lógica de NLU y visualizar los Flows simulados para la billetera electrónica.

## Archivos

1.  **`ewallet_test_nlu_local.js`**:
    *   Un script de Node.js para probar la lógica de Extracción de Lenguaje Natural (NLU) con Gemini, específicamente para las intenciones de la billetera electrónica.
    *   **Cómo usarlo**:
        1.  Asegúrate de tener Node.js instalado.
        2.  Necesitas una **clave API de Google AI (para Gemini)**. Consigue una desde [Google AI Studio](https://aistudio.google.com/app/apikey).
        3.  Establece tu clave API como una variable de entorno. En tu terminal, antes de ejecutar el script, usa:
            `export GOOGLE_API_KEY="TU_CLAVE_API_AQUI"`
            (Reemplaza `TU_CLAVE_API_AQUI` con tu clave real).
            **No guardes tu clave API directamente en el script.**
        4.  Instala las dependencias (si es la primera vez o si `package.json` cambió):
            Navega a esta carpeta (`ewallet-chatapp/PreviewTesting`) en tu terminal y ejecuta `npm install`.
        5.  Ejecuta el script: `node ewallet_test_nlu_local.js`
    *   **Propósito**: Ingresar frases de usuario (ej. "quiero ver mi saldo", "enviar 50 a Juan") y ver la intención y entidades que Gemini extrae. El script también sugerirá qué archivo HTML de Flow corresponde a la intención.

2.  **`/flows_html/`** (Carpeta):
    *   Contiene archivos HTML que simulan visualmente los WhatsApp Flows para cada operación de la billetera.
    *   **Cómo usarlos**: Abre cada archivo `.html` directamente en tu navegador web.
    *   **Propósito**: Visualizar cómo podría ser la interfaz de usuario estructurada dentro de WhatsApp para cada acción. Estos son solo visuales y no funcionales.

## Flujo de Prueba Sugerido

1.  Configura tu `GOOGLE_API_KEY`.
2.  Ejecuta `npm install` en esta carpeta si no lo has hecho.
3.  Ejecuta `node ewallet_test_nlu_local.js`.
4.  Ingresa diferentes comandos de usuario para la billetera.
5.  Observa la intención detectada por el script.
6.  Si el script sugiere un Flow HTML, ábrelo desde la carpeta `flows_html/` en tu navegador para ver la simulación visual.
