export type SupportedLanguage =
  | 'es'
  | 'en'
  | 'fr'
  | 'pt'
  | 'de'
  | 'ja'
  | 'zh'
  | 'ar'
  | 'ko'
  | 'it'
  | 'ru';

export type InterpretationMode = 'consecutive';
export type AppTab = 'consecutive' | 'history';
export type SpeakerTarget = 'user' | 'counterpart';
export type VoiceGender = 'female' | 'male' | 'automatic';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
  voiceCode: string;
}

export const LANGUAGE_NAMES_TRANSLATIONS: Record<SupportedLanguage, Record<SupportedLanguage, string>> = {
  es: {
    es: 'Español',
    en: 'Inglés',
    fr: 'Francés',
    pt: 'Portugués',
    de: 'Alemán',
    ja: 'Japonés',
    zh: 'Chino Mandarín',
    ar: 'Árabe',
    ko: 'Coreano',
    it: 'Italiano',
    ru: 'Ruso',
  },
  en: {
    es: 'Spanish',
    en: 'English',
    fr: 'French',
    pt: 'Portuguese',
    de: 'German',
    ja: 'Japanese',
    zh: 'Mandarin Chinese',
    ar: 'Arabic',
    ko: 'Korean',
    it: 'Italian',
    ru: 'Russian',
  },
  fr: {
    es: 'Espagnol',
    en: 'Anglais',
    fr: 'Français',
    pt: 'Portugais',
    de: 'Allemand',
    ja: 'Japonais',
    zh: 'Chinois mandarin',
    ar: 'Arabe',
    ko: 'Coréen',
    it: 'Italien',
    ru: 'Russe',
  },
  pt: {
    es: 'Espanhol',
    en: 'Inglês',
    fr: 'Francês',
    pt: 'Português',
    de: 'Alemão',
    ja: 'Japonês',
    zh: 'Chinês Mandarim',
    ar: 'Árabe',
    ko: 'Coreano',
    it: 'Italiano',
    ru: 'Russo',
  },
  de: {
    es: 'Spanisch',
    en: 'Englisch',
    fr: 'Französisch',
    pt: 'Portugiesisch',
    de: 'Deutsch',
    ja: 'Japanisch',
    zh: 'Mandarin-Chinesisch',
    ar: 'Arabisch',
    ko: 'Koreanisch',
    it: 'Italienisch',
    ru: 'Russisch',
  },
  ja: {
    es: 'スペイン語',
    en: '英語',
    fr: 'フランス語',
    pt: 'ポルトガル語',
    de: 'ドイツ語',
    ja: '日本語',
    zh: '中国語（マンダリン）',
    ar: 'アラビア語',
    ko: '韓国語',
    it: 'イタリア語',
    ru: 'ロシア語',
  },
  zh: {
    es: '西班牙语',
    en: '英语',
    fr: '法语',
    pt: '葡萄牙语',
    de: '德语',
    ja: '日语',
    zh: '普通话',
    ar: '阿拉伯语',
    ko: '韩语',
    it: '意大利语',
    ru: '俄语',
  },
  ar: {
    es: 'الإسبانية',
    en: 'الإنجليزية',
    fr: 'الفرنسية',
    pt: 'البرتغالية',
    de: 'الألمانية',
    ja: 'اليابانية',
    zh: 'الصينية الماندرين',
    ar: 'العربية',
    ko: 'الكورية',
    it: 'الإيطالية',
    ru: 'الروسية',
  },
  ko: {
    es: '스페인어',
    en: '영어',
    fr: '프랑스어',
    pt: '포르투갈어',
    de: '독일어',
    ja: '일본어',
    zh: '중국어 (만다린)',
    ar: '아랍어',
    ko: '한국어',
    it: '이탈리아어',
    ru: '러시아어',
  },
  it: {
    es: 'Spagnolo',
    en: 'Inglese',
    fr: 'Francese',
    pt: 'Portoghese',
    de: 'Tedesco',
    ja: 'Giapponese',
    zh: 'Cinese Mandarino',
    ar: 'Arabo',
    ko: 'Coreano',
    it: 'Italiano',
    ru: 'Russo',
  },
  ru: {
    es: 'Испанский',
    en: 'Английский',
    fr: 'Французский',
    pt: 'Португальский',
    de: 'Немецкий',
    ja: 'Японский',
    zh: 'Китайский (мандарин)',
    ar: 'Арабский',
    ko: 'Корейский',
    it: 'Итальянский',
    ru: 'Русский',
  },
};

export function getLanguageName(code: SupportedLanguage, uiLang: SupportedLanguage): string {
  return LANGUAGE_NAMES_TRANSLATIONS[uiLang]?.[code] || LANGUAGE_NAMES_TRANSLATIONS['es'][code] || code;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr', voiceCode: 'es-ES' },
  { code: 'en', name: 'Inglés', nativeName: 'English', flag: '🇺🇸', dir: 'ltr', voiceCode: 'en-US' },
  { code: 'fr', name: 'Francés', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr', voiceCode: 'fr-FR' },
  { code: 'pt', name: 'Portugués', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr', voiceCode: 'pt-BR' },
  { code: 'de', name: 'Alemán', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr', voiceCode: 'de-DE' },
  { code: 'ja', name: 'Japonés', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr', voiceCode: 'ja-JP' },
  { code: 'zh', name: 'Chino Mandarín', nativeName: '中文 (普通话)', flag: '🇨🇳', dir: 'ltr', voiceCode: 'zh-CN' },
  { code: 'ar', name: 'Árabe', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl', voiceCode: 'ar-SA' },
  { code: 'ko', name: 'Coreano', nativeName: '한국어', flag: '🇰🇷', dir: 'ltr', voiceCode: 'ko-KR' },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr', voiceCode: 'it-IT' },
  { code: 'ru', name: 'Ruso', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr', voiceCode: 'ru-RU' },
];

/** Strict JSON output specified in prompt */
export interface InterpretationResult {
  detected_source_language: SupportedLanguage;
  target_language: SupportedLanguage;
  mode: InterpretationMode;
  speaker_target: SpeakerTarget;
  original_transcription: string;
  translated_subtitles: string;
  ssml_or_tts_text: string;
}

export interface TranslationSessionItem extends InterpretationResult {
  id: string;
  timestamp: number;
  durationMs?: number;
  audioWavBase64?: string;
  isStreaming?: boolean;
}

export interface PresetScenario {
  id: string;
  category: string;
  title: string;
  language: SupportedLanguage;
  speakerTarget: SpeakerTarget;
  text: string;
}
