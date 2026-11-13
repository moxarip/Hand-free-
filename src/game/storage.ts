import { HandSkinId, SaveData, SettingsData, ThrusterColorId } from '../types/game';

const STORAGE_KEY = 'sky_ascent_3d_save_v1';

export interface HandSkinPreset {
  id: HandSkinId;
  labelAr: string;
  primaryColor: string;
  secondaryColor: string;
  wireColor: string;
  conduitGlow: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  useCarbonTexture: boolean;
}

export const HAND_SKINS: Record<HandSkinId, HandSkinPreset> = {
  cyber_steel: {
    id: 'cyber_steel',
    labelAr: 'فولاذ سيبراني',
    primaryColor: '#b8c4d4',
    secondaryColor: '#263244',
    wireColor: '#d97706',
    conduitGlow: '#00e5ff',
    metalness: 0.88,
    roughness: 0.24,
    clearcoat: 0.55,
    useCarbonTexture: false,
  },
  gold_titanium: {
    id: 'gold_titanium',
    labelAr: 'تيتانيوم ذهبي',
    primaryColor: '#eab308',
    secondaryColor: '#292218',
    wireColor: '#fb7185',
    conduitGlow: '#fef08a',
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.75,
    useCarbonTexture: false,
  },
  black_carbon: {
    id: 'black_carbon',
    labelAr: 'كربون أسود',
    primaryColor: '#1e2430',
    secondaryColor: '#0c0f16',
    wireColor: '#ef4444',
    conduitGlow: '#10b981',
    metalness: 0.52,
    roughness: 0.42,
    clearcoat: 0.85,
    useCarbonTexture: true,
  },
  neon_violet: {
    id: 'neon_violet',
    labelAr: 'نيون بنفسجي',
    primaryColor: '#4c1d95',
    secondaryColor: '#130b24',
    wireColor: '#38bdf8',
    conduitGlow: '#e879f9',
    metalness: 0.82,
    roughness: 0.22,
    clearcoat: 0.9,
    useCarbonTexture: false,
  },
};

export interface ThrusterPreset {
  id: ThrusterColorId;
  labelAr: string;
  coreHex: string;
  outerHex: string;
}

export const THRUSTER_COLORS: Record<ThrusterColorId, ThrusterPreset> = {
  cyan: { id: 'cyan', labelAr: 'أزرق سيبراني', coreHex: '#e0faff', outerHex: '#00d4ff' },
  gold: { id: 'gold', labelAr: 'ذهبي ناري', coreHex: '#fffbeb', outerHex: '#f59e0b' },
  violet: { id: 'violet', labelAr: 'بنفسجي بلازما', coreHex: '#fdf4ff', outerHex: '#c026d3' },
  emerald: { id: 'emerald', labelAr: 'أخضر نيون', coreHex: '#ecfdf5', outerHex: '#10b981' },
};

export const DEFAULT_SETTINGS: SettingsData = {
  graphicsPreset: 'high',
  renderResolution: '100',
  showFps: false,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  windVolume: 0.6,
  muted: false,
  cameraSensitivity: 1.0,
  autoCameraFollow: true,
};

export const DEFAULT_SAVE: SaveData = {
  bestAltitude: 0,
  bestSummitTimeSec: null,
  selectedSkin: 'cyber_steel',
  selectedThruster: 'cyan',
  difficulty: 'CHECKPOINTS',
  settings: DEFAULT_SETTINGS,
};

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestAltitude: typeof parsed.bestAltitude === 'number' ? parsed.bestAltitude : 0,
      bestSummitTimeSec:
        typeof parsed.bestSummitTimeSec === 'number' ? parsed.bestSummitTimeSec : null,
      selectedSkin:
        parsed.selectedSkin && parsed.selectedSkin in HAND_SKINS
          ? parsed.selectedSkin
          : DEFAULT_SAVE.selectedSkin,
      selectedThruster:
        parsed.selectedThruster && parsed.selectedThruster in THRUSTER_COLORS
          ? parsed.selectedThruster
          : DEFAULT_SAVE.selectedThruster,
      difficulty:
        parsed.difficulty === 'CHALLENGE' || parsed.difficulty === 'CHECKPOINTS'
          ? parsed.difficulty
          : DEFAULT_SAVE.difficulty,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota or storage restriction errors
  }
}
