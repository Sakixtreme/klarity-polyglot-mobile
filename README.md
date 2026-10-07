# Klarity Polyglot

Intérprete consecutivo móvil basado en el prototipo creado en Google AI Studio. Incluye una interfaz React 19, servidor Express, Gemini 2.5 Flash, detección de voz y un endpoint WebSocket.

## Requisitos

- Node.js 20.19 o posterior
- Una API key de Gemini

## Desarrollo local

```powershell
Copy-Item .env.example .env
```

Añade tu clave real a `GEMINI_API_KEY` en `.env`; no la publiques ni la añadas al control de versiones. Después ejecuta:

```powershell
npm install
npm run dev
```

Abre http://localhost:3000. El mismo proceso sirve la interfaz Vite, la API Express y `/api/ws-translate`.

## Comprobaciones

```powershell
npm run lint
npm run build
```

El modo de síntesis utiliza las voces disponibles en el navegador. El modo automático estima el tono del hablante y no identifica su género de forma fiable.
