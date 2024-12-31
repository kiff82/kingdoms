// game.js
import {
  MAP_SIZE,
  TILE_TYPES,
  UNIT_PRODUCTION_COST,
  MAINTENANCE_COST,  
  NUM_LAKES,
} from "./constants.js";
import { Unit } from "./units.js";
import { City } from "./buildings.js";
import { AIPlayer } from "./ai.js";

const TILE_VARIANTS = {
  Forest: 3,
  Hills: 3,
  Plains: 3,
  Mountain: 2,
  Water: 3,
};

function getRandomTileVariant(baseType) {
  const variants = TILE_VARIANTS[baseType];
  if (!variants || variants === 1) return 1;
  return Math.floor(Math.random() * variants) + 1;
}

class Game {
  constructor() {
    this.mapState = Array.from({ length: MAP_SIZE }, () =>
      Array.from({ length: MAP_SIZE }, () => ({
        tileType: null,
        tileVariant: 1,
        occupant: null,
      }))
    );

    this.playerResources = {
      food: 0,
      wood: 0,
      stone: 0,
      gold: 0,
      cities: [],
    };

    this.currentTech = "None";
    this.notifications = [];
    this.currentTurn = 1;
    this.currentPlayer = "player"; 
    this.actionsRemaining = 0;

    this.units = [];
    this.playerUnits = [];
    this.AIs = [];
    this.selectedUnit = null;
    this.selectedCity = null;
    this.leaderBonus = {};
    this.movementMode = false;

    this.maxUnits = 4; 

    this.cacheDOMElements();
    this.initializeGame();
  }

  cacheDOMElements() {
    this.startButton = document.getElementById("startButton");
    this.startGameButton = document.getElementById("startGame");
    this.endTurnButton = document.getElementById("endTurn");
    this.mapElement = document.getElementById("map");
    this.leaderList = document.getElementById("leaderList");
    this.leaderInfo = document.getElementById("leaderInfo");
    this.resourcesElement = document.getElementById("resources");
    this.notificationsList = document.getElementById("notifications");
    this.helpButton = document.getElementById("helpButton");
    this.helpPanel = document.getElementById("helpPanel");
    this.closeHelpButton = document.getElementById("closeHelp");
    this.sidebar = document.getElementById("sidebar");
    this.actionsRemainingElement = document.getElementById("actionsRemaining");
    this.gameInfoPanel = document.getElementById("gameInfoPanel");
    this.resourcePanel = document.getElementById("resourcePanel");
    this.actionsPanel = document.getElementById("actionsPanel");
    this.notificationPanel = document.getElementById("notificationPanel");
    this.leftPanel = document.getElementById("leftPanel");
  }

  initializeGame() {
    this.setupEventListeners();
    this.showStartScreen();
    this.createGameInfoPanel();
    this.updateUI();
    this.setupKeyboardInput(); // Add keyboard input handling
  }

  setupEventListeners() {
    if (this.startButton) {
      this.startButton.addEventListener("click", () =>
        this.showLeaderSelection()
      );
    }

    if (this.startGameButton) {
      this.startGameButton.addEventListener("click", () => this.startGame());
    }

    if (this.endTurnButton) {
      this.endTurnButton.addEventListener("click", () => this.endTurn());
    }

    if (this.mapElement) {
      this.mapElement.addEventListener("click", (event) => {
        const tile = event.target.closest(".tile");
        if (tile) {
          const x = parseInt(tile.dataset.x);
          const y = parseInt(tile.dataset.y);
          this.handleTileClick(x, y, tile);
        }
      });
    }

    if (this.helpButton && this.helpPanel && this.closeHelpButton) {
      this.helpButton.addEventListener("click", () => {
        this.helpPanel.hidden = false;
      });

      this.closeHelpButton.addEventListener("click", () => {
        this.helpPanel.hidden = true;
      });
    }
  }

  setupKeyboardInput() {
    document.addEventListener("keydown", (event) => {
      if (this.currentPlayer !== "player") return;

      const selectedUnit = this.selectedUnit;
      const selectedCity = this.selectedCity;

      if (selectedUnit && !selectedUnit.hasActed) {
        switch (event.key) {
          case "m": // Move
            this.toggleUnitMove(selectedUnit);
            break;
          case "s": // Settle (for Settlers)
            if (selectedUnit.type === "Settler") {
              this.settleCity(selectedUnit);
            }
            break;
          case "a": // Attack
            if (selectedUnit.type === "Warrior" || selectedUnit.type === "Hero") {
              this.toggleAttackMode(selectedUnit);
            }
            break;
          case " ": // Skip
            selectedUnit.skipAction(this);
            break;
        }
      } else if (selectedCity && !selectedCity.hasActed) {
        // City-specific shortcuts (if needed in the future)
      } else if (event.key === "Escape") {
        this.deselectUnit();
      }
    });
  }

  toggleAttackMode(unit) {
    if (this.attackMode) {
      this.attackMode = false;
      this.removeHighlights();
    } else {
      this.attackMode = true;
      this.movementMode = false; // Ensure movement mode is off
      this.removeHighlights();
      this.highlightAttackRange(unit);
    }
  }

