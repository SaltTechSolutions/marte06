// src/constants/ui.ts
// UI ile ilgili sabitler

// Breakpoints (mobil-first tasarım için)
export const BREAKPOINTS = {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
    wide: 1280,
} as const;

// Animasyon süreleri (ms)
export const ANIMATION_DURATION = {
    fast: 150,
    normal: 300,
    slow: 500,
} as const;

// Varsayılan boşluklar
export const SPACING = {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    xxl: '3rem',    // 48px
} as const;

// Loading durumları için mesajlar
export const LOADING_MESSAGES = {
    default: 'Yükleniyor...',
    saving: 'Kaydediliyor...',
    deleting: 'Siliniyor...',
    fetching: 'Veriler alınıyor...',
    uploading: 'Yükleniyor...',
} as const;

// Modal boyutları
export const MODAL_SIZES = {
    sm: '400px',
    md: '600px',
    lg: '800px',
    xl: '1000px',
    full: '100%',
} as const;

// Bottom sheet snap noktaları
export const SHEET_SNAP_POINTS = {
    closed: 0,
    quarter: 0.25,
    half: 0.5,
    threeQuarters: 0.75,
    full: 1,
} as const;

// Dokunma hedef boyutları (mobil erişilebilirlik)
export const TOUCH_TARGET = {
    minimum: 44, // px - Apple HIG standartı
    comfortable: 48, // px
} as const;

// Z-index katmanları
export const Z_INDEX = {
    base: 0,
    dropdown: 100,
    sticky: 200,
    modal: 300,
    overlay: 400,
    toast: 500,
    tooltip: 600,
} as const;
