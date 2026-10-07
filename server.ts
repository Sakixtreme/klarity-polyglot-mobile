import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SUPPORTED_LANG_CODES = ['es', 'en', 'fr', 'pt', 'de', 'ja', 'zh', 'ar', 'ko', 'it', 'ru'];

// Store last detected external language in memory for continuous session flow
let lastDetectedExternalLanguage: string = 'en';

/**
 * Core Translation Executor using Google 3.5 Translate / Flash Preview
 * Optimized for minimal latency (ThinkingLevel.MINIMAL, temperature 0.0)
 */
async function executeTranslation({
  text,
  audioBase64,
  mimeType,
  mode = 'consecutive',
  userLanguage = 'es',
  counterpartLanguage = 'en',
}: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  mode?: string;
  userLanguage?: string;
  counterpartLanguage?: string;
}) {
  if (!ai) throw new Error('GEMINI_API_KEY_MISSING');

  const userLang = userLanguage || 'es';
  const targetCounterpart = counterpartLanguage || 'en';

  const systemInstruction = `# ROL Y MISIÓN
Eres el motor ultrarrápido de interpretación bidireccional en tiempo real para la aplicación "Klarity Consecutiva". Tu prioridad absoluta es la mínima latencia y la precisión inmediata sin frases introductorias ni rellenos.

# REGLA ESTRICTA DE SILENCIO (NO RUIDO NI ALUCINACIONES)
Si la entrada contiene únicamente silencio, murmullos incomprensibles, respiración o ruido de fondo de reunión, responde estrictamente:
NO_SPEECH

# IDIOMAS COMPATIBLES (11)
Español (es), Inglés (en), Francés (fr), Portugués (pt), Alemán (de), Japonés (ja), Chino Mandarín (zh), Árabe (ar), Coreano (ko), Italiano (it), Ruso (ru).

# FORMATO DE SALIDA (ULTRA-LIGERO)
Responde EXCLUSIVAMENTE con una sola línea delimitada por "||":
[CODIGO_ORIGEN]>[CODIGO_DESTINO] || [TRADUCCIÓN_DIRECTA]`;

  const contents: any[] = [];
  if (audioBase64) {
    let cleanMimeType = mimeType || 'audio/webm';
    if (cleanMimeType.includes('mp4') || cleanMimeType.toLowerCase().includes('aac')) cleanMimeType = 'audio/mp4';
    else if (cleanMimeType.includes('wav')) cleanMimeType = 'audio/wav';

    contents.push({
      inlineData: { mimeType: cleanMimeType, data: audioBase64 },
    });
    contents.push({
      text: 'Interpreta de inmediato el audio en formato [CODIGO_ORIGEN]>[CODIGO_DESTINO] || [TRADUCCIÓN_DIRECTA]. Si solo hay ruido o silencio responde NO_SPEECH.',
    });
  } else {
    contents.push({ text: text || '' });
  }

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.0,
      },
    });
    responseText = response.text?.trim() || '';
  } catch (err: any) {
    console.warn('Fallback a gemini-2.0-flash:', err?.message);
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.0,
      },
    });
    responseText = fallbackResponse.text?.trim() || '';
  }

  if (!responseText || responseText.includes('NO_SPEECH') || responseText.length < 2) {
    return { isSilent: true };
  }

  let detectedSource = userLang;
  let detectedTarget = targetCounterpart;
  let translatedText = responseText;

  if (responseText.includes('||')) {
    const parts = responseText.split('||');
    const langPart = parts[0].trim();
    translatedText = parts.slice(1).join('||').trim();
    const langMatch = langPart.match(/([a-z]{2})\s*>\s*([a-z]{2})/i);
    if (langMatch) {
      detectedSource = langMatch[1].toLowerCase();
      detectedTarget = langMatch[2].toLowerCase();
    }
  }

  const isUserSpeaking = detectedSource === userLang;

  return {
    isSilent: false,
    detected_source_language: detectedSource,
    target_language: detectedTarget,
    mode,
    speaker_target: isUserSpeaking ? 'user' : 'counterpart',
    original_transcription: text || `[Audio ${detectedSource.toUpperCase()}]`,
    translated_subtitles: translatedText,
    ssml_or_tts_text: translatedText,
  };
}

// HTTP Translation endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const {
      text,
      audioBase64,
      mimeType,
      mode = 'consecutive',
      userLanguage = 'es',
      counterpartLanguage = 'en',
    } = req.body;

    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'Debes proporcionar texto o audio para interpretar.' });
    }
    if (!ai) {
      return res.status(503).json({ error: 'Configura GEMINI_API_KEY en .env para habilitar traducciones.' });
    }

    const result = await executeTranslation({
      text,
      audioBase64,
      mimeType,
      mode,
      userLanguage,
      counterpartLanguage,
    });

    if (!result || result.isSilent) return res.json({ isSilent: true });
    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/translate:', error);
    if (error?.message === 'GEMINI_API_KEY_MISSING') {
      return res.status(503).json({ error: 'Configura GEMINI_API_KEY en .env para habilitar traducciones.' });
    }
    return res.status(500).json({
      error: 'Error interno en el motor de interpretación: ' + (error?.message || 'Error desconocido'),
    });
  }
});

// WebSocket Server for Ultra-low latency streaming
const wss = new WebSocketServer({ server, path: '/api/ws-translate' });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', async (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      const {
        requestId,
        text,
        audioBase64,
        mimeType,
        mode,
        userLanguage,
        counterpartLanguage,
      } = msg;

      const startTime = Date.now();
      const result = await executeTranslation({
        text,
        audioBase64,
        mimeType,
        mode,
        userLanguage,
        counterpartLanguage,
      });

      if (!result || result.isSilent) {
        ws.send(JSON.stringify({ requestId, isSilent: true }));
        return;
      }
      const latencyMs = Date.now() - startTime;
      ws.send(
        JSON.stringify({
          requestId,
          type: 'result',
          result: {
            ...result,
            durationMs: latencyMs,
          },
        })
      );
    } catch (e: any) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: e?.message || 'Error en streaming de traducción',
        })
      );
    }
  });
});

// Speech synthesis is performed by the browser so playback can start without another model request.
app.post('/api/tts', async (req: Request, res: Response) => {
  if (!req.body?.text) return res.status(400).json({ error: 'Se requiere texto para síntesis de voz.' });
  return res.json({ fallbackToWebSpeech: true });
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    configured: Boolean(apiKey),
    languages: SUPPORTED_LANG_CODES,
    modes: ['consecutive'],
    model: 'gemini-2.5-flash',
    streaming: 'WebSocket (/api/ws-translate)',
    version: '1.2.0',
  });
});

// Vite or static serving
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
}

setupViteOrStatic().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Klarity Polyglot engine with WebSocket streaming running on http://localhost:${PORT}`);
  });
});
