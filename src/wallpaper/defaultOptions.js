export const DEFAULT_OPTIONS = {
  seed: 1234567,
  width: 3840,
  height: 2160,

  // Stars
  starCount: null, // auto
  starAvoidMargin: 1.10,

  // Constellations
  constellationConnectChance: 0.55,
  constellationModules: [3, 7],

  // Planets
  planetCount: [2, 4],
  planetMainRadius: [0.11, 0.18],
  planetSmallRadius: [0.05, 0.11],

  // Rings (main planet)
  ringCount: [2, 12],

  // Curves
  curveCount: [4, 10],
  arrowChance: 0.2,

  // Nebula (0 or 1 max)
  nebulaChance: 0.55,
};
