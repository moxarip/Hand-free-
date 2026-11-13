export type GameState = 'SPLASH' | 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY';

export type DifficultyMode = 'CHALLENGE' | 'CHECKPOINTS';

export type HandSkinId = 'cyber_steel' | 'gold_titanium' | 'black_carbon' | 'neon_violet';

export type ThrusterColorId = 'cyan' | 'gold' | 'violet' | 'emerald';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export type RenderResolution = '50' | '75' | '100' | 'ultra';

export type BiomeId = 1 | 2 | 3 | 4;

export type SurfaceMaterialType = 'metal' | 'glass' | 'stone' | 'wood';

export type PlatformKind =
  | 'launchpad'
  | 'container'
  | 'ibeam'
  | 'plank'
  | 'trampoline'
  | 'island'
  | 'moving'
  | 'turbine_blade'
  | 'hypercar'
  | 'neon_rail'
  | 'glass'
  | 'asteroid'
  | 'satellite'
  | 'summit';

export interface PlatformDef {
  id: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: PlatformKind;
  biome: BiomeId;
  colorHex: string;
  accentHex?: string;
  rotY?: number;
  // Moving / swinging platform parameters
  moveAxis?: 'x' | 'y' | 'z';
  moveAmp?: number;
  moveSpeed?: number;
  movePhase?: number;
  // Rotating turbine blade parameters
  rotCenterX?: number;
  rotCenterZ?: number;
  rotRadius?: number;
  rotSpeed?: number;
  rotAngleOffset?: number;
  // Special interactions
  bounceVel?: number;
  checkpointIndex?: number;
}

export interface CheckpointDef {
  index: number;
  altitude: number;
  x: number;
  y: number;
  z: number;
}

export interface GrappleAnchorDef {
  id: number;
  x: number;
  y: number;
  z: number;
  biome: BiomeId;
}

export interface SettingsData {
  graphicsPreset: GraphicsPreset;
  renderResolution: RenderResolution;
  showFps: boolean;
  masterVolume: number;
  sfxVolume: number;
  windVolume: number;
  muted: boolean;
  cameraSensitivity: number;
  autoCameraFollow: boolean;
}

export interface SaveData {
  bestAltitude: number;
  bestSummitTimeSec: number | null;
  selectedSkin: HandSkinId;
  selectedThruster: ThrusterColorId;
  difficulty: DifficultyMode;
  settings: SettingsData;
}

export interface HudDomRefs {
  altitudeEl: HTMLSpanElement | null;
  altitudeBarEl: HTMLDivElement | null;
  timerEl: HTMLSpanElement | null;
  biomeEl: HTMLSpanElement | null;
  fpsEl: HTMLSpanElement | null;
  dashRingCircleEl: SVGCircleElement | null;
  dashBtnEl: HTMLButtonElement | null;
  dashLabelEl: HTMLSpanElement | null;
  grappleBtnEl: HTMLButtonElement | null;
  ledgeBannerEl: HTMLDivElement | null;
  fallCamBannerEl: HTMLDivElement | null;
  fallCamDistEl: HTMLSpanElement | null;
}
