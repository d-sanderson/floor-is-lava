import kaplay from "kaplay";
import "kaplay/global"; // uncomment if you want to use without the k. prefix

// @ts-check

// Start a kaboom game
kaplay({
  // Scale the whole game up
  scale: 4,
  // Set the default font
  font: "monospace",
  background: [15, 15, 15],
  touchToMouse: true, // Enable touch to mouse conversion for basic interactions
});

const transformText = (idx, ch) => ({
  color: hsl2rgb((time() * 0.2 + idx * 0.1) % 1, 0.7, 0.8),
  pos: vec2(0, wave(-4, 4, time() * 4 + idx * 0.5)),
  scale: wave(1, 1.2, time() * 3 + idx),
  angle: wave(-9, 9, time() * 3 + idx),
})
// Loading sprites
loadSprite("dino", "/sprites/dino.png", {
  sliceX: 9,
  anims: {
    "idle": {
      from: 0,
      to: 3,
      speed: 5,
      loop: true,
    },
    "run": {
      from: 4,
      to: 7,
      speed: 10,
      loop: true,
    },
    "jump": 8,
  },
});

// Load coin sprite
loadSprite("coin", "/sprites/coin.png", {
  sliceX: 1,
});

// Load button sprites
loadSprite("left-button", "/sprites/left-button.png", { sliceX: 1 });
loadSprite("right-button", "/sprites/right-button.png", { sliceX: 1 });
loadSprite("jump-button", "/sprites/jump-button.png", { sliceX: 1 });

// Game constants
const SPEED = 120;
const JUMP_FORCE = 300; // Increased jump force
const DOUBLE_JUMP_FORCE = 260; // Increased double jump force
const LAVA_RISE_SPEED = 30; // Increased lava rise speed
const PLATFORM_WIDTH = 100;
const PLATFORM_HEIGHT = 10;
const NUM_PLATFORMS = 15; // More platforms
const PLATFORM_SPACING = 70; // Closer platform spacing (was 100)
const NUM_COINS = 15;

// Game state
let score = 0;
let coinsCollected = 0;
let gameOver = false;
let survivalTime = 0;
let lastPlatformY = 0;
let isMobile = false;
let moveLeft = false;
let moveRight = false;

// Check if the device is mobile
isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Set up physics
setGravity(640);

// Create a component for double jump
function doubleJump() {
  let jumps = 0;
  
  return {
    id: "doubleJump",
    require: ["body"],
    
    doubleJump(force = DOUBLE_JUMP_FORCE) {
      if (jumps < 1) {
        this.jump(force);
        jumps++;
        return true;
      }
      return false;
    },
    
    update() {
      if (this.isGrounded()) {
        jumps = 0;
      }
    }
  };
}

// Create game layers
setLayers([
  "bg",     // Background
  "game",   // Main game elements
  "ui",     // UI elements
  "controls" // Mobile controls layer
], "game");

// Add lava
const lava = add([
  rect(width(), height()),
  pos(0, height()),
  color(rgb(255, 100, 50)),
  area(),
  layer("game"),
  "lava",
  z(100)
]);

// UI elements
const scoreLabel = add([
  text("Score: 0", { transform: transformText }),
  pos(12, 12),
  layer("ui"),
  fixed(),
  "scoreLabel",
  scale(0.20),
]);


const timeLabel = add([
  text("Time: 0", { transform: transformText }),
  pos(12, 24),
  layer("ui"),
  fixed(),
  "timeLabel",
  scale(0.20),
]);

const coinCounter = add([
  text("Coins: 0", { transform: transformText }),
  pos(12, 36),
  layer("ui"),
  fixed(),
  scale(0.20),
  "coinCounter"
]);

// Add our player character
const player = add([
  sprite("dino"),
  pos(center().x, height() - 100),
  anchor("center"),
  area(),
  body(),
  doubleJump(),
  layer("game"),
  "player",
]);

// Play initial animation
player.play("idle");

// Mobile controls
let leftButton, rightButton, jumpButton;

