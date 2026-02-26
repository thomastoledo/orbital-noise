import { createWallpaperGenerator } from "../../src/wallpaper/createWallpaperGenerator.js";
import { getStyleProfile } from "../../src/styles/styleProfiles.js";

const profile = getStyleProfile("blue-ink");
const generator = createWallpaperGenerator(profile);

export const generateWallpaper = generator.generateWallpaper;
export const generateWallpaperAsync = generator.generateWallpaperAsync;
export { DEFAULT_OPTIONS } from "../../src/wallpaper/defaultOptions.js";
