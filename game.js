/**
 * NS-Shaft Clone - Action Version
 * Core Game Logic
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpBarFill = document.getElementById('hp-bar-fill');
const floorText = document.getElementById('floor-count');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreText = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// --- Configuration ---
const CONFIG = {
    canvasWidth: 400,
    canvasHeight: 600,
    gravity: 0.35,
    jumpForce: -8,
    moveSpeed: 5,
    friction: 0.8,
    scrollSpeed: 1.5,
    maxHp: 100,
    topSpikesHeight: 30,
    platformWidth: 80,
    platformHeight: 15,
    spawnDistance: 100
};

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// --- State ---
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 1;
let hp = CONFIG.maxHp;
let platforms = [];
let enemies = [];
let projectiles = [];
let keys = {};
let lastPlatformY = CONFIG.canvasHeight - 50;

// --- Classes ---

class Player {
    constructor() {
        this.width = 24;
        this.height = 32;
        this.reset();
    }

    reset() {
        this.x = CONFIG.canvasWidth / 2 - this.width / 2;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.onPlatform = false;
        this.canTakeDamage = true;
        this.invincibilityFrames = 0;
    }

    update() {
        // Horizontal movement
        if (keys['ArrowLeft']) this.vx -= 0.8;
        if (keys['ArrowRight']) this.vx += 0.8;
        this.vx *= CONFIG.friction;

        // Apply velocities
        this.x += this.vx;
        this.y += this.vy;

        // Gravity
        this.vy += CONFIG.gravity;

        // Screen boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CONFIG.canvasWidth) this.x = CONFIG.canvasWidth - this.width;

        // Top Spikes Damage
        if (this.y < CONFIG.topSpikesHeight) {
            this.takeDamage(10);
            this.vy = 2; // Bounce down
        }

        // Falling off bottom
        if (this.y > CONFIG.canvasHeight) {
            this.takeDamage(100); // Instant death or heavy damage
        }

        if (this.invincibilityFrames > 0) {
            this.invincibilityFrames--;
        }
    }

    takeDamage(amount) {
        if (this.invincibilityFrames > 0) return;
        hp -= amount;
        this.invincibilityFrames = 30; // 0.5 sec at 60fps
        if (hp <= 0) {
            hp = 0;
            endGame();
        }
    }

    draw() {
        if (this.invincibilityFrames % 4 < 2) {
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Simple eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(this.x + 4, this.y + 6, 4, 4);
            ctx.fillRect(this.x + 16, this.y + 6, 4, 4);
        }
    }
}

class Platform {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = CONFIG.platformWidth;
        this.height = CONFIG.platformHeight;
        this.type = type;
        this.hasStepped = false;
        this.breakTimer = 30; // For fragile platforms
    }

    update() {
        this.y -= CONFIG.scrollSpeed;
    }

    draw() {
        switch (this.type) {
            case 'normal': ctx.fillStyle = '#555'; break;
            case 'spike': ctx.fillStyle = '#ff3366'; break;
            case 'spring': ctx.fillStyle = '#ffcc00'; break;
            case 'conveyor-l': ctx.fillStyle = '#3399ff'; break;
            case 'conveyor-r': ctx.fillStyle = '#3399ff'; break;
            case 'fragile': ctx.fillStyle = '#aaaaaa'; break;
        }

        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Visual details
        if (this.type === 'spike') {
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(this.x + i * 16, this.y);
                ctx.lineTo(this.x + i * 16 + 8, this.y - 8);
                ctx.lineTo(this.x + i * 16 + 16, this.y);
                ctx.fill();
            }
        } else if (this.type === 'spring') {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x + 10, this.y + 2, this.width - 20, this.height - 4);
        } else if (this.type === 'conveyor-l' || this.type === 'conveyor-r') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            const offset = (Date.now() / 50) % 20;
            for(let i=0; i<4; i++){
                let iconX = this.type === 'conveyor-l' ? this.x + (i*20) - offset : this.x + (i*20) + offset;
                if(iconX > this.x && iconX < this.x + this.width - 10){
                    ctx.fillText(this.type === 'conveyor-l' ? '<' : '>', iconX, this.y + 12);
                }
            }
        }
    }
}

class Enemy {
    constructor(platform, type) {
        this.type = type;
        this.width = 20;
        this.height = 20;
        this.platform = platform; // Turret is fixed to platform
        this.shootTimer = Math.random() * 100;
        
        if (type === 'turret') {
            this.x = platform.x + platform.width / 2 - this.width / 2;
            this.y = platform.y - this.height;
        } else if (type === 'sentry') {
            this.x = Math.random() * (CONFIG.canvasWidth - this.width);
            this.y = platform.y - 120; // Above platform
            this.vx = 2;
        }
    }

    update() {
        if (this.type === 'turret') {
            this.y = this.platform.y - this.height;
            this.x = this.platform.x + this.platform.width / 2 - this.width / 2;
        } else if (this.type === 'sentry') {
            this.x += this.vx;
            if (this.x < 0 || this.x + this.width > CONFIG.canvasWidth) this.vx *= -1;
            // Float up slowly like platforms
            this.y -= CONFIG.scrollSpeed;
        }

        // Shooting logic
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = 100 + Math.random() * 100;
        }
    }

    shoot() {
        let angle;
        if (this.type === 'turret') {
            // Shoot towards player if nearby, else down
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            angle = Math.atan2(dy, dx);
        } else {
            angle = Math.PI / 2; // Straight down
        }
        
        projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2, angle));
    }

    draw() {
        ctx.fillStyle = this.type === 'turret' ? '#ff6600' : '#purple';
        if (this.type === 'turret') {
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 5, this.y + 5, 10, 10);
        } else {
            // Draw sentry (diamond shape)
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height / 2);
            ctx.closePath();
            ctx.fill();
        }
    }
}

class Projectile {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.speed = 4;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = 4;
        this.bounces = 0;
        this.maxBounces = 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce logic
        if (this.x - this.radius < 0 || this.x + this.radius > CONFIG.canvasWidth) {
            this.vx *= -1;
            // Add random vertical offset as requested
            this.vy += (Math.random() - 0.5) * 2;
            this.bounces++;
        }

        // Projectile removal
        if (this.y < 0 || this.y > CONFIG.canvasHeight || this.bounces > this.maxBounces) {
            return false;
        }

        // Hit player
        const dx = this.x - (player.x + player.width / 2);
        const dy = this.y - (player.y + player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + player.width / 2) {
            player.takeDamage(5);
            return false;
        }

        return true;
    }

    draw() {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

const player = new Player();

// --- Game Logic ---

function init() {
    platforms = [];
    enemies = [];
    projectiles = [];
    hp = CONFIG.maxHp;
    score = 1;
    lastPlatformY = CONFIG.canvasHeight - 50;
    player.reset();
    
    // Initial platforms
    for (let i = 0; i < 6; i++) {
        spawnPlatform(CONFIG.canvasHeight - i * 100);
    }
    
    requestAnimationFrame(gameLoop);
}

function spawnPlatform(y = null) {
    const types = ['normal', 'normal', 'normal', 'spike', 'spring', 'conveyor-l', 'conveyor-r', 'fragile'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = Math.random() * (CONFIG.canvasWidth - CONFIG.platformWidth);
    const spawnY = y !== null ? y : lastPlatformY + CONFIG.spawnDistance;
    
    const p = new Platform(x, spawnY, type);
    platforms.push(p);
    lastPlatformY = spawnY;

    // Chance to spawn an enemy on or above this platform
    if (Math.random() < 0.2) {
        enemies.push(new Enemy(p, Math.random() > 0.5 ? 'turret' : 'sentry'));
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    player.update();

    // Platforms
    for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        p.update();

        // Collision logic
        if (player.vy > 0 && 
            player.x + player.width > p.x && 
            player.x < p.x + p.width &&
            player.y + player.height > p.y && 
            player.y + player.height < p.y + p.height + player.vy) {
            
            // Land on platform
            player.y = p.y - player.height;
            player.vy = -CONFIG.scrollSpeed; // Move with platform

            if (p.type === 'spike') {
                player.takeDamage(5);
            } else if (p.type === 'spring') {
                player.vy = CONFIG.jumpForce;
            } else if (p.type === 'conveyor-l') {
                player.x -= 2;
            } else if (p.type === 'conveyor-r') {
                player.x += 2;
            } else if (p.type === 'fragile') {
                p.hasStepped = true;
            }

            // Scoring: count unique platforms descending
            if (!p.hasStepped) {
                p.hasStepped = true;
                if (p.type !== 'fragile') {
                    // Fragile managed separately
                }
            }
        }

        // Fragile disappearance
        if (p.type === 'fragile' && p.hasStepped) {
            p.breakTimer--;
            if (p.breakTimer <= 0) {
                platforms.splice(i, 1);
                continue;
            }
        }

        // Remove off-screen platforms and increment score
        if (p.y < 0) {
            platforms.splice(i, 1);
            score++;
            // Increase diff
            CONFIG.scrollSpeed = 1.5 + (score / 50);
        }
    }

    // Spawn new platforms
    if (platforms[platforms.length - 1].y < CONFIG.canvasHeight - CONFIG.spawnDistance) {
        spawnPlatform(CONFIG.canvasHeight);
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update();
        if (e.y < -50 || (e.platform && e.platform.y < -50)) {
            enemies.splice(i, 1);
        }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i].update()) {
            projectiles.splice(i, 1);
        }
    }

    // Update UI
    hpBarFill.style.width = hp + '%';
    floorText.textContent = score;
}

function draw() {
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Top spikes
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.topSpikesHeight);
    ctx.fillStyle = '#ff3366';
    for(let i=0; i<CONFIG.canvasWidth/20; i++) {
        ctx.beginPath();
        ctx.moveTo(i*20, CONFIG.topSpikesHeight);
        ctx.lineTo(i*20+10, CONFIG.topSpikesHeight + 15);
        ctx.lineTo(i*20+20, CONFIG.topSpikesHeight);
        ctx.fill();
    }

    platforms.forEach(p => p.draw());
    enemies.forEach(e => e.draw());
    projectiles.forEach(pr => pr.draw());
    player.draw();
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING') {
        requestAnimationFrame(gameLoop);
    }
}

function endGame() {
    gameState = 'GAMEOVER';
    gameOverScreen.classList.remove('hidden');
    finalScoreText.textContent = score;
}

// --- Inputs ---

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    gameState = 'PLAYING';
    init();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameState = 'PLAYING';
    init();
});
