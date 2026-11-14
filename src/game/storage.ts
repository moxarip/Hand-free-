import { RelicSkinId, SaveData, SettingsData } from '../types/game';

const STORAGE_KEY = 'immortal_hand_3d_save_v1';

export interface RelicSkinPreset {
  id: RelicSkinId;
  labelAr: string;
  armorHex: string;
  trimHex: string;
  veinHex: string;
  flameCoreHex: string;
  flameOuterHex: string;
  metalness: number;
  roughness: number;
}

export const RELIC_SKINS: Record<RelicSkinId, RelicSkinPreset> = {
  immortal_gold: {
    id: 'immortal_gold',
    labelAr: 'الذهب الخالد',
    armorHex: '#241e18',
    trimHex: '#eab308',
    veinHex: '#fde047',
    flameCoreHex: '#fffbeb',
    flameOuterHex: '#f59e0b',
    metalness: 0.88,
    roughness: 0.22,
  },
  cursed_obsidian: {
    id: 'cursed_obsidian',
    labelAr: 'السبج الملعون',
    armorHex: '#12101a',
    trimHex: '#6366f1',
    veinHex: '#22d3ee',
    flameCoreHex: '#e0faff',
    flameOuterHex: '#06b6d4',
    metalness: 0.82,
    roughness: 0.26,
  },
  spectral_ivory: {
    id: 'spectral_ivory',
    labelAr: 'العاج الطيفي',
    armorHex: '#d6d3d1',
    trimHex: '#0d9488',
    veinHex: '#5eead4',
    flameCoreHex: '#ecfdf5',
    flameOuterHex: '#14b8a6',
    metalness: 0.55,
    roughness: 0.34,
  },
  eternal_ember: {
    id: 'eternal_ember',
    labelAr: 'الجمر الأبدي',
    armorHex: '#1c1210',
    trimHex: '#dc2626',
    veinHex: '#fb923c',
    flameCoreHex: '#fff7ed',
    flameOuterHex: '#ef4444',
    metalness: 0.84,
    roughness: 0.25,
  },
};

export const DEFAULT_SETTINGS: SettingsData = {
  graphicsPreset: 'high',
  renderResolution: '100',
  showFps: false,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  windVolume: 0.65,
  muted: false,
  cameraSensitivity: 1.0,
  autoCameraFollow: true,
};

export const DEFAULT_SAVE: SaveData = {
  bestAltitude: 0,
  bestReunionTimeSec: null,
  selectedSkin: 'immortal_gold',
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
      bestReunionTimeSec:
        typeof parsed.bestReunionTimeSec === 'number' ? parsed.bestReunionTimeSec : null,
      selectedSkin:
        parsed.selectedSkin && parsed.selectedSkin in RELIC_SKINS
          ? parsed.selectedSkin
          : DEFAULT_SAVE.selectedSkin,
      difficulty:
        parsed.difficulty === 'HARDCORE' || parsed.difficulty === 'CHECKPOINTS'
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
    // Ignore storage quota errors
  }
}
