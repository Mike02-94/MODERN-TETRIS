const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const colors = [
  "", "#00f0f0", "#0000f0", "#f0a000", "#f0f000", "#00f000", "#a000f0", "#f00000", "#00c0ff"
];

const ROWS = 20, COLS = 10, BLOCK_SIZE = 30;
let grid, currentPiece, nextPiece, score, level, lines, dropInterval, dropCounter, lastTime;
let gameOver = false, paused = false, gameStarted = false, combo = 0, pendingClear = null;
let particles = [], shiftChances = 2;

const scoreElem = document.getElementById("score");
const levelElem = document.getElementById("level");
const gameOverElem = document.getElementById("gameOver");

const sounds = {
  bgm: new Audio("sounds/bgm.mp3"),
  softdrop: new Audio("sounds/softdrop.mp3"),
  harddrop: new Audio("sounds/harddrop.mp3"),
  lineclear: new Audio("sounds/lineclear.mp3"),
  rotate: new Audio("sounds/rotate.mp3"),
  move: new Audio("sounds/move.mp3"),
  gameover: new Audio("sounds/gameover.mp3"),
  button: new Audio("sounds/button.mp3"),
  levelup: new Audio("sounds/levelup.mp3")
};
sounds.bgm.loop = true;
Object.values(sounds).forEach(s => s.preload = "auto");

const pieces = [
  [[8, 8, 8, 8]], [[1, 1, 1], [0, 1, 0]], [[0, 2, 2], [2, 2, 0]],
  [[3, 3, 0], [0, 3, 3]], [[4, 4], [4, 4]], [[0, 5, 0], [5, 5, 5]],
  [[6, 0, 0], [6, 6, 6]], [[0, 0, 7], [7, 7, 7]]
];

function createMatrix(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function drawMatrix(matrix, offset, context, size = BLOCK_SIZE) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.shadowColor = colors[value];
        context.shadowBlur = 2;
        context.fillStyle = colors[value];
        context.fillRect((x + offset.x) * size, (y + offset.y) * size, size, size);
        context.strokeStyle = '#000000';
        context.strokeRect((x + offset.x) * size, (y + offset.y) * size, size, size);
        context.shadowBlur = 0;
      }
    });
  });
}

function collide(grid, piece) {
  const { matrix, pos } = piece;
  return matrix.some((row, y) => row.some((value, x) => {
    const px = x + pos.x;
    const py = y + pos.y;
    return value !== 0 && (px < 0 || px >= COLS || py >= ROWS || (py >= 0 && grid[py][px] !== 0));
  }));
}

function drawGhostPiece(piece) {
  const ghost = { matrix: piece.matrix, pos: { ...piece.pos } };
  while (!collide(grid, ghost)) ghost.pos.y++;
  ghost.pos.y--;
  ctx.globalAlpha = 0.25;
  drawMatrix(ghost.matrix, ghost.pos, ctx);
  ctx.globalAlpha = 1.0;
}

function merge(grid, piece) {
  piece.matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value !== 0) grid[y + piece.pos.y][x + piece.pos.x] = value;
    })
  );
}

function rotate(matrix) {
  return matrix[0].map((_, i) => matrix.map(row => row[i])).reverse();
}

function playerDrop() {
  currentPiece.pos.y++;
  if (collide(grid, currentPiece)) {
    currentPiece.pos.y--;
    merge(grid, currentPiece);
    handleLineClear();
  } else {
    playSound("softdrop");
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(grid, currentPiece)) currentPiece.pos.y++;
  currentPiece.pos.y--;
  merge(grid, currentPiece);
  handleLineClear();
  dropCounter = 0;
  playSound("harddrop");
  shakeScreen();
}

function shakeScreen() {
  const original = canvas.style.transform;
  let count = 0;
  const interval = setInterval(() => {
    canvas.style.transform = `translate(${Math.random() * 6 - 3}px, ${Math.random() * 6 - 3}px)`;
    if (++count > 5) {
      clearInterval(interval);
      canvas.style.transform = original;
    }
  }, 30);
}

function createParticles(x, y, color) {
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: x + BLOCK_SIZE / 2,
      y: y + BLOCK_SIZE / 2,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      alpha: 1,
      color
    });
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });
  particles = particles.filter(p => {
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.03;
    return p.alpha > 0;
  });
}

function handleLineClear() {
  const fullRows = [];
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].every(cell => cell !== 0)) fullRows.push(y);
  }

  if (fullRows.length > 0) {
    pendingClear = { fullRows, frame: 0 };
    fullRows.forEach(y => {
      for (let x = 0; x < COLS; x++) {
        createParticles(x * BLOCK_SIZE, y * BLOCK_SIZE, colors[grid[y][x]]);
      }
    });
  } else {
    combo = 0;
    resetPiece();
  }
}

function processPendingClear() {
  const { fullRows, frame } = pendingClear;
  if (frame < 6) {
    fullRows.forEach(y => {
      ctx.fillStyle = frame % 2 === 0 ? "#fff176" : "#f5f5f5";
      ctx.fillRect(0, y * BLOCK_SIZE, canvas.width, BLOCK_SIZE);
    });
    pendingClear.frame++;
  } else {
    fullRows.forEach(y => {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(0));
    });
    combo++;
    score += fullRows.length * 100;
    lines += fullRows.length;
    playSound("lineclear");
    showCombo(combo);
    if (lines >= level * 10) {
      level++;
      dropInterval = Math.max(80, Math.floor(1000 * Math.pow(0.7, level - 1)));
      playSound("levelup");
    }
    updateScore();
    pendingClear = null;
    resetPiece();
  }
}

