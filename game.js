/**
 * 小朋友下樓梯 (NS-Shaft Clone)
 * Game Logic
 */

const CONFIG = {
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 600,
    GRAVITY: 0.5,
    FRICTION: 0.8,
    MOVE_SPEED: 5,
    INITIAL_SCROLL_SPEED: 1.5,
    MAX_SCROLL_SPEED: 4,
    SCROLL_ACCELERATION: 0.0001,
    PLAYER_WIDTH: 30,
    PLAYER_HEIGHT: 30,
    PLATFORM_WIDTH: 80,
    PLATFORM_HEIGHT: 15,
    MAX_HP: 100,
    HEAL_AMOUNT: 0.2,
    SPIKE_DAMAGE: 15,
    CEILING_DAMAGE: 10,
    FALL_DAMAGE: 100,
    PLATFORM_SPACING: 100,
    TYPES: {
        NORMAL: 'normal',
        SPIKE: 'spike',
        SPRING: 'spring',
        CONVEYOR_LEFT: 'conveyor-left',
        CONVEYOR_RIGHT: 'conveyor-right',
        FRAGILE: 'fragile'
    }
};

class Player {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.x = CONFIG.CANVAS_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.hp = CONFIG.MAX_HP;
        this.onPlatform = null;
        this.width = CONFIG.PLAYER_WIDTH;
        this.height = CONFIG.PLAYER_HEIGHT;
    }

    update() {
        // Horizontal movement
        if (this.game.keys['ArrowLeft']) {
            this.vx -= 1;
        } else if (this.game.keys['ArrowRight']) {
            this.vx += 1;
        } else {
            this.vx *= CONFIG.FRICTION;
        }

        // Limit velocity
        if (Math.abs(this.vx) > CONFIG.MOVE_SPEED) {
            this.vx = Math.sign(this.vx) * CONFIG.MOVE_SPEED;
        }

        this.x += this.vx;

        // Screen boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CONFIG.CANVAS_WIDTH) {
            this.x = CONFIG.CANVAS_WIDTH - this.width;
        }

        // Vertical movement
        this.vy += CONFIG.GRAVITY;
        this.y += this.vy;

        // Check if on a platform
        let landed = false;
        const prevPlatform = this.onPlatform;

        if (this.vy >= 0) {
            for (const platform of this.game.platforms) {
                if (this.x + this.width > platform.x &&
                    this.x < platform.x + platform.width &&
                    this.y + this.height >= platform.y &&
                    this.y + this.height <= platform.y + platform.height + this.vy) {
                    
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onPlatform = platform;
                    landed = true;
                    
                    if (prevPlatform !== platform) {
                        platform.onStepped(this, true);
                    } else {
                        platform.onStepped(this, false);
                    }
                    break;
                }
            }
        }

        if (!landed) {
            this.onPlatform = null;
        }

        // Ceiling collision
        if (this.y <= 0) {
            this.y = 0;
            this.vy = 0;
            this.takeDamage(CONFIG.CEILING_DAMAGE / 60); // damage per frame while touching
        }

        // Bottom collision
        if (this.y + this.height > CONFIG.CANVAS_HEIGHT) {
            this.takeDamage(CONFIG.FALL_DAMAGE);
        }

        // Healing on normal platforms (if desired by spec or traditional)
        if (this.onPlatform && this.onPlatform.type === CONFIG.TYPES.NORMAL) {
            this.heal(CONFIG.HEAL_AMOUNT);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > CONFIG.MAX_HP) this.hp = CONFIG.MAX_HP;
    }

    draw(ctx) {
        ctx.fillStyle = '#42a5f5'; // Light blue
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Eyes for the "child"
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
        ctx.fillRect(this.x + 20, this.y + 5, 5, 5);
    }
}

