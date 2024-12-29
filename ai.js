import { Unit } from "./units.js";
import { MAINTENANCE_COST, UNIT_PRODUCTION_COST } from "./constants.js";
import { City } from "./buildings.js";

export class AIPlayer {
  constructor(name, game) {
    this.name = name;
    this.units = [];
    this.cities = [];
    this.resources = {
      food: 0,
      wood: 0,
      stone: 0,
      gold: 0,
    };
    this.game = game;
    this.aggression = Math.random();
  }

  resetUnits() {
    console.log(`[AI ${this.name}] Resetting units movement.`);
    this.units.forEach((unit) => {
      unit.resetMovement();
    });
  }

  update() {
    console.log(
      `[AI ${this.name}] Starting update. Current resources:`,
      this.resources,
      "Units:",
      this.units,
      "Cities:",
      this.cities
    );
    this.manageCities();

    this.units.forEach((unit) => {
      if (unit.health > 0) {
        console.log(
          `[AI ${this.name}] Strategizing for unit:`,
          unit.type,
          "at",
          unit.x,
          unit.y
        );
        if (unit.type === "Settler") {
          this.strategizeSettler(unit);
        } else if (unit.type === "Warrior") {
          this.strategizeCombatUnit(unit);
        } else {
          console.log(
            `[AI ${this.name}] No specific strategy for unit type ${unit.type}, attempting move.`
          );
          this.moveUnit(unit); // Default movement
        }
      } else {
        console.log(
          `[AI ${this.name}] Unit ${unit.type} is dead or invalid health.`
        );
      }
    });

    this.payMaintenance();
    console.log(`[AI ${this.name}] Finished update.`);
  }

  // --- Strategic Decision Making ---

  strategizeSettler(settler) {
    console.log(
      `[AI ${this.name}] Settler strategizing at: ${settler.x}, ${settler.y}`
    );
    if (this.cities.length === 0) {
      const bestInitialTile = this.findBestInitialTile(settler);
      if (bestInitialTile) {
        console.log(`[AI ${this.name}] Found best initial tile:`, bestInitialTile);
        this.settleCity(settler);
        return;
      }
    }

    const nearestEnemy = this.findNearestEnemy(settler);
    if (nearestEnemy) {
      console.log(
        `[AI ${this.name}] Settler sees nearest enemy at:`,
        nearestEnemy.x,
        nearestEnemy.y
      );
      const bestDominationTile = this.findBestDominationTile(
        settler,
        nearestEnemy
      );
      if (bestDominationTile) {
        console.log(
          `[AI ${this.name}] Attempting domination settle at tile:`,
          bestDominationTile
        );
        if (
          this.game.calculateDistance(
            settler.x,
            settler.y,
            bestDominationTile.x,
            bestDominationTile.y
          ) <= 1
        ) {
          this.settleCity(settler);
        } else {
          const { dx, dy } = this.game.calculateDirection(
            settler,
            bestDominationTile
          );
          const moveX = settler.x + dx;
          const moveY = settler.y + dy;
          if (this.game.isValidMove(settler, moveX, moveY)) {
            console.log(
              `[AI ${this.name}] Moving settler towards domination tile.`
            );
            settler.move(moveX, moveY, this.game);
          } else {
            console.log(
              `[AI ${this.name}] Invalid move for settler towards domination tile.`
            );
          }
        }
        return;
      }
    }

    if (this.cities.length < 3) {
      console.log(`[AI ${this.name}] Looking for best resource tile.`);
      const bestResourceTile = this.findBestResourceTile(settler);
      if (bestResourceTile) {
        console.log(
          `[AI ${this.name}] Found best resource tile:`,
          bestResourceTile
        );
        if (
          this.game.calculateDistance(
            settler.x,
            settler.y,
            bestResourceTile.x,
            bestResourceTile.y
          ) <= 1
        ) {
          this.settleCity(settler);
        } else {
          const { dx, dy } = this.game.calculateDirection(
            settler,
            bestResourceTile
          );
          const moveX = settler.x + dx;
          const moveY = settler.y + dy;
          if (this.game.isValidMove(settler, moveX, moveY)) {
            console.log(
              `[AI ${this.name}] Moving settler towards resource tile.`
            );
            settler.move(moveX, moveY, this.game);
          } else {
            console.log(
              `[AI ${this.name}] Invalid move for settler towards resource tile.`
            );
          }
        }
        return;
      } else {
        console.log(`[AI ${this.name}] No best resource tile found.`);
      }
    }

    // Default: Explore if no good tiles are found
    console.log(`[AI ${this.name}] No strategic tiles found, exploring.`);
    this.moveUnit(settler);
  }

