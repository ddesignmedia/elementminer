// --- Spiel-Setup und Logik ---

// UI-Elemente holen
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const inventoryListUI = document.getElementById('inventory-list');
const chamberElementsUI = document.getElementById('chamber-elements');
const combineButton = document.getElementById('combine-button');
const clearChamberButton = document.getElementById('clear-chamber-button');
const messageUI = document.getElementById('message');
const gameOverDisplay = document.getElementById('game-over-display');
const startGameButton = document.getElementById('start-game-button');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');
const mainTitle = document.getElementById('main-title');
const dailyHighscoreListElement = document.getElementById('dailyHighscoreList');
const alltimeHighscoreListElement = document.getElementById('alltimeHighscoreList');

// Spielkonstanten
const ROWS = 15;
const COLS = 20;
let CELL_SIZE = 30;

// Highscore-Server-Konfiguration
const GAME_ID = "ElementMinerV1";
const BASE_URL = "https://www.ddesignmedia.de/code/";
const GET_HIGHSCORES_URL = BASE_URL + "get_highscores.php";
const SAVE_HIGHSCORE_URL = BASE_URL + "save_score.php";
const funnyGamerNames = [
    "Atom-Spalter", "Molekül-Magier", "Quanten-Quirler", "Protonen-Paule", "Neutronen-Nick",
    "Elektronen-Else", "Sigma-Susi", "Pi-Paul", "Delta-Dieter", "Gamma-Gabi", "Teilchen-Toni", "Isotopen-Ida"
];

// --- Highscore-Funktionen ---
async function fetchHighscores(scope) {
    const listElement = scope === 'daily' ? dailyHighscoreListElement : alltimeHighscoreListElement;
    if (!listElement) { console.error("Highscore list element not found for:", scope); return; }
    listElement.innerHTML = '<li>Lade...</li>';
    try {
        const url = new URL(GET_HIGHSCORES_URL);
        url.searchParams.append('game_id', GAME_ID);
        url.searchParams.append('scope', scope);
        const response = await fetch(url.toString());
        if (!response.ok) {
            let errorText = `HTTP error! status: ${response.status}`;
            try { const serverError = await response.text(); errorText += `, Server: ${serverError}`; } catch (e) {}
            throw new Error(errorText);
        }
        const jsonData = await response.json();
        let scoresToDisplay = [];
        if (jsonData && jsonData.status === 'success' && Array.isArray(jsonData.highscores)) {
            scoresToDisplay = jsonData.highscores;
        } else if (jsonData && jsonData.status === 'error') {
             console.error(`Server error fetching ${scope} highscores: ${jsonData.message}`);
        } else if (Array.isArray(jsonData)) {
            scoresToDisplay = jsonData;
        }
        displayHighscores(scoresToDisplay, listElement, 3);
    } catch (error) {
        console.error(`Client/Network error fetching ${scope} highscores:`, error);
        if(listElement) listElement.innerHTML = `<li>Fehler beim Laden.</li>`;
    }
}

function displayHighscores(scores, listElement, limit) {
    if (!listElement) return;
    listElement.innerHTML = '';
    if (scores && scores.length > 0) {
        const scoresToShow = scores.slice(0, limit);
        scoresToShow.forEach((entry, index) => {
            const listItem = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = `${index + 1}. ${entry.player_name || entry.playerName || 'Anonym'}`;
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'player-score';
            scoreSpan.textContent = entry.score;
            listItem.appendChild(nameSpan);
            listItem.appendChild(scoreSpan);
            listElement.appendChild(listItem);
        });
    } else { listElement.innerHTML = '<li>Noch keine Einträge</li>'; }
}

