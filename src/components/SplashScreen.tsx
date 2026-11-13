import React, { useEffect, useState } from 'react';
import { getCourseData } from '../game/courseGenerator';
import { getProceduralTextures } from '../game/proceduralTextures';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(12);
  const [statusText, setStatusText] = useState('جارٍ تهيئة المحرك الثلاثي الأبعاد...');

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      getProceduralTextures();
      setProgress(54);
      setStatusText('جارٍ توليد مسار الصعود (1000 متر)...');
    }, 260);

    const t2 = window.setTimeout(() => {
      getCourseData();
      setProgress(92);
      setStatusText('جارٍ تجهيز اليد السايبرانية والمؤثرات الصوتية...');
    }, 620);

    const t3 = window.setTimeout(() => {
      setProgress(100);
      onComplete();
    }, 1050);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#070b14] via-[#11192e] to-[#1e1b4b] px-6 text-center"
    >
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold text-amber-300">
        <span>إصدار ثلاثي الأبعاد متكامل</span>
      </div>

      <h1 className="bg-gradient-to-l from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-[0_4px_20px_rgba(251,191,36,0.35)] sm:text-5xl">
        الصعود المستحيل 3D
      </h1>
      <p className="mt-1.5 text-sm font-medium text-cyan-200/80">
        Sky Ascent 3D — مغامرة اليد السايبرانية
      </p>

      <div className="mt-8 w-full max-w-sm">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
          <div
            style={{ width: `${progress}%` }}
            className="h-full rounded-full bg-gradient-to-l from-amber-400 via-yellow-400 to-cyan-400 transition-all duration-300"
          />
        </div>
        <p className="mt-2.5 text-xs text-slate-300">{statusText}</p>
      </div>
    </div>
  );
};
