const canvas = document.querySelector('canvas')
const context = canvas.getContext('2d')
const menu = document.getElementById('menu')
const audioFileInput = document.getElementById('audiofile')
const maxEnemiesInput = document.getElementById('maxEnemiesInput')
const enemySpeedInput = document.getElementById('enemySpeedInput')
const startBtn = document.getElementById('startBtn')
//la musique doit continuer de jouer en game over, le joeuur gagne quand la chanson est finie
//revoir les couleur: chercher les analyses d'instruments selon leurs range de féquence et ensuite une couleur est
//un instrument
canvas.width = innerWidth
canvas.height = innerHeight

let audioCtx, analyser, audioSource, dataArray, audioElement;
let gameStarted = false;
let gameOver = false;
let maxConcurrentEnemies = 10; // Valeur par défaut
let fixedEnemySpeed = 3;

audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        audioElement = new Audio(fileURL);
        startBtn.disabled = false;
    }
});

startBtn.addEventListener('click', () => {
    // Récupération de la limite d'ennemis simultanés
    maxConcurrentEnemies = parseInt(maxEnemiesInput.value) || 10;
    fixedEnemySpeed = parseFloat(enemySpeedInput.value) || 3;

    menu.style.display = 'none';
    canvas.style.display = 'block';

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

function spawnEnemy(type) {
    let radius, color;

    if (type === 'bass') {
        radius = Math.random() * (35 - 20) + 20;
        color = '#ff3333';
    } else {
        radius = Math.random() * (15 - 8) + 8;
        color = '#33ccff';
    }

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

// Petites sécurités anti-spam pour éviter de spawner 10 ennemis sur une seule fraction de seconde de basse
let lastBassSpawn = 0;
let lastVocalSpawn = 0;

function animate() {
    if (!gameStarted || gameOver) return;
    requestAnimationFrame(animate)
    context.fillStyle = 'rgba(0, 0, 0, 0.2)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    analyser.getByteFrequencyData(dataArray);

    let bassSum = 0;
    for (let i = 0; i < 5; i++) bassSum += dataArray[i];
    let bassAvg = bassSum / 5;

    let vocalSum = 0;
    for (let i = 10; i < 30; i++) vocalSum += dataArray[i];
    let vocalAvg = vocalSum / 20;

    const now = Date.now();

    // Apparition conditionnée par la limite max d'ennemis simultanés sur l'écran
    if (bassAvg > 150 && enemies.length < maxConcurrentEnemies && now - lastBassSpawn > 150) {
        spawnEnemy('bass');
        lastBassSpawn = now;
    }

    if (vocalAvg > 120 && enemies.length < maxConcurrentEnemies && now - lastVocalSpawn > 150) {
        spawnEnemy('vocal');
        lastVocalSpawn = now;
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
                if (audioElement) audioElement.pause();

                context.fillStyle = 'rgba(0, 0, 0, 0.8)';
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
    if (!gameStarted || gameOver) return;
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