async function saveHighscoreToServer(playerName, scoreValue) {
    try {
        const formData = new FormData();
        formData.append('game_id', GAME_ID);
        formData.append('playerName', playerName);
        formData.append('score', scoreValue);
        const response = await fetch(SAVE_HIGHSCORE_URL, { method: 'POST', body: formData });
        const responseText = await response.text();
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`); }
        try {
            const result = JSON.parse(responseText);
            if (result.success || result.status === 'success') {
                console.log("Highscore erfolgreich gespeichert.");
                fetchHighscores('daily');
                fetchHighscores('alltime');
            } else { console.error('Fehler beim Speichern des Highscores (Server-Logik):', result.message || 'Unbekannter Serverfehler aus JSON'); }
        } catch (jsonError) { console.error('Fehler beim Parsen der JSON-Antwort vom Server für Highscore-Speicherung.', jsonError, "Rohe Antwort:", responseText); }
    } catch (error) { console.error('Fehler beim Speichern des Highscores (Client/Netzwerk oder ungültiger HTTP-Status):', error); }
}
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// --- Canvas und Spiel-Anpassung ---
function resizeCanvas() {
    const gameContainerEl = document.getElementById('game-container');
    let containerWidth = gameContainerEl.clientWidth;
    const uiPanel = document.getElementById('ui-panel');
    let uiPanelWidth = 0;

    if (window.innerWidth > 900 && uiPanel) {
         uiPanelWidth = uiPanel.offsetWidth;
         containerWidth -= (uiPanelWidth + 20);
    } else {
         containerWidth = gameContainerEl.clientWidth * 0.98;
    }

    CELL_SIZE = Math.floor(containerWidth / COLS);
    if (CELL_SIZE * ROWS > window.innerHeight * 0.7) {
        CELL_SIZE = Math.floor((window.innerHeight * 0.7) / ROWS);
    }
    CELL_SIZE = Math.max(10, CELL_SIZE);

    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;

    if (gameRunning && !gameOver) drawGrid();
}
window.addEventListener('resize', resizeCanvas);

// --- Spieldaten: Kacheln, Elemente, Salze ---
const TILE_TYPES = {
    EMPTY: 0, EARTH: 1, PLAYER: 2, SKY: 3, GRASS: 4, STONE: 5,
    SODIUM_ORE: 10, ALUMINUM_ORE: 11,
    CHLORINE_DEPOSIT: 20, OXYGEN_DEPOSIT: 21, SULFUR_DEPOSIT: 22,
    POTASSIUM_ORE: 12, MAGNESIUM_ORE: 13, CALCIUM_ORE: 14,
    PHOSPHORUS_DEPOSIT: 23, BROMINE_DEPOSIT: 24, NITROGEN_DEPOSIT: 25, CARBON_DEPOSIT: 26,
};

const ELEMENTS = {
    [TILE_TYPES.SODIUM_ORE]:    { name: "Natrium", symbol: "Na", type: "metal", color: "#B0B0B0", valency: 1 },
    [TILE_TYPES.ALUMINUM_ORE]:  { name: "Aluminium", symbol: "Al", type: "metal", color: "#808080", valency: 3 },
    [TILE_TYPES.POTASSIUM_ORE]: { name: "Kalium", symbol: "K", type: "metal", color: "#D8BFD8", valency: 1 },
    [TILE_TYPES.MAGNESIUM_ORE]: { name: "Magnesium", symbol: "Mg", type: "metal", color: "#E0E0E0", valency: 2 },
    [TILE_TYPES.CALCIUM_ORE]:   { name: "Calcium", symbol: "Ca", type: "metal", color: "#BEBEBE", valency: 2 },
    [TILE_TYPES.CHLORINE_DEPOSIT]:{ name: "Chlor", symbol: "Cl", type: "nonmetal", color: "#90EE90", valency: 1 },
    [TILE_TYPES.OXYGEN_DEPOSIT]:  { name: "Sauerstoff", symbol: "O", type: "nonmetal", color: "#ADD8E6", valency: 2 },
    [TILE_TYPES.SULFUR_DEPOSIT]:  { name: "Schwefel", symbol: "S", type: "nonmetal", color: "#FFFF00", valency: 2 },
    [TILE_TYPES.PHOSPHORUS_DEPOSIT]:{ name: "Phosphor", symbol: "P", type: "nonmetal", color: "#CD5C5C", valency: 3 },
    [TILE_TYPES.BROMINE_DEPOSIT]: { name: "Brom", symbol: "Br", type: "nonmetal", color: "#A52A2A", valency: 1 },
    [TILE_TYPES.NITROGEN_DEPOSIT]:{ name: "Stickstoff", symbol: "N", type: "nonmetal", color: "#B0C4DE", valency: 3 },
    [TILE_TYPES.CARBON_DEPOSIT]:  { name: "Kohlenstoff", symbol: "C", type: "nonmetal", color: "#404040", valency: 4 }
};

const TILE_COLORS = {
    [TILE_TYPES.EMPTY]: "#303030", [TILE_TYPES.EARTH]: "#8B4513", [TILE_TYPES.PLAYER]: "#FFD700",
    [TILE_TYPES.SKY]: "#87CEEB", [TILE_TYPES.GRASS]: "#228B22", [TILE_TYPES.STONE]: "#708090",
    [TILE_TYPES.SODIUM_ORE]: ELEMENTS[TILE_TYPES.SODIUM_ORE].color,
    [TILE_TYPES.ALUMINUM_ORE]: ELEMENTS[TILE_TYPES.ALUMINUM_ORE].color,
    [TILE_TYPES.POTASSIUM_ORE]: ELEMENTS[TILE_TYPES.POTASSIUM_ORE].color,
    [TILE_TYPES.MAGNESIUM_ORE]: ELEMENTS[TILE_TYPES.MAGNESIUM_ORE].color,
    [TILE_TYPES.CALCIUM_ORE]: ELEMENTS[TILE_TYPES.CALCIUM_ORE].color,
    [TILE_TYPES.CHLORINE_DEPOSIT]: ELEMENTS[TILE_TYPES.CHLORINE_DEPOSIT].color,
    [TILE_TYPES.OXYGEN_DEPOSIT]: ELEMENTS[TILE_TYPES.OXYGEN_DEPOSIT].color,
    [TILE_TYPES.SULFUR_DEPOSIT]: ELEMENTS[TILE_TYPES.SULFUR_DEPOSIT].color,
    [TILE_TYPES.PHOSPHORUS_DEPOSIT]: ELEMENTS[TILE_TYPES.PHOSPHORUS_DEPOSIT].color,
    [TILE_TYPES.BROMINE_DEPOSIT]: ELEMENTS[TILE_TYPES.BROMINE_DEPOSIT].color,
    [TILE_TYPES.NITROGEN_DEPOSIT]: ELEMENTS[TILE_TYPES.NITROGEN_DEPOSIT].color,
    [TILE_TYPES.CARBON_DEPOSIT]: ELEMENTS[TILE_TYPES.CARBON_DEPOSIT].color,
};

function isFallable(tileType) {
    return (tileType >= 10 && tileType < 20) ||
           (tileType >= 20 && tileType < 30) ||
           tileType === TILE_TYPES.STONE;
}

const SALTS = [
    { name: "Natriumchlorid (NaCl)", components: { Na: 1, Cl: 1 }, points: 10 },
    { name: "Aluminiumchlorid (AlCl₃)", components: { Al: 1, Cl: 3 }, points: 30 },
    { name: "Natriumoxid (Na₂O)", components: { Na: 2, O: 1 }, points: 15 },
    { name: "Aluminiumoxid (Al₂O₃)", components: { Al: 2, O: 3 }, points: 50 },
    { name: "Natriumsulfid (Na₂S)", components: { Na: 2, S: 1 }, points: 15 },
    { name: "Aluminiumsulfid (Al₂S₃)", components: { Al: 2, S: 3 }, points: 50 },
    { name: "Kaliumchlorid (KCl)", components: { K: 1, Cl: 1 }, points: 10 },
    { name: "Kaliumbromid (KBr)", components: { K: 1, Br: 1 }, points: 12 },
    { name: "Kaliumoxid (K₂O)", components: { K: 2, O: 1 }, points: 15 },
    { name: "Magnesiumchlorid (MgCl₂)", components: { Mg: 1, Cl: 2 }, points: 20 },
    { name: "Magnesiumoxid (MgO)", components: { Mg: 1, O: 1 }, points: 18 },
    { name: "Calciumchlorid (CaCl₂)", components: { Ca: 1, Cl: 2 }, points: 20 },
    { name: "Calciumoxid (CaO)", components: { Ca: 1, O: 1 }, points: 18 },
    { name: "Aluminiumphosphid (AlP)", components: { Al: 1, P: 1 }, points: 25 },
    { name: "Phosphortrichlorid (PCl₃)", components: { P: 1, Cl: 3 }, points: 30 },
    { name: "Kohlenstoffdioxid (CO₂)", components: { C: 1, O: 2 }, points: 15 },
    { name: "Natriumbromid (NaBr)", components: { Na: 1, Br: 1 }, points: 12 },
    { name: "Magnesiumsulfid (MgS)", components: { Mg: 1, S: 1 }, points: 22 },
    { name: "Calciumsulfid (CaS)", components: { Ca: 1, S: 1 }, points: 22 },
    { name: "Kaliumnitrid (K₃N)", components: { K: 3, N: 1 }, points: 35 },
    { name: "Magnesiumnitrid (Mg₃N₂)", components: { Mg: 3, N: 2 }, points: 40 },
    { name: "Calciumnitrid (Ca₃N₂)", components: { Ca: 3, N: 2 }, points: 40 },
    { name: "Natriumphosphid (Na₃P)", components: {Na: 3, P:1}, points: 30},
    { name: "Aluminiumbromid (AlBr₃)", components: {Al:1, Br:3}, points:32},
    { name: "Kohlenstoffdisulfid (CS₂)", components: {C:1, S:2}, points: 20},
    { name: "Calciumbromid (CaBr₂)", components: { Ca: 1, Br: 2 }, points: 22 },
    { name: "Aluminiumnitrid (AlN)", components: { Al: 1, N: 1 }, points: 28 },
    { name: "Calciumphosphid (Ca₃P₂)", components: { Ca: 3, P: 2 }, points: 45 },
    { name: "Magnesiumphosphid (Mg₃P₂)", components: { Mg: 3, P: 2 }, points: 42 },
    { name: "Calciumcarbid (CaC₂)", components: { Ca: 1, C: 2 }, points: 25 },
    { name: "Dicalciumcarbid (Ca₂C)", components: { Ca: 2, C: 1 }, points: 26 },
    { name: "Magnesiumcarbid (MgC₂)", components: { Mg: 1, C: 2 }, points: 25 },
    { name: "Dimagnesiumcarbid (Mg₂C)", components: { Mg: 2, C: 1 }, points: 26 },
    { name: "Kaliumcarbid (K₂C₂)", components: { K: 2, C: 2 }, points: 30 },
    { name: "Tetrakaliumcarbid (K₄C)", components: { K: 4, C: 1 }, points: 32 },
    { name: "Natriumcarbid (Na₂C₂)", components: { Na: 2, C: 2 }, points: 30 },
    { name: "Tetranatriumcarbid (Na₄C)", components: { Na: 4, C: 1 }, points: 32 },
    { name: "Aluminiumcarbid (Al₄C₃)", components: { Al: 4, C: 3 }, points: 60 }
];

// --- Spielzustandsvariablen ---
let grid = [];
let player = { x: 1, y: 1 };
let inventory = {};
let reactionChamber = [];
let score = 0;
let gameOver = false;
let gameRunning = false;
let totalGameTimeElapsed = 0;
let crushingObjectDetails = null;
let currentLevel = 1;
const INITIAL_PRODUCTS_TO_NEXT_LEVEL = 10;
let productsToNextLevel = INITIAL_PRODUCTS_TO_NEXT_LEVEL;
let monsters = [];
const MONSTER_COLOR = "#2A0000";
const MONSTER_EYE_COLOR = "#FF0000";
const NORMAL_MONSTER_MOVE_INTERVAL = 5;
const FAST_MONSTER_MOVE_INTERVAL = 2;
const monsterSpawnTimes = [
    { time: 30 * 1000, spawned: false, id: 1 },
    { time: 120 * 1000, spawned: false, id: 2 },
    { time: 240 * 1000, spawned: false, id: 3 },
];

// --- Spielinitialisierung und Level-Management ---
function initGame() {
    gameOver = false;
    gameRunning = true;
    totalGameTimeElapsed = 0;
    crushingObjectDetails = null;
    score = 0;
    inventory = {};
    reactionChamber = [];
    currentLevel = 1;
    productsToNextLevel = INITIAL_PRODUCTS_TO_NEXT_LEVEL;
    monsters = [];
    monsterSpawnTimes.forEach(timer => timer.spawned = false);
    resetLevelContent();
    resizeCanvas();
    updateUI();
    showMessage(`Level ${currentLevel}. Noch ${productsToNextLevel} Produkte bis zum nächsten Level.`);
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resetLevelContent() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) {
            if (r === 0 || r === 1) grid[r][c] = TILE_TYPES.SKY;
            else if (r === 2) grid[r][c] = TILE_TYPES.GRASS;
            else {
                if (r === ROWS - 1 || c === 0 || c === COLS - 1) grid[r][c] = TILE_TYPES.EARTH;
                else {
                    let rand = Math.random();
                    if (rand < 0.18) grid[r][c] = TILE_TYPES.STONE;
                    else if (rand < 0.20) grid[r][c] = TILE_TYPES.SODIUM_ORE;
                    else if (rand < 0.22) grid[r][c] = TILE_TYPES.ALUMINUM_ORE;
                    else if (rand < 0.24) grid[r][c] = TILE_TYPES.POTASSIUM_ORE;
                    else if (rand < 0.26) grid[r][c] = TILE_TYPES.MAGNESIUM_ORE;
                    else if (rand < 0.28) grid[r][c] = TILE_TYPES.CALCIUM_ORE;
                    else if (rand < 0.30) grid[r][c] = TILE_TYPES.CHLORINE_DEPOSIT;
                    else if (rand < 0.32) grid[r][c] = TILE_TYPES.OXYGEN_DEPOSIT;
                    else if (rand < 0.34) grid[r][c] = TILE_TYPES.SULFUR_DEPOSIT;
                    else if (rand < 0.36) grid[r][c] = TILE_TYPES.PHOSPHORUS_DEPOSIT;
                    else if (rand < 0.38) grid[r][c] = TILE_TYPES.BROMINE_DEPOSIT;
                    else if (rand < 0.40) grid[r][c] = TILE_TYPES.NITROGEN_DEPOSIT;
                    else if (rand < 0.42) grid[r][c] = TILE_TYPES.CARBON_DEPOSIT;
                    else grid[r][c] = TILE_TYPES.EARTH;
                }
            }
        }
    }
    player.x = Math.floor(COLS/2);
    player.y = 2;
    grid[player.y][player.x] = TILE_TYPES.PLAYER;

    for(let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const checkY = player.y + i; const checkX = player.x + j;
            if (checkY === player.y && checkX === player.x) continue;
            if (checkY >=0 && checkY < ROWS && checkX >=0 && checkX < COLS) {
                 if (grid[checkY][checkX] === TILE_TYPES.STONE || isFallable(grid[checkY][checkX])) {
                    grid[checkY][checkX] = (checkY === 2) ? TILE_TYPES.GRASS : TILE_TYPES.EARTH;
                 }
            }
        }
    }
    monsters = [];
    monsterSpawnTimes.forEach(timer => timer.spawned = false);
    totalGameTimeElapsed = 0;
}

function levelUp() {
    currentLevel++;
    productsToNextLevel = INITIAL_PRODUCTS_TO_NEXT_LEVEL;
    resetLevelContent();
    showMessage(`Level Up! Willkommen zu Level ${currentLevel}. Noch ${productsToNextLevel} Produkte!`, false);
    updateUI();
    drawGrid();
}

// --- Monster-Logik ---
function spawnNewMonster(spawnConfig) {
    const emptyCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === TILE_TYPES.EMPTY) {
                const distToPlayer = Math.abs(r - player.y) + Math.abs(c - player.x);
                if (distToPlayer > 5) {
                   emptyCells.push({ x: c, y: r });
                }
            }
        }
    }
    if (emptyCells.length > 0) {
        const spawnCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        monsters.push({
            x: spawnCell.x, y: spawnCell.y, id: spawnConfig.id,
            moveCooldown: 0, currentMoveInterval: NORMAL_MONSTER_MOVE_INTERVAL, isChasing: false,
        });
        showMessage("Ein Höhlenmonster ist erschienen!", true);
        spawnConfig.spawned = true;
    } else {
        console.warn("Kein Platz zum Spawnen eines Höhlenmonsters.");
    }
}

function updateMonsterSpawners(elapsedTimeForTick) {
    totalGameTimeElapsed += elapsedTimeForTick;
    for (const spawnConfig of monsterSpawnTimes) {
        if (!spawnConfig.spawned && totalGameTimeElapsed >= spawnConfig.time) {
            spawnNewMonster(spawnConfig);
        }
    }
}

function hasLineOfSightToPlayer(monster) {
    if (monster.y === player.y) {
        const startX = Math.min(monster.x, player.x); const endX = Math.max(monster.x, player.x);
        let clearPath = true;
        for (let x = startX + 1; x < endX; x++) {
            if (grid[monster.y][x] !== TILE_TYPES.EMPTY) { clearPath = false; break; }
        }
        if (clearPath) return { clear: true, dx: Math.sign(player.x - monster.x), dy: 0 };
    }
    if (monster.x === player.x) {
        const startY = Math.min(monster.y, player.y); const endY = Math.max(monster.y, player.y);
        let clearPath = true;
        for (let y = startY + 1; y < endY; y++) {
            if (grid[y][monster.x] !== TILE_TYPES.EMPTY) { clearPath = false; break; }
        }
        if (clearPath) return { clear: true, dx: 0, dy: Math.sign(player.y - monster.y) };
    }
    return { clear: false };
}

let monsterMoveCounter = 0;

function moveMonsters() {
    if (gameOver || !gameRunning) return;
    monsterMoveCounter++;

    monsters.forEach(monster => {
        if (monsterMoveCounter % monster.currentMoveInterval !== 0) return;

        let dx = 0, dy = 0;
        const sight = hasLineOfSightToPlayer(monster);

        if (sight.clear) {
            monster.isChasing = true;
            monster.currentMoveInterval = FAST_MONSTER_MOVE_INTERVAL;
            dx = sight.dx; dy = sight.dy;
        } else {
            monster.isChasing = false;
            monster.currentMoveInterval = NORMAL_MONSTER_MOVE_INTERVAL;
            const possibleMoves = [];
            if (monster.y > 0 && grid[monster.y - 1][monster.x] === TILE_TYPES.EMPTY) possibleMoves.push({dx:0, dy:-1});
            if (monster.y < ROWS - 1 && grid[monster.y + 1][monster.x] === TILE_TYPES.EMPTY) possibleMoves.push({dx:0, dy:1});
            if (monster.x > 0 && grid[monster.y][monster.x - 1] === TILE_TYPES.EMPTY) possibleMoves.push({dx:-1, dy:0});
            if (monster.x < COLS - 1 && grid[monster.y][monster.x + 1] === TILE_TYPES.EMPTY) possibleMoves.push({dx:1, dy:0});
            if (possibleMoves.length > 0) {
                const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                dx = move.dx; dy = move.dy;
            }
        }

        if (dx !== 0 || dy !== 0) {
            const nextX = monster.x + dx; const nextY = monster.y + dy;
            if (nextX >= 0 && nextX < COLS && nextY >= 0 && nextY < ROWS &&
                (grid[nextY][nextX] === TILE_TYPES.EMPTY || (nextY === player.y && nextX === player.x) ) ) {
                    monster.x = nextX; monster.y = nextY;
            }
        }
        if (monster.x === player.x && monster.y === player.y) {
            triggerGameOver("Vom Höhlenmonster erwischt!");
        }
    });
}

// --- Zeichenfunktionen ---
function drawMonstersCtx() {
    monsters.forEach(monster => {
        const P_M = Math.max(1, Math.floor(CELL_SIZE / 7));
        const monsterCenterX = monster.x * CELL_SIZE + CELL_SIZE / 2;
        const monsterCenterY = monster.y * CELL_SIZE + CELL_SIZE / 2;
        const bodyWidth = 3 * P_M; const bodyHeight = 3 * P_M;
        ctx.fillStyle = MONSTER_COLOR;
        ctx.fillRect(monsterCenterX - bodyWidth / 2, monsterCenterY - bodyHeight / 2, bodyWidth, bodyHeight);
        ctx.fillStyle = MONSTER_EYE_COLOR;
        if (P_M > 1) {
            ctx.fillRect(monsterCenterX - P_M * 0.7, monsterCenterY - P_M * 0.3, P_M*0.5, P_M*0.5);
            ctx.fillRect(monsterCenterX + P_M * 0.2, monsterCenterY - P_M * 0.3, P_M*0.5, P_M*0.5);
        }
        ctx.strokeStyle = MONSTER_COLOR; ctx.lineWidth = Math.max(1, P_M / 2);
        const legLength = 2 * P_M;
        ctx.beginPath(); ctx.moveTo(monsterCenterX - bodyWidth/2, monsterCenterY - bodyHeight/2); ctx.lineTo(monsterCenterX - bodyWidth/2 - legLength*0.7, monsterCenterY - bodyHeight/2 - legLength*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(monsterCenterX - bodyWidth/2, monsterCenterY); ctx.lineTo(monsterCenterX - bodyWidth/2 - legLength, monsterCenterY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(monsterCenterX - bodyWidth/2, monsterCenterY + bodyHeight/2); ctx.lineTo(monsterCenterX - bodyWidth/2 - legLength*0.7, monsterCenterY + bodyHeight/2 + legLength*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(monsterCenterX + bodyWidth/2, monsterCenterY - bodyHeight/2); ctx.lineTo(monsterCenterX + bodyWidth/2 + legLength*0.7, monsterCenterY - bodyHeight/2 - legLength*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(monsterCenterX + bodyWidth/2, monsterCenterY); ctx.lineTo(monsterCenterX + bodyWidth/2 + legLength, monsterCenterY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(monsterCenterX + bodyWidth/2, monsterCenterY + bodyHeight/2); ctx.lineTo(monsterCenterX + bodyWidth/2 + legLength*0.7, monsterCenterY + bodyHeight/2 + legLength*0.7); ctx.stroke();
    });
}

function drawGrid() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tileType = grid[r][c];
            const tileX = c * CELL_SIZE;
            const tileY = r * CELL_SIZE;

            if (tileType === TILE_TYPES.PLAYER) {
                ctx.fillStyle = TILE_COLORS[TILE_TYPES.EMPTY];
                ctx.fillRect(tileX, tileY, CELL_SIZE, CELL_SIZE);
                const P = Math.max(1, Math.floor(CELL_SIZE / 10));
                const spriteBodyWidth = 4*P; const spriteBodyHeight = 6*P;
                const pickaxeWidth = 3*P; const totalSpriteEffectiveWidth = spriteBodyWidth + pickaxeWidth;
                const startDrawX = tileX + Math.floor((CELL_SIZE - totalSpriteEffectiveWidth) / 2);
                const startDrawY = tileY + Math.floor((CELL_SIZE - spriteBodyHeight) / 2);
                const minerSkin = "#FFDBAC"; const minerHair = "#593E2A";
                const minerShirt = "#D2691E"; const minerPants = "#4682B4";
                const pickaxeHandleColor = "#964B00"; const pickaxeHeadColor = "#A9A9A9";
                ctx.fillStyle = minerHair; ctx.fillRect(startDrawX + 1*P, startDrawY + 0*P, 2*P, 1*P);
                ctx.fillStyle = minerSkin; ctx.fillRect(startDrawX + 1*P, startDrawY + 1*P, 2*P, 2*P);
                ctx.fillStyle = minerShirt; ctx.fillRect(startDrawX + 0*P, startDrawY + 3*P, 4*P, 2*P);
                ctx.fillStyle = minerPants; ctx.fillRect(startDrawX + 0.5*P, startDrawY + 5*P, 1*P, 1*P);
                ctx.fillRect(startDrawX + 2.5*P, startDrawY + 5*P, 1*P, 1*P);
                const pickaxeRootX_offset = startDrawX + spriteBodyWidth - P; const pickaxeRootY_offset = startDrawY + 3*P;
                ctx.fillStyle = pickaxeHandleColor; ctx.fillRect(pickaxeRootX_offset, pickaxeRootY_offset, P, P);
                ctx.fillRect(pickaxeRootX_offset + P, pickaxeRootY_offset - P, P, P); ctx.fillRect(pickaxeRootX_offset + 2*P, pickaxeRootY_offset - 2*P, P, P);
                ctx.fillStyle = pickaxeHeadColor; const handleTipX_offset = pickaxeRootX_offset + 2.5*P; const handleTipY_offset = pickaxeRootY_offset - 2.5*P;
                ctx.fillRect(handleTipX_offset - 1.5*P, handleTipY_offset - 0.5*P, 3*P, P); ctx.fillRect(handleTipX_offset - 0.5*P, handleTipY_offset, P, 1.5*P);
            } else {
                ctx.fillStyle = TILE_COLORS[tileType] || TILE_COLORS[TILE_TYPES.EARTH];
                ctx.fillRect(tileX, tileY, CELL_SIZE, CELL_SIZE);
                if (isFallable(tileType) && ELEMENTS[tileType]) {
                    const element = ELEMENTS[tileType]; ctx.fillStyle = "black";
                    const fontSize = Math.max(8, Math.floor(CELL_SIZE * 0.45));
                    ctx.font = `${fontSize}px 'Courier New', Courier, monospace`; /* Ersetzte Schriftart */
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillText(element.symbol, tileX + CELL_SIZE / 2, tileY + CELL_SIZE / 2 + 1);
                }
            }
            ctx.strokeStyle = "#202020";
            ctx.strokeRect(tileX, tileY, CELL_SIZE, CELL_SIZE);

            if (gameOver && crushingObjectDetails && crushingObjectDetails.x === c && crushingObjectDetails.y === r && crushingObjectDetails.type === tileType) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
                ctx.fillRect(tileX, tileY + CELL_SIZE * 0.75, CELL_SIZE, CELL_SIZE * 0.25);
            }
        }
    }
    drawMonstersCtx();
}

// --- UI-Updates und Nachrichten ---
function updateUI() {
    scoreDisplay.textContent = score; inventoryListUI.innerHTML = '';
    for (const symbol in inventory) {
        if (inventory[symbol] > 0) {
            const elementDef = Object.values(ELEMENTS).find(el => el.symbol === symbol);
            const li = document.createElement('li');
            li.textContent = `${elementDef.name} (${symbol}): ${inventory[symbol]}`;
            li.style.borderColor = elementDef.color;
            li.style.borderLeftWidth = "5px"; li.style.borderLeftStyle = "solid";
            li.onclick = () => addToChamber(symbol); inventoryListUI.appendChild(li);
        }
    }
    chamberElementsUI.textContent = reactionChamber.join(', ');
}

function showMessage(msg, isError = false) {
    messageUI.textContent = msg;
    messageUI.style.color = isError ? "#e74c3c" : "#3498db";
}

// --- Spieleraktionen und Spielmechanik ---
function movePlayer(dx, dy) {
    if (gameOver || !gameRunning) return;
    const newX = player.x + dx; const newY = player.y + dy;
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) return;

    grid[player.y][player.x] = TILE_TYPES.EMPTY;

    const targetTile = grid[newY][newX];

    if (targetTile === TILE_TYPES.EARTH) {
        score++;
        updateUI();
        grid[newY][newX] = TILE_TYPES.PLAYER;
    } else if (targetTile === TILE_TYPES.EMPTY || targetTile === TILE_TYPES.GRASS) {
        grid[newY][newX] = TILE_TYPES.PLAYER;
    } else if (ELEMENTS[targetTile]) {
        const element = ELEMENTS[targetTile]; inventory[element.symbol] = (inventory[element.symbol] || 0) + 1;
        showMessage(`Sammelte ${element.name}!`); grid[newY][newX] = TILE_TYPES.PLAYER; updateUI();
    } else if (targetTile === TILE_TYPES.SKY || targetTile === TILE_TYPES.STONE) {
        grid[player.y][player.x] = TILE_TYPES.PLAYER;
        drawGrid();
        return;
    } else {
         grid[player.y][player.x] = TILE_TYPES.PLAYER;
         drawGrid();
         return;
    }
    player.x = newX; player.y = newY;

    monsters.forEach(monster => {
        if (player.x === monster.x && player.y === monster.y) {
            triggerGameOver("Vom Höhlenmonster erwischt!");
        }
    });
    applyGravityAndDraw();
}

function applyGravityAndDraw() {
    if (gameOver) return; let fell;
    do { fell = applyGravity(); if (gameOver) break; } while (fell);
    if (!gameOver) drawGrid();
}

function applyGravity() {
    if (gameOver) return false; let somethingFell = false;
    for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 2; r >= 0; r--) {
            const currentTile = grid[r][c];
            if (isFallable(currentTile)) {
                const tileBelow = grid[r + 1][c];
                if (tileBelow === TILE_TYPES.EMPTY) {
                    grid[r + 1][c] = currentTile; grid[r][c] = TILE_TYPES.EMPTY; somethingFell = true;
                } else if (tileBelow === TILE_TYPES.PLAYER) {
                    grid[r + 1][c] = currentTile; grid[r][c] = TILE_TYPES.EMPTY;
                    const itemType = currentTile === TILE_TYPES.STONE ? "Stein" : "Erz/Vorkommen";
                    triggerGameOver(`Vom ${itemType} erschlagen!`, { x: c, y: r + 1, type: currentTile });
                    return true;
                }
            }
        }
    }
    return somethingFell;
}

function triggerGameOver(reason, details = null) {
    if (gameOver) return;
    gameOver = true;
    gameRunning = false;
    crushingObjectDetails = details;

    let finalScoreMessage = `${reason}<br><span class="game-over-score">Dein Score: ${score}</span>`;

    showMessage(reason, true);
    gameOverDisplay.innerHTML = `${finalScoreMessage}<br><button id="restart-button-inner">Neustart</button>`;
    gameOverDisplay.style.display = 'block';

     if (details || reason.includes("Höhlenmonster") || reason.includes("Explosion")) {
        gameContainer.style.display = 'flex';
    } else {
        gameContainer.style.display = 'none';
    }
    mainTitle.style.display = 'none';

    if (score > 0) {
        let playerName = funnyGamerNames[getRandomInt(0, funnyGamerNames.length - 1)];
        saveHighscoreToServer(playerName, score);
    }

    document.getElementById('restart-button-inner').onclick = () => {
        gameOverDisplay.style.display = 'none';
        startScreen.style.display = 'flex';
        mainTitle.style.display = 'block';
        gameContainer.style.display = 'none';
        crushingObjectDetails = null;
        fetchHighscores('daily');
        fetchHighscores('alltime');
    };
}

function addToChamber(symbol) {
    if (gameOver) return;
    if (inventory[symbol] && inventory[symbol] > 0) {
        inventory[symbol]--;
        reactionChamber.push(symbol);
        updateUI();
    } else {
        showMessage(`Nicht genug ${symbol} im Inventar.`, true);
    }
}

clearChamberButton.onclick = () => {
    if (gameOver) return;
    reactionChamber.forEach(symbol => {
        inventory[symbol] = (inventory[symbol] || 0) + 1;
    });
    reactionChamber = [];
    updateUI();
    showMessage("Reaktionskammer geleert. Elemente zum Inventar zurückgefügt.");
};

combineButton.onclick = () => {
    if (gameOver || !gameRunning || reactionChamber.length === 0) return;
    const currentCombinationCounts = {};
    reactionChamber.forEach(symbol => {
        currentCombinationCounts[symbol] = (currentCombinationCounts[symbol] || 0) + 1;
    });
    let saltFormedThisAttempt = false;
    for (const salt of SALTS) {
        let canFormSalt = true; const tempRequiredCounts = { ...salt.components };
        if (Object.keys(tempRequiredCounts).length !== Object.keys(currentCombinationCounts).length) canFormSalt = false;
        else {
            for (const symbolInRecipe in tempRequiredCounts) {
                if (currentCombinationCounts[symbolInRecipe] !== tempRequiredCounts[symbolInRecipe]) {
                    canFormSalt = false; break;
                }
            }
        }
        if (canFormSalt) {
            score += salt.points;
            productsToNextLevel--;
            updateUI();

            if (productsToNextLevel <= 0) {
                levelUp();
            } else {
                showMessage(`${salt.name} gebildet! +${salt.points} P. Level ${currentLevel}. Noch ${productsToNextLevel} Produkte.`);
            }
            saltFormedThisAttempt = true; break;
        }
    }

    if (!saltFormedThisAttempt) {
        const stonesOnGrid = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] === TILE_TYPES.STONE) {
                    stonesOnGrid.push({x: c, y: r});
                }
            }
        }

        if (stonesOnGrid.length > 0) {
            showMessage("Fehlkombination! Ein Fels explodiert!", true);
            const explodingStone = stonesOnGrid[Math.floor(Math.random() * stonesOnGrid.length)];
            const explosionCells = [];
            const explosionRadius = 1;

            for (let rOffset = -explosionRadius; rOffset <= explosionRadius; rOffset++) {
                for (let cOffset = -explosionRadius; cOffset <= explosionRadius; cOffset++) {
                    const exR = explodingStone.y + rOffset;
                    const exC = explodingStone.x + cOffset;
                    if (exR >= 0 && exR < ROWS && exC >= 0 && exC < COLS) {
                        explosionCells.push({ x: exC, y: exR });
                    }
                }
            }

            gameRunning = false;

            explosionCells.forEach(cell => {
                if (grid[cell.y][cell.x] !== TILE_TYPES.SKY) {
                    ctx.fillStyle = "orange";
                    if(cell.x === explodingStone.x && cell.y === explodingStone.y) {
                        ctx.fillStyle = "red";
                    }
                    ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            });

            setTimeout(() => {
                let playerCaughtInExplosion = false;
                explosionCells.forEach(cell => {
                    if (grid[cell.y][cell.x] !== TILE_TYPES.SKY) {
                        if (player.x === cell.x && player.y === cell.y) {
                            playerCaughtInExplosion = true;
                        }
                        monsters = monsters.filter(m => !(m.x === cell.x && m.y === cell.y));
                        grid[cell.y][cell.x] = TILE_TYPES.EMPTY;
                    }
                });

                if (playerCaughtInExplosion) {
                    triggerGameOver("In Explosion geraten!");
                }

                if (!gameOver) {
                   gameRunning = true;
                   applyGravityAndDraw();
                   showMessage(`Fels explodierte! Level ${currentLevel}. Noch ${productsToNextLevel} Produkte.`);
                   requestAnimationFrame(gameLoop);
                } else {
                   drawGrid();
                }

            }, 300);
            reactionChamber = [];
            updateUI();
            return;
        } else {
            showMessage("Fehlkombination! Keine Felsen zum Explodieren da.", true);
        }
    }
    reactionChamber = [];
    updateUI();
};

// --- Event Listener ---
startGameButton.onclick = () => {
    startScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    mainTitle.style.display = 'block';
    initGame();
};

window.addEventListener('keydown', (e) => {
    if (gameOver || !gameRunning) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break; case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break; case 'ArrowRight': movePlayer(1, 0); break;
    }
});

let touchStartX = 0; let touchStartY = 0; let touchEndX = 0; let touchEndY = 0;
const swipeThreshold = 30;
canvas.addEventListener('touchstart', (e) => {
    if (gameOver || !gameRunning) return; e.preventDefault();
    touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY;
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    if (gameOver || !gameRunning) return; e.preventDefault();
    touchEndX = e.changedTouches[0].screenX; touchEndY = e.changedTouches[0].screenY;
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
    if (gameOver || !gameRunning) return; e.preventDefault();
    const deltaX = touchEndX - touchStartX; const deltaY = touchEndY - touchStartY;
    touchEndX = touchStartX; touchEndY = touchStartY;
    if (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) movePlayer(1, 0); else movePlayer(-1, 0);
        } else {
            if (deltaY > 0) movePlayer(0, 1); else movePlayer(0, -1);
        }
    }
}, { passive: false });

// --- Game Loop ---
let lastTime = 0;
const gameLogicInterval = 180;
let animationFrameId = null;

function gameLoop(currentTime = 0) {
    if (!gameRunning || gameOver) {
         if (gameOver) {
            drawGrid();
         }
         cancelAnimationFrame(animationFrameId);
         return;
    }

    const deltaTime = currentTime - lastTime;

    if (deltaTime >= gameLogicInterval) {
        lastTime = currentTime - (deltaTime % gameLogicInterval);

        updateMonsterSpawners(gameLogicInterval);
        moveMonsters();
        applyGravityAndDraw();
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Initialisierung beim Laden der Seite ---
window.onload = function() {
    startScreen.style.display = 'flex';
    gameContainer.style.display = 'none';
    mainTitle.style.display = 'block';
    fetchHighscores('daily');
    fetchHighscores('alltime');
};
