/* ============================================================
   EVERYDAI HUB – hub.js
   ============================================================ */

// ── Theme ───────────────────────────────────────────────────
let currentTheme = localStorage.getItem('everydai-theme') || 'dark';

function applyTheme(theme) {
    currentTheme = theme;
    const icon = document.getElementById('theme-icon');
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        icon.textContent = '🌙';
    } else {
        document.body.removeAttribute('data-theme');
        icon.textContent = '☀️';
    }
    localStorage.setItem('everydai-theme', theme);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// ── App Panel ────────────────────────────────────────────────
const overlay = document.getElementById('app-panel-overlay');
const frame = document.getElementById('app-frame');
const panelName = document.getElementById('panel-app-name');
const openTab = document.getElementById('panel-open-tab');

function openApp(appSrc, appName) {
    frame.src = appSrc;
    panelName.textContent = appName;
    openTab.href = appSrc;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Pause hub orb animations — they're invisible behind the overlay
    // and removing them frees up significant GPU bandwidth for the iframe
    document.querySelector('.bg-orbs').classList.add('orbs-paused');
    setTimeout(() => document.getElementById('panel-close-btn').focus(), 350);
}

function closeApp() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Resume hub orb animations
    document.querySelector('.bg-orbs').classList.remove('orbs-paused');
    // Small delay before clearing src to allow animation
    setTimeout(() => { frame.src = ''; }, 400);
}

document.getElementById('panel-close-btn').addEventListener('click', closeApp);

// Click on overlay backdrop (outside panel) to close
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeApp();
});

// Keyboard: Escape to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeApp();
});

// ── App Cards ────────────────────────────────────────────────
const APPS = {
    'card-palette': { src: 'ColorPalette/index.html', name: 'Palette Picker' },
    'card-pattern': { src: 'PatternGen/index.html', name: 'Visual Synthesizer' },
    'card-visage': { src: 'WhatHairstyle/index.html', name: 'What Hairstyle?' }
};

document.querySelectorAll('.app-card:not(.app-soon)').forEach(card => {
    const appKey = card.id;
    const app = APPS[appKey];
    if (!app) return;

    // Click anywhere on the card or the button
    card.addEventListener('click', (e) => {
        openApp(app.src, app.name);
    });

    // Keyboard: Enter or Space on card
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openApp(app.src, app.name);
        }
    });
});

// ── Animated card entrance ───────────────────────────────────
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            const delay = Array.from(document.querySelectorAll('.app-card')).indexOf(entry.target) * 80;
            setTimeout(() => entry.target.classList.add('visible'), delay);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.app-card').forEach(card => {
    observer.observe(card);
});

// ── Animated palette card thumbnail ──────────────────────────
const PALETTE_COLORS = [
    ['#6C63FF', '#FF6B95', '#63FFD5', '#FFD663', '#FF9363'],
    ['#E85B8F', '#5B5FE8', '#5BE8C8', '#E8C85B', '#E8705B'],
    ['#4ECDC4', '#FF6B6B', '#FFE66D', '#A64AC9', '#17B978'],
    ['#F7B731', '#FC5C65', '#45AAF2', '#26DE81', '#FD9644'],
];
let paletteColorIdx = 0;

function rotatePaletteThumb() {
    const swatches = document.querySelectorAll('.palette-thumb .thumb-swatch');
    const cols = PALETTE_COLORS[paletteColorIdx % PALETTE_COLORS.length];
    swatches.forEach((s, i) => { if (cols[i]) s.style.background = cols[i]; });

    // Update gradient bar
    const grad = document.querySelector('.palette-thumb .thumb-gradient');
    if (grad) grad.style.background = `linear-gradient(90deg, ${cols.join(', ')})`;

    paletteColorIdx++;
}

rotatePaletteThumb();
setInterval(rotatePaletteThumb, 2800);

// ── Shape Logo ───────────────────────────────────────────────
// Draws a regular polygon with one vertex per app (live + coming-soon).
// 3 apps → triangle, 4 → square, 5 → pentagon, etc.

const LOGO_DOT_COLORS = ['#6C63FF', '#FF6B95', '#63FFD5', '#FFD663', '#FC5C65', '#45AAF2'];

