/* ──────────────────────────────────────────────────────────────
   Audio Visualizer Hub — app.js
   EverydAI · NCS & TrapNation style audio reactivity
────────────────────────────────────────────────────────────── */

'use strict';

// ── Color palettes ───────────────────────────────────────────
const PALETTES = {
    mono: (t) => `hsl(240,10%,${10 + Math.abs(t) * 80}%)`,
    duotone: (t) => `hsl(${255 + Math.abs(t) * 60},70%,${40 + Math.abs(t) * 40}%)`,
    spectrum: (t) => `hsl(${Math.abs(t) * 360},70%,60%)`,
    grunge: (t) => {
        const h = [18, 28, 38, 195, 215][Math.floor(Math.abs(t) * 4.99)];
        return `hsl(${h},${35 + Math.abs(t) * 25}%,${30 + Math.abs(t) * 40}%)`;
    },
    neon: (t) => {
        const hues = [180, 300, 120, 60, 200];
        const i = Math.floor(Math.abs(t) * hues.length);
        return `hsl(${hues[i % hues.length]},100%,${55 + Math.abs(t) * 20}%)`;
    },
    fire: (t) => `hsl(${Math.abs(t) * 60},90%,${30 + Math.abs(t) * 40}%)`,
    ice: (t) => `hsl(${200 + Math.abs(t) * 40},${60 + Math.abs(t) * 30}%,${40 + Math.abs(t) * 45}%)`,
};

// ── Preset configs ────────────────────────────────────────────
const PRESETS = {
    abstract: { bgAlpha: 0.1, neonGlow: false, bgColor: '#09100a' },
    minimal: { bgAlpha: 0.2, neonGlow: false, bgColor: '#0a110a' },
    neon: { bgAlpha: 0.1, neonGlow: true, bgColor: '#04040e' },
};

// ── Data Smoothers ───────────────────────────────────────
let smoothedData = new Float32Array(256);
let bassSmooth = 0;
let particles = [];
let animOffsetGlobal = 0;

