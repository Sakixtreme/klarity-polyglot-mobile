/**
 * Ultra-fast and reliable Translation Client (Optimized for Android & iOS mobile networks)
 * Uses robust HTTP POST for 100% reliability across all mobile browsers and networks.
 */
import { InterpretationResult, SupportedLanguage } from '../types/interpreter';

export interface StreamTranslateOptions {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  mode?: 'consecutive' | 'simultaneous';
  userLanguage: SupportedLanguage;
  counterpartLanguage: SupportedLanguage;
  lastExternalLanguage?: string;
  speakerTargetOverride?: 'user' | 'counterpart';
  windowSeconds?: number | null;
  onChunk?: (partial: string) => void;
  onNoSpeech?: () => void;
  onResult: (result: InterpretationResult) => void;
  onError: (err: any) => void;
}

class TranslationClient {
  public async connect(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public async translate(options: StreamTranslateOptions): Promise<void> {
    if (typeof WebSocket === 'undefined') {
      await this.translateHttp(options);
      return;
    }

    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const websocketUrl = new URL('/api/ws-translate', window.location.href);
    websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    await new Promise<void>((resolve) => {
      let completed = false;
      let fallbackStarted = false;
      let timeout: ReturnType<typeof setTimeout>;
      let socket: WebSocket;

      const finish = () => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        try { socket.close(); } catch {}
        resolve();
      };

      const fallbackToHttp = () => {
        if (completed || fallbackStarted) return;
        fallbackStarted = true;
        clearTimeout(timeout);
        try { socket.close(); } catch {}
        void this.translateHttp(options).finally(finish);
      };

      try {
        socket = new WebSocket(websocketUrl);
      } catch {
        void this.translateHttp(options).finally(finish);
        return;
      }

      timeout = setTimeout(fallbackToHttp, 10000);
      socket.onopen = () => {
        try {
          socket.send(JSON.stringify({ requestId, ...this.requestBody(options) }));
        } catch {
          fallbackToHttp();
        }
      };
      socket.onmessage = (event) => {
        if (completed || fallbackStarted) return;
        try {
          const message = JSON.parse(event.data as string);
          if (message.requestId && message.requestId !== requestId) return;
          if (message.isSilent) {
            options.onNoSpeech?.();
            finish();
          } else if (message.type === 'result' && message.result) {
            options.onResult(message.result as InterpretationResult);
            finish();
          } else if (message.type === 'error') {
            fallbackToHttp();
          }
        } catch {
          fallbackToHttp();
        }
      };
      socket.onerror = fallbackToHttp;
      socket.onclose = () => {
        if (!completed) fallbackToHttp();
      };
    });
  }

  private requestBody(options: StreamTranslateOptions) {
    return {
      text: options.text,
      audioBase64: options.audioBase64,
      mimeType: options.mimeType,
      mode: options.mode || 'consecutive',
      userLanguage: options.userLanguage,
      counterpartLanguage: options.counterpartLanguage,
      lastExternalLanguage: options.lastExternalLanguage,
      speakerTargetOverride: options.speakerTargetOverride,
      windowSeconds: options.windowSeconds,
    };
  }

  private async translateHttp(options: StreamTranslateOptions): Promise<void> {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.requestBody(options)),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al traducir');
      }

      const result: InterpretationResult & { isSilent?: boolean; no_speech?: boolean } = await res.json();
      if (result.isSilent || result.no_speech) {
        options.onNoSpeech?.();
        return;
      }
      options.onResult(result);
    } catch (err: any) {
      options.onError(err);
    }
  }
}

export const wsTranslationClient = new TranslationClient();
