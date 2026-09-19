// ── Dynamic Office Theme Utilities ──────────────────────────────────────────

const COLOR_NAME_MAP = {
    // English names
    'blue': '#2563eb',
    'sky': '#0284c7',
    'cyan': '#0891b2',
    'teal': '#0d9488',
    'emerald': '#059669',
    'green': '#16a34a',
    'lime': '#65a30d',
    'yellow': '#ca8a04',
    'amber': '#d97706',
    'orange': '#ea580c',
    'red': '#dc2626',
    'rose': '#e11d48',
    'pink': '#db2777',
    'purple': '#9333ea',
    'violet': '#7c3aed',
    'indigo': '#4f46e5',
    'slate': '#475569',
    'gray': '#4b5563',
    'brown': '#8B5E3C',
    // Japanese names
    '青': '#2563eb',
    '水色': '#0284c7',
    '緑': '#16a34a',
    '黄緑': '#65a30d',
    '黄': '#ca8a04',
    '黄色': '#ca8a04',
    '橙': '#ea580c',
    'オレンジ': '#ea580c',
    '赤': '#dc2626',
    'ピンク': '#db2777',
    '紫': '#9333ea',
    '茶': '#8B5E3C',
    '茶色': '#8B5E3C',
    '紺': '#1e3a8a',
    '黒': '#1e293b'
};

const DEFAULT_BASE_HEX = '#28A745';

/**
 * Robust color parser accepting HEX, RGB, RGBA, color names (EN/JA), or color objects.
 * Returns [r, g, b] or null.
 */
export function parseAnyColor(input) {
    if (!input) return null;

    // 1. If input is an object
    if (typeof input === 'object') {
        const val = input.hex || input.color || input.value || input.rgb || input.code;
        if (val && typeof val !== 'object') return parseAnyColor(val);
    }

    if (typeof input !== 'string') return null;
    let str = input.trim().toLowerCase();

    // 2. Check Color Name map
    if (COLOR_NAME_MAP[str]) {
        return parseAnyColor(COLOR_NAME_MAP[str]);
    }

    // 3. RGB / RGBA: rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = str.match(/rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (rgbMatch) {
        return [
            Math.min(255, parseInt(rgbMatch[1], 10)),
            Math.min(255, parseInt(rgbMatch[2], 10)),
            Math.min(255, parseInt(rgbMatch[3], 10))
        ];
    }

    // 4. Pure "R, G, B" or "R G B"
    const numMatch = str.match(/^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/);
    if (numMatch) {
        return [
            Math.min(255, parseInt(numMatch[1], 10)),
            Math.min(255, parseInt(numMatch[2], 10)),
            Math.min(255, parseInt(numMatch[3], 10))
        ];
    }

    // 5. HEX format (#fff, #ffffff, fff, ffffff)
    let cleanHex = str.replace(/^#/, '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length === 6 && /^[0-9a-f]{6}$/i.test(cleanHex)) {
        const num = parseInt(cleanHex, 16);
        return [
            (num >> 16) & 255,
            (num >> 8) & 255,
            num & 255
        ];
    }

    return null;
}

/**
 * Converts RGB [0-255] to HSL [h:0-360, s:0-1, l:0-1].
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s, l];
}

/**
 * Converts HSL [h:0-360, s:0-1, l:0-1] back to RGB [0-255].
 */
function hslToRgb(h, s, l) {
    h = (h % 360 + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
}

/**
 * Generates shades (50 to 900) for a given color (HEX, RGB, or Name).
 * Returns an object with keys 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 in "R, G, B" string format.
 */
export function generateThemePalette(colorInput) {
    const baseRgb = parseAnyColor(colorInput) || parseAnyColor(DEFAULT_BASE_HEX);
    const [h, s, baseL] = rgbToHsl(...baseRgb);

    const shades = {
        50: hslToRgb(h, Math.min(s * 0.7, 0.65), 0.97),
        100: hslToRgb(h, Math.min(s * 0.75, 0.65), 0.92),
        200: hslToRgb(h, Math.min(s * 0.8, 0.7), 0.82),
        300: hslToRgb(h, Math.min(s * 0.85, 0.75), 0.70),
        400: hslToRgb(h, Math.min(s * 0.9, 0.8), 0.58),
        500: baseRgb,
        600: hslToRgb(h, Math.min(s * 1.05, 1), Math.max(0.2, baseL * 0.86)),
        700: hslToRgb(h, Math.min(s * 1.1, 1), Math.max(0.16, baseL * 0.72)),
        800: hslToRgb(h, Math.min(s * 1.15, 1), Math.max(0.12, baseL * 0.58)),
        900: hslToRgb(h, Math.min(s * 1.2, 1), Math.max(0.08, baseL * 0.44)),
    };

    const formatted = {};
    Object.entries(shades).forEach(([key, rgb]) => {
        formatted[key] = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
    });

    return formatted;
}

/**
 * Searches for any color value in an office object deeply and intelligently.
 */
export function getOfficeColor(office) {
    if (!office || typeof office !== 'object') return DEFAULT_BASE_HEX;

    // 1. Direct standard property check
    const candidates = [
        office.color,
        office.themeColor,
        office.officeColor,
        office.mainColor,
        office.theme,
        office.primaryColor,
        office.brandColor,
        office.iconColor,
        office.badgeColor,
        office.bgColor,
        office.backgroundColor,
        office.colorCode,
        office.color_code,
        office.style?.color,
        office.settings?.color,
        office.settings?.themeColor
    ];

    for (const c of candidates) {
        if (c && parseAnyColor(c)) return c;
    }

    // 2. Scan any property in office object that looks like a color
    for (const [key, val] of Object.entries(office)) {
        if (typeof val === 'string' || typeof val === 'object') {
            if (/color|theme|brand|accent/i.test(key)) {
                if (parseAnyColor(val)) return val;
            }
        }
    }

    return DEFAULT_BASE_HEX;
}

/**
 * Applies the office theme colors to the document root CSS variables.
 */
export function applyOfficeTheme(office) {
    if (typeof document === 'undefined') return;

    const rawColor = getOfficeColor(office);
    const palette = generateThemePalette(rawColor);
    const root = document.documentElement;

    Object.entries(palette).forEach(([shade, rgbStr]) => {
        root.style.setProperty(`--color-tree-${shade}-rgb`, rgbStr);
    });

    const rgb = parseAnyColor(rawColor) || parseAnyColor(DEFAULT_BASE_HEX);
    root.style.setProperty('--color-tree-main', `rgb(${rgb.join(', ')})`);
    
    console.log(`[Theme] Applied office theme for "${office?.name || office?.id || 'default'}":`, {
        rawColor,
        mainRgb: rgb.join(', '),
        palette
    });
}