// ── Visualizer Engines ─────────────────────────────────────────
const VISUALIZERS = {

    // NCS Style: Pulse Ring
    pulse_ring(ctx, W, H, dataArray, colorFn, params) {
        const cx = W / 2, cy = H / 2;
        const baseRadius = Math.min(W, H) * 0.20;
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const r = baseRadius + beatDrop * 0.3; // Core circle expands on beat

        // Draw Core Circle Outline
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = colorFn(bassSmooth / 255);
        ctx.lineWidth = params.lineWeight * 2;
        ctx.stroke();

        if (!dataArray || dataArray.length === 0) return;

        const numBars = 120; // How many bars around the circle
        const barWidth = (2 * Math.PI * r) / numBars * 0.6;
        const angleStep = (Math.PI * 2) / numBars;

        ctx.lineCap = 'round';

        for (let i = 0; i < numBars; i++) {
            // Map the bar index to the frequency data array symmetrically
            // so low frequencies are at the bottom, highs at the top
            const mirroredIndex = i > numBars / 2 ? numBars - i : i;
            // Map [0, numBars/2] to [0, ~80] (meaningful frequencies)
            const dataIndex = Math.floor((mirroredIndex / (numBars / 2)) * 80);

            // Apply smoothing
            const val = dataArray[dataIndex] || 0;
            smoothedData[i] += (val - smoothedData[i]) * 0.2; // visual lerp

            // Bass boost for lower indexes
            const boost = (dataIndex < 10) ? params.bassBoost : 1;
            const amp = smoothedData[i] * params.sensitivity * boost * (H / 800);

            const angle = (i * angleStep) + Math.PI / 2; // Start bottom

            const x1 = cx + (r + 4) * Math.cos(angle);
            const y1 = cy + (r + 4) * Math.sin(angle);
            const x2 = cx + (r + 4 + amp) * Math.cos(angle);
            const y2 = cy + (r + 4 + amp) * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = Math.max(2, barWidth);
            ctx.strokeStyle = colorFn(i / numBars + animOffsetGlobal * 0.05);
            ctx.stroke();
        }
    },

    // SoundCloud Style: Sonic Wave
    sonic_wave(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const numBars = Math.min(dataArray.length, 100);
        const padding = W * 0.1;
        const drawWidth = W - (padding * 2);
        const barSpacing = drawWidth / numBars;
        const barWidth = Math.max(1, barSpacing * 0.7);
        const cy = H / 2;

        ctx.lineCap = 'miter';

        for (let i = 0; i < numBars; i++) {
            const val = dataArray[i] || 0;
            smoothedData[i] += (val - smoothedData[i]) * 0.3;

            const boost = (i < 10) ? params.bassBoost : 1;
            const amp = smoothedData[i] * params.sensitivity * boost * (H / 400);

            const x = padding + (i * barSpacing);
            const y1 = cy - (amp / 2);
            const y2 = cy + (amp / 2);

            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.lineWidth = barWidth;
            ctx.strokeStyle = colorFn(i / numBars);
            ctx.stroke();
        }
    },

    // TrapNation Style: Bass Core
    bass_core(ctx, W, H, dataArray, colorFn, params) {
        const cx = W / 2, cy = H / 2;
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const scale = 1 + (beatDrop / 500);

        // --- Render Background Particles First ---
        // Spawn particles heavily on strong beats
        if (beatDrop > 100 && Math.random() > 0.5) {
            for (let p = 0; p < 3; p++) {
                particles.push({
                    x: cx, y: cy,
                    vx: (Math.random() - 0.5) * 10 * scale,
                    vy: (Math.random() - 0.5) * 10 * scale,
                    life: 1.0,
                    color: colorFn(Math.random())
                });
            }
        }

        // Update & Draw Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1, p.life * 4), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life * params.opacity;
                ctx.fill();
            }
        }

        ctx.globalAlpha = params.opacity;

        // --- Render Core Geometric Logo ---
        const r = Math.min(W, H) * 0.15 * scale;
        const n = 6; // Hexagon

        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.lineWidth = params.lineWeight * 3;
        ctx.strokeStyle = colorFn(bassSmooth / 255);
        ctx.stroke();

        // Small inner triangle
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const px = cx + (r * 0.4) * Math.cos(angle);
            const py = cy + (r * 0.4) * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = colorFn((bassSmooth / 255) + 0.5);
        ctx.fill();
    },

    // Stardust Vortex
    stardust_vortex(ctx, W, H, dataArray, colorFn, params) {
        const cx = W / 2, cy = H / 2;
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const scale = 1 + (beatDrop / 400);

        if (beatDrop > 50 && Math.random() > 0.4) {
            for (let p = 0; p < 4; p++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 50;
                particles.push({
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist,
                    vx: Math.cos(angle) * 2 * scale,
                    vy: Math.sin(angle) * 2 * scale,
                    angle: angle,
                    life: 1.0,
                    color: colorFn(Math.random())
                });
            }
        }

        ctx.globalAlpha = params.opacity;
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];

            p.angle += 0.05;
            p.vx += Math.cos(p.angle) * 0.5;
            p.vy += Math.sin(p.angle) * 0.5;

            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.008;

            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1, p.life * 5), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life * params.opacity;
                ctx.fill();
            }
        }
    },

    // Quantum Grid
    quantum_grid(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const cx = W / 2, cy = H / 2;
        const gridSize = 12;
        const spacing = Math.min(W, H) / 15;

        ctx.lineWidth = params.lineWeight;

        for (let x = -gridSize; x <= gridSize; x++) {
            for (let y = -gridSize; y <= gridSize; y++) {
                const i = Math.floor(Math.abs(x * y) % dataArray.length);
                const val = dataArray[i] || 0;
                smoothedData[i] += (val - smoothedData[i]) * 0.2;

                const boost = (i < 10) ? params.bassBoost : 1;
                const amp = smoothedData[i] * params.sensitivity * boost * (H / 2000);

                const px = cx + x * spacing * (1 + amp);
                const py = cy + y * spacing * (1 + amp);

                if (x < gridSize) {
                    const nx = cx + (x + 1) * spacing * (1 + amp);
                    const ny = cy + y * spacing * (1 + amp);
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(nx, ny);
                    ctx.strokeStyle = colorFn((x + gridSize) / (gridSize * 2) + animOffsetGlobal * 0.1);
                    ctx.globalAlpha = params.opacity * (1 - (Math.abs(x) + Math.abs(y)) / (gridSize * 2));
                    ctx.stroke();
                }
                if (y < gridSize) {
                    const nx = cx + x * spacing * (1 + amp);
                    const ny = cy + (y + 1) * spacing * (1 + amp);
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(nx, ny);
                    ctx.strokeStyle = colorFn((y + gridSize) / (gridSize * 2) + animOffsetGlobal * 0.1);
                    ctx.globalAlpha = params.opacity * (1 - (Math.abs(x) + Math.abs(y)) / (gridSize * 2));
                    ctx.stroke();
                }
            }
        }
    },

    // Neon Threads
    neon_threads(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const cx = W / 2, cy = H / 2;
        const numThreads = 16;
        const segments = 20;
        const radius = Math.min(W, H) * 0.4;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let t = 0; t < numThreads; t++) {
            ctx.beginPath();
            const angleOffset = (t / numThreads) * Math.PI * 2 + animOffsetGlobal * 0.2;
            ctx.moveTo(cx, cy);

            for (let s = 1; s <= segments; s++) {
                const i = ((t * segments + s) * 2) % dataArray.length;
                const val = dataArray[i] || 0;
                smoothedData[i] += (val - smoothedData[i]) * 0.3;

                const boost = (i < 15) ? params.bassBoost : 1;
                const amp = smoothedData[i] * params.sensitivity * boost * (H / 1000);

                const wAngle = angleOffset + Math.sin(s * 0.5 + animOffsetGlobal * 2) * amp;
                const wDist = (s / segments) * radius;

                const px = cx + Math.cos(wAngle) * wDist;
                const py = cy + Math.sin(wAngle) * wDist;

                ctx.lineTo(px, py);
            }

            ctx.lineWidth = params.lineWeight * 1.5;
            ctx.strokeStyle = colorFn(t / numThreads);
            ctx.globalAlpha = params.opacity;
            ctx.stroke();
        }
    }
};