  findBestInitialTile(settler) {
    let bestTile = null;
    let maxInitialValue = 0;

    for (
      let y = Math.max(0, settler.y - 2);
      y <= Math.min(this.game.mapState.length - 1, settler.y + 2);
      y++
    ) {
      for (
        let x = Math.max(0, settler.x - 2);
        x <= Math.min(this.game.mapState[y].length - 1, settler.x + 2);
        x++
      ) {
        const tileType = this.game.mapState[y][x].tileType;
        const initialValue = this.calculateInitialResourceValue(tileType);

        if (initialValue > maxInitialValue) {
          maxInitialValue = initialValue;
          bestTile = { x, y };
        }
      }
    }

    return bestTile;
  }

  calculateInitialResourceValue(tileType) {
    switch (tileType) {
      case "Forest":
      case "Hills":
        return 3;
      case "Plains":
        return 2;
      default:
        return 0;
    }
  }

  findBestDominationTile(settler, nearestEnemy) {
    let bestTile = null;
    let minDistanceToEnemy = Infinity;
    let maxResourceValue = 0;

    for (let y = 0; y < this.game.mapState.length; y++) {
      for (let x = 0; x < this.game.mapState[y].length; x++) {
        const tileType = this.game.mapState[y][x].tileType;
        const resourceValue = this.calculateResourceValue(tileType);
        const distanceToEnemy = this.game.calculateDistance(
          x,
          y,
          nearestEnemy.x,
          nearestEnemy.y
        );

        if (
          distanceToEnemy < minDistanceToEnemy &&
          resourceValue >= maxResourceValue
        ) {
          minDistanceToEnemy = distanceToEnemy;
          maxResourceValue = resourceValue;
          bestTile = { x, y };
        }
      }
    }

    return bestTile;
  }

  findNearestEnemy(unit) {
    let nearestEnemy = null;
    let minDistance = Infinity;
    const allPotentialTargets = [
      ...this.game.units,
      ...this.game.playerResources.cities,
    ];

    this.game.AIs.forEach((ai) => {
      if (ai.name !== this.name) {
        allPotentialTargets.push(...ai.units, ...ai.cities);
      }
    });

    allPotentialTargets.forEach((potentialTarget) => {
      if (potentialTarget.owner !== this.name) {
        const distance = this.game.calculateDistance(
          unit.x,
          unit.y,
          potentialTarget.x,
          potentialTarget.y
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestEnemy = potentialTarget;
        }
      }
    });

    return nearestEnemy;
  }

  strategizeCombatUnit(unit) {
    console.log(`[AI ${this.name}] Combat unit strategizing:`, unit.type);

    const nearestEnemy = this.findNearestEnemy(unit);
    if (nearestEnemy) {
      console.log(`[AI ${this.name}] Nearest enemy found:`, nearestEnemy);
      if (nearestEnemy instanceof City) {
        console.log(`[AI ${this.name}] Target is an enemy city.`);
        this.attackOrMoveTowards(unit, nearestEnemy);
      } else {
        console.log(`[AI ${this.name}] Target is an enemy unit.`);
        const distanceToEnemy = this.game.calculateDistance(
          unit.x,
          unit.y,
          nearestEnemy.x,
          nearestEnemy.y
        );
        if (distanceToEnemy <= unit.movementRemaining) {
          this.attackOrMoveTowards(unit, nearestEnemy);
        } else {
          console.log(
            `[AI ${this.name}] Enemy unit is out of range, moving towards.`
          );
          this.moveTowards(unit, nearestEnemy);
        }
      }
      return;
    }

    console.log(`[AI ${this.name}] No combat target found, exploring.`);
    this.moveUnit(unit);
  }