class Platform {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLATFORM_WIDTH;
        this.height = CONFIG.PLATFORM_HEIGHT;
        this.type = type;
        this.active = true;
        this.fragileTimer = 0;
    }

    update(scrollSpeed) {
        this.y -= scrollSpeed;
        if (this.y + this.height < 0) {
            this.active = false;
        }

        if (this.type === CONFIG.TYPES.FRAGILE && this.fragileTimer > 0) {
            this.fragileTimer--;
            if (this.fragileTimer <= 0) {
                this.active = false;
            }
        }
    }

    onStepped(player, isFirstStep) {
        switch (this.type) {
            case CONFIG.TYPES.SPIKE:
                if (isFirstStep) {
                    player.takeDamage(CONFIG.SPIKE_DAMAGE);
                }
                break;
            case CONFIG.TYPES.SPRING:
                if (isFirstStep) {
                    player.vy = -12;
                    player.onPlatform = null;
                }
                break;
            case CONFIG.TYPES.CONVEYOR_LEFT:
                player.x -= 2;
                break;
            case CONFIG.TYPES.CONVEYOR_RIGHT:
                player.x += 2;
                break;
            case CONFIG.TYPES.FRAGILE:
                if (isFirstStep && this.fragileTimer === 0) {
                    this.fragileTimer = 30; // 0.5s at 60fps
                }
                break;
        }
    }

    draw(ctx) {
        switch (this.type) {
            case CONFIG.TYPES.NORMAL:
                ctx.fillStyle = '#bdbdbd';
                break;
            case CONFIG.TYPES.SPIKE:
                ctx.fillStyle = '#ef5350'; // Red
                break;
            case CONFIG.TYPES.SPRING:
                ctx.fillStyle = '#66bb6a'; // Green
                break;
            case CONFIG.TYPES.CONVEYOR_LEFT:
            case CONFIG.TYPES.CONVEYOR_RIGHT:
                ctx.fillStyle = '#ffa726'; // Orange
                break;
            case CONFIG.TYPES.FRAGILE:
                ctx.fillStyle = '#ab47bc'; // Purple
                if (this.fragileTimer > 0) {
                    ctx.globalAlpha = this.fragileTimer / 30;
                }
                break;
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add spike visual
        if (this.type === CONFIG.TYPES.SPIKE) {
            ctx.fillStyle = '#b71c1c';
            for (let i = 0; i < this.width; i += 10) {
                ctx.beginPath();
                ctx.moveTo(this.x + i, this.y);
                ctx.lineTo(this.x + i + 5, this.y - 5);
                ctx.lineTo(this.x + i + 10, this.y);
                ctx.fill();
            }
        }

        // Add conveyor arrows
        if (this.type === CONFIG.TYPES.CONVEYOR_LEFT || this.type === CONFIG.TYPES.CONVEYOR_RIGHT) {
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            const arrow = this.type === CONFIG.TYPES.CONVEYOR_LEFT ? '<<<<' : '>>>>';
            ctx.fillText(arrow, this.x + 5, this.y + 12);
        }

        ctx.globalAlpha = 1.0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.hpBar = document.getElementById('hp-bar');
        this.floorCountElement = document.getElementById('floor-count');
        this.gameOverScreen = document.getElementById('game-over');
        this.finalScoreElement = document.getElementById('final-score');
        this.restartBtn = document.getElementById('restart-btn');

        this.player = new Player(this);
        this.platforms = [];
        this.keys = {};
        this.floorCount = 0;
        this.scrollSpeed = CONFIG.INITIAL_SCROLL_SPEED;
        this.lastPlatformY = 0;
        this.isRunning = false;

        this.setupInput();
        this.restartBtn.addEventListener('click', () => this.start());
        
        this.start();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    start() {
        this.player.reset();
        this.platforms = [];
        this.floorCount = 0;
        this.scrollSpeed = CONFIG.INITIAL_SCROLL_SPEED;
        this.isRunning = true;
        this.gameOverScreen.classList.add('hidden');

        // Initial platforms
        this.lastPlatformY = 200;
        this.platforms.push(new Platform(CONFIG.CANVAS_WIDTH / 2 - CONFIG.PLATFORM_WIDTH / 2, 200, CONFIG.TYPES.NORMAL));
        
        while (this.lastPlatformY < CONFIG.CANVAS_HEIGHT + 100) {
            this.generatePlatform();
        }

        requestAnimationFrame(() => this.loop());
    }

    generatePlatform() {
        const x = Math.random() * (CONFIG.CANVAS_WIDTH - CONFIG.PLATFORM_WIDTH);
        const y = this.lastPlatformY + CONFIG.PLATFORM_SPACING;
        
        const types = Object.values(CONFIG.TYPES);
        // Weighted random: mostly normal
        let type;
        const rand = Math.random();
        if (rand < 0.5) type = CONFIG.TYPES.NORMAL;
        else if (rand < 0.65) type = CONFIG.TYPES.SPIKE;
        else if (rand < 0.8) type = CONFIG.TYPES.SPRING;
        else if (rand < 0.9) type = CONFIG.TYPES.CONVEYOR_LEFT;
        else if (rand < 0.95) type = CONFIG.TYPES.CONVEYOR_RIGHT;
        else type = CONFIG.TYPES.FRAGILE;

        this.platforms.push(new Platform(x, y, type));
        this.lastPlatformY = y;
        this.floorCount++;
    }

    update() {
        if (!this.isRunning) return;

        this.scrollSpeed += CONFIG.SCROLL_ACCELERATION;
        if (this.scrollSpeed > CONFIG.MAX_SCROLL_SPEED) {
            this.scrollSpeed = CONFIG.MAX_SCROLL_SPEED;
        }

        this.player.update();

        // Update platforms
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            this.platforms[i].update(this.scrollSpeed);
            if (!this.platforms[i].active) {
                this.platforms.splice(i, 1);
            }
        }
        this.lastPlatformY -= this.scrollSpeed;

        // Generate new platforms
        if (this.lastPlatformY < CONFIG.CANVAS_HEIGHT) {
            this.generatePlatform();
        }

        // Update UI
        this.hpBar.style.width = `${this.player.hp}%`;
        if (this.player.hp > 50) this.hpBar.style.backgroundColor = '#4caf50';
        else if (this.player.hp > 20) this.hpBar.style.backgroundColor = '#ffeb3b';
        else this.hpBar.style.backgroundColor = '#f44336';

        this.floorCountElement.innerText = `Floors: ${Math.floor(this.floorCount)}`;

        // Check game over
        if (this.player.hp <= 0) {
            this.endGame();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ceiling spikes
        this.ctx.fillStyle = '#555';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, 10);
        this.ctx.fillStyle = '#9e9e9e';
        for (let i = 0; i < CONFIG.CANVAS_WIDTH; i += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 10);
            this.ctx.lineTo(i + 10, 25);
            this.ctx.lineTo(i + 20, 10);
            this.ctx.fill();
        }

        // Draw platforms
        for (const platform of this.platforms) {
            platform.draw(this.ctx);
        }

        // Draw player
        this.player.draw(this.ctx);
    }

    loop() {
        if (!this.isRunning) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    endGame() {
        this.isRunning = false;
        this.finalScoreElement.innerText = this.floorCount;
        this.gameOverScreen.classList.remove('hidden');
    }
}

// Start the game
new Game();
