// buildings.js
import { UNIT_PRODUCTION_COST } from "./constants.js";

export class City {
  constructor(x, y, name, owner = "player") {
    this.x = x;
    this.y = y;
    this.name = name;
    this.owner = owner;
    this.productionQueue = [];
    this.population = 1;
    this.food = 0;

    // Start production at 3 for population 1
    this.production = 3; 
    this.gold = 4;
    this.hasActed = false;
    this.defense = 5;
    this.health = 100;
  }

  produceUnit(type) {
    if (type !== "Warrior" && type !== "Settler") {
      console.error("Invalid unit type for production:", type);
      return;
    }
    const cost = UNIT_PRODUCTION_COST[type];
    const turns = Math.ceil(cost / this.production);
    console.log(`[City ${this.name}] Producing ${type}, will take ${turns} turns.`);
    this.productionQueue.push({
      type: "Unit",
      unitType: type,
      turnsRemaining: turns,
    });
    this.hasActed = true;
  }

  updateProduction(game, resources) {
    if (this.productionQueue.length > 0) {
      const item = this.productionQueue[0];
      item.turnsRemaining--;
      if (item.turnsRemaining <= 0) {
        this.activateProduction(game, this.productionQueue.shift(), resources);
      }
    }

    this.food += this.calculateFoodProduction();
    this.gold += this.calculateGoldProduction();
    this.growCity(game, resources);
  }

  // Every city gets 1 food per turn by default.
  calculateFoodProduction() {
    return 1;
  }

  calculateGoldProduction() {
    return 4;
  }

  growCity(game, resources) {
    // Growth cost scaling:
    // After population 5: cost is doubled
    // After population 10: cost is doubled again (x4 total)
    let foodRequired = this.population * 10;
    if (this.population > 10) {
      foodRequired *= 4;
    } else if (this.population > 5) {
      foodRequired *= 2;
    }

    if (this.food >= foodRequired) {
      this.population++;
      // Increase production by 1 for every new population beyond the first
      // Since we started at population=1, production=3 initially
      // Each new population increases production by 1
      this.production += 1;

      this.food -= foodRequired;
      game.updateNotification(
        `${this.name} has grown to population ${this.population} and production increased to ${this.production}!`
      );

      if (this.owner === "player") {
        game.updateUnitLimits();
      } else {
        // For AI - no more maxUnits logic needed, as we rely on population
        console.log(`[City ${this.name}] Population growth (AI city).`);
      }
    }
  }

  activateProduction(game, item, resources) {
    if (item.type === "Unit") {
      const unitPlacement = game.findFreeAdjacentTile(this.x, this.y);
      if (unitPlacement) {
        const tileType = game.getTileType(unitPlacement.x, unitPlacement.y);
        if (tileType === "Water" || tileType === "Mountain") {
          game.updateNotification(
            `Cannot place ${item.unitType} on ${tileType} tile.`
          );
          return;
        }

        if (this.owner === "player") {
          const newUnit = game.createUnit(
            item.unitType,
            unitPlacement.x,
            unitPlacement.y,
            "player"
          );
          game.updateNotification(
            `${this.name} has produced a ${item.unitType}!`
          );
        } else {
          const aiPlayer = game.AIs.find((ai) => ai.name === this.owner);
          if (aiPlayer) {
            const newUnit = game.createUnit(
              item.unitType,
              unitPlacement.x,
              unitPlacement.y,
              aiPlayer.name
            );
            game.updateNotification(
              `${this.name} has produced a ${item.unitType}!`
            );
          }
        }
      } else {
        game.updateNotification(`No space to place new unit from ${this.name}`);
      }
    }
  }

  skipAction(game) {
    this.hasActed = true;
    game.updateActionsRemaining();
    game.updateNotification(`${this.name} has skipped its action.`);
  }
}
