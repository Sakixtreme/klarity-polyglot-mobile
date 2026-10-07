import { TranslationSessionItem, SUPPORTED_LANGUAGES } from '../types/interpreter';

/**
 * Generates a clean, professionally formatted .txt file from the session history
 * and triggers a browser download.
 */
export function exportTranscriptAsTextFile(items: TranslationSessionItem[]): void {
  if (!items || items.length === 0) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeStr = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dividerMain = '================================================================================';
  const dividerSub = '--------------------------------------------------------------------------------';
  const dividerItem = '  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -';

  const header = [
    dividerMain,
    '                    KLARITY POLYGLOT / KLARITY CONSECUTIVA                      ',
    '                       REGISTRO DE SESIÓN DE INTERPRETACIÓN                     ',
    dividerMain,
    `Fecha de exportación   : ${dateStr} ${timeStr}`,
    `Total de intervenciones: ${items.length}`,
    `Generado por           : Klarity Engine (Tiempo Real)`,
    dividerMain,
    '',
  ];

  // We sort in chronological order (oldest first) for reading naturally
  const chronologicalItems = [...items].sort((a, b) => a.timestamp - b.timestamp);

  const body = chronologicalItems.map((item, index) => {
    const itemTime = new Date(item.timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const isUser = item.speaker_target === 'user';
    const speakerLabel = isUser ? 'TÚ (Usuario Local)' : 'INTERLOCUTOR (Externo)';
    
    const srcLang = SUPPORTED_LANGUAGES.find((l) => l.code === item.detected_source_language);
    const tgtLang = SUPPORTED_LANGUAGES.find((l) => l.code === item.target_language);
    const srcName = srcLang ? `${srcLang.name} (${srcLang.code.toUpperCase()})` : item.detected_source_language.toUpperCase();
    const tgtName = tgtLang ? `${tgtLang.name} (${tgtLang.code.toUpperCase()})` : item.target_language.toUpperCase();

    const latencyInfo = item.durationMs ? ` (${item.durationMs} ms)` : '';

    return [
      `[${String(index + 1).padStart(2, '0')}] ${itemTime} | ${speakerLabel}`,
      `     Canal    : ${srcName} ──> ${tgtName}${latencyInfo}`,
      `     Modo     : ${item.mode === 'consecutive' ? 'Consecutivo' : 'Simultáneo'}`,
      dividerItem,
      `     ORIGINAL :`,
      `     "${item.original_transcription}"`,
      ``,
      `     TRADUCCIÓN :`,
      `     "${item.translated_subtitles}"`,
      dividerSub,
    ].join('\n');
  });

  const footer = [
    '',
    dividerMain,
    '                        FIN DE LA TRANSCRIPCIÓN                                 ',
    dividerMain,
  ];

  const fullContent = [...header, ...body, ...footer].join('\n');

  // Trigger download
  const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  const fileDateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  downloadAnchor.download = `Klarity_Transcript_${fileDateStamp}.txt`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
