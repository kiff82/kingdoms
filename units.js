// units.js
import { City } from "./buildings.js";

export class Unit {
  constructor(type, x, y, owner = "player", leaderBonus = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.owner = owner;
    this.health = 10;
    this.attack = 0;
    this.defense = 0;
    this.movement = 1;
    this.xp = 0;
    this.level = 1;
    this.extraAttacks = 0;

    switch (type) {
      case "Warrior":
        this.attack = 4;
        this.defense = 3;
        this.health = 10;
        break;
      case "Settler":
        this.attack = 0;
        this.defense = 1;
        this.health = 10;
        break;
      case "Hero":
        this.attack = 8;
        this.defense = 3;
        this.health = 20;
        this.movement = 2;
        this.xp = 0;
        this.level = 1;
        break;
      default:
        this.attack = 1;
        this.defense = 1;
        this.health = 10;
    }

    this.maxHealth = this.health;

    if (leaderBonus.attack) {
      this.attack += leaderBonus.attack;
    }
    if (leaderBonus.defense) {
      this.defense += leaderBonus.defense;
    }

    this.movementRemaining = this.movement;
    this.actionPoints = this.movement;
    this.hasActed = false;

    this.move = this.move.bind(this);
    this.attackUnit = this.attackUnit.bind(this);
    this.skipAction = this.skipAction.bind(this);
  }

  gainXp(amount, game) {
    if (this.type !== "Hero") return;

    this.xp += amount;
    game.updateNotification(`${this.type} gained ${amount} XP!`);

    // Level thresholds and bonuses
    const levelThresholds = [5, 10, 20, 50];
    const levelBonuses = [
      () => {
        this.attack += 5;
        game.updateNotification(`${this.type} leveled up to ${this.level}! Attack increased!`);
      },
      () => {
        this.defense += 5;
        game.updateNotification(`${this.type} leveled up to ${this.level}! Defense increased!`);
      },
      () => {
        this.movement += 1;
        this.movementRemaining += 1;
        game.updateNotification(`${this.type} leveled up to ${this.level}! Movement increased!`);
      },
      () => {
        this.extraAttacks += 1;
        game.updateNotification(`${this.type} leveled up to ${this.level}! Now has an extra attack!`);
      },
    ];

    while (this.level <= levelThresholds.length && this.xp >= levelThresholds[this.level - 1]) {
      this.level++;
      this.health = this.maxHealth;
      if (levelBonuses[this.level - 2]) {
        levelBonuses[this.level - 2]();
      }
    }
  }

  regenerateHealth() {
    if (this.health < this.maxHealth) {
      this.health += 1;
      if (this.health > this.maxHealth) {
        this.health = this.maxHealth;
      }
    }
  }

  attackUnit(target, game) {
    console.log(`[Unit ${this.type}] Attacking target:`, target);
    if (target instanceof Unit || target instanceof City) {
      let damageToTarget = Math.max(
        this.attack - target.defense + game.getRandomInt(-1, 1),
        0
      );
      let damageToAttacker = 0;

      if (damageToTarget > 0) {
        target.health -= damageToTarget;
        game.updateNotification(
          `${this.type} attacked ${target.name || target.type
          } and dealt ${damageToTarget} damage!`
        );

        if (target.health <= 0) {
          if (target instanceof Unit) {
            if (this.type === "Hero" && target.type === "Warrior") {
              this.gainXp(3, game); // Gain XP for killing a Warrior
            }
            game.removeUnit(target);
          } else if (target instanceof City) {
            game.removeCity(target);
          }
          game.updateNotification(
            `${target.name || target.type} has been destroyed!`
          );
          this.hasActed = true;
          game.updateActionsRemaining();
          game.deselectUnit();
          return;
        }
      } else {
        game.updateNotification(
          `${this.type} attacked ${target.type} but dealt no damage.`
        );
      }

      if (
        target.health > 0 &&
        target.attack &&
        !(target instanceof City && this.extraAttacks === 0)
      ) {
        damageToAttacker = Math.max(
          target.attack - this.defense + game.getRandomInt(-1, 1),
          0
        );

        if (damageToAttacker > 0) {
          this.health -= damageToAttacker;
          game.updateNotification(
            `${target.name || target.type} counter-attacked and dealt ${damageToAttacker} damage!`
          );

          if (this.health <= 0) {
            game.removeUnit(this);
            game.updateNotification(`${this.type} has been destroyed!`);
          }
        } else {
          game.updateNotification(
            `${target.type} counter-attacked but dealt no damage.`
          );
        }
      }

      // Extra attack logic for level 4+ Hero
      if (this.extraAttacks > 0 && this.type === "Hero" && target.health > 0) {
        game.updateNotification(`${this.type} uses an extra attack!`);
        this.attackUnit(target, game);
      }

      this.hasActed = true;
      game.updateActionsRemaining();
      game.deselectUnit();
    }
  }

  skipAction(game) {
    console.log(`[Unit ${this.type}] Skipping action.`);
    this.hasActed = true;
    game.updateActionsRemaining();
    game.deselectUnit();
    game.updateNotification(`${this.type} has skipped its action.`);
  }

  move(newX, newY, game) {
    console.log(
      `[Unit ${this.type}] Moving from (${this.x}, ${this.y}) to (${newX}, ${newY})`
    );
    if (!game.isValidMove(this, newX, newY)) {
      console.log(`[Unit ${this.type}] Invalid move.`);
      return;
    }

    game.mapState[this.y][this.x].occupant = null;
    game.updateTileDisplay(null, this.x, this.y);

    this.x = newX;
    this.y = newY;
    game.mapState[newY][newX].occupant = this;
    game.updateTileDisplay(this, newX, newY);

    game.revealSurroundingTiles(this);
    game.gatherResources(this);

    this.actionPoints--;
    this.movementRemaining--;

    if (this.actionPoints <= 0) {
      this.hasActed = true;
    }

    game.updateActionsRemaining();
    game.updateNotification(`${this.type} moved to (${newX}, ${newY}).`);
  }

  resetMovement() {
    console.log(`[Unit ${this.type}] Resetting movement.`);
    this.movementRemaining = this.movement;
    this.actionPoints = this.movement;
    this.hasActed = false;
  }
}