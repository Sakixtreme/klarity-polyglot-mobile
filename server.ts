import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey && !apiKey.startsWith('AQ.') ? new GoogleGenAI({ apiKey }) : null;
if (!apiKey) {
  console.error('GEMINI_API_KEY no está definida; las traducciones están deshabilitadas.');
} else {
  console.log('GEMINI_API_KEY está configurada.');
}

const SUPPORTED_LANG_CODES = ['es', 'en', 'fr', 'pt', 'de', 'ja', 'zh', 'ar', 'ko', 'it', 'ru'];

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
  speakerTargetOverride,
}: {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  mode?: string;
  userLanguage?: string;
  counterpartLanguage?: string;
  speakerTargetOverride?: 'user' | 'counterpart';
}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');

  const userLang = userLanguage || 'es';
  const targetCounterpart = counterpartLanguage || 'en';

  const systemInstruction = `Eres un intérprete bidireccional de baja latencia. Idiomas permitidos: ${SUPPORTED_LANG_CODES.join(', ')}. Detecta el idioma hablado. Si está en ${userLang}, traduce directamente a ${targetCounterpart}; en otro idioma permitido, traduce a ${userLang}. No agregues introducciones ni explicaciones. Si percibes voz inteligible, nunca respondas vacío: traduce todo lo que entiendas y conserva los fragmentos inciertos de forma prudente. Responde únicamente con [CODIGO_ORIGEN]>[CODIGO_DESTINO] || [TRADUCCIÓN]. Responde exactamente NO_SPEECH solo si no hay voz inteligible.`;

  const contents: any[] = [];
  if (audioBase64) {
    const requestedMimeType = (mimeType || 'audio/webm').split(';', 1)[0].trim().toLowerCase();
    const cleanMimeType = requestedMimeType === 'audio/x-wav'
      ? 'audio/wav'
      : ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/wav'].includes(requestedMimeType)
        ? requestedMimeType
        : 'audio/webm';
    console.log('Audio recibido para traducción:', {
      bytes: Buffer.byteLength(audioBase64, 'base64'),
      mimeType: cleanMimeType,
    });

    contents.push({
      inlineData: { mimeType: cleanMimeType, data: audioBase64 },
    });
    contents.push({
      text: `Interpreta el audio completo. Devuelve [CODIGO_ORIGEN]>[CODIGO_DESTINO] || [TRADUCCIÓN]. Si no hay voz inteligible, responde NO_SPEECH.${text ? ` La transcripción automática orientativa es: "${text}".` : ''}`,
    });
  } else {
    contents.push({ text: text || '' });
  }

  let responseText = '';
  const isAqKey = apiKey.startsWith('AQ.');
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  if (isAqKey) {
    const parts: Array<Record<string, unknown>> = [{
      text: `${systemInstruction}\n\n${text ? `Contexto/transcripción: ${text}` : 'Interpreta el audio adjunto.'}`,
    }];
    if (audioBase64) {
      const audioPart = contents.find((item) => item.inlineData)?.inlineData;
      if (audioPart) parts.push({ inlineData: audioPart });
    }

    const googleResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!googleResponse.ok) {
      const errorBody = await googleResponse.text();
      console.error('Error de Gemini API:', googleResponse.status, errorBody);
      throw new Error(`Gemini API respondió ${googleResponse.status}: ${errorBody}`);
    }

    const googleData = await googleResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    responseText = googleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } else {
    if (!ai) throw new Error('GEMINI_API_KEY_MISSING');
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
      console.warn('gemini-2.5-flash falló; intentando gemini-2.0-flash:', err?.message);
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.0,
          },
        });
        responseText = fallbackResponse.text?.trim() || '';
      } catch (fallbackError: any) {
        console.error('Fallaron ambos modelos de Gemini:', fallbackError?.message);
        throw new Error(`Error en los modelos Gemini: ${fallbackError?.message || 'respuesta no disponible'}`);
      }
    }
  }

  console.log('Respuesta cruda de Gemini:', responseText);
  if (responseText.trim().toUpperCase() === 'NO_SPEECH') {
    console.log('Respuesta procesada para el cliente:', { isSilent: true });
    return { isSilent: true };
  }
  if (!responseText) {
    responseText = text?.trim() || 'No se pudo obtener una traducción del audio.';
  }

  let detectedSource = userLang;
  let detectedTarget = targetCounterpart;
  let translatedText = responseText;

  const formattedResponse = responseText.match(/^([a-z]{2})\s*>\s*([a-z]{2})\s*\|\|\s*([\s\S]+)$/i);
  if (formattedResponse) {
    detectedSource = formattedResponse[1].toLowerCase();
    detectedTarget = formattedResponse[2].toLowerCase();
    translatedText = formattedResponse[3].trim() || responseText;
  }

  const isUserSpeaking = detectedSource === userLang;

  const processedResult = {
    isSilent: false,
    detected_source_language: detectedSource,
    target_language: detectedTarget,
    mode,
    speaker_target: speakerTargetOverride || (isUserSpeaking ? 'user' : 'counterpart'),
    original_transcription: text || `[Audio ${detectedSource.toUpperCase()}]`,
    translated_subtitles: translatedText,
    ssml_or_tts_text: translatedText,
  };
  console.log('Respuesta procesada para el cliente:', processedResult);
  return processedResult;
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
      speakerTargetOverride,
    } = req.body;

    if (!text && !audioBase64) {
      return res.status(400).json({ error: 'Debes proporcionar texto o audio para interpretar.' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'Configura GEMINI_API_KEY en .env para habilitar traducciones.' });
    }

    const result = await executeTranslation({
      text,
      audioBase64,
      mimeType,
      mode,
      userLanguage,
      counterpartLanguage,
      speakerTargetOverride,
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
        speakerTargetOverride,
      } = msg;

      const startTime = Date.now();
      const result = await executeTranslation({
        text,
        audioBase64,
        mimeType,
        mode,
        userLanguage,
        counterpartLanguage,
        speakerTargetOverride,
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
    modes: ['consecutive', 'simultaneous', 'facetoface'],
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
