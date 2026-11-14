export type GameState = 'SPLASH' | 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY';

export type DifficultyMode = 'CHECKPOINTS' | 'HARDCORE';

export type RelicSkinId =
  | 'immortal_gold'
  | 'cursed_obsidian'
  | 'spectral_ivory'
  | 'eternal_ember';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export type RenderResolution = '50' | '75' | '100' | 'ultra';

export type BiomeId = 1 | 2 | 3 | 4;

export type SurfaceType = 'obsidian' | 'stone' | 'crystal' | 'gold';

export type PlatformKind =
  | 'shrine'
  | 'obsidian'
  | 'sword'
  | 'rune_pad'
  | 'pillar'
  | 'elevator'
  | 'pendulum'
  | 'crystal'
  | 'wind_slab'
  | 'astral_disc'
  | 'throne';

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
  rotY?: number;
  // Dynamic platform motion (elevators, pendulums, orbiting discs)
  moveAxis?: 'x' | 'y' | 'z';
  moveAmp?: number;
  moveSpeed?: number;
  movePhase?: number;
  pendulumPivotX?: number;
  pendulumPivotY?: number;
  pendulumPivotZ?: number;
  pendulumLen?: number;
  pendulumSpeed?: number;
  pendulumMaxAngle?: number;
  pendulumPhase?: number;
  orbitCenterX?: number;
  orbitCenterZ?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitPhase?: number;
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

export interface SoulAnchorDef {
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
  bestReunionTimeSec: number | null;
  selectedSkin: RelicSkinId;
  difficulty: DifficultyMode;
  settings: SettingsData;
}

export interface HudDomRefs {
  altitudeEl: HTMLSpanElement | null;
  altitudeBarEl: HTMLDivElement | null;
  distToMasterEl: HTMLSpanElement | null;
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

export interface EngineInputState {
  moveX: number;
  moveY: number;
  camYaw: number;
  camPitch: number;
  jumpPressed: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
  grappleJustPressed: boolean;
}
