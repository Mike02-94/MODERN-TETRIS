const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");

const colors = [
  "",             
  "#00f0f0",      
  "#0000f0",      
  "#f0a000",      
  "#f0f000",      
  "#00f000",      
  "#a000f0",      
  "#f00000",      
  "#00c0ff",       
];

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;
let grid = createMatrix(COLS, ROWS);
let currentPiece, nextPiece;
let score = 0, level = 1, lines = 0;
let dropInterval = 1000;
let dropCounter = 0;
let lastTime = 0;
let gameOver = false;
let paused = false;
let gameStarted = false;

const scoreElem = document.getElementById("score");
const levelElem = document.getElementById("level");
const gameOverElem = document.getElementById("gameOver");



document.getElementById("startBtn").onclick = () => {
  if (!gameStarted) {
    gameStarted = true;
    startGame();
  }
};

document.getElementById("pauseBtn").onclick = () => paused = true;

document.getElementById("resumeBtn").onclick = () => {
  if (!gameOver) paused = false;
  update();
};

document.getElementById("restartBtn").onclick = () => startGame();


const pieces = [
  [[8, 8, 8, 8]], 
  [[1, 1, 1], [0, 1, 0]],
  [[0, 2, 2], [2, 2, 0]],
  [[3, 3, 0], [0, 3, 3]],
  [[4, 4], [4, 4]],
  [[0, 5, 0], [5, 5, 5]],
  [[6, 0, 0], [6, 6, 6]],
  [[0, 0, 7], [7, 7, 7]]
];

function createMatrix(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function drawMatrix(matrix, offset, context, size = BLOCK_SIZE) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = colors[value];
        context.fillRect((x + offset.x) * size, (y + offset.y) * size, size, size);
        context.strokeStyle = '#000000';
        context.strokeRect((x + offset.x) * size, (y + offset.y) * size, size, size);
      }
    });
  });
}

function collide(grid, piece) {
  const { matrix, pos } = piece;
  return matrix.some((row, y) => {
    return row.some((value, x) => {
      const px = x + pos.x;
      const py = y + pos.y;
      return (
        value !== 0 &&
        (px < 0 || px >= COLS || py >= ROWS || (py >= 0 && grid[py][px] !== 0))
      );
    });
  });
}

function drawGhostPiece(piece) {
  const ghost = {
    matrix: piece.matrix,
    pos: { x: piece.pos.x, y: piece.pos.y }
  };

  while (!collide(grid, ghost)) {
    ghost.pos.y++;
  }
  ghost.pos.y--;

  ctx.globalAlpha = 0.3;
  drawMatrix(ghost.matrix, ghost.pos, ctx);
  ctx.globalAlpha = 1.0;
}

function merge(grid, piece) {
  piece.matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value !== 0) {
        grid[y + piece.pos.y][x + piece.pos.x] = value;
      }
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
    sweepRows();
    resetPiece();
  }
  dropCounter = 0;
}

function sweepRows() {
  let rowCount = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every(cell => cell !== 0)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(0));
      rowCount++;
      y++;
    }
  }

  if (rowCount > 0) {
    score += rowCount * 100;
    lines += rowCount;
    if (lines >= level * 10) {
      level++;
      dropInterval *= 0.9;
    }
    updateScore();
  }
}

function updateScore() {
  scoreElem.textContent = score;
  levelElem.textContent = level;
}

function resetPiece() {
  currentPiece = nextPiece;
  currentPiece.pos = { x: Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2), y: 0 };
  nextPiece = createPiece();

  if (collide(grid, currentPiece)) {
    gameOver = true;
    gameOverElem.style.display = 'block';
  }
  drawPreview(); 
}

function createPiece() {
  const matrix = pieces[Math.floor(Math.random() * pieces.length)];
  return {
    matrix: matrix,
    pos: { x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2), y: 0 }
  };
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const matrix = nextPiece.matrix;
  const blockSize = 30;
  const shapeWidth = matrix[0].length * blockSize;
  const shapeHeight = matrix.length * blockSize;
  const canvasWidth = previewCanvas.width;
  const canvasHeight = previewCanvas.height;

  const pixelOffsetX = Math.floor((canvasWidth - shapeWidth) / 2);
  const pixelOffsetY = Math.floor((canvasHeight - shapeHeight) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        previewCtx.fillStyle = colors[value];
        previewCtx.fillRect(
          pixelOffsetX + x * blockSize,
          pixelOffsetY + y * blockSize,
          blockSize,
          blockSize
        );
        previewCtx.strokeStyle = "#000000";
        previewCtx.strokeRect(
          pixelOffsetX + x * blockSize,
          pixelOffsetY + y * blockSize,
          blockSize,
          blockSize
        );
      }
    });
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMatrix(grid, { x: 0, y: 0 }, ctx);
  drawGhostPiece(currentPiece);
  drawMatrix(currentPiece.matrix, currentPiece.pos, ctx);
}

function update(time = 0) {
  if (paused || gameOver || !gameStarted) return;

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  requestAnimationFrame(update);
}

function startGame() {
  grid = createMatrix(COLS, ROWS);
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  gameOver = false;
  paused = false;
  gameOverElem.style.display = 'none';
  updateScore();

  nextPiece = createPiece();
  resetPiece();
  drawPreview();
  update();
}

document.addEventListener("keydown", e => {
  if (gameOver || paused || !gameStarted) return;
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
    currentPiece.pos.x--;
    if (collide(grid, currentPiece)) currentPiece.pos.x++;
  } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
    currentPiece.pos.x++;
    if (collide(grid, currentPiece)) currentPiece.pos.x--;
  } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
    playerDrop();
  } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
    const rotated = rotate(currentPiece.matrix);
    const original = currentPiece.matrix;
    currentPiece.matrix = rotated;
    if (collide(grid, currentPiece)) {
      currentPiece.matrix = original;
    }
  }
});
