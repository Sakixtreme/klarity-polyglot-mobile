import type { VoiceGender } from '../types/interpreter';

/**
 * Audio Recording, Waveform Analysis, and TTS utilities (Universal iOS & Android Cross-Browser Optimization)
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private timeDomainArray: Uint8Array<ArrayBuffer> | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
    } catch (err: any) {
      throw new Error('Permiso de micrófono denegado o no disponible en este navegador.');
    }

    // Setup Analyser with iOS WebKit AudioContext resume support
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        this.audioContext = new AudioContextClass();
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.timeDomainArray = new Uint8Array(this.analyser.fftSize);
      } catch {}
    }

    // Setup MediaRecorder with robust cross-browser iOS / Android MIME support
    let mimeType = 'audio/webm';
    try {
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }
    } catch {
      mimeType = '';
    }

    try {
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    try {
      this.mediaRecorder.start(150);
    } catch (e) {
      this.mediaRecorder.start();
    }
  }

  getAudioLevels(): number[] {
    if (!this.analyser || !this.dataArray) {
      return [10, 18, 25, 40, 30, 20, 15, 8];
    }
    try {
      (this.analyser as any).getByteFrequencyData(this.dataArray);
      const levels: number[] = [];
      const step = Math.max(1, Math.floor(this.dataArray.length / 8));
      for (let i = 0; i < 8; i++) {
        const idx = i * step;
        levels.push(this.dataArray[idx] || 0);
      }
      return levels;
    } catch {
      return [10, 18, 25, 40, 30, 20, 15, 8];
    }
  }

  getAverageVolume(): number {
    if (!this.analyser || !this.timeDomainArray) {
      return 0;
    }
    try {
      this.analyser.getByteTimeDomainData(this.timeDomainArray);
      let sum = 0;
      for (const sample of this.timeDomainArray) {
        const centered = sample - 128;
        sum += centered * centered;
      }
      return Math.sqrt(sum / this.timeDomainArray.length);
    } catch {
      return 0;
    }
  }

  getEstimatedPitch(): number | null {
    if (!this.analyser || !this.dataArray || !this.audioContext) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    const sampleRate = this.audioContext.sampleRate;
    const minBin = Math.ceil(75 * this.analyser.fftSize / sampleRate);
    const maxBin = Math.min(this.dataArray.length - 1, Math.floor(360 * this.analyser.fftSize / sampleRate));
    let peakBin = minBin;
    for (let bin = minBin + 1; bin <= maxBin; bin++) {
      if (this.dataArray[bin] > this.dataArray[peakBin]) peakBin = bin;
    }
    if (this.dataArray[peakBin] < 24) return null;
    return peakBin * sampleRate / this.analyser.fftSize;
  }

  async stop(): Promise<{ blob: Blob; base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder not initialized'));
      }

      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/mp4';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result ? (result.split(',')[1] || '') : '';
          this.cleanup();
          resolve({
            blob: audioBlob,
            base64: base64Data,
            mimeType,
          });
        };
        reader.onerror = (err) => {
          this.cleanup();
          reject(err);
        };
        reader.readAsDataURL(audioBlob);
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          this.cleanup();
          reject(new Error('Recorder was already inactive'));
        }
      } catch (e) {
        this.cleanup();
        reject(e);
      }
    });
  }

  private cleanup() {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.timeDomainArray = null;
  }
}

/**
 * Text-to-Speech synthesis coordinator
 * Guarantees STRICT single-audio playback with atomic cancellation and epoch tracking
 */
const activeAudioPool = new Set<HTMLAudioElement>();
let ttsEpoch = 0;
let isAudioCurrentlyLoading = false;
let currentPlayingText: string | null = null;
let currentAbortController: AbortController | null = null;

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  currentText: string | null;
}

const ttsListeners = new Set<(state: TTSState) => void>();

function notifyTTSState() {
  const isPlaying = currentPlayingText !== null;
  const state: TTSState = {
    isPlaying,
    isLoading: isAudioCurrentlyLoading,
    currentText: currentPlayingText,
  };
  ttsListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error('Error in TTS state listener', e);
    }
  });
}

export function subscribeTTSState(listener: (state: TTSState) => void): () => void {
  ttsListeners.add(listener);
  listener({
    isPlaying: currentPlayingText !== null,
    isLoading: isAudioCurrentlyLoading,
    currentText: currentPlayingText,
  });
  return () => {
    ttsListeners.delete(listener);
  };
}

