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

loadSound("coin-collected", "/sfx/coin-collected.mp3");
loadSound("jump", "/sfx/jump.mp3")
loadSound("dead", "/sfx/dead.mp3")
loadSound("mute", "/sfx/switch.mp3")

loadShader(
  "lava",
  null,
  `
uniform float u_time;

// Simplex noise functions modified from https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
const vec4 C = vec4(0.211324865405187, 0.366025403784439,
        -0.577350269189626, 0.024390243902439);
vec2 i  = floor(v + dot(v, C.yy));
vec2 x0 = v -   i + dot(i, C.xx);
vec2 i1;
i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
vec4 x12 = x0.xyxy + C.xxzz;
x12.xy -= i1;
i = mod(i, 289.0);
vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
  dot(x12.zw,x12.zw)), 0.0);
m = m*m;
m = m*m;
vec3 x = 2.0 * fract(p * C.www) - 1.0;
vec3 h = abs(x) - 0.5;
vec3 ox = floor(x + 0.5);
vec3 a0 = x - ox;
m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
vec3 g;
g.x  = a0.x  * x0.x  + h.x  * x0.y;
g.yz = a0.yz * x12.xz + h.yz * x12.yw;
return 130.0 * dot(m, g);
}

vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
  // Base lava color
  vec3 lavaColor1 = vec3(0.9, 0.2, 0.0); // Orange-red
  vec3 lavaColor2 = vec3(1.0, 0.6, 0.0); // Brighter orange
  vec3 darkLava = vec3(0.4, 0.02, 0.0);  // Dark red for cracks
  
  // Time variables for animation
  float slowTime = u_time * 0.4;
  float mediumTime = u_time * 0.8;
  float fastTime = u_time * 2.0;
  
  // Scale UV coordinates for better effect
  vec2 scaledUV = uv * 2.5;
  
  // Create multiple layers of noise for more complex effect
  float noise1 = snoise(scaledUV + vec2(slowTime * 0.3, slowTime * 0.2)) * 0.5 + 0.5;
  float noise2 = snoise(scaledUV * 2.0 + vec2(-mediumTime * 0.2, mediumTime * 0.1)) * 0.5 + 0.5;
  float noise3 = snoise(scaledUV * 4.0 + vec2(fastTime * 0.1, -fastTime * 0.15)) * 0.5 + 0.5;
  
  // Combine noise layers
  float combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
  
  // Create bubbling effect with sharper transitions
  float bubbles = smoothstep(0.4, 0.6, noise3);
  
  // Create cracks pattern
  float cracks = smoothstep(0.4, 0.5, abs(noise2 - 0.5) * 2.0);
  
  // Glow effect with pulsing
  float glow = sin(fastTime) * 0.5 + 0.5;
  
  // Mix colors based on noise
  vec3 finalColor = mix(lavaColor1, lavaColor2, combinedNoise);
  
  // Add dark cracks
  finalColor = mix(finalColor, darkLava, cracks * 0.7);
  
  // Add bubbles (brighter spots)
  finalColor = mix(finalColor, vec3(1.0, 0.8, 0.3), bubbles * 0.4);
  
  // Add overall glow
  finalColor += vec3(0.1, 0.02, 0.0) * glow;
  
  // Add a bit of original color for texture blending if needed
  vec4 origColor = def_frag();
  
  return vec4(finalColor, 1.0);
}
`,
);

// Game constants
const SPEED = 120;
const JUMP_FORCE = 300; // Increased jump force
const DOUBLE_JUMP_FORCE = 260; // Increased double jump force
const LAVA_RISE_SPEED = 40; // Increased lava rise speed
const PLATFORM_WIDTH = 100;
const PLATFORM_HEIGHT = 10;
const NUM_PLATFORMS = 24; // More platforms
const PLATFORM_SPACING = 70; // Closer platform spacing (was 100)
const NUM_COINS = 15;

// Game state
let score = 0;
let coinsCollected = 0;
let gameOver = false;
let survivalTime = 0;
let lastPlatformY = 0;

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
], "game");

// Add lava
const lava = add([
  rect(width(), height()),
  pos(0, height()),
  color(rgb(255, 100, 50)),
  area(),
  layer("game"),
  "lava",
  z(100),
  shader("lava", () => ({
    "u_time": time(),
})),
]);

