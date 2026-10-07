import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Play, Loader2, Clock } from 'lucide-react';
import { SupportedLanguage, TranslationSessionItem, InterpretationResult, VoiceGender } from '../types/interpreter';
import { AudioRecorder, playTTS, toggleTTS, stopTTS, subscribeTTSState, TTSState } from '../utils/audio';
import { wsTranslationClient } from '../utils/websocket';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface ConsecutiveModeProps {
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

export const ConsecutiveMode: React.FC<ConsecutiveModeProps> = ({
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

  const [captureMode, setCaptureMode] = useState<'free' | 'manual'>('free');
  const [windowSeconds, setWindowSeconds] = useState<10 | 20 | 30 | 60>(20);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [silenceDuration, setSilenceDuration] = useState<number>(0); // 0 to 2000 ms
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isContinuousLibreActive, setIsContinuousLibreActive] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>(() => t('pressRedButtonToStart'));
  const [lastResult, setLastResult] = useState<InterpretationResult | null>(null);
  const [ttsState, setTtsState] = useState<TTSState>({
    isPlaying: false,
    isLoading: false,
    currentText: null,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const silenceCheckIntervalRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  const hasSpokenRef = useRef<boolean>(false);
  const detectedPitchRef = useRef<number | null>(null);
  const lastSpokenTimestampRef = useRef<number>(0);
  const recordingStartedAtRef = useRef<number>(0);
  const isContinuousLibreActiveRef = useRef<boolean>(false);
  const accumulatedTranscriptRef = useRef<string>('');

  // Subscribe to global TTS state
  useEffect(() => {
    const unsubscribe = subscribeTTSState((state) => {
      setTtsState(state);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsWorking?.(isRecording || isProcessing || isContinuousLibreActive || ttsState.isPlaying);
  }, [isRecording, isProcessing, isContinuousLibreActive, ttsState.isPlaying, setIsWorking]);

  const isCurrentAudioActive = Boolean(
    lastResult && ttsState.currentText === lastResult.ssml_or_tts_text
  );
  const isPlayingCurrentTTS = isCurrentAudioActive && ttsState.isPlaying;
  const isLoadingCurrentTTS = isCurrentAudioActive && ttsState.isLoading;

  useEffect(() => {
    return () => {
      isContinuousLibreActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceCheckIntervalRef.current) clearInterval(silenceCheckIntervalRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const startConsecutiveRecording = async () => {
    try {
      setStatusMessage(t('accessingMic'));
      accumulatedTranscriptRef.current = '';

      const recorder = new AudioRecorder();
      await recorder.start();
      recorderRef.current = recorder;

      // Start SpeechRecognition for lightning-fast STT pre-translation
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = userLanguage === 'es' ? 'es-ES' : userLanguage;

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const current = (final || interim).trim();
            if (current) {
              accumulatedTranscriptRef.current = current;
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }

      setIsRecording(true);
      setElapsedSeconds(0);
      setSilenceDuration(0);
      setIsSpeaking(false);
      hasSpokenRef.current = false;
      detectedPitchRef.current = null;
      lastSpokenTimestampRef.current = Date.now();
      recordingStartedAtRef.current = Date.now();

      setStatusMessage(t('listeningStatus'));
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setElapsedSeconds(elapsed);
        if (captureMode === 'manual' && elapsed >= windowSeconds) {
          void stopAndProcessRecording('window_elapsed');
        }
      }, 200);

      const VOICE_ENERGY_THRESHOLD = 12;
      const SILENCE_LIMIT_MS = 900;
      silenceCheckIntervalRef.current = setInterval(() => {
        if (!recorderRef.current) return;
        const currentVolume = recorderRef.current.getAverageVolume();

        if (currentVolume >= VOICE_ENERGY_THRESHOLD) {
          hasSpokenRef.current = true;
          detectedPitchRef.current = recorderRef.current.getEstimatedPitch() ?? detectedPitchRef.current;
          lastSpokenTimestampRef.current = Date.now();
          setIsSpeaking(true);
          setSilenceDuration(0);
        } else if (hasSpokenRef.current) {
          setIsSpeaking(false);
          const silenceElapsed = Date.now() - lastSpokenTimestampRef.current;
          setSilenceDuration(Math.min(SILENCE_LIMIT_MS, silenceElapsed));

          if (captureMode === 'free' && silenceElapsed >= SILENCE_LIMIT_MS) {
            if (silenceCheckIntervalRef.current) {
              clearInterval(silenceCheckIntervalRef.current);
              silenceCheckIntervalRef.current = null;
            }
            void stopAndProcessRecording('silence_detected');
          }
        }
      }, 50);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setIsRecording(false);
      setStatusMessage('Error mic: ' + (err?.message || 'Permiso denegado'));
    }
  };

  const scheduleNextCapture = () => {
    if (captureMode === 'manual') {
      isContinuousLibreActiveRef.current = false;
      setIsContinuousLibreActive(false);
      return;
    }
    if (!isContinuousLibreActiveRef.current) return;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      if (isContinuousLibreActiveRef.current) startConsecutiveRecording();
    }, 300);
  };

  const stopAndProcessRecording = async (triggerReason?: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    if (!recorderRef.current) return;

    try {
      setIsRecording(false);
      setIsSpeaking(false);
      setSilenceDuration(0);

      const recorderObj = recorderRef.current;
      recorderRef.current = null;
      const audioData = await recorderObj.stop();

      if (!hasSpokenRef.current && triggerReason !== 'manual_force') {
        setIsProcessing(false);
        setStatusMessage(t('pressRedButtonToStart'));
        scheduleNextCapture();
        return;
      }

      const startTime = Date.now();
      const isLibreContinuous = isContinuousLibreActiveRef.current;

      const textToTranslate = accumulatedTranscriptRef.current.trim();

      if (textToTranslate) {
        setIsProcessing(true);
        setStatusMessage(t('interpretingGoogle'));

        await wsTranslationClient.translate({
          text: textToTranslate,
          audioBase64: audioData.base64,
          mimeType: audioData.mimeType,
          mode: 'consecutive',
          userLanguage,
          counterpartLanguage,
          windowSeconds: null,
          onResult: (result) => {
            const durationMs = Date.now() - startTime;
            setLastResult(result);

            onAddSessionItem({
              ...result,
              id: 'consec-' + Date.now(),
              timestamp: Date.now(),
              durationMs,
            });

            if (result.speaker_target === 'counterpart' && result.detected_source_language !== userLanguage) {
              onLanguageDetected?.(result.detected_source_language);
            }

            setIsProcessing(false);

            if (result.ssml_or_tts_text && autoPlayAudio) {
              if (isLibreContinuous) {
                setStatusMessage('🔊 Reproduciendo traducción...');
              } else {
                setStatusMessage(`${t('ready')} (${durationMs}ms)`);
              }

              playTTS(result.ssml_or_tts_text, result.target_language, {
                voiceGender,
                detectedPitch: detectedPitchRef.current,
                onEnd: scheduleNextCapture,
              });
            } else scheduleNextCapture();
          },
          onNoSpeech: () => {
            setIsProcessing(false);
            setStatusMessage(t('pressRedButtonToStart'));
            scheduleNextCapture();
          },
          onError: (err) => {
            console.error('Error text translation:', err);
            setStatusMessage('Error: ' + err.message);
            setIsProcessing(false);
          },
        });
        return;
      }

      // 2. Fallback to audio upload if no speech recognition text was captured
      setIsProcessing(true);
      setStatusMessage(t('interpretingGoogle'));

      await wsTranslationClient.translate({
        audioBase64: audioData.base64,
        mimeType: audioData.mimeType,
        mode: 'consecutive',
        userLanguage,
        counterpartLanguage,
        windowSeconds: null,
        onResult: (result) => {
          const durationMs = Date.now() - startTime;
          setLastResult(result);

          onAddSessionItem({
            ...result,
            id: 'consec-' + Date.now(),
            timestamp: Date.now(),
            durationMs,
          });

          if (result.speaker_target === 'counterpart' && result.detected_source_language !== userLanguage) {
            onLanguageDetected?.(result.detected_source_language);
          }

          setIsProcessing(false);

          if (result.ssml_or_tts_text && autoPlayAudio) {
            if (isLibreContinuous) {
              setStatusMessage('🔊 Reproduciendo traducción...');
            } else {
              setStatusMessage(`${t('ready')} (${durationMs}ms)`);
            }

            playTTS(result.ssml_or_tts_text, result.target_language, {
              voiceGender,
              detectedPitch: detectedPitchRef.current,
              onEnd: scheduleNextCapture,
            });
          } else scheduleNextCapture();
        },
        onNoSpeech: () => {
          setIsProcessing(false);
          setStatusMessage(t('pressRedButtonToStart'));
          scheduleNextCapture();
        },
        onError: (err) => {
          console.error('Error processing audio:', err);
          setStatusMessage('Error: ' + (err?.message || 'Error servidor'));
          setIsProcessing(false);

          if (isContinuousLibreActiveRef.current) {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = setTimeout(() => {
              if (isContinuousLibreActiveRef.current) {
                startConsecutiveRecording();
              }
            }, 800);
          }
        },
      });
    } catch (err: any) {
      console.error('Error processing audio:', err);
      setStatusMessage('Error: ' + (err?.message || 'Error servidor'));
      setIsProcessing(false);
    }
  };

  const handleStartRecording = () => {
    isContinuousLibreActiveRef.current = true;
    setIsContinuousLibreActive(true);
    startConsecutiveRecording();
  };

  const handleStopSession = () => {
    isContinuousLibreActiveRef.current = false;
    setIsContinuousLibreActive(false);
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    stopTTS();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    if (isRecording) {
      stopAndProcessRecording('manual_stop');
    } else {
      setIsProcessing(false);
      setStatusMessage(t('sessionFinished'));
    }
  };

  const handleManualSubmit = async () => {
    if (!textInput.trim() || isProcessing) return;

    const query = textInput.trim();
    setTextInput('');
    setIsProcessing(true);
    setStatusMessage(t('interpretingGoogle'));

    try {
      const startTime = Date.now();

      await wsTranslationClient.translate({
        text: query,
        mode: 'consecutive',
        userLanguage,
        counterpartLanguage,
        windowSeconds: null,
        onResult: (result) => {
          const durationMs = Date.now() - startTime;
          setLastResult(result);
          setStatusMessage(`${t('ready')} (${durationMs}ms)`);

          const sessionItem: TranslationSessionItem = {
            ...result,
            id: 'consec-' + Date.now(),
            timestamp: Date.now(),
            durationMs,
          };

          onAddSessionItem(sessionItem);

          if (result.speaker_target === 'counterpart' && result.detected_source_language !== userLanguage) {
            onLanguageDetected?.(result.detected_source_language);
          }

          if (result.ssml_or_tts_text && autoPlayAudio) {
            playTTS(result.ssml_or_tts_text, result.target_language, { voiceGender });
          }
          setIsProcessing(false);
        },
        onError: (err) => {
          console.error('Error manual submission:', err);
          setStatusMessage('Error: ' + err.message);
          setIsProcessing(false);
        },
      });
    } catch (err: any) {
      console.error('Error manual submission:', err);
      setStatusMessage('Error: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleToggleCurrentTTS = () => {
    if (!lastResult?.ssml_or_tts_text) return;
    toggleTTS(lastResult.ssml_or_tts_text, lastResult.target_language, { voiceGender, detectedPitch: detectedPitchRef.current });
  };

  const isSessionBusy = isRecording || isProcessing || isContinuousLibreActive;

  return (
    <div className="w-full space-y-3">
      {/* Control Card */}
      <div
        className={`rounded-2xl border p-3.5 shadow-sm transition-colors ${
          isDark
            ? 'border-navy-border bg-navy-surface/85'
            : 'border-slate-300 bg-white'
        }`}
      >
        {/* Capture mode and fixed listening window */}
        <div
          className={`pb-2 mb-2 border-b transition-colors ${
            isDark ? 'border-navy-border/80' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-semibold ${isDark ? 'text-neutral-light' : 'text-navy'}`}>{t('captureMode')}</span>
            <button
              type="button"
              disabled={isRecording || isProcessing}
              aria-pressed={captureMode === 'free'}
              onClick={() => setCaptureMode((current) => current === 'free' ? 'manual' : 'free')}
              className="min-h-[30px] rounded-lg border border-orange/50 px-3 text-[11px] font-bold text-orange disabled:opacity-50"
            >
              {captureMode === 'free' ? t('freeMode') : t('manualMode')}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5" role="group" aria-label={t('windowDuration')}>
            <span className="mr-auto text-[10px] text-slate-500">{t('windowDuration')}</span>
            {([10, 20, 30, 60] as const).map((seconds) => (
              <button
                key={seconds}
                type="button"
                disabled={isRecording || isProcessing || captureMode === 'free'}
                aria-pressed={windowSeconds === seconds}
                onClick={() => setWindowSeconds(seconds)}
                className={`min-h-[29px] min-w-[39px] rounded-md border px-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${windowSeconds === seconds && captureMode === 'manual' ? 'border-orange bg-orange text-white' : isDark ? 'border-navy-border text-neutral-muted' : 'border-slate-300 text-slate-600'}`}
              >{seconds}s</button>
            ))}
          </div>
        </div>

        {/* Recording zone */}
        <div className="py-2.5 flex flex-col items-center justify-center text-center">
          {/* Waveform */}
          <div className="w-full max-w-[240px] mb-2">
            <WaveformVisualizer
              isRecording={isRecording}
              getAudioLevels={recorderRef.current ? () => recorderRef.current!.getAudioLevels() : undefined}
              accentColor="orange"
            />
          </div>

          {/* Big Recording Button & Manual Translate Now Button when recording */}
          <div className="relative flex items-center justify-center gap-3">
            {isSessionBusy && (
              <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/30" />
            )}
            {!isSessionBusy ? (
              <button
                disabled={isProcessing}
                onClick={handleStartRecording}
                className="relative min-h-[64px] min-w-[64px] rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/35 active:scale-95 transition-all"
                title="Iniciar interpretación (Rojo = Inactivo)"
                aria-label="Iniciar interpretación"
              >
                <Mic className="h-7 w-7" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => stopAndProcessRecording('manual_force')}
                  className="min-h-[48px] px-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all z-10"
                  title="Traducir lo escuchado hasta ahora (Ideal para lugares con ruido)"
                  aria-label="Traducir ahora"
                >
                  <Send className="w-4 h-4" />
                  <span>Traducir ahora</span>
                </button>

                <button
                  onClick={handleStopSession}
                  className="relative min-h-[64px] min-w-[64px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 active:scale-95 transition-all"
                  title="Detener sesión"
                  aria-label="Detener sesión"
                >
                  <Square className="h-6 w-6 fill-white" />
                </button>
              </>
            )}
          </div>

          {/* Live Silence 2s Detection Visual Meter */}
          {isRecording && captureMode === 'free' && (
            <div className="mt-2.5 w-full max-w-[220px] mx-auto text-center space-y-1">
              {isSpeaking ? (
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{t('voiceDetected')}</span>
                </div>
              ) : silenceDuration > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-orange">
                    <span>{t('pauseDetected')}</span>
                    <span className="tabular-nums">{(silenceDuration / 1000).toFixed(1)}s / 1.0s</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-navy-dark overflow-hidden">
                    <div
                      className="h-full bg-orange transition-all duration-75 rounded-full"
                      style={{ width: `${Math.min(100, (silenceDuration / 1000) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Elapsed time in Free mode, remaining window in Manual mode */}
          {isRecording && (
            <div className="mt-2 space-y-1">
              <span className="text-[10px] text-slate-500">{captureMode === 'manual' ? t('remaining') : t('elapsed')}</span>
              <div
                className={`text-xl font-bold tabular-nums ${
                  isDark ? 'text-neutral-light' : 'text-navy'
                }`}
              >
                {captureMode === 'manual' ? Math.max(0, windowSeconds - elapsedSeconds) : elapsedSeconds}s
              </div>
            </div>
          )}
        </div>

        {/* Text Input Row */}
        <div
          className={`pt-2 border-t transition-colors ${
            isDark ? 'border-navy-border/80' : 'border-slate-200'
          }`}
        >
          <div className="flex gap-1.5">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder={t('typeMessage')}
              disabled={isRecording || isProcessing}
              className={`flex-1 border rounded-xl px-2.5 py-1.5 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-orange ${
                isDark
                  ? 'bg-navy-dark border-navy-border text-neutral-light placeholder:text-neutral-dim'
                  : 'bg-slate-50 border-slate-300 text-navy placeholder:text-slate-400'
              }`}
            />
            <button
              onClick={handleManualSubmit}
              disabled={!textInput.trim() || isRecording || isProcessing}
              className="min-h-[38px] px-3.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center shrink-0 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Latest Result Card */}
      {lastResult && (
        <div
          className={`rounded-2xl border p-3 space-y-2 transition-colors ${
            isDark
              ? 'border-orange/40 bg-navy-dark/90'
              : 'border-orange/50 bg-white shadow-sm'
          }`}
        >
          <div
            className={`flex items-center justify-between text-xs pb-1.5 border-b transition-colors ${
              isDark
                ? 'text-neutral-muted border-navy-border/70'
                : 'text-slate-600 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-orange">
                {lastResult.detected_source_language.toUpperCase()} → {lastResult.target_language.toUpperCase()}
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>{lastResult.speaker_target === 'user' ? 'Tú' : 'Interlocutor'}</span>
            </div>

            <button
              onClick={handleToggleCurrentTTS}
              className={`min-h-[32px] px-2.5 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isPlayingCurrentTTS
                  ? 'bg-orange text-white border-orange shadow-md animate-pulse'
                  : isLoadingCurrentTTS
                  ? 'bg-orange/20 text-orange border-orange/40 opacity-90'
                  : 'bg-orange/15 hover:bg-orange/25 text-orange border-orange/30 active:scale-95'
              }`}
              title="Reproducir audio"
              aria-label="Reproducir audio"
            >
              {isLoadingCurrentTTS ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cargando...</span>
                </>
              ) : isPlayingCurrentTTS ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Detener</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Reproducir</span>
                </>
              )}
            </button>
          </div>

          <div>
            <p
              className={`text-sm font-bold leading-snug ${
                isDark ? 'text-neutral-light' : 'text-navy'
              }`}
            >
              {lastResult.translated_subtitles}
            </p>
            <p
              className={`text-[11px] italic mt-1 ${
                isDark ? 'text-neutral-muted' : 'text-slate-600'
              }`}
            >
              "{lastResult.original_transcription}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