  highlightAttackRange(unit) {
    const range = 1; // Melee attack range
    const visited = new Set();
    const queue = [{ x: unit.x, y: unit.y, remaining: range }];

    while (queue.length > 0) {
      const { x, y, remaining } = queue.shift();
      const tileKey = `${x},${y}`;
      if (visited.has(tileKey) || remaining < 0) continue;
      visited.add(tileKey);

      const occupant = this.mapState[y][x].occupant;
      if (occupant && occupant.owner !== unit.owner) {
        const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (tile) {
          tile.classList.add("attack-highlight"); // Use a different highlight class
        }
      }

      if (remaining > 0) {
        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: -1 },
          { dx: -1, dy: 1 },
          { dx: 1, dy: -1 },
          { dx: 1, dy: 1 },
        ];

        for (const dir of directions) {
          const newX = x + dir.dx;
          const newY = y + dir.dy;
          if (
            newX >= 0 &&
            newX < MAP_SIZE &&
            newY >= 0 &&
            newY < MAP_SIZE
          ) {
            queue.push({ x: newX, y: newY, remaining: remaining - 1 });
          }
        }
      }
    }
  }

  showStartScreen() {
    const startScreen = document.getElementById("startScreen");
    const leaderSelectionScreen = document.getElementById(
      "leaderSelectionScreen"
    );
    const gameArea = document.getElementById("gameArea");

    if (startScreen && leaderSelectionScreen && gameArea) {
      startScreen.classList.add("active");
      leaderSelectionScreen.classList.remove("active");
      gameArea.classList.remove("active");
    }
  }

  showLeaderSelection() {
    const startScreen = document.getElementById("startScreen");
    const leaderSelectionScreen = document.getElementById(
      "leaderSelectionScreen"
    );

    if (startScreen && leaderSelectionScreen) {
      startScreen.classList.remove("active");
      leaderSelectionScreen.classList.add("active");
      this.populateLeaderList();
    }
  }

  populateLeaderList() {
    const leaders = this.getLeaders();
    if (!this.leaderList) return;

    this.leaderList.innerHTML = "";
    leaders.forEach((leader) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        <img src="${leader.portrait}" alt="${leader.leader} Portrait" class="leader-portrait">
        <div class="leader-details">
          <span>${leader.name}</span>
          <span class="leader-title">${leader.leader}</span>
        </div>
      `;
      listItem.setAttribute("tabindex", "0");
      listItem.setAttribute("role", "button");
      listItem.setAttribute("aria-pressed", "false");
      listItem.addEventListener("click", () => this.selectLeader(leader));
      listItem.addEventListener("keypress", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.selectLeader(leader);
        }
      });
      this.leaderList.appendChild(listItem);
    });
  }

  getLeaders() {
    return [
      {
        name: "America",
        leader: "George Washington",
        bonus: "+1 food production per turn",
        portrait: "Portraits/George_Washington_America.webp",
        applyBonus: (playerResources) => {
          playerResources.food = (playerResources.food || 0) + 1;
        },
      },
      {
        name: "China",
        leader: "Qin Shi Huang",
        bonus: "+1 attack strength for all units",
        portrait: "Portraits/Qin_Shi_Huang_China.webp",
        applyBonus: () => {
          this.playerUnits.forEach((unit) => {
            unit.attack += 1;
          });
        },
      },
      {
        name: "Germany",
        leader: "Frederick Barbarossa",
        bonus: "+1 movement range for all units",
        portrait: "Portraits/Frederick_Barbarossa_Germany.webp",
        applyBonus: () => {
          this.playerUnits.forEach((unit) => {
            unit.movement += 1;
            unit.movementRemaining += 1;
            unit.actionPoints += 1;
          });
        },
      },
      {
        name: "Spain",
        leader: "Isabella",
        bonus: "+1 gold production per turn",
        portrait: "Portraits/Queen_Isabella_Spain.webp",
        applyBonus: (playerResources) => {
          playerResources.gold = (playerResources.gold || 0) + 1;
        },
      },
    ];
  }

  selectLeader(leader) {
    this.playerResources.leader = leader;
    this.updateLeaderInfo(leader);
    this.updateNotification(
      `Selected Leader: ${leader.name} - ${leader.leader}`
    );
  }

  updateLeaderInfo(leader) {
    if (!this.leaderInfo) return;
    const leaderImage = this.leaderInfo.querySelector(".leader-portrait-large");
    const infoText = this.leaderInfo.querySelector("p");
    if (leaderImage) {
      leaderImage.src = leader.portrait;
      leaderImage.alt = `${leader.leader} Portrait`;
      leaderImage.hidden = false;
    }
    infoText.textContent = `${leader.name} - ${leader.leader}\nBonus: ${leader.bonus}`;

    const leaderListItems = document.querySelectorAll("#leaderList li");
    leaderListItems.forEach((item) => {
      const img = item.querySelector(".leader-portrait");
      const imgSrc = img.getAttribute("src");
      if (imgSrc === leader.portrait) {
        item.setAttribute("aria-pressed", "true");
        item.style.backgroundColor = "var(--color-warning)";
      } else {
        item.setAttribute("aria-pressed", "false");
        item.style.backgroundColor = "var(--color-secondary)";
      }
    });
  }

  startGame() {
    if (!this.playerResources.leader) {
      alert("Please select a leader before starting the game.");
      return;
    }

    const leaderSelectionScreen = document.getElementById(
      "leaderSelectionScreen"
    );
    const gameArea = document.getElementById("gameArea");

    if (leaderSelectionScreen && gameArea) {
      leaderSelectionScreen.classList.remove("active");
      gameArea.classList.add("active");
    }

    this.initializeMap();
    this.generateAIPlayers();
    this.createInitialUnits();
    this.applyLeaderBonus();
    this.scrollToSettler();
    this.updateUnitLimits();
    this.gameLoop();
  }

  applyLeaderBonus() {
    const leader = this.playerResources.leader;
    if (leader && typeof leader.applyBonus === "function") {
      leader.applyBonus(this.playerResources);
      this.updateNotification(`${leader.name}'s bonus has been applied.`);
      this.updateUI();
    }
  }

  initializeMap() {
    if (!this.mapElement) return;
    this.mapElement.innerHTML = "";
    for (let i = 0; i < MAP_SIZE; i++) {
      for (let j = 0; j < MAP_SIZE; j++) {
        const tile = document.createElement("div");
        tile.classList.add("tile", "hidden");
        let baseType;
        let variant = 1;

        if (i === 0 || i === MAP_SIZE - 1 || j === 0 || j === MAP_SIZE - 1) {
          baseType = "Water";
        } else {
          baseType = this.getRandomTileType();
        }

        if (TILE_VARIANTS[baseType] > 1) {
          variant = getRandomTileVariant(baseType);
        }

        tile.dataset.type = baseType;
        tile.dataset.variant = variant;
        tile.classList.add(baseType);
        if (variant > 1) {
          tile.classList.add(`${baseType}_${variant}`);
        }

        tile.dataset.x = j;
        tile.dataset.y = i;
        this.mapElement.appendChild(tile);
        this.mapState[i][j].tileType = baseType;
        this.mapState[i][j].tileVariant = variant;
      }
    }

    this.generateLakes();
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getRandomCoordinate() {
    return {
      x: this.getRandomInt(0, MAP_SIZE - 1),
      y: this.getRandomInt(0, MAP_SIZE - 1),
    };
  }

  getRandomTileType() {
    const tileTypes = ["Forest", "Hills", "Plains", "Mountain"];
    const randomIndex = Math.floor(Math.random() * tileTypes.length);
    return tileTypes[randomIndex];
  }

  generateLakes() {
    let lakesGenerated = 0;
    while (lakesGenerated < NUM_LAKES) {
      const { x, y } = this.getRandomCoordinate();
      if (
        x === 0 ||
        x === MAP_SIZE - 1 ||
        y === 0 ||
        y === MAP_SIZE - 1 ||
        this.mapState[y][x].tileType === "Mountain"
      )
        continue; 
      if (
        this.mapState[y][x].tileType !== "Water" &&
        this.mapState[y][x].tileType !== "Mountain"
      ) {
        this.mapState[y][x].tileType = "Water";
        this.mapState[y][x].tileVariant = getRandomTileVariant("Water");
        const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (tile) {
          tile.dataset.type = "Water";
          tile.dataset.variant = this.mapState[y][x].tileVariant;
          tile.classList.remove(...TILE_TYPES);
          tile.classList.add("Water");
          if (this.mapState[y][x].tileVariant > 1) {
            tile.classList.add(`Water_${this.mapState[y][x].tileVariant}`);
          }

          tile.style.backgroundImage = `url('./Tiles/water_tile.jpg')`;
          tile.style.backgroundSize = "cover";
          tile.classList.remove("hidden");
        }
        lakesGenerated++;
      }
    }
  }

  handleTileClick(x, y, tileElement) {
    if (this.currentPlayer !== "player") return;

    const city = this.playerResources.cities.find((c) => c.x === x && c.y === y);
    if (city && !city.hasActed) {
      this.selectCity(city);
      return;
    }

    const unit = this.units.find(
      (u) => u.x === x && u.y === y && u.owner === "player"
    );

    if (this.attackMode && this.selectedUnit) {
      if (tileElement.classList.contains("attack-highlight")) {
        const target = this.mapState[y][x].occupant;
        if (target && target.owner !== this.selectedUnit.owner) {
          this.selectedUnit.attackUnit(target, this);
        }
        this.attackMode = false;
        this.deselectUnit();
        this.removeHighlights();
      }
    } else if (this.movementMode && this.selectedUnit) {
      if (tileElement.classList.contains("highlighted")) {
        this.moveUnit(this.selectedUnit, x, y);
        this.deselectUnit();
        this.movementMode = false;
        this.removeHighlights();
      } else {
        this.updateNotification("Invalid movement tile.");
      }
    } else {
      if (unit && !unit.hasActed) {
        this.selectUnit(unit);
      } else if (this.selectedUnit && unit === this.selectedUnit) {
        this.deselectUnit();
      } else if (city && !city.hasActed) {
        this.selectCity(city);
      } else {
        this.deselectUnit();
      }
    }
  }

  selectUnit(unit) {
    this.deselectUnit();
    this.selectedUnit = unit;
    this.displayUnitMenu(unit);
  }

  deselectUnit() {
    this.selectedUnit = null;
    this.selectedCity = null;
    this.movementMode = false;
    this.removeHighlights();
    this.clearLeftPanel();
  }

  selectCity(city) {
    this.deselectUnit();
    this.selectedCity = city;
    this.displayCityMenu(city);
  }

  removeHighlights() {
    if (this.mapElement) {
      this.mapElement
        .querySelectorAll(".highlighted, .attack-highlight")
        .forEach((tile) => {
          tile.classList.remove("highlighted");
          tile.classList.remove("attack-highlight");
        });
    }
  }

  displayUnitMenu(unit) {
    this.clearLeftPanel();
    if (!this.leftPanel) return;

    const unitMenu = document.createElement("section");
    unitMenu.id = "unitPanel";
    unitMenu.innerHTML = `
      <h3>${unit.type}</h3>
      <p>Owner: ${unit.owner}</p>
      <p>Health: ${unit.health}</p>
      <p>Attack: ${unit.attack}</p>
      <p>Defense: ${unit.defense}</p>
      <p>Movement: ${unit.movementRemaining}/${unit.movement}</p>
      ${
        unit.type === "Settler"
          ? `<button id="settleCityBtn" data-keybind="s">Settle City (S)</button>`
          : ""
      }
      ${
        unit.type === "Warrior" || unit.type === "Hero"
          ? `<button id="attackBtn" data-keybind="a">Attack (A)</button>`
          : ""
      }
      <button id="moveUnitBtn" data-keybind="m">Move Unit (M)</button>
      <button id="skipActionBtn" data-keybind="Space">Skip Action (Space)</button>
    `;

    this.leftPanel.appendChild(unitMenu);

    if (unit.type === "Settler") {
      const settleBtn = document.getElementById("settleCityBtn");
      if (settleBtn) {
        settleBtn.addEventListener("click", () => this.settleCity(unit));
      }
    }

    if (unit.type === "Warrior" || unit.type === "Hero") {
      const attackBtn = document.getElementById("attackBtn");
      if (attackBtn) {
        attackBtn.addEventListener("click", () => this.toggleAttackMode(unit));
      }
    }

    const moveBtn = document.getElementById("moveUnitBtn");
    if (moveBtn) {
      moveBtn.addEventListener("click", () => this.toggleUnitMove(unit));
    }

    const skipBtn = document.getElementById("skipActionBtn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => unit.skipAction(this));
    }
  }

  toggleUnitMove(unit) {
    if (this.movementMode) {
      this.movementMode = false;
      this.removeHighlights();
    } else {
      this.movementMode = true;
      this.highlightMovementRange(unit);
    }
  }

  highlightMovementRange(unit) {
    const range = unit.movementRemaining;
    const visited = new Set();
    const queue = [{ x: unit.x, y: unit.y, remaining: range }];

    while (queue.length > 0) {
      const { x, y, remaining } = queue.shift();
      const tileKey = `${x},${y}`;
      if (visited.has(tileKey) || remaining < 0) continue;
      visited.add(tileKey);

      const tileType = this.getTileType(x, y);
      if (tileType === "Water" || tileType === "Mountain") {
        continue;
      }

      const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (tile) {
        tile.classList.add("highlighted");
      }

      const directions = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: 1, dy: 1 },
      ];

      for (const dir of directions) {
        const newX = x + dir.dx;
        const newY = y + dir.dy;
        if (
          newX >= 0 &&
          newX < MAP_SIZE &&
          newY >= 0 &&
          newY < MAP_SIZE &&
          this.calculateDistance(newX, newY, unit.x, unit.y) <= range
        ) {
          queue.push({ x: newX, y: newY, remaining: remaining - 1 });
        }
      }
    }

    if (queue.length === 0) {
      this.updateNotification(
        "No available movement tiles for the selected unit."
      );
    }
  }

  clearSidebar() {
    this.updateGameInfoPanel();
  }

  clearLeftPanel() {
    if (this.leftPanel) {
      this.leftPanel.innerHTML = "";
    }
  }

  moveUnit(unit, x, y) {
    if (
      x >= 0 &&
      x < MAP_SIZE &&
      y >= 0 &&
      y < MAP_SIZE &&
      unit.movementRemaining > 0 &&
      unit.actionPoints > 0 &&
      !unit.hasActed
    ) {
      const target = this.mapState[y][x].occupant;
      if (target && target.owner !== unit.owner) {
        unit.attackUnit(target, this);
      } else {
        unit.move(x, y, this);
      }
    }
  }

  isValidMove(unit, x, y) {
    const tileType = this.getTileType(x, y);
    if (tileType === "Water" || tileType === "Mountain") {
      return false;
    }
    const occupant = this.mapState[y][x].occupant;
    if (occupant && occupant.owner === unit.owner && !(occupant instanceof City)) {
      return false;
    }
    return true;
  }

  addUnit(unit) {
    this.units.push(unit);
    if (unit.owner === "player") {
      this.playerUnits.push(unit);
    } else {
      const aiPlayer = this.AIs.find((ai) => ai.name === unit.owner);
      if (aiPlayer) aiPlayer.units.push(unit);
    }
    this.mapState[unit.y][unit.x].occupant = unit;
    this.updateTileDisplay(unit, unit.x, unit.y);
  }

  removeUnit(unit) {
    const currentOccupant = this.mapState[unit.y][unit.x].occupant;
    if (currentOccupant === unit) {
      this.mapState[unit.y][unit.x].occupant = null;
    }

    const index = this.units.indexOf(unit);
    if (index > -1) {
      this.units.splice(index, 1);
    }

    if (unit.owner === "player") {
      const pIndex = this.playerUnits.indexOf(unit);
      if (pIndex > -1) this.playerUnits.splice(pIndex, 1);
    } else {
      const aiPlayer = this.AIs.find((ai) => ai.name === unit.owner);
      if (aiPlayer) {
        const aiIndex = aiPlayer.units.indexOf(unit);
        if (aiIndex > -1) aiPlayer.units.splice(aiIndex, 1);
      }
    }

    this.mapState[unit.y][unit.x].occupant = null;
    this.updateTileDisplay(null, unit.x, unit.y);
  }

  removeCity(city) {
    if (city.owner === "player") {
      const index = this.playerResources.cities.indexOf(city);
      if (index > -1) {
        this.playerResources.cities.splice(index, 1);
      }
    } else {
      const ai = this.AIs.find((a) => a.name === city.owner);
      if (ai) {
        const index = ai.cities.indexOf(city);
        if (index > -1) {
          ai.cities.splice(index, 1);
        }
      }
    }

    this.mapState[city.y][city.x].occupant = null;
    this.updateTileDisplay(null, city.x, city.y);
  }

  updateTileDisplay(unitOrCity, x, y) {
    const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (!tile) {
      console.error(`Tile not found at coordinates: ${x}, ${y}`);
      return;
    }

    const baseType = this.mapState[y][x].tileType;
    const variant = this.mapState[y][x].tileVariant;
    const occupant = this.mapState[y][x].occupant;

    tile.className = tile.className
      .replace(/(unit-\w+)|(player-unit)|(ai\d-unit)|(ai\d-city)/g, "")
      .trim();

    const existingUnitDiv = tile.querySelector(".unit-image");
    if (existingUnitDiv) {
      tile.removeChild(existingUnitDiv);
    }

    tile.style.backgroundImage = "none";

    if (occupant || this.doesCityExistAt(x, y)) {
      if (occupant instanceof City || this.doesCityExistAt(x, y)) {
        const city = occupant instanceof City ? occupant : this.getCityAt(x, y);

        tile.classList.add("city");

        if (city.originalTileType) {
          tile.classList.add(city.originalTileType);
          if (city.originalTileVariant > 1) {
            tile.classList.add(
              `${city.originalTileType}_${city.originalTileVariant}`
            );
          }
        }

        let cityImgPath;
        if (city.owner === "player") {
          cityImgPath = "./Buildings/human_city.jpg";
        } else if (city.owner === "AI 1") {
          cityImgPath = "./Buildings/ai_1_city.jpg";
          tile.classList.add("ai1-city");
        } else if (city.owner === "AI 2") {
          cityImgPath = "./Buildings/ai_2_city.jpg";
          tile.classList.add("ai2-city");
        } else {
          cityImgPath = "./Buildings/city.jpg";
        }

        const cityImg = new Image();
        cityImg.onload = () => {
          tile.style.backgroundImage = `url('${cityImgPath}')`;
          tile.style.backgroundSize = "contain";
          tile.style.backgroundRepeat = "no-repeat";          
          tile.style.backgroundPosition = "center";
        };
        cityImg.onerror = () => {
          console.error(`Error loading image: ${cityImgPath}`);
          tile.style.backgroundColor = "gray";
        };
        cityImg.src = cityImgPath;

        if (city.originalTileType) {
          let tileImgPath;
          if (city.originalTileType === "Forest") {
            tileImgPath = "./Tiles/forest_tile.jpg";
          } else if (city.originalTileType === "Hills") {
            tileImgPath = "./Tiles/hills_tile.jpg";
          } else if (city.originalTileType === "Plains") {
            tileImgPath = "./Tiles/plains_tile.jpg";
          } else if (city.originalTileType === "Water") {
            tileImgPath = `./Tiles/water_tile.jpg`;
          } else if (city.originalTileType === "Mountain") {
            tileImgPath = `./Tiles/mountain.jpg`;
          } else {
            tileImgPath = `./Tiles/${city.originalTileType.toLowerCase()}_tile_${city.originalTileVariant}.jpg`;
          }

          const tileImg = new Image();
          tileImg.onload = () => {
            tile.style.backgroundImage = `url('${tileImgPath}'), url('${cityImgPath}')`;
            tile.style.backgroundSize = "cover, contain";
            tile.style.backgroundRepeat = "no-repeat, no-repeat";
            tile.style.backgroundPosition = "center, center";
          };
          tileImg.onerror = () => {
            console.error(`Error loading image: ${tileImgPath}`);
          };
          tileImg.src = tileImgPath;
        }
      }

      if (unitOrCity instanceof Unit && !(occupant instanceof City)) {
        const unitDiv = document.createElement("div");
        unitDiv.classList.add(
          `unit-${unitOrCity.type.toLowerCase()}`,
          "unit-image"
        );

        // Append unitDiv first to ensure it shows even if image fails
        tile.appendChild(unitDiv);

        if (unitOrCity.owner === "player") {
          unitDiv.classList.add("player-unit");
        } else if (unitOrCity.owner && unitOrCity.owner === "AI 1") {
          unitDiv.classList.add("ai1-unit");
        } else if (unitOrCity.owner && unitOrCity.owner === "AI 2") {
          unitDiv.classList.add("ai2-unit");
        }

        const unitImgPath = `./Units/${unitOrCity.type.toLowerCase()}.jpg`;
        const unitImg = new Image();
        unitImg.onload = () => {
          unitDiv.style.backgroundImage = `url('${unitImgPath}')`;
          unitDiv.style.backgroundSize = "contain";
          unitDiv.style.backgroundRepeat = "no-repeat";
          unitDiv.style.backgroundPosition = "center";
          unitDiv.style.pointerEvents = "none";
          unitDiv.style.zIndex = "2";
        };
        unitImg.onerror = () => {
          console.error(`Error loading image: ${unitImgPath}`);
          unitDiv.style.backgroundColor = "gray";
        };
        unitImg.src = unitImgPath;
      }
    } else {
      if (baseType) {
        tile.classList.add(baseType);
        let tileImgPath;
        if (baseType === "Forest") {
          tileImgPath = "./Tiles/forest_tile.jpg";
        } else if (baseType === "Hills") {
          tileImgPath = "./Tiles/hills_tile.jpg";
        } else if (baseType === "Plains") {
          tileImgPath = "./Tiles/plains_tile.jpg";
        } else if (baseType === "Water") {
          tileImgPath = `./Tiles/water_tile.jpg`;
        } else if (baseType === "Mountain") {
          tileImgPath = `./Tiles/mountain.jpg`;
        } else {
          tileImgPath = `./Tiles/${baseType.toLowerCase()}_tile_${variant}.jpg`;
        }

        const img = new Image();
        img.onload = () => {
          tile.style.backgroundImage = `url('${tileImgPath}')`;
          tile.style.backgroundSize = "cover";
        };
        img.onerror = () => {
          console.error(`Error loading image: ${tileImgPath}`);
          tile.style.backgroundColor = "gray";
        };
        img.src = tileImgPath;

        if (
          variant > 1 &&
          baseType !== "Forest" &&
          baseType !== "Hills" &&
          baseType !== "Plains" &&
          baseType !== "Water" &&
          baseType !== "Mountain"
        ) {
          tile.classList.add(`${baseType}_${variant}`);
        }
      }
    }

    tile.classList.remove("hidden");
  }

  doesCityExistAt(x, y) {
    return (
      this.playerResources.cities.some((c) => c.x === x && c.y === y) ||
      this.AIs.some((ai) => ai.cities.some((c) => c.x === x && c.y === y))
    );
  }

  getCityAt(x, y) {
    let city = this.playerResources.cities.find((c) => c.x === x && c.y === y);
    if (!city) {
      for (const ai of this.AIs) {
        city = ai.cities.find((c) => c.x === x && c.y === y);
        if (city) break;
      }
    }
    return city;
  }

  revealSurroundingTiles(unit, rangeOverride = null) {
    const range = rangeOverride !== null ? rangeOverride : 1;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const x = unit.x + dx;
        const y = unit.y + dy;
        if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
          const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
          if (tile) {
            tile.classList.remove("hidden");
          }
        }
      }
    }
  }

  gatherResources(unit) {
    const tileType = this.getTileType(unit.x, unit.y);
    const resourceAmount = this.calculateResourceAmount(tileType, unit);

    if (resourceAmount) {
      if (unit.owner === "player") {
        this.playerResources[resourceAmount.type] += resourceAmount.amount;
      } else {
        const aiPlayer = this.AIs.find((ai) => ai.name === unit.owner);
        if (aiPlayer) {
          aiPlayer.resources[resourceAmount.type] += resourceAmount.amount;
        }
      }

      this.updateResourcePanel();
      this.updateNotification(
        `Gathered ${resourceAmount.amount} ${resourceAmount.type}.`
      );
    }
  }

  getTileType(x, y) {
    const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    return tile ? tile.dataset.type : null;
  }

  createUnit(type, x, y, owner = "player") {
    const unit = new Unit(type, x, y, owner, this.leaderBonus);
    this.addUnit(unit);
    return unit;
  }

  createCity(x, y, name, owner = "player") {
    const city = new City(x, y, name, owner);

    city.originalTileType = this.mapState[y][x].tileType;
    city.originalTileVariant = this.mapState[y][x].tileVariant;

    if (owner === "player") {
      this.playerResources.cities.push(city);
      this.playerResources.gold += 4; 
    } else {
      const aiPlayer = this.AIs.find((ai) => ai.name === owner);
      if (aiPlayer) {
        aiPlayer.cities.push(city);
        aiPlayer.resources.gold += 4;
      }
    }

    this.mapState[y][x].occupant = city;
    this.updateTileDisplay(city, x, y);

    return city;
  }

  settleCity(settler) {
    const x = settler.x;
    const y = settler.y;

    if (settler.owner === "player") {
      const cityName = `${this.playerResources.leader.name} City`;
      const newCity = this.createCity(x, y, cityName, "player");
      this.updateNotification(`City ${cityName} has been founded!`);
    } else {
      const aiPlayer = this.AIs.find((ai) => ai.name === settler.owner);
      if (aiPlayer) {
        const cityName = `${aiPlayer.name} City ${
          aiPlayer.cities.length + 1
        }`;
        const newCity = this.createCity(x, y, cityName, aiPlayer.name);

        this.updateNotification(
          `City ${cityName} has been founded by ${aiPlayer.name}!`
        );
      }
    }
    this.removeUnit(settler);
    this.updateActionsRemaining();
    this.clearLeftPanel();
  }

  createInitialUnits() {
    const playerStart = this.getRandomPositionNear(
      Math.floor(MAP_SIZE / 2),
      Math.floor(MAP_SIZE / 2),
      Math.floor(MAP_SIZE / 4)
    );
    const settler = this.createUnit("Settler", playerStart.x, playerStart.y);
    const heroPos = this.getRandomPositionNear(playerStart.x, playerStart.y, 3);
    const hero = this.createUnit("Hero", heroPos.x, heroPos.y, "player");
    this.revealSurroundingTiles(settler, 3);

    const aiUnits = [
      { type: "Settler", owner: "AI 1" },
      { type: "Hero", owner: "AI 1" },
      { type: "Settler", owner: "AI 2" },
      { type: "Hero", owner: "AI 2" },
    ];

    aiUnits.forEach((unitDef) => {
      let aiStartPos;
      let attempts = 0;

      do {
        aiStartPos = this.getRandomPositionNear(
          this.getRandomInt(0, MAP_SIZE - 1),
          this.getRandomInt(0, MAP_SIZE - 1),
          5
        );
        attempts++;
        if (attempts > 100) {
          console.error(
            `Could not find a valid position for ${unitDef.owner} ${unitDef.type} after 100 attempts`
          );
          break; // Prevent infinite loop
        }
      } while (
        this.calculateDistance(
          aiStartPos.x,
          aiStartPos.y,
          playerStart.x,
          playerStart.y
        ) <
        MAP_SIZE / 3
      );

      if (unitDef.type === "Settler") {
        this.createUnit(unitDef.type, aiStartPos.x, aiStartPos.y, unitDef.owner);
      } else if (unitDef.type === "Hero") {
        const heroPos = this.getRandomPositionNear(aiStartPos.x, aiStartPos.y, 3);
        this.createUnit(unitDef.type, heroPos.x, heroPos.y, unitDef.owner);
      }
    });
  }

  getRandomPositionNear(x, y, range) {
    let newX, newY;
    let attempts = 0;
    do {
      newX = x + this.getRandomInt(-range, range);
      newY = y + this.getRandomInt(-range, range);
      attempts++;
      if (attempts > 100) {
        console.error("Could not find a valid position near", x, y, "after 100 attempts");
        return { x, y };
      }
    } while (
      newX < 0 ||
      newX >= MAP_SIZE ||
      newY < 0 ||
      newY >= MAP_SIZE ||
      this.mapState[newY][newX]?.tileType === "Water" ||
      this.mapState[newY][newX]?.tileType === "Mountain" ||
      this.mapState[newY][newX]?.occupant
    );

    return { x: newX, y: newY };
  }
  
    createInitialUnits() {
      const playerStart = this.getRandomPositionNear(
        Math.floor(MAP_SIZE / 2),
        Math.floor(MAP_SIZE / 2),
        Math.floor(MAP_SIZE / 4)
      );
      const settler = this.createUnit("Settler", playerStart.x, playerStart.y);
      const heroPos = this.getRandomPositionNear(playerStart.x, playerStart.y, 3);
      const hero = this.createUnit("Hero", heroPos.x, heroPos.y, "player");
      this.revealSurroundingTiles(settler, 3);
  
      const aiUnits = [
        { type: "Settler", owner: "AI 1" },
        { type: "Hero", owner: "AI 1" },
        { type: "Settler", owner: "AI 2" },
        { type: "Hero", owner: "AI 2" },
      ];
  
      aiUnits.forEach((unitDef) => {
        let aiStartPos;
        let attempts = 0;
  
        do {
          aiStartPos = this.getRandomPositionNear(
            this.getRandomInt(0, MAP_SIZE - 1),
            this.getRandomInt(0, MAP_SIZE - 1),
            5
          );
          attempts++;
          if (attempts > 100) {
            console.error(
              `Could not find a valid position for ${unitDef.owner} ${unitDef.type} after 100 attempts`
            );
            break; // Prevent infinite loop
          }
        } while (
          this.calculateDistance(
            aiStartPos.x,
            aiStartPos.y,
            playerStart.x,
            playerStart.y
          ) <
          MAP_SIZE / 3
        );
  
        if (unitDef.type === "Settler") {
          this.createUnit(unitDef.type, aiStartPos.x, aiStartPos.y, unitDef.owner);
        } else if (unitDef.type === "Hero") {
          const heroPos = this.getRandomPositionNear(aiStartPos.x, aiStartPos.y, 3);
          this.createUnit(unitDef.type, heroPos.x, heroPos.y, unitDef.owner);
        }
      });
    }
  createGameInfoPanel() {
    if (!this.sidebar) return;

    const gameInfoPanel = document.createElement("section");
    gameInfoPanel.id = "gameInfoPanel";
    this.sidebar.appendChild(gameInfoPanel);

    const resourcePanel = document.createElement("section");
    resourcePanel.id = "resourcePanel";
    gameInfoPanel.appendChild(resourcePanel);

    const actionsPanel = document.createElement("section");
    actionsPanel.id = "actionsPanel";
    gameInfoPanel.appendChild(actionsPanel);

    const notificationPanel = document.createElement("section");
    notificationPanel.id = "notificationPanel";
    gameInfoPanel.appendChild(notificationPanel);

    this.gameInfoPanel = gameInfoPanel;
    this.resourcePanel = resourcePanel;
    this.actionsPanel = actionsPanel;
    this.notificationPanel = notificationPanel;

    this.updateGameInfoPanel();
  }

  updateGameInfoPanel() {
    this.updateResourcePanel();
    this.updateActionsRemaining();
    this.updateNotificationPanel();
  }

  updateUI() {
    this.updateResourcePanel();
    this.updateNotificationPanel();
    this.updateActionsRemaining();
  }

  updateResourcePanel() {
    if (!this.resourcePanel) return;

    if (this.currentPlayer === "player") {
      this.resourcePanel.innerHTML = `
        <h3>Your Resources</h3>
        <p>Food: ${this.playerResources.food}</p>
        <p>Wood: ${this.playerResources.wood}</p>
        <p>Stone: ${this.playerResources.stone}</p>
        <p>Gold: ${this.playerResources.gold}</p>
        <p>Units: ${this.playerUnits.length} / ${this.maxUnits}</p>
      `;
    } else {
      this.resourcePanel.innerHTML = `
        <h3>Resources</h3>
        <p>It's ${this.currentPlayer}'s turn</p>
      `;
    }
  }

  updateNotificationPanel() {
    if (!this.notificationPanel) return;
    this.notificationPanel.innerHTML = `
      <h3>Notifications</h3>
      <ul id="notifications">
        ${this.notifications.map((message) => `<li>${message}</li>`).join("")}
      </ul>
    `;
  }

  updateNotification(message) {
    console.log(`[Notification]: ${message}`);
    this.notifications.push(message);
    if (this.notifications.length > 5) this.notifications.shift();
    this.updateNotificationPanel();
  }

  updateActionsRemaining() {
    let actions = 0;
    this.playerUnits.forEach((unit) => {
      if (!unit.hasActed && unit.health > 0) actions++;
    });
    this.playerResources.cities.forEach((city) => {
      if (!city.hasActed) actions++;
    });
    this.actionsRemaining = actions;

    if (this.actionsPanel) {
      this.actionsPanel.innerHTML = `
        <h3>Actions Remaining: <span id="actionsRemaining">${this.actionsRemaining}</span></h3>
      `;
      this.actionsRemainingElement = document.getElementById("actionsRemaining");
    }

    if (this.endTurnButton) {
      this.endTurnButton.disabled = this.actionsRemaining === 0;
    }
  }

  generateAIPlayers() {
    const aiNames = ["AI 1", "AI 2"];
    for (let i = 0; i < aiNames.length; i++) {
      const aiName = aiNames[i];
      const aiPlayer = new AIPlayer(aiName, this);
      this.AIs.push(aiPlayer);
      console.log(`Created AI player: ${aiName}`);
    }
  }

  gameLoop() {
    console.log(`[Game] Current turn: ${this.currentTurn}, Current player: ${this.currentPlayer}`);
    if (this.currentPlayer === "player") {
      this.updateNotification(`Player Turn (Turn ${this.currentTurn})`);
      this.startPlayerTurn();
    } else if (this.currentPlayer === "AI") {
      this.updateNotification(`AI 1 Turn (Turn ${this.currentTurn})`);
      this.startAITurn(this.AIs[0]);
    } else if (this.currentPlayer === "AI_2") {
      this.updateNotification(`AI 2 Turn (Turn ${this.currentTurn})`);
      this.startAITurn(this.AIs[1]);
    } else {
      this.currentPlayer = "player";
      this.currentTurn++;
      this.gameLoop();
    }
  }

  startPlayerTurn() {
    console.log("[Game] Starting Player Turn");
    this.resetUnits("player");
    this.actionsRemaining = this.calculateActionsRemaining();
    this.updateActionsRemaining();
    this.clearSidebar();
  }

  startAITurn(aiPlayer) {
    console.log(`[Game] Starting AI Turn for ${aiPlayer.name}`);
    aiPlayer.resetUnits();
    aiPlayer.update();
    this.endTurn();
  }

  resetUnits(owner) {
    this.units.forEach((unit) => {
      if (unit.owner === owner) {
        unit.resetMovement();
      }
    });
  }

  calculateActionsRemaining() {
    let actions = 0;
    this.playerUnits.forEach((unit) => {
      if (!unit.hasActed && unit.health > 0) actions++;
    });
    this.playerResources.cities.forEach((city) => {
      if (!city.hasActed) actions++;
    });
    return actions;
  }

  endTurn() {
    console.log(`[Game] Ending turn for ${this.currentPlayer}`);
    this.resetCities();
    this.updateCities();
    this.payMaintenance();

    // Regenerate health for all units
    this.units.forEach((unit) => {
      unit.regenerateHealth();
    });

    if (this.currentPlayer === "player") {
      this.currentPlayer = "AI"; 
    } else if (this.currentPlayer === "AI") {
      this.currentPlayer = "AI_2"; 
    } else {
      this.currentPlayer = "player";
      this.currentTurn++;
    }

    this.gameLoop();
  }

  resetCities() {
    this.playerResources.cities.forEach((city) => {
      city.hasActed = false;
    });
    this.AIs.forEach((ai) => {
      ai.cities.forEach((city) => {
        city.hasActed = false;
      });
    });
  }

  updateCities() {
    this.playerResources.cities.forEach((city) => {
      city.updateProduction(this, this.playerResources);
      this.playerResources.gold += city.calculateGoldProduction(); // Add city gold to total
    });
  
    this.AIs.forEach((ai) => {
      ai.cities.forEach((city) => {
        city.updateProduction(this, ai.resources);
        ai.resources.gold += city.calculateGoldProduction(); // Add city gold to total
      });
    });
  }


  payMaintenance() {
    const totalPlayerCost = this.playerUnits.length * MAINTENANCE_COST;
    this.playerResources.gold -= totalPlayerCost;
    if (this.playerResources.gold < 0) {
      this.updateNotification("You are running low on gold!");
    }
  
    this.AIs.forEach((ai) => {
      const totalAICost = ai.units.length * MAINTENANCE_COST;
      ai.resources.gold -= totalAICost;
      if (ai.resources.gold < 0) {
        this.updateNotification(`${ai.name} is running low on gold!`);
      }
    });
  
    this.updateResourcePanel();
  }

