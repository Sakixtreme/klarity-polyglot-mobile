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
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: options.text,
          audioBase64: options.audioBase64,
          mimeType: options.mimeType,
          mode: options.mode || 'consecutive',
          userLanguage: options.userLanguage,
          counterpartLanguage: options.counterpartLanguage,
          lastExternalLanguage: options.lastExternalLanguage,
          speakerTargetOverride: options.speakerTargetOverride,
          windowSeconds: options.windowSeconds,
        }),
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