  findNearbyEnemies(unit) {
    const nearbyEnemies = [];
    const allPotentialTargets = [
      ...this.game.units,
      ...this.game.playerResources.cities,
    ];

    this.game.AIs.forEach((ai) => {
      if (ai.name !== this.name) {
        allPotentialTargets.push(...ai.units, ...ai.cities);
      }
    });

    nearbyEnemies.push(
      ...allPotentialTargets.filter(
        (potentialTarget) =>
          potentialTarget.owner !== this.name &&
          this.game.calculateDistance(
            unit.x,
            unit.y,
            potentialTarget.x,
            potentialTarget.y
          ) <= unit.movementRemaining
      )
    );

    return nearbyEnemies;
  }

  findWeakestEnemyCity(unit) {
    let weakestCity = null;
    let minStrength = Infinity;

    const enemyCities = [...this.game.playerResources.cities];
    this.game.AIs.forEach((ai) => {
      if (ai.name !== this.name) {
        enemyCities.push(...ai.cities);
      }
    });

    enemyCities.forEach((city) => {
      const strength = this.calculateCityStrength(city);
      if (strength < minStrength) {
        minStrength = strength;
        weakestCity = city;
      }
    });

    return weakestCity;
  }

  calculateCityStrength(city) {
    return city.defense + city.population;
  }

  prioritizeTarget(enemies) {
    const units = enemies.filter((e) => e instanceof Unit);
    if (units.length > 0) {
      return units[0];
    } else {
      return enemies[0];
    }
  }

  attackOrMoveTowards(unit, target) {
    console.log(`[AI ${this.name}] Attacking or moving towards:`, target);
    if (this.game.calculateDistance(unit.x, unit.y, target.x, target.y) <= 1) {
      unit.attackUnit(target, this.game);
    } else {
      this.moveTowards(unit, target);
    }
  }

  moveTowards(unit, target) {
    const { dx, dy } = this.game.calculateDirection(unit, target);
    const moveX = unit.x + dx;
    const moveY = unit.y + dy;
    if (this.game.isValidMove(unit, moveX, moveY)) {
      console.log(
        `[AI ${this.name}] Moving unit towards target: (${moveX}, ${moveY})`
      );
      unit.move(moveX, moveY, this.game);
    } else {
      console.log(`[AI ${this.name}] Move towards target is invalid.`);
    }
  }

  findBestResourceTile(settler) {
    let bestTile = null;
    let maxResourceValue = 0;

    for (let y = 0; y < this.game.mapState.length; y++) {
      for (let x = 0; x < this.game.mapState[y].length; x++) {
        const tileType = this.game.mapState[y][x].tileType;
        const resourceValue = this.calculateResourceValue(tileType);

        if (
          this.game.calculateDistance(settler.x, settler.y, x, y) <= 5 &&
          resourceValue > maxResourceValue &&
          !this.game.mapState[y][x].occupant
        ) {
          maxResourceValue = resourceValue;
          bestTile = { x, y };
        }
      }
    }

    return bestTile;
  }

  calculateResourceValue(tileType) {
    switch (tileType) {
      case "Forest":
        return 2;
      case "Hills":
      case "Plains":
        return 1;
      default:
        return 0;
    }
  }

  manageCities() {
    console.log(`[AI ${this.name}] Managing cities.`);
    this.cities.forEach((city) => {
      city.updateProduction(this.game, this.resources);
      if (city.productionQueue.length === 0) {
        // Only add to the production queue if the AI can produce a unit
        if (this.canProduceUnit()) {
          // Prioritize Settler production for the first few turns
          if (this.cities.length < 2 && this.game.currentTurn < 5) {
            if (this.resources.gold >= UNIT_PRODUCTION_COST["Settler"]) {
              console.log(
                `[AI ${this.name}] Producing Settler in city ${city.name}.`
              );
              city.produceUnit("Settler");
              return;
            }
          }

          // Otherwise, produce Warrior if possible
          if (this.aggression >= 0.5) {
            if (this.resources.gold >= UNIT_PRODUCTION_COST["Warrior"]) {
              console.log(
                `[AI ${this.name}] Producing Warrior in city ${city.name}.`
              );
              city.produceUnit("Warrior");
              return;
            }
          } else {
            if (this.resources.gold >= UNIT_PRODUCTION_COST["Warrior"]) {
              console.log(
                `[AI ${this.name}] Producing Warrior in city ${city.name} due to population-based limit.`
              );
              city.produceUnit("Warrior");
              return;
            }
          }
        } else {
          console.log(
            `[AI ${this.name}] Cannot produce unit in ${city.name}: at population limit.`
          );
        }
      }
    });
  }