// UI elements

// Add these lines near the top of your script with other game constants
let isMuted = false;

// Add this function to toggle sound state
function toggleMute() {
  isMuted = !isMuted;
  
  // KaPlay's volume control (0 = muted, 1 = full volume)
  volume(isMuted ? 0 : 1);
  
  // Update the mute button text
  if (muteBtn) {
    muteBtn.text = isMuted ? "🔇" : "🔊";
  }
}

// Add this with your UI elements
const muteBtn = add([
  text("🔊"),
  pos(width() - 24, 24),
  anchor("topright"),
  area({ cursor: "pointer" }),
  layer("ui"),
  fixed(),
  scale(.25),
  "muteBtn",
]);

// Add this with your other input handlers
muteBtn.onClick(() => {
  toggleMute();
  play("mute")
});

// You can also add a keyboard shortcut if you want
onKeyPress("m", () => {
  toggleMute();
  play("mute")
});

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

// Function to generate random platforms
function spawnPlatforms() {
  // Clear existing platforms
  get("platform").forEach(destroy);
  
  lastPlatformY = height() - 24;
  
  // Add platforms with better spacing
  for (let i = 0; i < NUM_PLATFORMS; i++) {
    const x = rand(50, width() - 50 - PLATFORM_WIDTH);
    const y = height() - 100 - i * PLATFORM_SPACING;
    const platformWidth =  rand(PLATFORM_WIDTH - 50, PLATFORM_WIDTH + 50)
    add([
      rect(platformWidth, PLATFORM_HEIGHT),
      area(),
      outline(1),
      color(rgb(85, 85, 85)),
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

// Initialize the game
function startGame() {
  gameOver = false;
  score = 0;
  coinsCollected = 0;
  survivalTime = 0;

  scoreLabel.hidden = false
  coinCounter.hidden = false
  timeLabel.hidden = false
  
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
  player.pos = vec2(lowestPlatform.pos.x + PLATFORM_WIDTH / 2, lowestPlatform.pos.y - PLATFORM_HEIGHT);
  player.play("idle");
}

// Player controls
onKeyPress("space", () => {
  if (gameOver) return;
  
  if (player.isGrounded()) {
    player.jump(JUMP_FORCE);
    player.play("jump");
    play("jump");
  } else {
    if (player.doubleJump()) {
      player.play("jump");
      play("jump");
    }
  }
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

// Switch to "idle" or "run" animation when player hits ground
player.onGround(() => {
  if (!isKeyDown("left") && !isKeyDown("right")) {
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

  //play coin collect sound
  play("coin-collected", {
    volume: 1,
    speed: 1,
});
  coinCounter.text = `Coins: ${coinsCollected}`;
  scoreLabel.text = `Score: ${score}`;
});

// Collision with lava
player.onCollide("lava", () => {
  if (!gameOver) {
    gameOver = true;
    // hide coin counter, score label, and time label
    coinCounter.hidden = true
    scoreLabel.hidden = true
    timeLabel.hidden = true
    play("dead") 
    shake(12);

    add([
      text(`Game Over!\nScore: ${score}\nPress R to restart`, {
        // What font to use
        font: "monospace",
        // It'll wrap to next line if the text width exceeds the width option specified here
        width: width() - 24 *2,
        // The height of character
        size: 24,
        // Text alignment ("left", "center", "right", default "left")
        align: "left",
        lineSpacing: 8,
        letterSpacing: 4,
        // Transform each character for special effects
        transform: transformText,
    }),
      pos(center()),
      anchor("center"),
      layer("ui"),
      fixed(),
      // scale(0),
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

// Game update
onUpdate(() => {
  if (!gameOver) {

    // Make the lava rise faster over time
    // The speed of the lava is modified by a power function to make it rise exponentially
    // The power function is used to make the lava speed up quickly at the start but slow down later
    // The power function is: `LAVA_RISE_SPEED * Math.pow(1.1, survivalTime * 0.01) * dt()`
    // The `survivalTime * 0.01` is used to make the lava speed up faster at the start and slower later
    // The `dt()` is used to make the lava speed up based on the time since the last frame
    lava.pos.y -= LAVA_RISE_SPEED * Math.pow(1.1, survivalTime * 0.01) * dt();
    
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