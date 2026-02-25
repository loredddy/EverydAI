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
    // Focus close button for accessibility
    setTimeout(() => document.getElementById('panel-close-btn').focus(), 350);
}

function closeApp() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
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

// ── Init ────────────────────────────────────────────────────
applyTheme(currentTheme);