  payMaintenance() {
    const totalCost = this.units.length * MAINTENANCE_COST;
    // this.resources.gold += this.cities.length * 4; // Remove this line - AI gets gold from cities
    this.resources.gold -= totalCost;
    console.log(
      `[AI ${this.name}] Paid maintenance. Total cost: ${totalCost}, Current gold: ${this.resources.gold}`
    );
    if (this.resources.gold < 0) {
      console.log(`[AI ${this.name}] is running low on gold!`);
    }
  }

  settleCity(settler) {
    const cityName = `${this.name} City ${this.cities.length + 1}`;
    const city = this.game.createCity(
      settler.x,
      settler.y,
      cityName,
      this.name
    );
    console.log(
      `[AI ${this.name}] Settled new city: ${cityName} at (${settler.x}, ${settler.y}).`
    );
    this.cities.push(city);
    this.game.removeUnit(settler);
    this.game.updateNotification(
      `City ${cityName} has been founded by ${this.name}!`
    );

    this.game.mapState[city.y][city.x].occupant = city;
    this.game.updateTileDisplay(city, city.x, city.y);
    settler.hasActed = true;
  }

  moveUnit(unit) {
    if (!unit) {
      console.error("moveUnit called with undefined unit");
      return;
    }

    if (unit.movementRemaining <= 0 || unit.hasActed) {
      console.log(
        `[AI ${this.name}] Unit ${unit.type} cannot move, no movement remaining or already acted.`
      );
      return;
    }

    const nearbyResources = this.findNearbyResources(unit);
    if (nearbyResources.length > 0) {
      console.log(
        `[AI ${this.name}] Found nearby resources for unit ${unit.type}:`,
        nearbyResources
      );
      const targetResource = nearbyResources[0];
      const { dx, dy } = this.game.calculateDirection(unit, targetResource);
      const moveX = unit.x + dx;
      const moveY = unit.y + dy;

      if (this.game.isValidMove(unit, moveX, moveY)) {
        console.log(
          `[AI ${this.name}] Moving unit ${unit.type} towards resource (${moveX}, ${moveY}).`
        );
        unit.move(moveX, moveY, this.game);
        return;
      } else {
        console.log(`[AI ${this.name}] Invalid move towards resource tile.`);
      }
    }

    const possibleMoves = this.game.getPossibleMoves(unit);
    if (possibleMoves.length > 0) {
      const randomMove =
        possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      console.log(
        `[AI ${this.name}] No direct resources, moving ${unit.type} randomly to (${randomMove.x}, ${randomMove.y}).`
      );
      unit.move(randomMove.x, randomMove.y, this.game);
    } else {
      console.log(
        `[AI ${this.name}] No possible moves found for unit ${unit.type}.`
      );
    }
  }

  findNearestCity(unit) {
    let nearestCity = null;
    let minDistance = Infinity;
    const allCities = [...this.game.playerResources.cities];
    this.game.AIs.forEach((ai) => {
      if (ai.name !== this.name) {
        allCities.push(...ai.cities);
      }
    });

    allCities.forEach((city) => {
      const distance = this.game.calculateDistance(
        city.x,
        city.y,
        unit.x,
        unit.y
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    });
    return nearestCity;
  }

  // Modified canProduceUnit to depend on total population
  canProduceUnit() {
    const totalPop = this.cities.reduce((acc, city) => acc + city.population, 0);
    return this.units.length < totalPop;
  }

  findNearbyResources(unit) {
    const range = 3; // Search within a 3 tile radius
    const nearbyResources = [];

    for (
      let y = Math.max(0, unit.y - range);
      y <= Math.min(this.game.mapState.length - 1, unit.y + range);
      y++
    ) {
      for (
        let x = Math.max(0, unit.x - range);
        x <= Math.min(this.game.mapState[y].length - 1, unit.x + range);
        x++
      ) {
        const tileType = this.game.mapState[y][x].tileType;
        if (this.isResourceTile(tileType)) {
          nearbyResources.push({ x, y, tileType });
        }
      }
    }

    return nearbyResources;
  }

  isResourceTile(tileType) {
    return tileType === "Forest" || tileType === "Hills" || tileType === "Plains";
  }
}