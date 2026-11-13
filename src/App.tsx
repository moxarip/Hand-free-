import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { RotateCw } from 'lucide-react';
import { GameHud } from './components/GameHud';
import { GameScene } from './components/GameScene';
import { MainMenu } from './components/MainMenu';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { TouchControls } from './components/TouchControls';
import { VictoryModal } from './components/VictoryModal';
import { inputState } from './game/inputRef';
import { soundEngine } from './game/soundEngine';
import { loadSaveData, persistSaveData } from './game/storage';
import {
  DifficultyMode,
  GameState,
  HandSkinId,
  HudDomRefs,
  RenderResolution,
  SaveData,
  SettingsData,
  ThrusterColorId,
} from './types/game';

function resolveDpr(res: RenderResolution): number | [number, number] {
  switch (res) {
    case '50':
      return 0.55;
    case '75':
      return 0.8;
    case '100':
      return [1, 1.5];
    case 'ultra':
      return [1.25, 2];
  }
}

export function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [showSettings, setShowSettings] = useState(false);
  const [activeCheckpointIdx, setActiveCheckpointIdx] = useState(-1);
  const [checkpointBanner, setCheckpointBanner] = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [victoryTimeSec, setVictoryTimeSec] = useState(0);
  const [runSessionId, setRunSessionId] = useState(1);
  const [isPortraitWarning, setIsPortraitWarning] = useState(false);

  const hudRefs = useRef<HudDomRefs>({
    altitudeEl: null,
    altitudeBarEl: null,
    timerEl: null,
    biomeEl: null,
    fpsEl: null,
    dashRingCircleEl: null,
    dashBtnEl: null,
    dashLabelEl: null,
    grappleBtnEl: null,
    ledgeBannerEl: null,
    fallCamBannerEl: null,
    fallCamDistEl: null,
  });

  useEffect(() => {
    persistSaveData(saveData);
    soundEngine.applySettings(saveData.settings);
  }, [saveData]);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth * 1.1 && window.innerWidth < 768;
      setIsPortraitWarning(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    const onAndroidBack = () => {
      if (showSettings) {
        setShowSettings(false);
      } else if (gameState === 'PLAYING') {
        setGameState('PAUSED');
      } else if (gameState === 'PAUSED') {
        setGameState('PLAYING');
      } else if (gameState === 'VICTORY') {
        setGameState('MENU');
      }
    };
    window.addEventListener('android-back', onAndroidBack);
    return () => window.removeEventListener('android-back', onAndroidBack);
  }, [gameState, showSettings]);

  const handleStartPlay = useCallback(() => {
    soundEngine.init();
    setActiveCheckpointIdx(-1);
    setCheckpointBanner(null);
    setMilestoneBanner(null);
    setRunSessionId((id) => id + 1);
    setGameState('PLAYING');
  }, []);

  const handleCheckpointReached = useCallback((idx: number, altitude: number) => {
    setActiveCheckpointIdx(idx);
    setCheckpointBanner(`تم تفعيل نقطة الحفظ (${altitude}m)`);
    window.setTimeout(() => {
      setCheckpointBanner((prev) => (prev?.includes(`${altitude}m`) ? null : prev));
    }, 2600);
  }, []);

  const handleMilestoneReached = useCallback((altitude: number) => {
    const text =
      altitude === 250
        ? '250m: اخترقت السحاب!'
        : altitude === 500
          ? '500m: طبقة الستراتوسفير!'
          : '750m: حدود الفضاء!';
    setMilestoneBanner(text);
    window.setTimeout(() => {
      setMilestoneBanner((prev) => (prev === text ? null : prev));
    }, 3200);
  }, []);

  const handleAltitudeRecord = useCallback((altitude: number) => {
    setSaveData((prev) => {
      if (altitude <= prev.bestAltitude) return prev;
      return { ...prev, bestAltitude: altitude };
    });
  }, []);

  const handleVictory = useCallback((elapsedSec: number) => {
    setVictoryTimeSec(elapsedSec);
    setSaveData((prev) => {
      const nextBestTime =
        prev.bestSummitTimeSec === null
          ? elapsedSec
          : Math.min(prev.bestSummitTimeSec, elapsedSec);
      return {
        ...prev,
        bestAltitude: Math.max(prev.bestAltitude, 1000),
        bestSummitTimeSec: nextBestTime,
      };
    });
    setGameState('VICTORY');
  }, []);

  const updateSettings = useCallback((nextSettings: SettingsData) => {
    setSaveData((prev) => ({ ...prev, settings: nextSettings }));
  }, []);

  const updateDifficulty = useCallback((difficulty: DifficultyMode) => {
    soundEngine.init();
    setSaveData((prev) => ({ ...prev, difficulty }));
  }, []);

  const updateSkin = useCallback((selectedSkin: HandSkinId) => {
    soundEngine.init();
    setSaveData((prev) => ({ ...prev, selectedSkin }));
  }, []);

  const updateThruster = useCallback((selectedThruster: ThrusterColorId) => {
    soundEngine.init();
    setSaveData((prev) => ({ ...prev, selectedThruster }));
  }, []);

  const dpr = useMemo(
    () => resolveDpr(saveData.settings.renderResolution),
    [saveData.settings.renderResolution]
  );

  const shadowsEnabled =
    saveData.settings.graphicsPreset === 'high' ||
    saveData.settings.graphicsPreset === 'ultra';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070b14]">
      <Canvas
        shadows={shadowsEnabled}
        dpr={dpr}
        camera={{ fov: 62, near: 0.15, far: 460, position: [0, 3.2, -5.8] }}
        gl={{
          antialias: saveData.settings.graphicsPreset !== 'low',
          powerPreference: 'high-performance',
        }}
      >
        <GameScene
          gameState={gameState}
          difficulty={saveData.difficulty}
          skinId={saveData.selectedSkin}
          thrusterId={saveData.selectedThruster}
          settings={saveData.settings}
          hudRefs={hudRefs}
          activeCheckpointIdx={activeCheckpointIdx}
          onCheckpointReached={handleCheckpointReached}
          onMilestoneReached={handleMilestoneReached}
          onAltitudeRecord={handleAltitudeRecord}
          onVictory={handleVictory}
          runSessionId={runSessionId}
        />
      </Canvas>

      {gameState === 'SPLASH' && (
        <SplashScreen onComplete={() => setGameState('MENU')} />
      )}

      {gameState === 'MENU' && (
        <MainMenu
          bestAltitude={saveData.bestAltitude}
          bestSummitTimeSec={saveData.bestSummitTimeSec}
          difficulty={saveData.difficulty}
          selectedSkin={saveData.selectedSkin}
          selectedThruster={saveData.selectedThruster}
          onChangeDifficulty={updateDifficulty}
          onChangeSkin={updateSkin}
          onChangeThruster={updateThruster}
          onPlay={handleStartPlay}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {gameState === 'PLAYING' && (
        <>
          <GameHud
            hudRefs={hudRefs}
            showFps={saveData.settings.showFps}
            difficulty={saveData.difficulty}
            checkpointBanner={checkpointBanner}
            milestoneBanner={milestoneBanner}
            onPause={() => setGameState('PAUSED')}
          />
          <TouchControls
            active={gameState === 'PLAYING' && !showSettings}
            cameraSensitivity={saveData.settings.cameraSensitivity}
            hudRefs={hudRefs}
            onPausePress={() => setGameState('PAUSED')}
          />
        </>
      )}

      {gameState === 'PAUSED' && !showSettings && (
        <PauseModal
          difficulty={saveData.difficulty}
          hasCheckpoint={activeCheckpointIdx >= 0}
          onResume={() => setGameState('PLAYING')}
          onReturnCheckpoint={() => {
            inputState.resetToCheckpointRequested = true;
            setGameState('PLAYING');
          }}
          onRestartFromZero={() => {
            setActiveCheckpointIdx(-1);
            setCheckpointBanner(null);
            setMilestoneBanner(null);
            inputState.restartFromZeroRequested = true;
            setGameState('PLAYING');
          }}
          onOpenSettings={() => setShowSettings(true)}
          onMainMenu={() => setGameState('MENU')}
        />
      )}

      {gameState === 'VICTORY' && (
        <VictoryModal
          elapsedSec={victoryTimeSec}
          bestSummitTimeSec={saveData.bestSummitTimeSec}
          onPlayAgain={handleStartPlay}
          onMainMenu={() => setGameState('MENU')}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={saveData.settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {isPortraitWarning && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-md"
        >
          <RotateCw className="mb-3 h-12 w-12 animate-spin text-amber-400" />
          <h2 className="text-xl font-black text-white">يرجى تدوير الهاتف أفقياً</h2>
          <p className="mt-1 text-xs text-slate-300">
            تم تصميم لعبة الصعود المستحيل 3D للوضع الأفقي (Landscape) للحصول على أفضل تحكم باليدين.
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
