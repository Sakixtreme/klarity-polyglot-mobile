import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Radio, Square, Volume2, Zap } from 'lucide-react';
import { SupportedLanguage, TranslationSessionItem, VoiceGender } from '../types/interpreter';
import { playTTS, toggleTTS } from '../utils/audio';
import { wsTranslationClient } from '../utils/websocket';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface SimultaneousModeProps {
  userLanguage: SupportedLanguage;
  counterpartLanguage: SupportedLanguage;
  voiceGender: VoiceGender;
  autoPlayAudio: boolean;
  onAddSessionItem: (item: TranslationSessionItem) => void;
  onLanguageDetected?: (lang: SupportedLanguage) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  setIsWorking?: (val: boolean) => void;
}

export const SimultaneousMode: React.FC<SimultaneousModeProps> = ({
  userLanguage,
  counterpartLanguage,
  voiceGender,
  autoPlayAudio,
  onAddSessionItem,
  onLanguageDetected,
  isProcessing,
  setIsProcessing,
  setIsWorking,
}) => {
  const { isDark } = useTheme();
  const { t } = useAppLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [status, setStatus] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningRef = useRef(false);
  const translatingRef = useRef(false);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    setIsWorking?.(isListening || isProcessing);
  }, [isListening, isProcessing, setIsWorking]);

  const translatePhrase = async (phrase: string) => {
    const normalizedPhrase = phrase.trim();
    if (!normalizedPhrase) return;
    if (translatingRef.current) {
      pendingTextRef.current = normalizedPhrase;
      return;
    }

    translatingRef.current = true;
    setIsProcessing(true);
    const startedAt = Date.now();
    await wsTranslationClient.translate({
      text: normalizedPhrase,
      mode: 'simultaneous',
      userLanguage,
      counterpartLanguage,
      onResult: (result) => {
        const durationMs = Date.now() - startedAt;
        setTranslation(result.translated_subtitles);
        setLatencyMs(durationMs);
        onAddSessionItem({
          ...result,
          id: `simult-${Date.now()}`,
          timestamp: Date.now(),
          durationMs,
        });
        if (result.speaker_target === 'counterpart' && result.detected_source_language !== userLanguage) {
          onLanguageDetected?.(result.detected_source_language);
        }
        if (autoPlayAudio && result.ssml_or_tts_text) {
          void playTTS(result.ssml_or_tts_text, result.target_language, { voiceGender, rate: 1.05 });
        }
        setStatus(`${t('ready')} (${durationMs}ms)`);
        translatingRef.current = false;
        setIsProcessing(false);
        const pendingText = pendingTextRef.current;
        pendingTextRef.current = null;
        if (pendingText) void translatePhrase(pendingText);
      },
      onNoSpeech: () => {
        translatingRef.current = false;
        setIsProcessing(false);
        const pendingText = pendingTextRef.current;
        pendingTextRef.current = null;
        if (pendingText) void translatePhrase(pendingText);
      },
      onError: (error) => {
        console.error('Simultaneous translation error:', error);
        setStatus('Error: ' + (error?.message || 'Error de traducción'));
        translatingRef.current = false;
        setIsProcessing(false);
        const pendingText = pendingTextRef.current;
        pendingTextRef.current = null;
        if (pendingText) void translatePhrase(pendingText);
      },
    });
  };

  const startRecognition = () => {
    if (!listeningRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('El reconocimiento de voz no está disponible en este navegador. Usa el campo de texto.');
      listeningRef.current = false;
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = userLanguage === 'es' ? 'es-ES' : userLanguage;
      recognition.onstart = () => setStatus(t('streamingActive'));
      recognition.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const spokenText = event.results[index][0]?.transcript || '';
          if (event.results[index].isFinal) finalText += spokenText;
          else interimText += spokenText;
        }
        const phrase = (finalText || interimText).trim();
        if (!phrase) return;
        setTranscript((current) => finalText ? `${current} ${finalText}`.trim() : `${current.split(' ').slice(0, -interimText.split(' ').length).join(' ')} ${interimText}`.trim());
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => void translatePhrase(phrase), finalText ? 150 : 450);
      };
      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && listeningRef.current) {
          setStatus('Reconectando reconocimiento de voz...');
        }
      };
      recognition.onend = () => {
        if (listeningRef.current) {
          restartTimerRef.current = setTimeout(startRecognition, 150);
        } else {
          setIsListening(false);
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error: any) {
      setStatus('No se pudo iniciar el micrófono: ' + (error?.message || 'error desconocido'));
      if (listeningRef.current) restartTimerRef.current = setTimeout(startRecognition, 500);
    }
  };

  const handleStart = () => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    setIsListening(true);
    setTranscript('');
    setTranslation('');
    setStatus(t('accessingMic'));
    startRecognition();
  };

  const handleStop = () => {
    listeningRef.current = false;
    setIsListening(false);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setStatus(t('sessionFinished'));
  };

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const phrase = textInput.trim();
    if (!phrase) return;
    setTextInput('');
    setTranscript(phrase);
    void translatePhrase(phrase);
  };

  useEffect(() => () => {
    listeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    try { recognitionRef.current?.abort(); } catch {}
  }, []);

  return (
    <div className="w-full space-y-3">
      <section className={`rounded-xl border p-3.5 shadow-sm ${isDark ? 'border-navy-border bg-navy-surface/85' : 'border-slate-300 bg-white'}`}>
        <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-navy-border text-neutral-light' : 'border-slate-200 text-navy'}`}>
          <span className="text-xs font-semibold">{t('simultaneous')} · {t('realtimeSubtitles')}</span>
          {latencyMs !== null && <span className="flex items-center gap-1 text-[11px] font-semibold text-orange"><Zap className="h-3 w-3" />{latencyMs}ms</span>}
        </div>
        <div className="flex flex-col items-center py-3 text-center">
          <div className="mb-2 w-full max-w-[240px]"><WaveformVisualizer isRecording={isListening} accentColor="orange" /></div>
          <button
            type="button"
            onClick={isListening ? handleStop : handleStart}
            className={`relative grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${isListening ? 'bg-red-600' : 'bg-orange'}`}
            aria-label={isListening ? t('stopListening') : t('startListening')}
            title={isListening ? t('stopListening') : t('startListening')}
          >
            {isListening ? <Square className="h-6 w-6 fill-current" /> : <Radio className="h-7 w-7" />}
          </button>
          <p className={`mt-2 text-[11px] ${isDark ? 'text-neutral-muted' : 'text-slate-600'}`} aria-live="polite">{status || (isListening ? t('listeningStatus') : t('simultaneousReady'))}</p>
        </div>
        <div className={`min-h-[108px] rounded-lg border p-3 ${isDark ? 'border-orange/40 bg-navy-dark' : 'border-orange/40 bg-white'}`}>
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase text-orange">
            <span>{t('realtimeSubtitles')}</span>
            {translation && <button type="button" onClick={() => toggleTTS(translation, counterpartLanguage, { voiceGender })} aria-label={t('listen')} title={t('listen')}><Volume2 className="h-4 w-4" /></button>}
          </div>
          <p className={`text-sm font-bold leading-snug ${isDark ? 'text-neutral-light' : 'text-navy'}`}>{translation || t('speakContinuouslyPrompt')}</p>
          {transcript && <p className={`mt-2 truncate border-t pt-1.5 text-[10px] italic ${isDark ? 'border-navy-border text-neutral-muted' : 'border-slate-200 text-slate-500'}`}>{transcript}</p>}
        </div>
        <form onSubmit={handleTextSubmit} className={`mt-3 flex gap-1.5 border-t pt-2.5 ${isDark ? 'border-navy-border' : 'border-slate-200'}`}>
          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            placeholder={t('typeSimultaneous')}
            className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-navy-border bg-navy-dark text-neutral-light' : 'border-slate-300 bg-slate-50 text-navy'}`}
          />
          <button type="submit" disabled={!textInput.trim() || isProcessing} className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-orange text-white disabled:opacity-40" aria-label={t('send') || 'Enviar'} title={t('send') || 'Enviar'}><ArrowRight className="h-4 w-4" /></button>
        </form>
      </section>
    </div>
  );
};
