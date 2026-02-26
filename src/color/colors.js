/**
 * Converts HSL color values to hexadecimal format.
 * @param {number} hue - Hue value (0-360)
 * @param {number} saturation - Saturation value (0-100)
 * @param {number} lightness - Lightness value (0-100)
 * @returns {string} Hex color string
 */
export function neonHsl(hue, saturation, lightness) {
  const { red, green, blue } = hslToRgb(hue / 360, saturation / 100, lightness / 100);
  return rgbToHex(red, green, blue);
}

/**
 * Converts hex color to RGBA string format.
 * @param {string} hexColor - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA string
 */
export function hexToRgba(hexColor, alpha) {
  const cleanHex = String(hexColor).replace("#", "").trim();
  const normalizedHex = cleanHex.length === 3 
    ? cleanHex.split("").map((char) => char + char).join("") 
    : cleanHex.padEnd(6, "0").slice(0, 6);
  const colorNumber = parseInt(normalizedHex, 16);
  const red = (colorNumber >> 16) & 255;
  const green = (colorNumber >> 8) & 255;
  const blue = colorNumber & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

/**
 * Extracts hue value from a hex color.
 * @param {string} hexColor - Hex color string
 * @returns {number} Hue value (0-360)
 */
export function hexToHue(hexColor) {
  const cleanHex = String(hexColor).replace("#", "").trim();
  const normalizedHex = cleanHex.length === 3 
    ? cleanHex.split("").map((char) => char + char).join("") 
    : cleanHex.padEnd(6, "0").slice(0, 6);
  const colorNumber = parseInt(normalizedHex, 16);
  const red = ((colorNumber >> 16) & 255) / 255;
  const green = ((colorNumber >> 8) & 255) / 255;
  const blue = (colorNumber & 255) / 255;

  const maxComponent = Math.max(red, green, blue);
  const minComponent = Math.min(red, green, blue);
  const delta = maxComponent - minComponent;

  let hueValue = 0;
  if (delta === 0) hueValue = 0;
  else if (maxComponent === red) hueValue = ((green - blue) / delta) % 6;
  else if (maxComponent === green) hueValue = (blue - red) / delta + 2;
  else hueValue = (red - green) / delta + 4;

  return (hueValue * 60 + 360) % 360;
}

/**
 * Generates three shades (dark, mid, light) from a hex color.
 * @param {string} hexColor - Hex color string
 * @returns {string[]} Array of [dark, mid, light] hex colors
 */
export function derive3Shades(hexColor) {
  const { hue, saturation, lightness } = rgbToHsl(hexToRgb(hexColor));
  const adjustedSaturation = clamp(saturation * 1.05);
  const darkShade = hslToHex(hue, adjustedSaturation, clamp(lightness * 0.72));
  const midShade = hslToHex(hue, adjustedSaturation, clamp(lightness));
  const lightShade = hslToHex(hue, adjustedSaturation, clamp(Math.min(1, lightness * 1.22)));
  return [darkShade, midShade, lightShade];
}

// ---------- internal ----------

function clamp(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function hexToRgb(hexColor) {
  const cleanHex = String(hexColor).replace("#", "").trim();
  const normalizedHex = cleanHex.length === 3 
    ? cleanHex.split("").map((char) => char + char).join("") 
    : cleanHex.padEnd(6, "0").slice(0, 6);
  const colorNumber = parseInt(normalizedHex, 16);
  return { 
    red: ((colorNumber >> 16) & 255) / 255, 
    green: ((colorNumber >> 8) & 255) / 255, 
    blue: (colorNumber & 255) / 255 
  };
}

function rgbToHsl({ red, green, blue }) {
  const maxComponent = Math.max(red, green, blue);
  const minComponent = Math.min(red, green, blue);
  const delta = maxComponent - minComponent;
  let hueValue = 0;
  const lightnessValue = (maxComponent + minComponent) / 2;
  const saturationValue = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightnessValue - 1));

  if (delta !== 0) {
    if (maxComponent === red) hueValue = ((green - blue) / delta) % 6;
    else if (maxComponent === green) hueValue = (blue - red) / delta + 2;
    else hueValue = (red - green) / delta + 4;
    hueValue /= 6;
    if (hueValue < 0) hueValue += 1;
  }
  return { hue: hueValue, saturation: saturationValue, lightness: lightnessValue };
}

function hslToHex(hue, saturation, lightness) {
  const { red, green, blue } = hslToRgb(hue, saturation, lightness);
  return rgbToHex(red, green, blue);
}

function hslToRgb(hue, saturation, lightness) {
  let red, green, blue;
  if (saturation === 0) {
    red = green = blue = lightness;
  } else {
    const hue2rgb = (point1, point2, hueComponent) => {
      if (hueComponent < 0) hueComponent += 1;
      if (hueComponent > 1) hueComponent -= 1;
      if (hueComponent < 1 / 6) return point1 + (point2 - point1) * 6 * hueComponent;
      if (hueComponent < 1 / 2) return point2;
      if (hueComponent < 2 / 3) return point1 + (point2 - point1) * (2 / 3 - hueComponent) * 6;
      return point1;
    };
    const point2 = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const point1 = 2 * lightness - point2;
    red = hue2rgb(point1, point2, hue + 1 / 3);
    green = hue2rgb(point1, point2, hue);
    blue = hue2rgb(point1, point2, hue - 1 / 3);
  }
  return { red: (red * 255) | 0, green: (green * 255) | 0, blue: (blue * 255) | 0 };
}

function rgbToHex(red, green, blue) {
  const toHexByte = (value) => value.toString(16).padStart(2, "0");
  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}
