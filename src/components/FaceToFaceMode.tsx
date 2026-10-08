import React, { useEffect, useRef, useState } from 'react';
import { Mic, RotateCw, Volume2 } from 'lucide-react';
import { SupportedLanguage, TranslationSessionItem, SUPPORTED_LANGUAGES, VoiceGender } from '../types/interpreter';
import { AudioRecorder, playTTS, toggleTTS } from '../utils/audio';
import { wsTranslationClient } from '../utils/websocket';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface FaceToFaceModeProps {
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

export const FaceToFaceMode: React.FC<FaceToFaceModeProps> = ({
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
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'counterpart' | null>(null);
  const [rotateCounterpart, setRotateCounterpart] = useState(true);
  const [userSubtitle, setUserSubtitle] = useState('Esperando que hables...');
  const [counterpartSubtitle, setCounterpartSubtitle] = useState('Waiting for speech / En attente...');
  const [status, setStatus] = useState('Coloca el móvil plano sobre la mesa');
  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    setIsWorking?.(Boolean(activeSpeaker) || isProcessing);
    return () => setIsWorking?.(false);
  }, [activeSpeaker, isProcessing, setIsWorking]);

  const userLangObj = SUPPORTED_LANGUAGES.find((language) => language.code === userLanguage);
  const counterpartLangObj = SUPPORTED_LANGUAGES.find((language) => language.code === counterpartLanguage);

  const handleStartTalk = async (speaker: 'user' | 'counterpart') => {
    if (activeSpeaker || isProcessing) return;

    try {
      setActiveSpeaker(speaker);
      setStatus(speaker === 'user' ? `Escuchando a ti (${userLangObj?.name})...` : 'Escuchando a interlocutor...');
      const recorder = new AudioRecorder();
      await recorder.start();
      recorderRef.current = recorder;
    } catch (error: any) {
      console.error('Error starting mic:', error);
      setStatus('Error mic: ' + error.message);
      setActiveSpeaker(null);
    }
  };

  const handleStopTalk = async () => {
    if (!recorderRef.current || !activeSpeaker) return;

    const speaker = activeSpeaker;
    setActiveSpeaker(null);
    setIsProcessing(true);
    setStatus('Interpretando...');

    try {
      const { base64, mimeType } = await recorderRef.current.stop();
      recorderRef.current = null;
      const startTime = Date.now();

      await wsTranslationClient.translate({
        audioBase64: base64,
        mimeType,
        mode: 'consecutive',
        userLanguage,
        counterpartLanguage,
        speakerTargetOverride: speaker,
        onResult: (result) => {
          const durationMs = Date.now() - startTime;
          if (speaker === 'user') {
            setCounterpartSubtitle(result.translated_subtitles);
            setUserSubtitle(`Tú: "${result.original_transcription}"`);
          } else {
            setUserSubtitle(result.translated_subtitles);
            setCounterpartSubtitle(`Interlocutor: "${result.original_transcription}"`);
            if (result.detected_source_language !== userLanguage) onLanguageDetected?.(result.detected_source_language);
          }

          setStatus(`Listo (${durationMs}ms)`);
          onAddSessionItem({
            ...result,
            id: 'f2f-' + Date.now(),
            timestamp: Date.now(),
            durationMs,
          });
          if (autoPlayAudio && result.ssml_or_tts_text) {
            void playTTS(result.ssml_or_tts_text, result.target_language, { voiceGender });
          }
          setIsProcessing(false);
        },
        onNoSpeech: () => {
          setStatus(t('pressRedButtonToStart'));
          setIsProcessing(false);
        },
        onError: (error) => {
          setStatus('Error: ' + (error?.message || 'Error servidor'));
          setIsProcessing(false);
        },
      });
    } catch (error: any) {
      setStatus('Error: ' + error.message);
      setIsProcessing(false);
    }
  };

  const bindPushToTalk = (speaker: 'user' | 'counterpart') => ({
    onPointerDown: () => { void handleStartTalk(speaker); },
    onPointerUp: () => { void handleStopTalk(); },
    onPointerCancel: () => { void handleStopTalk(); },
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.buttons !== 0) void handleStopTalk();
    },
  });

  return (
    <div className="w-full flex flex-col h-[calc(100dvh-130px)] max-h-[580px] space-y-1.5">
      <div className={`flex items-center justify-between text-[11px] px-1 shrink-0 ${isDark ? 'text-neutral-muted' : 'text-slate-600'}`}>
        <span className="truncate">{status}</span>
        <button
          type="button"
          onClick={() => setRotateCounterpart((rotated) => !rotated)}
          className={`min-h-[30px] px-2 rounded-lg flex items-center gap-1 border shrink-0 ${isDark ? 'bg-navy-surface text-neutral-light border-navy-border' : 'bg-white text-navy border-slate-300 shadow-sm'}`}
          aria-label="Girar pantalla del interlocutor"
          title="Girar pantalla del interlocutor"
        >
          <RotateCw className="w-3 h-3" />
          <span>{rotateCounterpart ? '180°' : '0°'}</span>
        </button>
      </div>

      <div className={`flex-1 rounded-xl border overflow-hidden flex flex-col shadow-sm ${isDark ? 'border-navy-border bg-navy-dark' : 'border-slate-300 bg-white'}`}>
        <section className={`flex-1 p-3 border-b flex flex-col justify-between overflow-y-auto ${isDark ? 'bg-navy-surface/90 border-navy-border text-neutral-light' : 'bg-orange/5 border-orange/20 text-navy'} ${rotateCounterpart ? 'rotate-180' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <span>{counterpartLangObj?.flag}</span>
              <span className="font-bold text-orange">{counterpartLangObj?.name}</span>
            </span>
            {counterpartSubtitle && (
              <button onClick={() => toggleTTS(counterpartSubtitle, counterpartLanguage)} className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border ${isDark ? 'bg-navy-dark/70 text-orange border-orange/30' : 'bg-white text-orange border-orange/30 shadow-sm'}`} aria-label={t('counterpartAudio')}>
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="my-1.5 overflow-y-auto max-h-[80px]"><p className={`text-sm font-bold leading-snug ${isDark ? 'text-neutral-light' : 'text-navy'}`}>{counterpartSubtitle}</p></div>
          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              disabled={isProcessing || activeSpeaker === 'user'}
              {...bindPushToTalk('counterpart')}
              className={`w-full max-w-[220px] min-h-[44px] rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm ${activeSpeaker === 'counterpart' ? 'bg-orange-hover animate-pulse text-white ring-4 ring-orange/30' : 'bg-orange text-white active:scale-95'} disabled:opacity-50`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{activeSpeaker === 'counterpart' ? t('releaseToSend') : t('holdToTalk')}</span>
            </button>
          </div>
        </section>

        <section className={`flex-1 p-3 flex flex-col justify-between overflow-y-auto ${isDark ? 'bg-navy-dark text-neutral-light' : 'bg-white text-navy'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5"><span>{userLangObj?.flag}</span><span className="font-bold text-orange">{userLangObj?.name}</span></span>
            {userSubtitle && (
              <button onClick={() => toggleTTS(userSubtitle, userLanguage)} className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border ${isDark ? 'bg-navy-surface text-orange border-orange/30' : 'bg-slate-50 text-orange border-orange/30 shadow-sm'}`} aria-label={t('yourAudio')}>
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="my-1.5 overflow-y-auto max-h-[80px]"><p className={`text-sm font-bold leading-snug ${isDark ? 'text-peach' : 'text-orange'}`}>{userSubtitle}</p></div>
          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              disabled={isProcessing || activeSpeaker === 'counterpart'}
              {...bindPushToTalk('user')}
              className={`w-full max-w-[220px] min-h-[44px] rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm ${activeSpeaker === 'user' ? 'bg-orange-hover animate-pulse text-white ring-4 ring-orange/30' : 'bg-orange text-white active:scale-95'} disabled:opacity-50`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{activeSpeaker === 'user' ? t('releaseToSend') : t('holdToTalk')}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
