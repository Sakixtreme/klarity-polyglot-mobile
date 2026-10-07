import { Check, Mic2, X } from 'lucide-react';
import type { VoiceGender } from '../types/interpreter';
import { useTheme } from '../context/ThemeContext';
interface Props { open: boolean; onClose: () => void; gender: VoiceGender; onGenderChange: (gender: VoiceGender) => void; }
const options: { value: VoiceGender; title: string; description: string }[] = [
  { value: 'female', title: 'Femenina · Kore', description: 'Busca la voz Kore o una voz femenina local.' },
  { value: 'male', title: 'Masculina · Fenrir', description: 'Busca la voz Fenrir o una voz masculina local.' },
  { value: 'automatic', title: 'Auto', description: 'Estima el tono del hablante y elige una voz aproximada.' },
];
export function SettingsModal({ open, onClose, gender, onGenderChange }: Props) {
  const { isDark } = useTheme();
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`w-full max-w-[410px] rounded-t-2xl border p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl ${isDark ? 'border-navy-border bg-navy text-neutral-light' : 'border-slate-200 bg-white text-navy'}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange text-white"><Mic2 size={20} /></span><button className="grid h-9 w-9 place-items-center rounded-lg text-current opacity-70 hover:bg-black/10" onClick={onClose} aria-label="Cerrar ajustes"><X size={19} /></button></div>
    <h2 id="settings-title" className="mt-4 text-xl font-bold">Ajustes de voz</h2><p className="mt-1 text-xs opacity-70">Elige el perfil para la interpretación hablada.</p>
    <div className="mt-5 grid gap-2">{options.map((option) => <button key={option.value} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3 text-left ${gender === option.value ? 'border-orange bg-orange/10' : isDark ? 'border-navy-border' : 'border-slate-200'}`} onClick={() => onGenderChange(option.value)}><span><b className="block text-xs">{option.title}</b><small className="mt-1 block text-[10px] leading-4 opacity-70">{option.description}</small></span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${gender === option.value ? 'border-orange bg-orange text-white' : 'border-current opacity-40'}`}>{gender === option.value && <Check size={13} />}</span></button>)}</div>
    <p className="mt-4 text-[10px] leading-4 opacity-60">La disponibilidad de voces depende del dispositivo. El modo automático estima el tono; no identifica de forma fiable el género.</p>
    <button className="mt-4 min-h-11 w-full rounded-xl bg-orange text-sm font-bold text-white" onClick={onClose}>Listo</button>
  </section></div>;
}
