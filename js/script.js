const canvas = document.querySelector('canvas')
const context = canvas.getContext('2d')
const menu = document.getElementById('menu')
const audioFileInput = document.getElementById('audiofile')
const maxEnemiesInput = document.getElementById('maxEnemiesInput')
const enemySpeedInput = document.getElementById('enemySpeedInput')
const startBtn = document.getElementById('startBtn')

canvas.width = innerWidth
canvas.height = innerHeight

let audioCtx, analyser, audioSource, dataArray, audioElement;
let gameStarted = false;
let gameOver = false;
let gameWon = false;
let isPaused = false;
let maxConcurrentEnemies = 10;
let fixedEnemySpeed = 3;

// Bouton Pause UI
const pauseBtn = document.createElement('button');
pauseBtn.innerText = 'Pause';
pauseBtn.style.position = 'absolute';
pauseBtn.style.top = '20px';
pauseBtn.style.right = '20px';
pauseBtn.style.zIndex = '100';
pauseBtn.style.padding = '8px 15px';
pauseBtn.style.fontSize = '14px';
pauseBtn.style.cursor = 'pointer';
pauseBtn.style.display = 'none';
document.body.appendChild(pauseBtn);

pauseBtn.addEventListener('click', () => {
    if (!gameStarted || gameOver || gameWon) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseBtn.innerText = 'Reprendre';
        audioElement.pause();
    } else {
        pauseBtn.innerText = 'Pause';
        audioElement.play();
        animate();
    }
});

audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        audioElement = new Audio(fileURL);
        startBtn.disabled = false;

        // Condition de victoire : quand la chanson est finie
        audioElement.addEventListener('ended', () => {
            if (!gameOver && gameStarted) {
                gameWon = true;
                if (pauseBtn) pauseBtn.style.display = 'none';

                context.fillStyle = 'rgba(0, 0, 0, 0.85)';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = '#33ff33';
                context.font = '40px sans-serif';
                context.textAlign = 'center';
                context.fillText('VICTOIRE ! La chanson est terminée !', canvas.width / 2, canvas.height / 2);
            }
        });
    }
});

startBtn.addEventListener('click', () => {
    maxConcurrentEnemies = parseInt(maxEnemiesInput.value) || 10;
    fixedEnemySpeed = parseFloat(enemySpeedInput.value) || 3;

    menu.style.display = 'none';
    canvas.style.display = 'block';
    pauseBtn.style.display = 'block';

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    audioSource = audioCtx.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    audioElement.play();
    gameStarted = true;
    animate();
});

class Player {
    constructor(x, y, radius, color) {
        this.x = x
        this.y = y
        this.radius = radius
        this.color = color
    }

    draw() {
        context.beginPath()
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true)
        context.fillStyle = this.color
        context.fill()
    }
}

class Projectile extends Player {
    constructor(x, y, radius, color, velocity) {
        super(x, y, radius, color)
        this.velocity = velocity
    }
    update() {
        this.draw()
        this.x = this.x + this.velocity.x
        this.y = this.y + this.velocity.y
    }
}

class Enemy extends Player {
    constructor(x, y, radius, color, velocity, type) {
        super(x, y, radius, color)
        this.velocity = velocity
        this.type = type
    }
    update() {
        this.draw()
        this.x = this.x + this.velocity.x
        this.y = this.y + this.velocity.y
    }
}

const wx = canvas.width / 2
const wy = canvas.height / 2
const player = new Player(wx, wy, 30, 'white')
const projectiles = []
const enemies = []

function spawnEnemy(type, color, radiusMin, radiusMax) {
    let radius = Math.random() * (radiusMax - radiusMin) + radiusMin;

    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 : canvas.width;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 : canvas.height;
    }

    const angle = Math.atan2(wy - y, wx - x)
    const velocity = {
        x: Math.cos(angle) * fixedEnemySpeed,
        y: Math.sin(angle) * fixedEnemySpeed
    }

    enemies.push(new Enemy(x, y, radius, color, velocity, type))
}

// Timers anti-spam pour les différentes plages d'instruments
let lastSubBassSpawn = 0;
let lastBassSpawn = 0;
let lastVocalSpawn = 0;
let lastHighSpawn = 0;

