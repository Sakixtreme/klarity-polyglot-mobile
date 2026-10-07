import React, { useState } from 'react';
import { Volume2, VolumeX, Sun, Moon, Settings2 } from 'lucide-react';
import { AppTab, SUPPORTED_LANGUAGES } from '../types/interpreter';
import { useTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/AppLanguageContext';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  autoPlayAudio: boolean;
  setAutoPlayAudio: (val: boolean) => void;
  onClearHistory: () => void;
  sessionCount: number;
  isWorking: boolean;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  autoPlayAudio,
  setAutoPlayAudio,
  onClearHistory,
  sessionCount,
  isWorking,
  onOpenSettings,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { appLang, setAppLang, t } = useAppLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === appLang) || SUPPORTED_LANGUAGES[0];

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors ${
        isDark ? 'border-navy-border bg-navy/95' : 'border-slate-300 bg-white/95'
      }`}
    >
      {/* Top brand and status bar */}
      <div className="flex h-12 items-center justify-between px-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-sm font-bold tracking-tight truncate ${
              isDark ? 'text-neutral-light' : 'text-navy'
            }`}
          >
            Klarity Polyglot
          </span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}
            title={isWorking ? 'Funcionando / Activo' : 'Inactivo'}
          ></span>
        </div>

        {/* Action icons order requested: (Historial, claro/oscuro, mutear, cambiar de idioma toda la aplicacion) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 1. Historial Button ([ H ]) */}
          <button
            onClick={() => setActiveTab(activeTab === 'history' ? 'consecutive' : 'history')}
            title={activeTab === 'history' ? t('backToIntr') : t('history')}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-all font-black text-sm relative ${
              activeTab === 'history'
                ? 'bg-orange text-white shadow-sm ring-1 ring-orange'
                : isDark
                ? 'text-neutral-muted hover:text-orange hover:bg-navy-surface'
                : 'text-navy hover:text-orange hover:bg-slate-200'
            }`}
            aria-label={t('history')}
          >
            <span>H</span>
            {sessionCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-orange text-white text-[9px] font-bold flex items-center justify-center px-0.5 border border-white dark:border-navy">
                {sessionCount > 99 ? '99+' : sessionCount}
              </span>
            )}
          </button>

          {/* 2. Light / Dark Mode Toggle button ([ ☀️ / 🌙 ]) */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
              isDark
                ? 'text-neutral-muted hover:text-orange hover:bg-navy-surface'
                : 'text-navy hover:text-orange hover:bg-slate-200'
            }`}
            aria-label="Cambiar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* 3. Mute toggle button ([ 🔊 / 🔇 ]) */}
          <button
            onClick={() => setAutoPlayAudio(!autoPlayAudio)}
            title={autoPlayAudio ? 'Audio activado (TTS)' : 'Audio silenciado'}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
              autoPlayAudio
                ? isDark
                  ? 'text-orange hover:bg-navy-surface'
                  : 'text-orange hover:bg-slate-200'
                : isDark
                ? 'text-neutral-dim hover:bg-navy-surface'
                : 'text-slate-400 hover:bg-slate-200'
            }`}
            aria-label="Alternar síntesis de voz"
          >
            {autoPlayAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            title="Ajustes de voz"
            className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
              isDark ? 'text-neutral-muted hover:text-orange hover:bg-navy-surface' : 'text-navy hover:text-orange hover:bg-slate-200'
            }`}
            aria-label="Ajustes de voz"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* 4. Cambiar de idioma toda la aplicación ([ 🇪🇸 ES ]) */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              title="Cambiar idioma de la aplicación"
              className={`min-h-[40px] px-2 flex items-center gap-1 rounded-lg transition-colors text-xs font-bold border ${
                isDark
                  ? 'bg-navy-surface text-neutral-light border-navy-border hover:border-orange'
                  : 'bg-slate-100 text-navy border-slate-300 hover:border-orange'
              }`}
              aria-label="Cambiar idioma de la aplicación"
            >
              <span>{currentLangObj.flag}</span>
              <span className="uppercase">{currentLangObj.code}</span>
            </button>

            {showLangMenu && (
              <div
                className={`absolute right-0 mt-1.5 w-48 rounded-xl border shadow-xl py-1 z-50 transition-all max-h-[320px] overflow-y-auto ${
                  isDark
                    ? 'bg-navy-dark border-navy-border text-neutral-light'
                    : 'bg-white border-slate-300 text-navy'
                }`}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 dark:border-navy-border">
                  Idioma de la App (11)
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setAppLang(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                      appLang === lang.code
                        ? 'bg-orange text-white font-bold'
                        : isDark
                        ? 'hover:bg-navy-surface'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                    <span className="uppercase text-[10px] font-bold px-1 rounded bg-black/20">
                      {lang.code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


    </header>
  );
};
