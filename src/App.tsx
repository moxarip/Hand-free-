import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { HUD } from './components/HUD';
import {
  HowToPlayModal,
  MainMenu,
  PauseModal,
  SettingsModal,
  SplashScreen,
  VictoryModal,
} from './components/Menus';
import { soundEngine } from './game/audio';
import { GameEngine } from './game/GameEngine';
import { loadSaveData, persistSaveData } from './game/storage';
import {
  DifficultyMode,
  EngineInputState,
  GameState,
  HudDomRefs,
  RelicSkinId,
  SaveData,
  SettingsData,
} from './types/game';

export function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [activeCheckpointIdx, setActiveCheckpointIdx] = useState(-1);
  const [checkpointBanner, setCheckpointBanner] = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [victoryTimeSec, setVictoryTimeSec] = useState(0);
  const [isPortraitWarning, setIsPortraitWarning] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const inputRef = useRef<EngineInputState>({
    moveX: 0,
    moveY: 0,
    camYaw: 0,
    camPitch: 0.34,
    jumpPressed: false,
    jumpJustPressed: false,
    dashJustPressed: false,
    grappleJustPressed: false,
  });

  const hudRefs = useRef<HudDomRefs>({
    altitudeEl: null,
    altitudeBarEl: null,
    distToMasterEl: null,
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

  const handleCheckpointReached = useCallback((idx: number, altitude: number) => {
    setActiveCheckpointIdx(idx);
    setCheckpointBanner(`تم إيقاد موقد الروح (${altitude}m)`);
    window.setTimeout(() => {
      setCheckpointBanner((prev) => (prev?.includes(`${altitude}m`) ? null : prev));
    }, 2800);
  }, []);

  const handleMilestoneReached = useCallback((altitude: number) => {
    const text =
      altitude === 250
        ? '250m: تجاوزت هاوية الرماد إلى الأطلال المعلقة!'
        : altitude === 500
          ? '500m: دخلت قمم البلورات الطيفية!'
          : '750m: عرش الخلود يقترب... المالك ينتظر!';
    setMilestoneBanner(text);
    window.setTimeout(() => {
      setMilestoneBanner((prev) => (prev === text ? null : prev));
    }, 3400);
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
        prev.bestReunionTimeSec === null
          ? elapsedSec
          : Math.min(prev.bestReunionTimeSec, elapsedSec);
      return {
        ...prev,
        bestAltitude: Math.max(prev.bestAltitude, 1000),
        bestReunionTimeSec: nextBestTime,
      };
    });
    setGameState('VICTORY');
  }, []);

  // Initialize pure Three.js GameEngine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialSave = loadSaveData();
    let engine: GameEngine | null = null;
    try {
      engine = new GameEngine(
        canvas,
        initialSave.selectedSkin,
        initialSave.settings,
        inputRef.current,
        hudRefs.current,
        {
          onCheckpointReached: handleCheckpointReached,
          onMilestoneReached: handleMilestoneReached,
          onAltitudeRecord: handleAltitudeRecord,
          onVictory: handleVictory,
        }
      );
      engine.setDifficulty(initialSave.difficulty);
      engineRef.current = engine;
    } catch (err) {
      console.error('WebGL initialization failed:', err);
      setWebglError(true);
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [
    handleAltitudeRecord,
    handleCheckpointReached,
    handleMilestoneReached,
    handleVictory,
  ]);

  useEffect(() => {
    persistSaveData(saveData);
    engineRef.current?.applySettings(saveData.settings);
    engineRef.current?.setSkin(saveData.selectedSkin);
    engineRef.current?.setDifficulty(saveData.difficulty);
  }, [saveData]);

  useEffect(() => {
    engineRef.current?.setGameState(gameState);
    engineRef.current?.setHudRefs(hudRefs.current);
  }, [gameState]);

  useEffect(() => {
    engineRef.current?.setActiveCheckpoint(activeCheckpointIdx);
  }, [activeCheckpointIdx]);

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
      } else if (showHowToPlay) {
        setShowHowToPlay(false);
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
  }, [gameState, showSettings, showHowToPlay]);

  const handleStartPlay = useCallback(() => {
    soundEngine.init();
    setActiveCheckpointIdx(-1);
    setCheckpointBanner(null);
    setMilestoneBanner(null);
    engineRef.current?.setActiveCheckpoint(-1);
    engineRef.current?.startNewRun();
    setGameState('PLAYING');
  }, []);

  const handleSplashComplete = useCallback(() => {
    setGameState('MENU');
  }, []);

  const handlePause = useCallback(() => {
    setGameState('PAUSED');
  }, []);

  const handleReturnCheckpoint = useCallback(() => {
    engineRef.current?.returnToCheckpoint();
  }, []);

  const handleResetCamera = useCallback(() => {
    engineRef.current?.resetCameraBehindHand();
  }, []);

  const updateSettings = useCallback((settings: SettingsData) => {
    setSaveData((prev) => ({ ...prev, settings }));
  }, []);

  const updateDifficulty = useCallback((difficulty: DifficultyMode) => {
    setSaveData((prev) => ({ ...prev, difficulty }));
  }, []);

  const updateSkin = useCallback((selectedSkin: RelicSkinId) => {
    setSaveData((prev) => ({ ...prev, selectedSkin }));
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0714]">
      {/* Layer 0: Full-Screen 3D Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 block h-full w-full" />

      {/* Layer 20: Screens & In-Game HUD */}
      {gameState === 'SPLASH' && <SplashScreen onComplete={handleSplashComplete} />}

      {gameState === 'MENU' && (
        <MainMenu
          bestAltitude={saveData.bestAltitude}
          bestReunionTimeSec={saveData.bestReunionTimeSec}
          difficulty={saveData.difficulty}
          selectedSkin={saveData.selectedSkin}
          onChangeDifficulty={updateDifficulty}
          onChangeSkin={updateSkin}
          onPlay={handleStartPlay}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {gameState === 'PLAYING' && (
        <HUD
          hudRefs={hudRefs}
          inputRef={inputRef}
          active={gameState === 'PLAYING' && !showSettings}
          showFps={saveData.settings.showFps}
          difficulty={saveData.difficulty}
          cameraSensitivity={saveData.settings.cameraSensitivity}
          checkpointBanner={checkpointBanner}
          milestoneBanner={milestoneBanner}
          onPause={handlePause}
          onReturnCheckpoint={handleReturnCheckpoint}
          onResetCamera={handleResetCamera}
        />
      )}

      {gameState === 'PAUSED' && !showSettings && (
        <PauseModal
          difficulty={saveData.difficulty}
          hasCheckpoint={activeCheckpointIdx >= 0}
          onResume={() => setGameState('PLAYING')}
          onReturnCheckpoint={() => {
            engineRef.current?.returnToCheckpoint();
            setGameState('PLAYING');
          }}
          onRestartFromZero={handleStartPlay}
          onOpenSettings={() => setShowSettings(true)}
          onMainMenu={() => setGameState('MENU')}
        />
      )}

      {gameState === 'VICTORY' && (
        <VictoryModal
          elapsedSec={victoryTimeSec}
          bestReunionTimeSec={saveData.bestReunionTimeSec}
          difficulty={saveData.difficulty}
          onPlayAgain={handleStartPlay}
          onMainMenu={() => setGameState('MENU')}
        />
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {showSettings && (
        <SettingsModal
          settings={saveData.settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {webglError && (
        <div
          dir="rtl"
          className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-rose-400/50 bg-rose-950/90 px-4 py-2 text-xs font-bold text-rose-100 shadow-xl"
        >
          تعذر تشغيل رسوميات WebGL ثلاثية الأبعاد على هذا الجهاز.
        </div>
      )}

      {isPortraitWarning && !portraitDismissed && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090612]/95 p-6 text-center backdrop-blur-md"
        >
          <RotateCw className="mb-3 h-12 w-12 animate-spin text-amber-400" />
          <h2 className="text-xl font-black text-white">يرجى تدوير الهاتف أفقياً</h2>
          <p className="mt-1 text-xs text-slate-300">
            تم تصميم لعبة اليد الخالدة: رحلة العودة للوضع الأفقي (Landscape) للحصول على أفضل تحكم باليدين.
          </p>
          <button
            type="button"
            onClick={() => setPortraitDismissed(true)}
            className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/20 px-5 py-2.5 text-xs font-black text-amber-200 active:scale-95"
          >
            متابعة اللعب على أي حال
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
