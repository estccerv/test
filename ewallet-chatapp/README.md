# E-Wallet ChatApp Demo para WhatsApp

Este proyecto simula una billetera electrónica (e-wallet) que funciona a través de una interfaz de chat en WhatsApp.
El objetivo principal de este demo es:
1.  Demostrar la capacidad de un modelo de Lenguaje Natural (NLU) como Gemini para entender las intenciones del usuario relacionadas con operaciones de una billetera.
2.  Visualizar, mediante archivos HTML simples, cómo se podrían estructurar los WhatsApp Flows para cada una de estas operaciones.

## Funcionalidades Simuladas

*   Creación de cuenta y definición de Pincode.
*   Consulta de saldo.
*   Carga de saldo.
*   Retiro de saldo.
*   Transferencia de montos a otros usuarios.
*   Solicitud de pagos a otros usuarios.
*   Aceptación de pagos (simulada).
*   Definición/cambio de Pincode de operaciones.
*   Ayuda general.

## Estructura del Demo

*   `/gemini_prompts`: Contiene el prompt diseñado para que Gemini entienda las intenciones del usuario para la billetera.
*   `/PreviewTesting`: Contiene los archivos para ejecutar una prueba local:
    *   `ewallet_test_nlu_local.js`: Un script de Node.js para ingresar frases y ver la intención y entidades extraídas por Gemini. También indicará qué Flow HTML se debería mostrar.
    *   `/flows_html/`: Contiene los archivos HTML que simulan la interfaz de los WhatsApp Flows. Estos se abren manualmente en un navegador para visualización.

## Importante

Este es un **demo de frontend y NLU**. No incluye:
*   Backend real para procesar transacciones.
*   Conexión a bases de datos para almacenar usuarios, saldos o Pincodes.
*   Integración real con la API de WhatsApp.
*   Mecanismos de seguridad reales para el Pincode o las transacciones.

El script de prueba NLU requerirá una clave API de Google AI (Gemini) para funcionar.
