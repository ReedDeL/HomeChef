/** Explicit recipe-to-art mapping; never infer a dish from a title or ingredient. */
export const MEAL_ART_COLUMNS = 5;
export const MEAL_ART_ROWS = 8;
export const MEAL_ART_FALLBACK = 39;
export const MEAL_ART_TILES: Readonly<Record<string, number>> = {
  'hc-48322a4046b660396285': 0,
  'hc-6089840ed7a96123bbe1': 1,
  'hc-82192586fc577f61793e': 2,
  'hc-96a39aa4a1fc565847af': 3,
  'hc-b4ae889a370ebbc5613f': 4,
  'hc-d63529038fdd6e186d8d': 5,
  'hc-mw-01': 6,
  'hc-mw-02': 7,
  'hc-mw-03': 8,
  'hc-mw-04': 9,
  'hc-mw-05': 10,
  'hc-mw-06': 11,
  'hc-mw-07': 12,
  'hc-mw-08': 13,
  'hc-mw-09': 14,
  'hc-mw-10': 15,
  'hc-mw-11': 16,
  'hc-mw-12': 17,
  'hc-mw-13': 18,
  'hc-mw-14': 19,
  'hc-mw-15': 20,
  'hc-mw-16': 21,
  'hc-mw-17': 22,
  'hc-mw-18': 23,
  'hc-mw-19': 24,
  'hc-mw-20': 25,
  'hc-mw-21': 26,
  'hc-mw-22': 27,
  'hc-mw-23': 28,
  'hc-mw-24': 29,
  'hc-mw-25': 30,
  'hc-mw-26': 31,
  'hc-mw-27': 32,
  'hc-staple-cinnamon-toast': 33,
  'hc-staple-grilled-cheese': 34,
  'hc-staple-pbj': 35,
  'hc-staple-scrambled-eggs': 36,
  'hc-staple-toast-jam': 37,
  'hc-staple-tuna-sandwich': 38,
};

export function mealArtTile(recipeId?: string): number {
  return recipeId && Object.hasOwn(MEAL_ART_TILES, recipeId)
    ? (MEAL_ART_TILES[recipeId] ?? MEAL_ART_FALLBACK)
    : MEAL_ART_FALLBACK;
}
