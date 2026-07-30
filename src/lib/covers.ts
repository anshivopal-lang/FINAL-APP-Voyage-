/**
 * Cover art. Presets are pure CSS gradients so the app has no image-hosting
 * dependency; a member can also paste any https image URL instead.
 */
export interface CoverPreset {
  key: string;
  label: string;
  gradient: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  {
    key: 'aurora',
    label: 'Aurora',
    gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 45%, #2c5364 100%)',
  },
  {
    key: 'sunset',
    label: 'Sunset',
    gradient: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 55%, #b8143c 100%)',
  },
  {
    key: 'lagoon',
    label: 'Lagoon',
    gradient: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
  },
  {
    key: 'sand',
    label: 'Sand',
    gradient: 'linear-gradient(135deg, #e6c78d 0%, #c79a5b 50%, #8a6033 100%)',
  },
  {
    key: 'alpine',
    label: 'Alpine',
    gradient: 'linear-gradient(135deg, #8e9eab 0%, #465060 60%, #232833 100%)',
  },
  {
    key: 'orchid',
    label: 'Orchid',
    gradient: 'linear-gradient(135deg, #7f5a83 0%, #0d324d 100%)',
  },
  {
    key: 'citrus',
    label: 'Citrus',
    gradient: 'linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%)',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    gradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
  },
];

const PRESET_BY_KEY = new Map(COVER_PRESETS.map((preset) => [preset.key, preset]));

export function isImageUrl(cover: string): boolean {
  return /^https?:\/\//i.test(cover);
}

/** Resolves a stored cover value into an inline `background` value. */
export function coverBackground(cover: string): string {
  if (isImageUrl(cover)) {
    return `linear-gradient(180deg, rgba(9,12,20,0.15) 0%, rgba(9,12,20,0.75) 100%), url("${cover}") center/cover no-repeat`;
  }
  return PRESET_BY_KEY.get(cover)?.gradient ?? COVER_PRESETS[0].gradient;
}

export const PHOTO_GRADIENTS: string[] = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
];

export const AVATAR_COLORS: string[] = [
  '#8b6f3f',
  '#3f6b8b',
  '#6b3f8b',
  '#3f8b6b',
  '#8b3f4f',
  '#4f4f8b',
  '#8b7a3f',
];
