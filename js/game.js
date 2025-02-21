// Game elements
const player = {
    x: 200,
    y: canvas.height - 130,
    width: 40,
    height: 40,
    velocity: 0,
    worldX: 200,
    isAlive: true
};

const game = {
    running: false,
    isPaused: false,
    speed: 8,
    baseSpeed: 8,
    jumpForce: -15,
    gravity: 0.8,
    score: 0,
    coinCount: 0,
    attempts: 0,
    obstacles: [],
    coins: [],
    particles: [],
    difficulty: 1,
    cameraX: 0
};

// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Game initialization
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupEventListeners();
    showMenu();
}

// Game state management
function startGame() {
    hideAllMenus();
    canvas.style.display = 'block';
    resetGame();
    game.running = true;
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    player.worldX = 200;
    player.x = 200;
    player.y = canvas.height - 130;
    player.velocity = 0;
    player.isAlive = true;

    game.score = 0;
    game.coinCount = 0;
    game.attempts++;
    game.obstacles = [];
    game.coins = [];
    game.particles = [];
    
    for(let i = 0; i < 10; i++) {
        generateObstacles(800 + i * 400);
    }

    updateScore();
    document.getElementById('attempts').textContent = `Attempts: ${game.attempts}`;
}

function hideAllMenus() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';
}

function showMenu() {
    hideAllMenus();
    document.getElementById('menu').style.display = 'block';
    canvas.style.display = 'none';
}

function pauseGame() {
    game.isPaused = true;
    document.getElementById('pauseMenu').style.display = 'block';
}

function resumeGame() {
    game.isPaused = false;
    document.getElementById('pauseMenu').style.display = 'none';
}

function playerDie() {
    if (!player.isAlive) return;
    
    player.isAlive = false;
    game.running = false;
    createParticles(player.x + player.width/2, player.y + player.height/2, '#00FFFF', 20);
    
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('finalScore').textContent = `Score: ${game.score}`;
}

// Game mechanics
function generateObstacles(startX) {
    game.difficulty = 1 + Math.floor(game.score / 1000) * 0.2;
    game.speed = game.baseSpeed * game.difficulty;

    if (Math.random() < 0.7) {
        const coinY = canvas.height - 230 + Math.random() * 100;
        game.coins.push({
            x: startX + Math.random() * 300,
            y: coinY,
            width: 20,
            height: 20,
            rotation: 0
        });
    }

    const types = ['spike', 'platform', 'gap'];
    const spikeChance = 0.3 + (game.difficulty - 1) * 0.1;
    const type = Math.random() < spikeChance ? 'spike' : types[Math.floor(Math.random() * types.length)];
    
    switch(type) {
        case 'spike':
            const spikeCount = Math.min(3, Math.floor(Math.random() * game.difficulty + 1));
            for(let i = 0; i < spikeCount; i++) {
                game.obstacles.push({
                    x: startX + (i * 50),
                    y: canvas.height - 130,
                    width: 40,
                    height: 40,
                    type: 'spike'
                });
            }
            break;
        case 'platform':
            const minHeight = canvas.height - 230 - ((game.difficulty - 1) * 50);
            const platformHeight = minHeight + Math.random() * 100;
            game.obstacles.push({
                x: startX,
                y: platformHeight,
                width: 200,
                height: 20,
                type: 'platform'
            });
            break;
    }
}

function createParticles(x, y, color, count = 10) {
    for(let i = 0; i < count; i++) {
        game.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 5 + 2,
            color: color,
            life: 1
        });
    }
}

function updateParticles() {
    for(let i = game.particles.length - 1; i >= 0; i--) {
        const particle = game.particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        
        if(particle.life <= 0) {
            game.particles.splice(i, 1);
        }
    }
}

