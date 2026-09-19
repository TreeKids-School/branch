// ── Dynamic Office Theme Utilities ──────────────────────────────────────────

/**
 * Parses any hex color (e.g. #28A745, #28a745, #28a) into [r, g, b].
 */
export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    let cleanHex = hex.trim().replace(/^#/, '');

    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }

    if (cleanHex.length !== 6) return null;

    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return null;

    return [
        (num >> 16) & 255,
        (num >> 8) & 255,
        num & 255
    ];
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

const DEFAULT_BASE_HEX = '#28A745';

/**
 * Generates shades (50 to 900) for a given base HEX color.
 * Returns an object with keys 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 in "R, G, B" string format.
 */
export function generateThemePalette(baseHex) {
    const baseRgb = hexToRgb(baseHex) || hexToRgb(DEFAULT_BASE_HEX);
    const [h, s, baseL] = rgbToHsl(...baseRgb);

    // Lightness & Saturation adjustments for each shade
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
 * Extracts color value from an office object.
 */
export function getOfficeColor(office) {
    if (!office || typeof office !== 'object') return DEFAULT_BASE_HEX;
    return (
        office.color ||
        office.themeColor ||
        office.officeColor ||
        office.mainColor ||
        office.iconColor ||
        DEFAULT_BASE_HEX
    );
}

/**
 * Applies the office theme colors to the document root CSS variables.
 */
export function applyOfficeTheme(office) {
    if (typeof document === 'undefined') return;

    const baseHex = getOfficeColor(office);
    const palette = generateThemePalette(baseHex);
    const root = document.documentElement;

    Object.entries(palette).forEach(([shade, rgbStr]) => {
        root.style.setProperty(`--color-tree-${shade}-rgb`, rgbStr);
    });

    // Also set standard hex/rgb on root for non-Tailwind consumers
    const baseRgb = hexToRgb(baseHex) || hexToRgb(DEFAULT_BASE_HEX);
    root.style.setProperty('--color-tree-main', `rgb(${baseRgb.join(', ')})`);
    root.style.setProperty('--color-tree-main-hex', baseHex);
}
