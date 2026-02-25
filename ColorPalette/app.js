/* ============================================================
   PALETTE STUDIO – App Logic  (dynamic N-color version)
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const state = {
    count: 3,
    colors: ['#5B5FE8', '#E85B8F', '#5BE8C8'],
    locked: [false, false, false],
    mode: 'complementary',
    theme: 'dark',
    previewMode: 'box',
};

// ── Mode descriptions ───────────────────────────────────────
const MODE_DESCRIPTIONS = {
    complementary: 'Opposite hues',
    triadic: 'Evenly-spaced hues',
    analogous: 'Adjacent hues',
    split: "Base + complement's neighbors",
};

// ── Logo positions per count (32×32 viewBox) ──────────────────
const LOGO_POSITIONS = {
    2: [{ cx: 8, cy: 16, r: 7.5, op: 1 }, { cx: 24, cy: 16, r: 7.5, op: 0.88 }],
    3: [{ cx: 9, cy: 9, r: 7, op: 1 }, { cx: 23, cy: 9, r: 7, op: 0.88 }, { cx: 16, cy: 22, r: 7, op: 0.88 }],
    4: [{ cx: 9, cy: 9, r: 6.2, op: 1 }, { cx: 23, cy: 9, r: 6.2, op: 0.88 }, { cx: 9, cy: 23, r: 6.2, op: 0.88 }, { cx: 23, cy: 23, r: 6.2, op: 0.88 }],
    5: [{ cx: 16, cy: 6, r: 5.5, op: 1 }, { cx: 6, cy: 16, r: 5.5, op: 0.88 }, { cx: 26, cy: 16, r: 5.5, op: 0.88 }, { cx: 10, cy: 26, r: 5.5, op: 0.88 }, { cx: 22, cy: 26, r: 5.5, op: 0.88 }],
};

function updateLogo() {
    const positions = LOGO_POSITIONS[state.count];
    for (let i = 0; i < 5; i++) {
        const g = document.getElementById(`lc-${i}`);
        const circle = document.getElementById(`lcc-${i}`);
        if (!g || !circle) continue;
        if (i < state.count) {
            const p = positions[i];
            circle.setAttribute('cx', p.cx);
            circle.setAttribute('cy', p.cy);
            circle.setAttribute('r', p.r);
            circle.setAttribute('fill', state.colors[i] || '#888888');
            circle.setAttribute('opacity', p.op);
            g.classList.add('lc-on');
        } else {
            g.classList.remove('lc-on');
        }
    }
}

// ── Color math ──────────────────────────────────────────────
function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const x = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${x(f(0))}${x(f(8))}${x(f(4))}`;
}

function hexToRgb(hex) {
    return `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
}

function randomHue() { return Math.random() * 360; }

// ── Palette generation for N colors ─────────────────────────
function generatePalette(baseHex, mode, count) {
    const [h, s, l] = hexToHsl(baseHex);
    // Wide variation so each color feels distinct
    const sV = () => Math.max(35, Math.min(94, s + (Math.random() - 0.5) * 50));
    const lV = () => Math.max(28, Math.min(74, l + (Math.random() - 0.5) * 36));
    const hJ = () => (Math.random() - 0.5) * 18; // subtle hue jitter

    switch (mode) {
        case 'triadic':
            // Distribute evenly across the hue wheel
            return Array.from({ length: count }, (_, i) =>
                i === 0 ? baseHex : hslToHex(h + hJ() + (360 / count) * i, sV(), lV())
            );

        case 'analogous': {
            // Spread around base, adjacent neighbours
            const spread = 28 + count * 9;
            const step = spread / Math.max(count - 1, 1);
            const start = h - spread / 2;
            return Array.from({ length: count }, (_, i) =>
                hslToHex(start + step * i + hJ(), sV(), lV())
            );
        }

        case 'complementary': {
            // Base + N-1 colours clustered around its complement
            if (count === 2) return [baseHex, hslToHex(h + 180 + hJ(), sV(), lV())];
            const compSpread = Math.min(60, 20 * (count - 1));
            const compStep = compSpread / (count - 2 || 1);
            const result = [baseHex];
            for (let i = 1; i < count; i++) {
                const offset = -compSpread / 2 + compStep * (i - 1);
                result.push(hslToHex(h + 180 + offset + hJ(), sV(), lV()));
            }
            return result;
        }

        case 'split': {
            // Fixed angular offsets that always look good
            const offsets = [0, 150, 210, 60, 300];
            return Array.from({ length: count }, (_, i) =>
                i === 0 ? baseHex : hslToHex(h + offsets[i] + hJ(), sV(), lV())
            );
        }

        default:
            return Array.from({ length: count }, () => hslToHex(randomHue(), sV(), lV()));
    }
}

// ── Card DOM builder ────────────────────────────────────────
function cardHTML(i) {
    return `
    <div class="swatch-card" id="card-${i}">
      <div class="swatch-color" id="swatch-${i}">
        <div class="swatch-overlay">
          <button class="lock-btn" id="lock-${i}" title="Lock this color">
            <svg id="lock-icon-${i}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        </div>
        <div class="color-input-wrap">
          <input type="color" class="color-native" id="color-input-${i}" title="Pick a color"/>
          <span class="color-pick-label">Pick</span>
        </div>
      </div>
      <div class="swatch-info">
        <span class="swatch-label">Hue #${i + 1}</span>
        <span class="swatch-hex" id="hex-${i}">#000000</span>
        <div class="swatch-actions">
          <button class="copy-btn" data-target="hex-${i}">HEX</button>
          <button class="copy-btn" data-target="rgb-${i}">RGB</button>
          <span class="rgb-val" id="rgb-${i}" style="display:none"></span>
        </div>
      </div>
    </div>`;
}

// Always single row regardless of count
const GRID_COLS = { 2: 'repeat(2,1fr)', 3: 'repeat(3,1fr)', 4: 'repeat(4,1fr)', 5: 'repeat(5,1fr)' };

function buildPalette(count) {
    // Preserve existing colors & locks where possible
    const prevColors = [...state.colors];
    const prevLocked = [...state.locked];
    state.count = count;
    state.colors = Array.from({ length: count }, (_, i) => prevColors[i] || hslToHex(randomHue(), 65, 55));
    state.locked = Array.from({ length: count }, (_, i) => prevLocked[i] || false);

    // Rebuild DOM
    const section = document.getElementById('palette');
    section.innerHTML = Array.from({ length: count }, (_, i) => cardHTML(i)).join('');
    section.style.gridTemplateColumns = GRID_COLS[count] || 'repeat(3,1fr)';

    updateLogo();

    // Attach per-card listeners
    for (let i = 0; i < count; i++) {
        // Lock
        document.getElementById(`lock-${i}`).addEventListener('click', () => toggleLock(i));

        // Color picker
        const label = document.querySelector(`#swatch-${i} .color-pick-label`);
        const input = document.getElementById(`color-input-${i}`);
        label.addEventListener('click', e => { e.stopPropagation(); input.click(); });
        input.addEventListener('input', () => {
            triggerSweep(i);
            state.colors[i] = input.value;
            state.locked[i] = true;
            document.getElementById(`lock-${i}`).classList.add('locked');
            renderAll();
        });

        // Hex click to copy
        document.getElementById(`hex-${i}`).addEventListener('click', () => {
            navigator.clipboard.writeText(state.colors[i].toUpperCase())
                .then(() => showToast(`Copied ${state.colors[i].toUpperCase()}`));
        });
    }

    // Copy buttons (delegated on section)
    section.addEventListener('click', e => {
        const btn = e.target.closest('.copy-btn');
        if (!btn) return;
        const el = document.getElementById(btn.dataset.target);
        if (el) navigator.clipboard.writeText(el.textContent.trim())
            .then(() => showToast(`Copied ${el.textContent.trim()}`));
    });

    renderAll();
}

// ── Lock helper ─────────────────────────────────────────────
function toggleLock(i) {
    state.locked[i] = !state.locked[i];
    const btn = document.getElementById(`lock-${i}`);
    const icon = document.getElementById(`lock-icon-${i}`);
    btn.classList.toggle('locked', state.locked[i]);
    icon.innerHTML = state.locked[i]
        ? `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
        : `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`;
}

// ── Render ──────────────────────────────────────────────────
function updateCard(i, hex) {
    const swatch = document.getElementById(`swatch-${i}`);
    if (swatch) swatch.style.backgroundColor = hex;
    const hexEl = document.getElementById(`hex-${i}`);
    if (hexEl) hexEl.textContent = hex.toUpperCase();
    const rgbEl = document.getElementById(`rgb-${i}`);
    if (rgbEl) rgbEl.textContent = hexToRgb(hex);
}

function renderAll() {
    state.colors.forEach((hex, i) => updateCard(i, hex));
    updateGradient();
    updateLogoDots();
    updateLogo();
}

// ── Sweep animation ──────────────────────────────────────────
function triggerSweep(i) {
    const swatch = document.getElementById(`swatch-${i}`);
    if (!swatch) return;
    let sheen = swatch.querySelector('.sweep-sheen');
    if (!sheen) {
        sheen = document.createElement('div');
        sheen.className = 'sweep-sheen';
        swatch.appendChild(sheen);
    }
    sheen.classList.remove('sweeping');
    void sheen.offsetWidth;
    sheen.style.animationDelay = `${i * 55}ms`;
    sheen.classList.add('sweeping');
    sheen.addEventListener('animationend', () => {
        sheen.classList.remove('sweeping');
        sheen.style.animationDelay = '';
    }, { once: true });
}

// ── Gradient ─────────────────────────────────────────────────
function updateGradient() {
    const stops = state.colors.map((c, i) => `${c} ${Math.round(i / (state.count - 1) * 100)}%`).join(', ');
    const grad = `linear-gradient(135deg, ${stops})`;

    if (state.previewMode === 'bg') {
        document.body.style.background = grad;
        document.getElementById('gradient-preview').style.display = 'none';
    } else {
        document.body.style.background = '';
        document.getElementById('gradient-preview').style.display = '';
        document.getElementById('gradient-preview').style.background = grad;
    }
}

function updateLogoDots() {
    document.documentElement.style.setProperty('--accent-1', state.colors[0]);
    document.documentElement.style.setProperty('--accent-2', state.colors[Math.floor(state.count / 2)]);
    document.documentElement.style.setProperty('--accent-3', state.colors[state.count - 1]);
    document.getElementById('btn-generate').style.background =
        `linear-gradient(135deg, ${state.colors[0]}, ${state.colors[state.count - 1]})`;
}

function showToast(msg = 'Copied! ✓') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Generate button ──────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', () => {
    const anyUnlocked = state.locked.some(l => !l);
    if (!anyUnlocked) { showToast('All colors are locked!'); return; }

    const base = hslToHex(randomHue(), 62 + Math.random() * 25, 52 + Math.random() * 10);
    const palette = generatePalette(base, state.mode, state.count);

    palette.forEach((hex, i) => {
        if (!state.locked[i]) {
            state.colors[i] = hex;
            triggerSweep(i);
        }
    });
    renderAll();
});

// ── Mode buttons ─────────────────────────────────────────────
const modeDescEl = document.getElementById('mode-desc');
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        modeDescEl.textContent = MODE_DESCRIPTIONS[state.mode] || '';
        modeDescEl.style.animation = 'none';
        void modeDescEl.offsetWidth;
        modeDescEl.style.animation = '';
    });
});

// ── Count buttons ────────────────────────────────────────────
document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildPalette(Number(btn.dataset.count));
    });
});

// ── Preview mode buttons ──────────────────────────────────────
document.querySelectorAll('.preview-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.previewMode = btn.dataset.pmode;
        updateGradient();
    });
});

// ── Export CSS ───────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
    const lines = state.colors.map((h, i) => `  --color-${i + 1}: ${h.toUpperCase()}; /* ${hexToRgb(h)} */`).join('\n');
    const stops = state.colors.map((c, i) => `${c.toUpperCase()} ${Math.round(i / (state.count - 1) * 100)}%`).join(', ');
    const code = `:root {\n${lines}\n  --gradient: linear-gradient(135deg, ${stops});\n}`;
    document.getElementById('modal-code').textContent = code;
    document.getElementById('modal-overlay').classList.add('visible');
});

document.getElementById('modal-close').addEventListener('click', () =>
    document.getElementById('modal-overlay').classList.remove('visible'));
document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay'))
        document.getElementById('modal-overlay').classList.remove('visible');
});
document.getElementById('btn-copy-all').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('modal-code').textContent)
        .then(() => showToast('CSS copied!'));
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (['BUTTON', 'INPUT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); document.getElementById('btn-generate').click(); }
    if (e.code === 'KeyT') { document.getElementById('theme-toggle').click(); }
});

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(theme) {
    state.theme = theme;
    const icon = document.getElementById('theme-icon');
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        icon.textContent = '🌙';
    } else {
        document.body.removeAttribute('data-theme');
        icon.textContent = '☀️';
    }
    localStorage.setItem('palette-theme', theme);
}
document.getElementById('theme-toggle').addEventListener('click', () =>
    applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

// ── Init ─────────────────────────────────────────────────────
applyTheme(localStorage.getItem('palette-theme') || 'dark');
buildPalette(state.count);
