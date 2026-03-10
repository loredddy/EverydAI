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
    'card-pattern': { src: 'PatternGen/index.html', name: 'Pattern Generator' },
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
        [124, 107, 245], // Abstract Purple (Lissajous)
        [240, 114, 182], // Neon Pink (Rose)
        [99, 255, 213]   // Tech Aqua (Spirograph)
    ];

    function drawFrame() {
        // Soft fade for trails
        ctx.fillStyle = 'rgba(10,10,15,0.06)';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2, cy = H / 2;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';

        const duration = 7.0; // seconds per pattern
        const phase = (t % (duration * 3)) / duration; // 0 to 3

        const getAlpha = (p, target) => {
            let dist = Math.abs(p - target);
            if (dist > 1.5) dist = 3 - dist;
            return Math.max(0, 1 - dist * 2); // Fades in/out smoothly
        };

        const a0 = getAlpha(phase, 0);
        const a1 = getAlpha(phase, 1);
        const a2 = getAlpha(phase, 2);

        // 1. Lissajous
        if (a0 > 0.01) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${COLORS[0][0]}, ${COLORS[0][1]}, ${COLORS[0][2]}, ${a0 * 0.7})`;
            const rx = W * 0.42, ry = H * 0.42;
            const delta = t * 0.6;
            for (let i = 0; i <= 200; i++) {
                const theta = (i / 200) * Math.PI * 2;
                const x = cx + rx * Math.cos(3 * theta + delta);
                const y = cy + ry * Math.sin(2 * theta);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 2. Rose Curve
        if (a1 > 0.01) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${COLORS[1][0]}, ${COLORS[1][1]}, ${COLORS[1][2]}, ${a1 * 0.7})`;
            const R = Math.min(W, H) * 0.44;
            const k = 5;
            const rot = t * 0.4;
            const rmod = 0.8 + 0.2 * Math.sin(t * 1.5);
            for (let i = 0; i <= 300; i++) {
                const theta = (i / 300) * Math.PI * 2;
                const r = R * Math.cos(k * theta) * rmod;
                const x = cx + r * Math.cos(theta + rot);
                const y = cy + r * Math.sin(theta + rot);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 3. Spirograph
        if (a2 > 0.01) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${COLORS[2][0]}, ${COLORS[2][1]}, ${COLORS[2][2]}, ${a2 * 0.7})`;
            const R = Math.min(W, H) * 0.42;
            const r = R / 4;
            const d = r * (1.0 + 0.6 * Math.sin(t * 1.2));
            const rot = -t * 0.3;
            for (let i = 0; i <= 300; i++) {
                const theta = (i / 300) * Math.PI * 2;
                const pX = (R - r) * Math.cos(theta) + d * Math.cos(((R - r) / r) * theta);
                const pY = (R - r) * Math.sin(theta) - d * Math.sin(((R - r) / r) * theta);
                const x = cx + pX * Math.cos(rot) - pY * Math.sin(rot);
                const y = cy + pX * Math.sin(rot) + pY * Math.cos(rot);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        t += 0.015; // Slow, smooth time progression
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