function addMobileControls() {
  const buttonSize = 50;
  const buttonMargin = 20;
  const buttonY = height() - buttonMargin - buttonSize/2;
  
  // Left button
  leftButton = add([
    circle(buttonSize/2),
    color(rgb(255, 255, 255)),
    outline(2, rgb(255, 255, 255)),
    pos(buttonMargin + buttonSize/2, buttonY),
    area(),
    layer("controls"),
    fixed(),
    opacity(0.7),
    z(200),
    "control-button",
  ]);
  
  add([
    text("←", { size: 32 }),
    pos(buttonMargin + buttonSize/2, buttonY),
    color(rgb(255, 255, 255)),
    anchor("center"),
    layer("controls"),
    fixed(),
    z(201),
    "control-label",
  ]);

  // Right button
  rightButton = add([
    circle(buttonSize/2),
    color(rgb(255, 255, 255)),
    outline(2, rgb(255, 255, 255)),
    pos(buttonMargin + buttonSize*2, buttonY),
    area(),
    layer("controls"),
    fixed(),
    opacity(0.7),
    z(200),
    "control-button",
  ]);
  
  add([
    text("→", { size: 32 }),
    pos(buttonMargin + buttonSize*2, buttonY),
    color(rgb(255, 255, 255)),
    anchor("center"),
    layer("controls"),
    fixed(),
    z(201),
    "control-label",
  ]);

  // Jump button
  jumpButton = add([
    circle(buttonSize/2),
    color(rgb(255, 255, 255)),
    outline(2, rgb(255, 255, 255)),
    pos(width() - buttonMargin - buttonSize/2, buttonY),
    area(),
    layer("controls"),
    fixed(),
    opacity(0.7),
    z(200),
    "control-button",
  ]);
  
  add([
    text("↑", { size: 32 }),
    pos(width() - buttonMargin - buttonSize/2, buttonY),
    color(rgb(255, 255, 255)),
    anchor("center"),
    layer("controls"),
    fixed(),
    z(201),
    "control-label",
  ]);

  // Left button event handlers
  leftButton.onClick(() => {
    moveLeft = true;
  });
  
  leftButton.onTouchStart(() => {
    moveLeft = true;
  });
  
  leftButton.onTouchEnd(() => {
    moveLeft = false;
    if (player.isGrounded() && !moveRight) {
      player.play("idle");
    }
  });

  // Right button event handlers
  rightButton.onClick(() => {
    moveRight = true;
  });
  
  rightButton.onTouchStart(() => {
    moveRight = true;
  });
  
  rightButton.onTouchEnd(() => {
    moveRight = false;
    if (player.isGrounded() && !moveLeft) {
      player.play("idle");
    }
  });

  // Jump button event handlers
  jumpButton.onClick(() => {
    handleJump();
  });
  
  jumpButton.onTouchStart(() => {
    handleJump();
  });
}

// Function to generate random platforms
function spawnPlatforms() {
  // Clear existing platforms
  get("platform").forEach(destroy);
  
  lastPlatformY = height() - 24;
  
  // Add platforms with better spacing
  for (let i = 0; i < NUM_PLATFORMS; i++) {
    const x = rand(50, width() - 50 - PLATFORM_WIDTH);
    const y = height() - 100 - i * PLATFORM_SPACING;
    
    add([
      rect(rand(PLATFORM_WIDTH - 50, PLATFORM_WIDTH + 50), PLATFORM_HEIGHT),
      area(),
      outline(1),
      color(rgb(100, 200, 120)),
      pos(x, y),
      body({ isStatic: true }),
      layer("game"),
      "platform",
    ]);
    
    lastPlatformY = Math.min(lastPlatformY, y);
  }
}

// Function to spawn coins
function spawnCoins() {
  // Clear existing coins
  get("coin").forEach(destroy);
  
  // Add coins
  for (let i = 0; i < NUM_COINS; i++) {
    const x = rand(50, width() - 50);
    const y = rand(lastPlatformY, height() - 100);
    
    add([
      sprite("coin"),
      area(),
      pos(x, y),
      anchor("center"),
      layer("game"),
      "coin",
      scale(0.25),
    ]);
  }
}

// Handle jump logic
function handleJump() {
  if (gameOver) return;
  
  if (player.isGrounded()) {
    player.jump(JUMP_FORCE);
    player.play("jump");
  } else {
    if (player.doubleJump()) {
      player.play("jump");
    }
  }
}

