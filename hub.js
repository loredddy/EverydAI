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
// Draws a live mini spirograph onto the card thumbnail canvas.
function animatePatternThumb() {
    const canvas = document.getElementById('pattern-thumb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 300;
    const H = canvas.offsetHeight || 180;
    canvas.width = W;
    canvas.height = H;

    let t = 0;
    const COLORS = ['#7c6bf5', '#f072b6', '#63FFD5', '#FFD663', '#00ffe0'];

    function drawFrame() {
        ctx.fillStyle = 'rgba(10,10,15,0.18)';
        ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.42;
        const r = R / (3 + Math.sin(t * 0.07) * 1.2);
        const d = r * (0.5 + 0.4 * Math.cos(t * 0.05));
        const steps = 600;
        for (let i = 0; i < steps; i++) {
            const theta = (i / steps) * Math.PI * 2 * 12;
            const x = cx + (R - r) * Math.cos(theta) + d * Math.cos(((R - r) / r) * theta);
            const y = cy + (R - r) * Math.sin(theta) - d * Math.sin(((R - r) / r) * theta);
            const col = COLORS[Math.floor((i / steps * COLORS.length + t * 0.1) % COLORS.length)];
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(x, y, 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        t += 0.4;
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