buyUnitFromCity(city, unitType) {
  const cost = UNIT_PRODUCTION_COST[unitType];

  if (city.owner === "player") {
    if (this.playerResources.gold >= cost) {
      if (this.canProduceUnit()) {
        const placement = this.findFreeAdjacentTile(city.x, city.y);
        if (placement) {
          const tileType = this.getTileType(placement.x, placement.y);

          if (tileType === "Water" || tileType === "Mountain") {
            this.updateNotification(
              `Cannot place ${unitType} on ${tileType} tile.`
            );
            return;
          }

          this.playerResources.gold -= cost;
          const newUnit = this.createUnit(
            unitType,
            placement.x,
            placement.y,
            "player"
          );
          this.updateNotification(`Purchased a ${unitType}!`);
          city.hasActed = true;
          this.updateActionsRemaining();
          this.displayCityMenu(city);
        } else {
          this.updateNotification(`No space to place a new ${unitType}.`);
        }
      } else {
        this.updateNotification(
          `Unit limit reached. Grow your cities to increase the limit.`
        );
      }
    } else {
      this.updateNotification(`Not enough gold to purchase a ${unitType}.`);
    }
  } else {
    const aiPlayer = this.AIs.find((ai) => ai.name === city.owner);
    if (aiPlayer && aiPlayer.resources.gold >= cost) {
      if (aiPlayer.canProduceUnit()) {
        const placement = this.findFreeAdjacentTile(city.x, city.y);
        if (placement) {
          const tileType = this.getTileType(placement.x, placement.y);

          if (tileType === "Water" || tileType === "Mountain") {
            this.updateNotification(
              `Cannot place ${unitType} on ${tileType} tile.`
            );
            return;
          }

          aiPlayer.resources.gold -= cost; // Deduct cost from AI gold
          const newUnit = this.createUnit(
            unitType,
            placement.x,
            placement.y,
            aiPlayer.name
          );
          this.updateNotification(
            `${aiPlayer.name} purchased a ${unitType}!`
          );
          city.hasActed = true;
        } else {
          this.updateNotification(
            `${aiPlayer.name} has no space to place a new ${unitType}.`
          );
        }
      } else {
        this.updateNotification(
          `${aiPlayer.name} has reached its unit limit.`
        );
      }
    } else if (aiPlayer) {
      this.updateNotification(
        `${aiPlayer.name} does not have enough gold to purchase a ${unitType}.`
      );
    }
  }
  this.updateResourcePanel();
}

  findNearestCity(unit) {
    let nearestCity = null;
    let minDistance = Infinity;
    const allCities = [...this.playerResources.cities];
    this.AIs.forEach((ai) => {
      allCities.push(...ai.cities);
    });

    allCities.forEach((city) => {
      const distance = this.calculateDistance(city.x, city.y, unit.x, unit.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    });
    return nearestCity;
  }

  findFreeAdjacentTile(x, y) {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 },
    ];

    for (const dir of directions) {
      const newX = x + dir.dx;
      const newY = y + dir.dy;
      if (
        newX >= 0 &&
        newX < MAP_SIZE &&
        newY >= 0 &&
        newY < MAP_SIZE &&
        !this.mapState[newY][newX].occupant
      ) {
        const tileType = this.getTileType(newX, newY);
        if (tileType !== "Water" && tileType !== "Mountain") {
          return { x: newX, y: newY };
        }
      }
    }
    return null;
  }

  displayCityMenu(city) {
    this.clearLeftPanel();
    if (!this.leftPanel) return;

    const cityMenu = document.createElement("section");
    cityMenu.id = "cityPanel";
    cityMenu.innerHTML = `
      <h3>City: ${city.name}</h3>
      <p>Owner: ${city.owner}</p>
      <p>Health: ${city.health}</p>
      <p>Defense: ${city.defense}</p>
      <p>Population: ${city.population}</p>
      <p>Food: ${city.food}</p>
      <p>Production: ${city.production}</p>
      <p>Gold: ${city.gold}</p>
      <h4>Production Queue</h4>
      <ul id="productionQueue">
      </ul>
      ${
        !city.hasActed
          ? `
        <h4>Produce Unit</h4>
        <div id="unitProductionOptions">
          ${Object.keys(UNIT_PRODUCTION_COST)
            .map((unitType) => this.getUnitProductionHTML(unitType, city))
            .join("")}
        </div>
        <h4>Buy Units</h4>
        <div id="buyUnits">
          ${Object.keys(UNIT_PRODUCTION_COST)
            .filter((unitType) =>
              ["Settler", "Warrior"].includes(unitType)
            )
            .map(
              (unitType) =>
                `<button class="buyUnitBtn" data-unit="${unitType}">Buy ${unitType} (${UNIT_PRODUCTION_COST[unitType]} gold)</button>`
            )
            .join("")}
        </div>
        <button id="skipCityActionBtn">Skip Action</button>
      `
          : `<p>This city has completed its action this turn.</p>`
      }
    `;

    this.leftPanel.appendChild(cityMenu);
    this.updateCityProductionQueue(city);

    const produceUnitButtons = cityMenu.querySelectorAll(".produceUnitBtn");
    produceUnitButtons.forEach((button) => {
      button.addEventListener("click", () =>
        this.produceUnitFromCity(city, button.dataset.unit)
      );
    });

    const buyUnitButtons = cityMenu.querySelectorAll(".buyUnitBtn");
    buyUnitButtons.forEach((button) => {
      button.addEventListener("click", () =>
        this.buyUnitFromCity(city, button.dataset.unit)
      );
    });

    const skipCityActionBtn = document.getElementById("skipCityActionBtn");
    if (skipCityActionBtn) {
      skipCityActionBtn.addEventListener("click", () =>
        this.skipCityAction(city)
      );
    }
  }

  getUnitProductionHTML(unitType, city) {
    return `<button class="produceUnitBtn" data-unit="${unitType}">
              <img src="./Units/${unitType.toLowerCase()}.jpg" alt="${unitType} Icon" class="unit-icon"> ${unitType}
            </button>`;
  }

  produceUnitFromCity(city, unitType) {
    if (city && !city.hasActed) {
      if (city.owner === "player") {
        if (this.canProduceUnit()) {
          city.produceUnit(unitType);
          this.updateNotification(
            `${city.name} started producing ${unitType}.`
          );
          this.displayCityMenu(city);
        } else {
          this.updateNotification(
            `Unit limit reached. Grow your cities to increase the limit.`
          );
        }
      } else {
        const aiPlayer = this.AIs.find((ai) => ai.name === city.owner);
        if (aiPlayer && aiPlayer.canProduceUnit()) {
          city.produceUnit(unitType);
          this.updateNotification(
            `${city.name} started producing ${unitType}.`
          );
        } else if (aiPlayer) {
          this.updateNotification(
            `${aiPlayer.name} has reached its unit limit.`
          );
        }
      }
    }
  }

  skipCityAction(city) {
    if (city && !city.hasActed) {
      city.skipAction(this);
      this.updateNotification(`${city.name} has skipped its action.`);
      this.displayCityMenu(city);
    }
  }

  scrollToSettler() {
    const settler = this.playerUnits.find((u) => u.type === "Settler");
    if (settler) {
      const map = this.mapElement;
      const tile = document.querySelector(
        `[data-x="${settler.x}"][data-y="${settler.y}"]`
      );
      if (map && tile) {
        const tileRect = tile.getBoundingClientRect();
        const mapRect = map.getBoundingClientRect();
        const offsetX =
          tileRect.left - mapRect.left - mapRect.width / 2 + tileRect.width / 2;
        const offsetY =
          tileRect.top - mapRect.top - mapRect.height / 2 + tileRect.height / 2;
        map.scrollBy({
          top: offsetY,
          left: offsetX,
          behavior: "smooth",
        });
      }
    }
  }

  calculateDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  calculateDirection(unit, targetCity) {
    const dx = targetCity.x - unit.x;
    const dy = targetCity.y - unit.y;
    return {
      dx: dx !== 0 ? Math.sign(dx) : 0,
      dy: dy !== 0 ? Math.sign(dy) : 0,
    };
  }

  calculateResourceAmount(tileType, unit) {
    const resourceMap = {
      Forest: { type: "wood", baseAmount: 5 },
      Hills: { type: "stone", baseAmount: 3 },
      Plains: { type: "food", baseAmount: 5 },
    };

    if (!resourceMap[tileType]) {
      return null;
    }

    const resource = resourceMap[tileType];
    let amount = resource.baseAmount;

    if (unit.owner === "player" && this.playerResources.leader) {
      const leaderBonus = this.playerResources.leader.bonus;
      if (leaderBonus.includes(resource.type)) {
        amount += 1;
      }
    }

    return { type: resource.type, amount };
  }

  getPossibleMoves(unit) {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    const possibleMoves = [];
    directions.forEach((dir) => {
      const nx = unit.x + dir.dx;
      const ny = unit.y + dir.dy;
      if (
        nx >= 0 &&
        nx < MAP_SIZE &&
        ny >= 0 &&
        ny < MAP_SIZE &&
        this.isValidMove(unit, nx, ny)
      ) {
        possibleMoves.push({ x: nx, y: ny });
      }
    });
    return possibleMoves;
  }

  updateUnitLimits() {
    let totalPopulation = 0;
    this.playerResources.cities.forEach((city) => {
      totalPopulation += city.population;
    });

    if (totalPopulation >= 5) {
      this.maxUnits = Math.floor(totalPopulation / 5) + 3;
    } else {
      this.maxUnits = 4;
    }

    this.updateNotification(
      `Unit limit updated. You can now have up to ${this.maxUnits} units.`
    );
    this.updateResourcePanel();
  }

  canProduceUnit() {
    return this.playerUnits.length < this.maxUnits;
  }

  updateCityProductionQueue(city) {
    const productionQueueElement = document.getElementById("productionQueue");
    if (productionQueueElement) {
      productionQueueElement.innerHTML = city.productionQueue
        .map(
          (item) =>
            `<li>${item.unitType || item.buildingType} (${
              item.turnsRemaining
            } turns)</li>`
        )
        .join("");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