// ──────────────────────────────────────────────────────────────
//  APP STATE
// ──────────────────────────────────────────────────────────────
const state = {
    preset: 'abstract',
    visualizerStyle: 'pulse_ring',
    palette: 'spectrum',

    // Audio Params
    sensitivity: 1.5,
    smoothing: 0.8,
    bassBoost: 2.0,

    // Appearance
    lineWeight: 1,
    opacity: 0.6,

    // Core engine
    animating: false,
    animFrame: null,

    // Audio Hardware
    audioReactive: false,
    audioCtx: null,
    analyser: null,
    dataArray: null,
    stream: null,

    // 3D Tilt
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
};

// ──────────────────────────────────────────────────────────────
//  DOM REFS
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('pattern-canvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const stageToolbar = document.getElementById('stage-toolbar');
const toast = document.getElementById('toast');
let toastTimer;

// ──────────────────────────────────────────────────────────────
//  CANVAS SIZING
// ──────────────────────────────────────────────────────────────
function resizeCanvas() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    render();
}

// ──────────────────────────────────────────────────────────────
//  RENDER
// ──────────────────────────────────────────────────────────────
function render(timestamp = 0) {
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    animOffsetGlobal += 0.016; // internal steady beat

    const preset = PRESETS[state.preset] || PRESETS.abstract;
    const colorFn = PALETTES[state.palette] || PALETTES.spectrum;
    const renderer = VISUALIZERS[state.visualizerStyle];

    // Background fade (for trails)
    ctx.save();
    ctx.fillStyle = preset.bgColor;
    // Lower alpha allows old frames to persist longer, creating trails
    ctx.globalAlpha = state.animating ? preset.bgAlpha : 1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Neon glow
    if (preset.neonGlow) {
        ctx.shadowColor = PALETTES.neon(animOffsetGlobal % 1);
        ctx.shadowBlur = 15;
    } else {
        ctx.shadowBlur = 0;
    }

    // Capture precise Audio Hardware state
    if (state.audioReactive && state.analyser && state.dataArray) {
        state.analyser.getByteFrequencyData(state.dataArray);

        let sum = 0;
        const limit = Math.min(10, state.dataArray.length); // Super Sub-ass isolated
        for (let i = 0; i < limit; i++) sum += state.dataArray[i];
        const rawBass = sum / limit;

        // Manual aggressive lerp for bass punch
        bassSmooth += (rawBass - bassSmooth) * 0.3;
    } else {
        bassSmooth *= 0.9;
    }

    const params = {
        sensitivity: state.sensitivity,
        smoothing: state.smoothing,
        bassBoost: state.bassBoost,
        opacity: state.opacity,
        lineWeight: state.lineWeight
    };

    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (renderer) {
        // Pass the actual raw array directly to the engines
        renderer(ctx, W, H, state.dataArray, colorFn, params);
    }

    ctx.restore();

    // Loop
    if (state.audioReactive || state.animating) {
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
        state.animFrame = requestAnimationFrame(render);
    }
}