function animate() {
    if (!gameStarted || gameOver || gameWon || isPaused) return;
    requestAnimationFrame(animate)
    context.fillStyle = 'rgba(0, 0, 0, 0.2)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    analyser.getByteFrequencyData(dataArray);

    // Analyse spectrale par plages de fréquences (instruments) :
    // - Sub-Bass (0-2) -> Rouge foncé / Profond
    // - Basses / Kick (3-7) -> Rouge vif / Orange
    // - Médiums / Voix / Guitares (8-20) -> Jaune / Vert
    // - Aigus / Célestia / Cymbales (21-40) -> Bleu / Cyan

    let subBassSum = 0;
    for (let i = 0; i <= 2; i++) subBassSum += dataArray[i];
    let subBassAvg = subBassSum / 3;

    let bassSum = 0;
    for (let i = 3; i <= 7; i++) bassSum += dataArray[i];
    let bassAvg = bassSum / 5;

    let vocalSum = 0;
    for (let i = 8; i <= 20; i++) vocalSum += dataArray[i];
    let vocalAvg = vocalSum / 13;

    let highSum = 0;
    for (let i = 21; i <= 40; i++) highSum += dataArray[i];
    let highAvg = highSum / 20;

    const now = Date.now();

    // Apparition des ennemis selon l'analyse d'instruments/fréquences
    if (subBassAvg > 160 && enemies.length < maxConcurrentEnemies && now - lastSubBassSpawn > 200) {
        spawnEnemy('subbass', '#8b0000', 30, 45); // Sub-bass : gros ennemis rouges foncés
        lastSubBassSpawn = now;
    }

    if (bassAvg > 140 && enemies.length < maxConcurrentEnemies && now - lastBassSpawn > 150) {
        spawnEnemy('bass', '#ff3333', 20, 35); // Basses : ennemis rouges vifs
        lastBassSpawn = now;
    }

    if (vocalAvg > 120 && enemies.length < maxConcurrentEnemies && now - lastVocalSpawn > 150) {
        spawnEnemy('vocal', '#33cc33', 12, 22); // Voix/Médiums : ennemis verts
        lastVocalSpawn = now;
    }

    if (highAvg > 110 && enemies.length < maxConcurrentEnemies && now - lastHighSpawn > 120) {
        spawnEnemy('high', '#33ccff', 8, 15); // Aigus/Cymbales : petits ennemis bleus/cyan
        lastHighSpawn = now;
    }

    player.draw()

    projectiles.forEach((projectile, pIndex) => {
        projectile.update()

        if (projectile.x < 0 || projectile.x > canvas.width || projectile.y < 0 || projectile.y > canvas.height) {
            projectiles.splice(pIndex, 1);
            return;
        }

        enemies.forEach((enemy, eIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (dist - enemy.radius - projectile.radius < 1) {
                enemies.splice(eIndex, 1);
                projectiles.splice(pIndex, 1);
            }
        });
    })

    enemies.forEach((enemy, index) => {
        enemy.update();

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - player.radius - enemy.radius < 1) {
            enemies.splice(index, 1);
            player.radius += 4;

            if (player.radius >= Math.min(canvas.width, canvas.height) / 2 - 20) {
                gameOver = true;
                // La musique continue de jouer en game over (on ne fait PAS audioElement.pause())
                if (pauseBtn) pauseBtn.style.display = 'none';

                context.fillStyle = 'rgba(0, 0, 0, 0.85)';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = 'white';
                context.font = '40px sans-serif';
                context.textAlign = 'center';
                context.fillText('GAME OVER - Le joueur a envahi l\'écran !', canvas.width / 2, canvas.height / 2);
            }
        }
    })
}

window.addEventListener('click', (event) => {
    if (!gameStarted || gameOver || gameWon || isPaused) return;
    const angle = Math.atan2(event.clientY - player.y, event.clientX - player.x)
    const speed = 7
    const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
    }
    projectiles.push(new Projectile(
        player.x,
        player.y,
        6,
        'cyan',
        velocity,
    ))
});