function checkCollisions() {
    const playerHitbox = {
        x: player.worldX,
        y: player.y,
        width: player.width,
        height: player.height
    };

    // Check coin collisions
    for(let i = game.coins.length - 1; i >= 0; i--) {
        const coin = game.coins[i];
        if (coin.x > player.worldX - 800 && coin.x < player.worldX + 800) {
            const coinHitbox = {
                x: coin.x,
                y: coin.y,
                width: coin.width,
                height: coin.height
            };
            if (checkCollision(playerHitbox, coinHitbox)) {
                game.coins.splice(i, 1);
                game.coinCount++;
                game.score += 100;
                createParticles(coin.x + coin.width/2, coin.y + coin.height/2, '#FFD700', 15);
            }
        }
    }

    // Check obstacle collisions
    for(const obstacle of game.obstacles) {
        if(obstacle.x > player.worldX - 800 && obstacle.x < player.worldX + 800) {
            if(checkCollision(playerHitbox, obstacle)) {
                if(obstacle.type === 'spike') {
                    playerDie();
                    return;
                }
                if(obstacle.type === 'platform' && player.velocity > 0) {
                    player.y = obstacle.y - player.height;
                    player.velocity = 0;
                }
            }
        }
    }

    // Ground collision
    if (player.y > canvas.height - 130) {
        player.y = canvas.height - 130;
        player.velocity = 0;
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function updateScore() {
    document.getElementById('score').textContent = `Score: ${game.score} (Coins: ${game.coinCount})`;
}

// Drawing functions
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 2);

    // Draw coins
    game.coins.forEach(coin => {
        if (coin.x > player.worldX - 800 && coin.x < player.worldX + 800) {
            const screenX = coin.x - game.cameraX;
            coin.rotation += 0.1;

            const gradient = ctx.createRadialGradient(
                screenX + 10, coin.y + 10, 0,
                screenX + 10, coin.y + 10, 15
            );
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX + 10, coin.y + 10, 15, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(screenX + 10, coin.y + 10);
            ctx.rotate(coin.rotation);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    });

    // Draw obstacles
    game.obstacles.forEach(obstacle => {
        if(obstacle.x > player.worldX - 800 && obstacle.x < player.worldX + 800) {
            const screenX = obstacle.x - game.cameraX;
            
            ctx.fillStyle = obstacle.type === 'spike' ? '#FF0000' : '#00FFFF';
            if(obstacle.type === 'spike') {
                ctx.beginPath();
                ctx.moveTo(screenX, obstacle.y + obstacle.height);
                ctx.lineTo(screenX + obstacle.width/2, obstacle.y);
                ctx.lineTo(screenX + obstacle.width, obstacle.y + obstacle.height);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);
            }
        }
    });

    // Draw player
    const screenX = player.x;
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(screenX, player.y, player.width, player.height);

    // Draw particles
    game.particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life;
        ctx.beginPath();
        ctx.arc(particle.x - game.cameraX, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

// Game loop
function gameLoop() {
    if (!game.running) return;
    if (game.isPaused) return;

    if (player.isAlive) {
        player.worldX += game.speed;
        player.velocity += game.gravity;
        player.y += player.velocity;

        game.cameraX = player.worldX - 200;
        
        while (game.obstacles[game.obstacles.length - 1].x < player.worldX + 1600) {
            generateObstacles(game.obstacles[game.obstacles.length - 1].x + 400);
        }

        game.obstacles = game.obstacles.filter(obs => obs.x > player.worldX - 800);
        
        checkCollisions();
        updateScore();
    }

    updateParticles();
    drawGame();

    requestAnimationFrame(gameLoop);
}

// Event listeners
function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            if (game.running && player.isAlive && player.y >= canvas.height - 131) {
                player.velocity = game.jumpForce;
                createParticles(player.x + player.width/2, player.y + player.height, '#00FFFF');
            }
        } else if (e.code === 'Escape') {
            if (game.running && player.isAlive) {
                if (game.isPaused) {
                    resumeGame();
                } else {
                    pauseGame();
                }
            }
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (game.running && player.isAlive && player.y >= canvas.height - 131) {
            player.velocity = game.jumpForce;
            createParticles(player.x + player.width/2, player.y + player.height, '#00FFFF');
        }
    });
}

// Start the game
window.addEventListener('load', init);