// ──────────────────────────────────────────────────────────────
//  TOAST / EXPORT / UI
// ──────────────────────────────────────────────────────────────
function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function updateSliderVal(id, val) {
    const el = document.getElementById(id + '-val');
    if (el) el.textContent = parseFloat(val).toFixed(
        ['sensitivity', 'smoothing', 'bass-boost', 'opacity', 'line-weight'].includes(id) ? 2 : 0
    );
}

function update3DTransform() {
    const stage = document.getElementById('stage');
    if (stage && canvas) {
        stage.style.perspective = '800px';
        canvas.style.transform = `rotateX(${state.tiltX}deg) rotateY(${state.tiltY}deg) rotateZ(${state.tiltZ}deg) scale(1.15)`;
        canvas.style.transition = 'transform 0.1s ease-out';
        canvas.style.transformStyle = 'preserve-3d';
    }
}

function exportPNG() {
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visualizer-${state.visualizerStyle}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 Visualizer saved as PNG');
    }, 'image/png');
}

function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    state.preset = name;
    document.body.setAttribute('data-preset', name);
    document.getElementById('active-preset-badge').textContent = name.charAt(0).toUpperCase() + name.slice(1);
    if (!state.animating && !state.audioReactive) render();
}

function wireRange(id, key, format) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
        state[key] = format ? format(el.value) : parseFloat(el.value);
        updateSliderVal(id, el.value);

        // Update audio context smoothing instantly
        if (key === 'smoothing' && state.analyser) {
            state.analyser.smoothingTimeConstant = state.smoothing;
        }

        if (!state.animating && !state.audioReactive) render();
    });
}

