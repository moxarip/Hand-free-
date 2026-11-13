import React from 'react';
import { Monitor, Sliders, Volume2, VolumeX, X } from 'lucide-react';
import {
  GraphicsPreset,
  RenderResolution,
  SettingsData,
} from '../types/game';

interface SettingsModalProps {
  settings: SettingsData;
  onUpdate: (next: SettingsData) => void;
  onClose: () => void;
}

const GRAPHICS_OPTIONS: { id: GraphicsPreset; label: string }[] = [
  { id: 'low', label: 'منخفض' },
  { id: 'medium', label: 'متوسط' },
  { id: 'high', label: 'عالي' },
  { id: 'ultra', label: 'فائق' },
];

const RES_OPTIONS: { id: RenderResolution; label: string }[] = [
  { id: '50', label: '50%' },
  { id: '75', label: '75%' },
  { id: '100', label: '100%' },
  { id: 'ultra', label: 'فائق' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const patch = (partial: Partial<SettingsData>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-md"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-900/95 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-lg font-black text-amber-300">الإعدادات</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content in Landscape */}
        <div className="grid grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
          {/* Graphics & Resolution */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
              <Monitor className="h-4 w-4" />
              <span>الغرافيك والوضوح</span>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-300">جودة الرسوميات</div>
              <div className="grid grid-cols-4 gap-1.5">
                {GRAPHICS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ graphicsPreset: opt.id })}
                    className={`min-h-[36px] rounded-xl text-xs font-bold transition ${
                      settings.graphicsPreset === opt.id
                        ? 'border border-amber-400 bg-amber-500/25 text-amber-200'
                        : 'border border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-300">دقة العرض (Render)</div>
              <div className="grid grid-cols-4 gap-1.5">
                {RES_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ renderResolution: opt.id })}
                    className={`min-h-[36px] rounded-xl text-xs font-bold transition ${
                      settings.renderResolution === opt.id
                        ? 'border border-cyan-400 bg-cyan-500/25 text-cyan-200'
                        : 'border border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-xs font-bold text-slate-200">إظهار عداد FPS</span>
              <input
                type="checkbox"
                checked={settings.showFps}
                onChange={(e) => patch({ showFps: e.target.checked })}
                className="h-4 w-4 accent-amber-400"
              />
            </label>
          </div>

          {/* Audio & Controls */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                {settings.muted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                <span>الصوت</span>
              </div>
              <button
                type="button"
                onClick={() => patch({ muted: !settings.muted })}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  settings.muted
                    ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                }`}
              >
                {settings.muted ? 'مكتوم' : 'مفعّل'}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="mb-1 flex justify-between text-slate-300">
                  <span>الصوت العام</span>
                  <span className="font-mono">{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  onChange={(e) => patch({ masterVolume: parseFloat(e.target.value) })}
                  className="cyber-slider w-full"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-slate-300">
                  <span>المؤثرات والمحركات</span>
                  <span className="font-mono">{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  onChange={(e) => patch({ sfxVolume: parseFloat(e.target.value) })}
                  className="cyber-slider w-full"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-slate-300">
                  <span>صوت الرياح والارتفاع</span>
                  <span className="font-mono">{Math.round(settings.windVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.windVolume}
                  onChange={(e) => patch({ windVolume: parseFloat(e.target.value) })}
                  className="cyber-slider w-full"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-2.5">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-300">
                <Sliders className="h-4 w-4" />
                <span>التحكم</span>
              </div>
              <div className="mb-2 text-xs">
                <div className="mb-1 flex justify-between text-slate-300">
                  <span>حساسية الكاميرا</span>
                  <span className="font-mono">{settings.cameraSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={settings.cameraSensitivity}
                  onChange={(e) => patch({ cameraSensitivity: parseFloat(e.target.value) })}
                  className="cyber-slider w-full"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-xs font-bold text-slate-200">تتبّع الكاميرا التلقائي</span>
                <input
                  type="checkbox"
                  checked={settings.autoCameraFollow}
                  onChange={(e) => patch({ autoCameraFollow: e.target.checked })}
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
