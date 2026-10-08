/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LanguageSelector } from './components/LanguageSelector';
import { ConsecutiveMode } from './components/ConsecutiveMode';
import { SimultaneousMode } from './components/SimultaneousMode';
import { FaceToFaceMode } from './components/FaceToFaceMode';
import { TranscriptFeed } from './components/TranscriptFeed';
import { SettingsModal } from './components/SettingsModal';
import { SupportedLanguage, TranslationSessionItem, AppTab, VoiceGender } from './types/interpreter';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppLanguageProvider, useAppLanguage } from './context/AppLanguageContext';
import { ArrowLeft, Clock } from 'lucide-react';

function AppContent() {
  const { isDark } = useTheme();
  const { t } = useAppLanguage();
  const [activeTab, setActiveTab] = useState<AppTab>('consecutive');
  const [userLanguage, setUserLanguage] = useState<SupportedLanguage>('es');
  const [counterpartLanguage, setCounterpartLanguage] = useState<SupportedLanguage>('en');
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(() => (localStorage.getItem('voice_gender') as VoiceGender) || 'automatic');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [history, setHistory] = useState<TranslationSessionItem[]>(() => {
    try {
      const saved = localStorage.getItem('polyglot_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('polyglot_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  }, [history]);

  const handleAddSessionItem = (item: TranslationSessionItem) => {
    setHistory((prev) => [item, ...prev]);
  };

  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setVoiceGender(gender);
    localStorage.setItem('voice_gender', gender);
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('polyglot_history');
    } catch {}
  };

  const handleDeleteItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteSelected = (ids: string[]) => {
    setHistory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const handleSwapLanguages = () => {
    setUserLanguage(counterpartLanguage);
    setCounterpartLanguage(userLanguage);
  };

  const handleLanguageDetected = (lang: SupportedLanguage) => {
    if (lang && lang !== userLanguage) {
      setCounterpartLanguage(lang);
    }
  };

  return (
    <div
      className={`min-h-[100dvh] w-full flex justify-center selection:bg-orange/30 transition-colors ${
        isDark ? 'bg-navy-dark' : 'bg-slate-200'
      }`}
    >
      {/* Mobile Device Canvas Frame */}
      <div
        className={`w-full max-w-[430px] min-h-[100dvh] flex flex-col font-sans overflow-x-hidden shadow-2xl relative border-x transition-colors ${
          isDark
            ? 'bg-navy text-neutral-light border-navy-border/50'
            : 'bg-[#EFEFEF] text-navy border-slate-300'
        }`}
      >
        {/* Top Header with H, Theme, Mute, App Lang Switcher order */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          autoPlayAudio={autoPlayAudio}
          setAutoPlayAudio={setAutoPlayAudio}
          onClearHistory={handleClearHistory}
          sessionCount={history.length}
          isWorking={isWorking}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Compact Language Configuration Bar */}
        {activeTab !== 'history' && (
          <LanguageSelector
            userLanguage={userLanguage}
            setUserLanguage={setUserLanguage}
            counterpartLanguage={counterpartLanguage}
            setCounterpartLanguage={setCounterpartLanguage}
            onSwapLanguages={handleSwapLanguages}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full px-3 py-3 space-y-3 overflow-y-auto">
          {activeTab === 'consecutive' && (
            <div className="space-y-3">
              <ConsecutiveMode
                userLanguage={userLanguage}
                counterpartLanguage={counterpartLanguage}
                voiceGender={voiceGender}
                autoPlayAudio={autoPlayAudio}
                onAddSessionItem={handleAddSessionItem}
                onLanguageDetected={handleLanguageDetected}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                setIsWorking={setIsWorking}
              />
            </div>
          )}

          {activeTab === 'simultaneous' && (
            <div className="space-y-3">
              <SimultaneousMode
                userLanguage={userLanguage}
                counterpartLanguage={counterpartLanguage}
                voiceGender={voiceGender}
                autoPlayAudio={autoPlayAudio}
                onAddSessionItem={handleAddSessionItem}
                onLanguageDetected={handleLanguageDetected}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                setIsWorking={setIsWorking}
              />
            </div>
          )}

          {activeTab === 'facetoface' && (
            <FaceToFaceMode
              userLanguage={userLanguage}
              counterpartLanguage={counterpartLanguage}
              voiceGender={voiceGender}
              autoPlayAudio={autoPlayAudio}
              onAddSessionItem={handleAddSessionItem}
              onLanguageDetected={handleLanguageDetected}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              setIsWorking={setIsWorking}
            />
          )}

          {activeTab === 'history' && (
            <div className="w-full space-y-3">
              <div
                className={`flex items-center justify-between pb-2 border-b transition-colors ${
                  isDark ? 'border-navy-border' : 'border-slate-300'
                }`}
              >
                <button
                  onClick={() => setActiveTab('consecutive')}
                  className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    isDark
                      ? 'bg-navy-surface text-neutral-light border-navy-border hover:bg-orange hover:text-white'
                      : 'bg-white text-navy border-slate-300 hover:bg-orange hover:text-white shadow-sm'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('backToIntr')}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs font-bold text-orange">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('history')} ({history.length})</span>
                </div>
              </div>

              {history.length === 0 ? (
                <div
                  className={`text-center py-12 rounded-2xl border p-6 transition-colors ${
                    isDark
                      ? 'border-navy-border bg-navy-surface/50 text-neutral-muted'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  <Clock className="w-10 h-10 mx-auto text-orange/50 mb-2" />
                  <p className="text-xs font-semibold">{t('noHistory')}</p>
                </div>
              ) : (
                <TranscriptFeed
                  items={history}
                  voiceGender={voiceGender}
                  onClear={handleClearHistory}
                  onDeleteItem={handleDeleteItem}
                  onDeleteSelected={handleDeleteSelected}
                />
              )}
            </div>
          )}
        </main>

        {/* Compact Mobile Footer */}
        <footer
          className={`border-t py-2.5 px-3 text-center text-[10px] shrink-0 transition-colors ${
            isDark
              ? 'border-navy-border bg-navy text-neutral-muted'
              : 'border-slate-300 bg-white text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-semibold ${
                isDark ? 'text-neutral-light' : 'text-navy'
              }`}
            >
              Klarity Polyglot
            </span>
            <span>Produced by Klarity</span>
          </div>
        </footer>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} gender={voiceGender} onGenderChange={handleVoiceGenderChange} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppLanguageProvider>
        <AppContent />
      </AppLanguageProvider>
    </ThemeProvider>
  );
}