// Initialize the game
function startGame() {
  gameOver = false;
  score = 0;
  coinsCollected = 0;
  survivalTime = 0;
  moveLeft = false;
  moveRight = false;

  scoreLabel.hidden = false;
  coinCounter.hidden = false;
  timeLabel.hidden = false;
  
  // Reset lava position
  lava.pos.y = height();
  
  // Generate platforms
  spawnPlatforms();
  
  // Spawn coins
  spawnCoins();
  
  // Reset player
  const lowestPlatform = get("platform").reduce((lowest, platform) => {
    return platform.pos.y > lowest.pos.y ? platform : lowest;
  }, get("platform")[0]);
  player.pos = vec2(lowestPlatform.pos.x, lowestPlatform.pos.y - 50);
  player.play("idle");
  
  // Add mobile controls if they don't exist yet
  if (get("control-button").length === 0 && isMobile) {
    addMobileControls();
  }
}

// Player controls (keyboard)
onKeyPress("space", () => {
  handleJump();
});

onKeyDown("left", () => {
  if (gameOver) return;
  
  player.move(-SPEED, 0);
  player.flipX = true;
  if (player.isGrounded() && player.curAnim() !== "run") {
    player.play("run");
  }
});

onKeyDown("right", () => {
  if (gameOver) return;
  
  player.move(SPEED, 0);
  player.flipX = false;
  if (player.isGrounded() && player.curAnim() !== "run") {
    player.play("run");
  }
});

["left", "right"].forEach((key) => {
  onKeyRelease(key, () => {
    if (gameOver) return;
    
    // Only reset to "idle" if player is not holding any of these keys
    if (player.isGrounded() && !isKeyDown("left") && !isKeyDown("right")) {
      player.play("idle");
    }
  });
});

onKeyPress("r", () => {
  if (gameOver) {
    get("gameOverText").forEach(destroy);
    startGame();
  }
});

// Restart game on tap when game over
onClick(() => {
  if (gameOver) {
    get("gameOverText").forEach(destroy);
    startGame();
  }
});

// Switch to "idle" or "run" animation when player hits ground
player.onGround(() => {
  if (!isKeyDown("left") && !isKeyDown("right") && !moveLeft && !moveRight) {
    player.play("idle");
  } else {
    player.play("run");
  }
});

// Collision with coins
player.onCollide("coin", (coin) => {
  destroy(coin);
  coinsCollected++;
  score += 10;
  coinCounter.text = `Coins: ${coinsCollected}`;
  scoreLabel.text = `Score: ${score}`;
});

// Collision with lava
player.onCollide("lava", () => {
  if (!gameOver) {
    gameOver = true;
    // hide coin counter, score label, and time label
    coinCounter.hidden = true;
    scoreLabel.hidden = true;
    timeLabel.hidden = true;
    
    shake(12);

    add([
      text(`Game Over!\nScore: ${score}\nTap to restart`, {
        // What font to use
        font: "monospace",
        // It'll wrap to next line if the text width exceeds the width option specified here
        width: width() - 24 * 2,
        // The height of character
        size: 24,
        // Text alignment ("left", "center", "right", default "left")
        align: "center",
        lineSpacing: 8,
        letterSpacing: 4,
        // Transform each character for special effects
        transform: transformText,
      }),
      pos(center()),
      anchor("center"),
      layer("ui"),
      fixed(),
      "gameOverText",
    ]);
  }
});

// Screen wrap
player.onUpdate(() => {
  if (player.pos.x < 0) {
    player.pos.x = width();
  }
  if (player.pos.x > width()) {
    player.pos.x = 0;
  }
});

// Handle mobile controls in update loop
onUpdate(() => {
  if (!gameOver) {
    // Handle mobile movement
    if (moveLeft) {
      player.move(-SPEED, 0);
      player.flipX = true;
      if (player.isGrounded() && player.curAnim() !== "run") {
        player.play("run");
      }
    }
    
    if (moveRight) {
      player.move(SPEED, 0);
      player.flipX = false;
      if (player.isGrounded() && player.curAnim() !== "run") {
        player.play("run");
      }
    }
    
    // Move lava upward continuously
    lava.pos.y -= LAVA_RISE_SPEED * dt();
    
    // Update survival time
    survivalTime += dt();
    timeLabel.text = `Time: ${Math.floor(survivalTime)}`;
    
    // Update score based on survival time
    score = coinsCollected * 10 + Math.floor(survivalTime);
    scoreLabel.text = `Score: ${score}`;
  }
});

// Camera follow
onUpdate(() => {
  if (player.pos.y < height() / 2 && !gameOver) {
    // Camera follows player vertically
    camPos(camPos().x, player.pos.y);
  }
});

// Start the game
startGame();