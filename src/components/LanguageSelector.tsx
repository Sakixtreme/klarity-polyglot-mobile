import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, getLanguageName } from '../types/interpreter';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface LanguageSelectorProps {
  userLanguage: SupportedLanguage;
  setUserLanguage: (lang: SupportedLanguage) => void;
  counterpartLanguage: SupportedLanguage;
  setCounterpartLanguage: (lang: SupportedLanguage) => void;
  onSwapLanguages: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  userLanguage,
  setUserLanguage,
  counterpartLanguage,
  setCounterpartLanguage,
  onSwapLanguages,
}) => {
  const { isDark } = useTheme();
  const { appLang, t } = useAppLanguage();

  return (
    <div
      className={`w-full border-b px-2.5 py-1.5 transition-colors ${
        isDark
          ? 'bg-navy-surface/90 border-navy-border'
          : 'bg-white border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 max-w-full">
        {/* User Native Language Selector */}
        <div className="flex-1 min-w-0 relative">
          <select
            value={userLanguage}
            onChange={(e) => setUserLanguage(e.target.value as SupportedLanguage)}
            className={`w-full text-xs font-semibold rounded-lg pl-2 pr-6 py-1.5 border appearance-none cursor-pointer truncate transition-colors ${
              isDark
                ? 'bg-navy-dark text-neutral-light border-orange/50 focus:ring-orange'
                : 'bg-slate-100 text-navy border-orange/60 focus:ring-orange'
            }`}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {getLanguageName(lang.code, appLang)}
              </option>
            ))}
          </select>
          <span
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] ${
              isDark ? 'text-neutral-muted' : 'text-slate-500'
            }`}
          >
            ▼
          </span>
        </div>

        {/* Swap button */}
        <button
          onClick={onSwapLanguages}
          title={t('swapLanguages')}
          className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors border shrink-0 ${
            isDark
              ? 'bg-orange hover:bg-orange-hover text-white border-orange shadow-sm'
              : 'bg-orange hover:bg-orange-hover text-white border-orange/80 shadow-sm'
          }`}
          aria-label={t('swapLanguages')}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>

        {/* Counterpart Language Selector */}
        <div className="flex-1 min-w-0 relative">
          <select
            value={counterpartLanguage}
            onChange={(e) => setCounterpartLanguage(e.target.value as SupportedLanguage)}
            className={`w-full text-xs font-semibold rounded-lg pl-2 pr-6 py-1.5 border appearance-none cursor-pointer truncate transition-colors ${
              isDark
                ? 'bg-navy-dark text-neutral-light border-orange/50 focus:ring-orange'
                : 'bg-slate-100 text-navy border-orange/60 focus:ring-orange'
            }`}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {getLanguageName(lang.code, appLang)}
              </option>
            ))}
          </select>
          <span
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] ${
              isDark ? 'text-neutral-muted' : 'text-slate-500'
            }`}
          >
            ▼
          </span>
        </div>
      </div>
    </div>
  );
};
