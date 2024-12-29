// constants.js (unchanged)
export const MAP_SIZE = 30;
export const TILE_TYPES = ["Forest", "Hills", "Plains", "Mountain", "Water"];

export const UNIT_PRODUCTION_COST = {
  Settler: 50,
  Warrior: 40,
};

export const MAINTENANCE_COST = 1;
export const NUM_LAKES = 10;

export const STARTING_RESOURCES = {
  player: {
    food: 5,
    wood: 5,
    stone: 0,
    gold: 10,
  },
  AI: {
    food: 5,
    wood: 5,
    stone: 0,
    gold: 5, // Reduced initial gold for AI
  },
};