export function isTTSPlaying(text?: string): boolean {
  if (text) {
    return currentPlayingText === text;
  }
  return currentPlayingText !== null;
}

export function isTTSLoading(text?: string): boolean {
  if (text) {
    return isAudioCurrentlyLoading && currentPlayingText === text;
  }
  return isAudioCurrentlyLoading;
}

export function getCurrentPlayingText(): string | null {
  return currentPlayingText;
}

/**
 * Stop any and all currently playing or loading audio across the entire application
 */
export function stopTTS(): void {
  ttsEpoch++; // Invalidate any pending network requests or timeouts
  isAudioCurrentlyLoading = false;

  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch {}
    currentAbortController = null;
  }

  // Stop and destroy all HTMLAudioElement instances
  activeAudioPool.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    } catch {}
  });
  activeAudioPool.clear();

  // Cancel Web Speech API
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  currentPlayingText = null;
  notifyTTSState();
}

/**
 * Play TTS audio with monotonic epoch validation at normal speed (rate = 1.0).
 */
/**
 * Play TTS audio instantly using browser Web Speech API for zero-latency voice output.
 */
export async function playTTS(
  text: string,
  targetLang: string,
  options?: {
    useGeminiNeural?: boolean;
    voiceName?: string;
    rate?: number;
    voiceGender?: VoiceGender;
    detectedPitch?: number | null;
    onEnd?: () => void;
  }
): Promise<void> {
  if (!text || !text.trim()) return;

  // Stop all active audios first
  stopTTS();

  const thisEpoch = ++ttsEpoch;
  const { rate = 1.0, onEnd, voiceGender = 'automatic', detectedPitch, voiceName } = options || {};

  currentPlayingText = text;
  isAudioCurrentlyLoading = false;
  notifyTTSState();

  // Instant Web Speech API playback (0ms latency)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;

    const langMap: Record<string, string> = {
      es: 'es-ES',
      en: 'en-US',
      fr: 'fr-FR',
      pt: 'pt-BR',
      de: 'de-DE',
      ja: 'ja-JP',
      zh: 'zh-CN',
      ar: 'ar-SA',
      ko: 'ko-KR',
      it: 'it-IT',
      ru: 'ru-RU',
    };
    utterance.lang = langMap[targetLang] || 'es-ES';

    const voices = window.speechSynthesis.getVoices();
    const localizedVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(utterance.lang.toLowerCase().slice(0, 2)));
    const selectedGender = voiceGender === 'automatic' ? (detectedPitch && detectedPitch < 165 ? 'male' : 'female') : voiceGender;
    const preferredVoiceName = voiceName || (selectedGender === 'male' ? 'Fenrir' : 'Kore');
    const voicePattern = selectedGender === 'female' ? /female|woman|samantha|zira|monica|karen|susan/i : /male|man|david|jorge|alex|daniel/i;
    const voice = localizedVoices.find((candidate) => candidate.name.toLowerCase() === preferredVoiceName.toLowerCase())
      || localizedVoices.find((candidate) => voicePattern.test(candidate.name))
      || localizedVoices[0];
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      if (thisEpoch === ttsEpoch) {
        currentPlayingText = null;
        isAudioCurrentlyLoading = false;
        notifyTTSState();
        onEnd?.();
      }
    };

    utterance.onerror = () => {
      if (thisEpoch === ttsEpoch) {
        currentPlayingText = null;
        isAudioCurrentlyLoading = false;
        notifyTTSState();
        onEnd?.();
      }
    };

    window.speechSynthesis.speak(utterance);
  } else {
    currentPlayingText = null;
    isAudioCurrentlyLoading = false;
    notifyTTSState();
    onEnd?.();
  }
}

/**
 * Toggle TTS: if the given text is already playing or loading, stop it immediately.
 * Otherwise, stop any other audio and start playing this one.
 */
export function toggleTTS(
  text: string,
  targetLang: string,
  options?: {
    useGeminiNeural?: boolean;
    voiceName?: string;
    rate?: number;
    voiceGender?: VoiceGender;
    detectedPitch?: number | null;
    onEnd?: () => void;
  }
): void {
  if (currentPlayingText === text) {
    stopTTS();
  } else {
    playTTS(text, targetLang, options);
  }
}