function init() {
    // Sliders
    wireRange('sensitivity', 'sensitivity', parseFloat);
    wireRange('smoothing', 'smoothing', parseFloat);
    wireRange('bass-boost', 'bassBoost', parseFloat);
    wireRange('line-weight', 'lineWeight', parseFloat);
    wireRange('opacity', 'opacity', parseFloat);

    // 3D Tilt (Mouse Drag instead of Sliders)
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.classList.add('dragging');
        const hint = document.getElementById('pan-hint');
        if (hint) hint.classList.add('hidden');
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.classList.remove('dragging');
    });

    canvas.addEventListener('dblclick', () => {
        state.tiltX = 0;
        state.tiltY = 0;
        state.tiltZ = 0;
        update3DTransform();
        if (!state.animating && !state.audioReactive) render();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            state.tiltY += deltaX * 0.5;
            state.tiltX -= deltaY * 0.5;

            state.tiltX = Math.max(-90, Math.min(90, state.tiltX));

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            update3DTransform();
            if (!state.animating && !state.audioReactive) render();
        }
    });

    // Selects
    const visSelect = document.getElementById('visualizer-style');
    if (visSelect) {
        visSelect.addEventListener('change', (e) => {
            state.visualizerStyle = e.target.value;
            particles = []; // clear base core particles
            smoothedData = new Float32Array(256); // reset lerp buffers
            const el = document.getElementById('active-pattern-label');
            if (el) el.textContent = e.target.options[e.target.selectedIndex].text;
            if (!state.animating && !state.audioReactive) render();
        });
    }

    const colSelect = document.getElementById('color-palette');
    if (colSelect) {
        colSelect.addEventListener('change', (e) => {
            state.palette = e.target.value;
            if (!state.animating && !state.audioReactive) render();
        });
    }

    // Audio Reactive Toggle
    const audioToggle = document.getElementById('audio-reactive');
    if (audioToggle) {
        audioToggle.addEventListener('change', async (e) => {
            state.audioReactive = e.target.checked;
            if (state.audioReactive) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    state.stream = stream;
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const analyser = audioCtx.createAnalyser();
                    const source = audioCtx.createMediaStreamSource(stream);
                    source.connect(analyser);

                    analyser.fftSize = 512; // Double fidelity for sharp bands
                    analyser.smoothingTimeConstant = state.smoothing;

                    state.audioCtx = audioCtx;
                    state.analyser = analyser;
                    state.dataArray = new Uint8Array(analyser.frequencyBinCount);

                    showToast('🎤 Visualizer tracking enabled');
                    render(); // Kickoff main loop
                } catch (err) {
                    console.error("Audio init error", err);
                    state.audioReactive = false;
                    e.target.checked = false;
                    showToast('✕ Microphone access denied');
                }
            } else {
                if (state.stream) state.stream.getTracks().forEach(t => t.stop());
                if (state.audioCtx) state.audioCtx.close();
                state.audioAmp = 0;
                bassSmooth = 0;
                showToast('🔇 Visualizer tracking disabled');
            }
        });
    }

    // Preset pills wiring
    const pills = document.getElementById('preset-pills');
    if (pills) {
        pills.addEventListener('click', (e) => {
            const btn = e.target.closest('.preset-pill');
            if (!btn) return;
            document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.preset);
        });
    }

    // Action buttons
    const btnGen = document.getElementById('btn-generate');
    if (btnGen) {
        // Just trigger a dummy draw if not reacting, otherwise do nothing
        btnGen.addEventListener('click', () => {
            state.animating = true;
            if (!state.animFrame) render();
            // Automatically turn off animation after 2 sec if just a single "generate" test
            setTimeout(() => { if (!state.audioReactive) state.animating = false; }, 2000);
            showToast('▶ Preview running');
        });
    }

    const btnRandomize = document.getElementById('btn-randomize');
    if (btnRandomize && colSelect && visSelect) {
        btnRandomize.addEventListener('click', () => {
            const styles = ['pulse_ring', 'sonic_wave', 'bass_core', 'stardust_vortex', 'quantum_grid', 'neon_threads'];
            const palettes = Object.keys(PALETTES);
            state.visualizerStyle = styles[Math.floor(Math.random() * styles.length)];
            state.palette = palettes[Math.floor(Math.random() * palettes.length)];

            visSelect.value = state.visualizerStyle;
            colSelect.value = state.palette;
            const el = document.getElementById('active-pattern-label');
            if (el) el.textContent = visSelect.options[visSelect.selectedIndex].text;

            particles = [];
            showToast('🎲 Randomized!');
            if (!state.animating && !state.audioReactive) render();
        });
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', exportPNG);

    // Active Sidebar Auto-hide
    let userToggledSidebar = false;
    let inactivityTimer;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);

        if (!userToggledSidebar && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            stageToolbar.classList.remove('visible');
            setTimeout(resizeCanvas, 360);
        }

        if (!userToggledSidebar) {
            inactivityTimer = setTimeout(() => {
                sidebar.classList.add('collapsed');
                stageToolbar.classList.add('visible');
                setTimeout(resizeCanvas, 360);
            }, 3000);
        }
    }

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    resetInactivityTimer();

    // Sidebar toggles
    const tBtn = document.getElementById('sidebar-toggle');
    if (tBtn) tBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userToggledSidebar = true;
        sidebar.classList.add('collapsed');
        stageToolbar.classList.add('visible');
        setTimeout(resizeCanvas, 360);
    });

    const expandBtn = document.getElementById('expand-sidebar');
    if (expandBtn) expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userToggledSidebar = false;
        sidebar.classList.remove('collapsed');
        stageToolbar.classList.remove('visible');
        setTimeout(resizeCanvas, 360);
        resetInactivityTimer();
    });

    const ro = new ResizeObserver(() => resizeCanvas());
    const stageContainer = document.getElementById('stage');
    if (stageContainer) ro.observe(stageContainer);

    // Set baseline DOM state UI text
    const label = document.getElementById('active-pattern-label');
    if (label) label.textContent = 'Pulse Ring';
    applyPreset('abstract');
    resizeCanvas();
}

document.addEventListener('DOMContentLoaded', init);