function getPolyPoints(n, cx, cy, r, startAngleDeg) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const angle = (startAngleDeg + (360 / n) * i) * (Math.PI / 180);
        pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    return pts;
}

function drawShapeLogo() {
    const totalApps = document.querySelectorAll('.app-card').length;
    if (totalApps < 2) return;

    const cx = 17, cy = 17, r = 13;
    // Start at -90° so the shape is upright (flat top for even N, point-up for odd N)
    const points = getPolyPoints(totalApps, cx, cy, r, -90);

    // Set polygon outline
    const poly = document.getElementById('logo-poly');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));

    // Draw a colored circle at each vertex
    const dotsGroup = document.getElementById('logo-dots');
    dotsGroup.innerHTML = '';
    points.forEach(([x, y], i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x.toFixed(2));
        circle.setAttribute('cy', y.toFixed(2));
        circle.setAttribute('r', '3.4');
        circle.setAttribute('fill', LOGO_DOT_COLORS[i % LOGO_DOT_COLORS.length]);
        circle.style.animation = `logoDotPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`;
        dotsGroup.appendChild(circle);
    });
}

// ── Animated Pattern Thumbnail ──────────────────────────────
// Draws a live transition of actual generative patterns from the app
function animatePatternThumb() {
    const canvas = document.getElementById('pattern-thumb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 300;
    const H = canvas.offsetHeight || 180;
    canvas.width = W;
    canvas.height = H;

    let t = 0;
    const COLORS = [
        [124, 107, 245], // Abstract Purple
        [240, 114, 182], // Neon Pink
        [99, 255, 213]   // Tech Aqua
    ];

    function drawFrame() {
        ctx.fillStyle = 'rgba(10,10,15,0.15)';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2, cy = H / 2 + 10;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Fake 3D audio circle
        const numBars = 50;
        const angleStep = (Math.PI * 2) / numBars;
        
        // Simulating bass pump
        const pump = Math.sin(t * 5) * Math.sin(t * 1.2);
        const beat = Math.max(0, pump) * 15;
        const radius = H * 0.25 + beat;

        for (let i = 0; i < numBars; i++) {
            const angle = i * angleStep + t * 0.2;
            
            // Simulating frequency data
            const freq = Math.sin(i * 4 + t * 8) * Math.cos(i * 7 - t * 3) + Math.random() * 0.5;
            const amp = Math.max(0, freq) * 25 * (1 + beat * 0.05);
            
            // 3D projection (pseudo)
            // rotating ring
            const x3d = Math.cos(angle) * (radius + amp);
            const z3d = Math.sin(angle) * (radius + amp);
            const y3d = (Math.sin(angle * 3 + t * 4) * amp * 0.5) - 20;

            const scale = 300 / (300 + z3d);
            const sx = cx + x3d * scale;
            const sy = cy + y3d * scale;

            // base point
            const bx3d = Math.cos(angle) * radius;
            const bz3d = Math.sin(angle) * radius;
            const bx = cx + bx3d * scale;
            const by = cy + 10 * scale; // fixed y for base

            // Color gradient
            const colorPhase = ((i / numBars) + t * 0.1) % 1;
            const c0 = COLORS[0], c1 = COLORS[1], c2 = COLORS[2];
            let r, g, b;
            if (colorPhase < 0.5) {
                const p = colorPhase * 2;
                r = c0[0] + (c1[0] - c0[0]) * p;
                g = c0[1] + (c1[1] - c0[1]) * p;
                b = c0[2] + (c1[2] - c0[2]) * p;
            } else {
                const p = (colorPhase - 0.5) * 2;
                r = c1[0] + (c2[0] - c1[0]) * p;
                g = c1[1] + (c2[1] - c1[1]) * p;
                b = c1[2] + (c2[2] - c1[2]) * p;
            }

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(sx, sy);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + scale * 0.4})`;
            ctx.lineWidth = scale * 2.5;
            ctx.stroke();
        }

        t += 0.02;
        requestAnimationFrame(drawFrame);
    }

    // Fill black once before first animation frame
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);
    drawFrame();
}

// ── Init ────────────────────────────────────────────────────
applyTheme(currentTheme);
drawShapeLogo();
animatePatternThumb();