function showCombo(count) {
  if (count < 2) return;
  const div = document.createElement("div");
  div.className = "combo-popup";
  div.textContent = `Combo x${count}!`;
  document.body.appendChild(div);
  const rect = canvas.getBoundingClientRect();
  div.style.left = `${rect.left + canvas.width / 2 - 50}px`;
  div.style.top = `${rect.top + canvas.height / 4}px`;
  setTimeout(() => div.remove(), 800);
}

function updateScore() {
  scoreElem.textContent = score;
  levelElem.textContent = level;
}

function resetPiece() {
  currentPiece = nextPiece;
  currentPiece.pos = {
    x: Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2),
    y: 0
  };
  nextPiece = createPiece();
  shiftChances = 2;
  if (collide(grid, currentPiece)) {
    gameOver = true;
    gameOverElem.style.display = 'block';
    playSound("gameover");
  }
  drawPreview();
}

function createPiece() {
  const matrix = pieces[Math.floor(Math.random() * pieces.length)];
  return {
    matrix,
    pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 }
  };
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const matrix = nextPiece.matrix;
  const shapeWidth = matrix[0].length * BLOCK_SIZE;
  const shapeHeight = matrix.length * BLOCK_SIZE;
  const offsetX = Math.floor((previewCanvas.width - shapeWidth) / 2);
  const offsetY = Math.floor((previewCanvas.height - shapeHeight) / 2);
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        previewCtx.fillStyle = colors[value];
        previewCtx.fillRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        previewCtx.strokeStyle = "#000000";
        previewCtx.strokeRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    });
  });
}

function handleShift() {
  if (!gameOver && !paused && gameStarted && nextPiece && shiftChances > 0) {
    const tempMatrix = currentPiece.matrix;
    currentPiece.matrix = nextPiece.matrix;
    currentPiece.pos = {
      x: Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2),
      y: 0
    };
    nextPiece = { matrix: tempMatrix };
    drawPreview();
    shiftChances--;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMatrix(grid, { x: 0, y: 0 }, ctx);
  drawGhostPiece(currentPiece);
  drawMatrix(currentPiece.matrix, currentPiece.pos, ctx);
  drawParticles();
  if (pendingClear) processPendingClear();
}

function update(time = 0) {
  if (paused || gameOver || !gameStarted) return;
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval && !pendingClear) playerDrop();
  draw();
  requestAnimationFrame(update);
}

function startGame() {
  gameOver = false;
  paused = false;
  dropCounter = 0;
  lastTime = 0;
  score = 0;
  level = 1;
  lines = 0;
  combo = 0;
  particles = [];
  pendingClear = null;
  dropInterval = 1000;
  grid = createMatrix(COLS, ROWS);
  gameOverElem.style.display = 'none';
  updateScore();
  nextPiece = createPiece();
  resetPiece();
  update();
  playSound("bgm");
}

function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;
  try {
    sound.currentTime = 0;
    sound.play();
  } catch (e) {
    console.warn(`Could not play sound: ${name}`, e);
  }
}

// ========== UI and Events ==========

themeToggleBtn.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
};

document.addEventListener("DOMContentLoaded", () => {
  const loadingBar = document.getElementById("loading-bar");
  const gameContainer = document.querySelector(".container");
  const loadingScreen = document.getElementById("loading-screen");

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") document.body.classList.add("dark");

  setTimeout(() => {
    loadingBar.style.width = "100%";
  }, 100);

  setTimeout(() => {
    loadingScreen.style.display = "none";
    gameContainer.style.display = "grid";
    playSound("bgm");
  }, 3100);
});

document.getElementById("startBtn").onclick = () => {
  if (!gameStarted) {
    gameStarted = true;
    playSound("button");
    startGame();
  }
};

document.getElementById("pauseBtn").onclick = () => {
  playSound("button");
  paused = true;
};

document.getElementById("resumeBtn").onclick = () => {
  if (!gameOver) {
    playSound("button");
    paused = false;
    update();
  }
};

document.getElementById("restartBtn").onclick = () => {
  playSound("button");
  gameStarted = true;
  startGame();
};

document.addEventListener("keydown", e => {
  if (!gameStarted || gameOver || paused || pendingClear) return;

  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      currentPiece.pos.x--;
      if (collide(grid, currentPiece)) currentPiece.pos.x++;
      else playSound("move");
      break;
    case "ArrowRight":
    case "d":
    case "D":
      currentPiece.pos.x++;
      if (collide(grid, currentPiece)) currentPiece.pos.x--;
      else playSound("move");
      break;
    case "ArrowDown":
    case "s":
    case "S":
      playerDrop();
      break;
    case "ArrowUp":
    case "w":
    case "W":
      const rotated = rotate(currentPiece.matrix);
      const original = currentPiece.matrix;
      currentPiece.matrix = rotated;
      if (collide(grid, currentPiece)) currentPiece.matrix = original;
      else playSound("rotate");
      break;
    case " ":
      e.preventDefault();
      hardDrop();
      break;
    case "Shift":
      handleShift();
      break;
  }
});
