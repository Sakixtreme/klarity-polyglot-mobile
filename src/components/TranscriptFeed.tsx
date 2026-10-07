import React, { useState } from 'react';
import { Volume2, Copy, Check, Download, Clock, Trash2, CheckSquare, Square } from 'lucide-react';
import { TranslationSessionItem, SUPPORTED_LANGUAGES, VoiceGender } from '../types/interpreter';
import { toggleTTS } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface TranscriptFeedProps {
  items: TranslationSessionItem[];
  voiceGender: VoiceGender;
  onClear: () => void;
  onDeleteItem: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void;
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  items,
  voiceGender,
  onClear,
  onDeleteItem,
  onDeleteSelected,
}) => {
  const { isDark } = useTheme();
  const { t } = useAppLanguage();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((itemKey) => itemKey !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleExportTranscript = () => {
    const lines = items.map((item) => {
      const speaker = item.speaker_target === 'user' ? 'Tú (Usuario)' : 'Interlocutor';
      const time = new Date(item.timestamp).toLocaleTimeString();
      return `[${time}] ${speaker} (${item.detected_source_language.toUpperCase()} → ${item.target_language.toUpperCase()}):
Original: ${item.original_transcription}
Traducción: ${item.translated_subtitles}
--------------------------------------------------`;
    });

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `transcripcion_klarity_${Date.now()}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (items.length === 0) return null;

  return (
    <div className="w-full space-y-2.5">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h3
            className={`text-xs font-semibold ${
              isDark ? 'text-neutral-light' : 'text-navy'
            }`}
          >
            {t('sessionLog')} ({items.length})
          </h3>

          <button
            onClick={toggleSelectAll}
            className={`text-[10px] font-bold underline transition-colors ${
              isDark ? 'text-orange hover:text-orange-hover' : 'text-orange hover:text-orange-hover'
            }`}
          >
            {selectedIds.length === items.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                onDeleteSelected(selectedIds);
                setSelectedIds([]);
              }}
              className="min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white transition-colors shadow-xs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Borrar sel. ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={onClear}
            className="min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/40 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Borrar todo</span>
          </button>

          <button
            onClick={handleExportTranscript}
            className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors border ${
              isDark
                ? 'bg-navy-surface hover:bg-orange hover:text-white text-neutral-light border-orange/30'
                : 'bg-white hover:bg-orange hover:text-white text-navy border-orange/40 shadow-sm'
            }`}
          >
            <Download className="w-3 h-3" />
            <span>{t('export')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          const srcLang = SUPPORTED_LANGUAGES.find((l) => l.code === item.detected_source_language);
          const tgtLang = SUPPORTED_LANGUAGES.find((l) => l.code === item.target_language);
          const isUser = item.speaker_target === 'user';
          const isSelected = selectedIds.includes(item.id);

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-3 sm:p-3.5 transition-all shadow-sm relative ${
                isSelected
                  ? 'border-orange ring-2 ring-orange/30'
                  : isDark
                  ? isUser
                    ? 'border-orange/40 bg-navy-surface/90'
                    : 'border-orange/25 bg-navy-surface/75'
                  : isUser
                  ? 'border-orange/40 bg-white'
                  : 'border-orange/25 bg-white'
              }`}
            >
              {/* Card Header metadata */}
              <div
                className={`flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b text-xs ${
                  isDark
                    ? 'border-navy-border text-neutral-muted'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    onClick={() => toggleSelectItem(item.id)}
                    className="text-orange hover:scale-110 transition-transform"
                    aria-label="Seleccionar elemento"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 fill-orange text-white" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <span
                    className={`font-bold ${
                      isUser ? 'text-orange' : 'text-orange-light'
                    }`}
                  >
                    {isUser ? t('youUser') : t('counterpart')}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="flex items-center gap-1">
                    <span>{srcLang?.flag} {srcLang?.name}</span>
                    <span>→</span>
                    <span>{tgtLang?.flag} {tgtLang?.name}</span>
                  </span>
                  {item.durationMs && (
                    <>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="tabular-nums flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {item.durationMs}ms
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleTTS(item.ssml_or_tts_text, item.target_language, { voiceGender })}
                    className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-navy-dark text-neutral-muted hover:text-neutral-light'
                        : 'hover:bg-slate-100 text-slate-600 hover:text-navy'
                    }`}
                    title="Reproducir audio sintetizado"
                    aria-label="Reproducir audio"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleCopy(item.translated_subtitles, item.id)}
                    className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-navy-dark text-neutral-muted hover:text-neutral-light'
                        : 'hover:bg-slate-100 text-slate-600 hover:text-navy'
                    }`}
                    title="Copiar traducción"
                    aria-label="Copiar traducción"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-orange" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
                    title="Borrar elemento"
                    aria-label="Borrar elemento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subtitles (Translated) */}
              <div className="mt-2">
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider block ${
                    isDark ? 'text-neutral-muted' : 'text-slate-500'
                  }`}
                >
                  {t('translationLabel')}
                </span>
                <p
                  className={`text-sm font-semibold mt-0.5 leading-snug ${
                    isDark ? 'text-neutral-light' : 'text-navy'
                  }`}
                >
                  {item.translated_subtitles}
                </p>
              </div>

              {/* Original Transcription */}
              <div
                className={`mt-2 pt-1.5 border-t text-xs ${
                  isDark
                    ? 'border-navy-border text-neutral-muted'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider block">
                  {t('originalLabel')} ({item.detected_source_language.toUpperCase()}):
                </span>
                <p className="italic mt-0.5 text-[11px]">
                  "{item.original_transcription}"
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
