/* ──────────────────────────────────────────────────────────────
   Pattern Generator — app.js
   EverydAI · Canvas-based procedural art engine
────────────────────────────────────────────────────────────── */

'use strict';

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ── Simplex-like noise (value noise, no dep) ──────────────────
function makeNoise(seed) {
    const rng = mulberry32(seed);
    const TABLE = new Float32Array(512);
    for (let i = 0; i < 256; i++) TABLE[i] = TABLE[i + 256] = rng();
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + t * (b - a); }
    return function noise(x, y = 0) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = fade(x), v = fade(y);
        const a = TABLE[X] + Y, b = TABLE[X + 1] + Y;
        return lerp(
            lerp(TABLE[a], TABLE[b], u),
            lerp(TABLE[a + 1], TABLE[b + 1], u),
            v
        );
    };
}

// ── Color palettes ───────────────────────────────────────────
const PALETTES = {
    mono: (t) => `hsl(240,10%,${10 + t * 80}%)`,
    duotone: (t) => `hsl(${255 + t * 60},70%,${40 + t * 40}%)`,
    spectrum: (t) => `hsl(${t * 360},70%,60%)`,
    grunge: (t) => {
        const h = [18, 28, 38, 195, 215][Math.floor(t * 4.99)];
        return `hsl(${h},${35 + t * 25}%,${30 + t * 40}%)`;
    },
    neon: (t) => {
        const hues = [180, 300, 120, 60, 200];
        const i = Math.floor(t * hues.length);
        return `hsl(${hues[i % hues.length]},100%,${55 + t * 20}%)`;
    },
    fire: (t) => `hsl(${t * 60},90%,${30 + t * 40}%)`,
    ice: (t) => `hsl(${200 + t * 40},${60 + t * 30}%,${40 + t * 45}%)`,
};

// ── Preset configs ────────────────────────────────────────────
const PRESETS = {
    abstract: {
        bgAlpha: 0.04,
        lineWeight: 1.0,
        opacity: 0.55,
        palette: 'spectrum',
        neonGlow: false,
        grainAlpha: 0,
        bgColor: '#0a0a0c',
    },
    minimal: {
        bgAlpha: 0.12,
        lineWeight: 0.6,
        opacity: 0.35,
        palette: 'mono',
        neonGlow: false,
        grainAlpha: 0,
        bgColor: '#0f0f0f',
    },
    grunge: {
        bgAlpha: 0.03,
        lineWeight: 1.8,
        opacity: 0.7,
        palette: 'grunge',
        neonGlow: false,
        grainAlpha: 0.18,
        bgColor: '#0c0a08',
    },
    neon: {
        bgAlpha: 0.08,
        lineWeight: 1.2,
        opacity: 0.8,
        palette: 'neon',
        neonGlow: true,
        grainAlpha: 0,
        bgColor: '#04040e',
    },
    organic: {
        bgAlpha: 0.05,
        lineWeight: 1.4,
        opacity: 0.6,
        palette: 'ice',
        neonGlow: false,
        grainAlpha: 0.04,
        bgColor: '#060e0a',
    },
};

// ── Pattern renderers ─────────────────────────────────────────
const RENDERERS = {

    // ── Spirograph (Hypotrochoid) ──────────────────────────────
    spirograph(ctx, W, H, p, colorFn, rng) {
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.44 * p.amplitude;
        const r = R / p.freqA;
        const d = r * (0.3 + (p.freqB / 20) * 0.7);
        const steps = Math.floor(p.iterations);
        const useShape = p.shape !== 'line';
        const shapeSize = Math.max(1.5, ctx.lineWidth * 2.5);
        const sampleStep = useShape ? Math.max(1, Math.floor(steps / 400)) : 1;
        let prevX, prevY;
        if (!useShape) ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * Math.PI * 2 * Math.lcm(p.freqA, p.freqB || 1);
            const eq = p.equationFn(1, 1, theta / (2 * Math.PI), p.freqA, p.freqB, i, steps);
            const amp = isFinite(eq) ? eq : 1;
            const x = cx + (R - r) * Math.cos(theta) + d * Math.cos(((R - r) / r) * theta) * amp;
            const y = cy + (R - r) * Math.sin(theta) - d * Math.sin(((R - r) / r) * theta) * amp;
            const t = i / steps;
            if (useShape) {
                if (i % sampleStep === 0) {
                    ctx.strokeStyle = colorFn(t);
                    ctx.fillStyle = colorFn(t);
                    applyShape(ctx, p.shape, x, y, shapeSize, p.sides);
                }
            } else {
                ctx.strokeStyle = colorFn(t);
                if (i === 0) { ctx.moveTo(x, y); }
                else {
                    if (i % 3 === 0) {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(prevX, prevY);
                    }
                    ctx.lineTo(x, y);
                }
            }
            prevX = x; prevY = y;
        }
        if (!useShape) ctx.stroke();
    },

    // ── Lissajous ─────────────────────────────────────────────
    lissajous(ctx, W, H, p, colorFn, rng) {
        const cx = W / 2, cy = H / 2;
        const rx = W * 0.42 * p.amplitude;
        const ry = H * 0.42 * p.amplitude;
        const steps = Math.floor(p.iterations);
        const delta = Math.PI / 3.7;
        const useShape = p.shape !== 'line';
        const shapeSize = Math.max(1.5, ctx.lineWidth * 2.5);
        const sampleStep = useShape ? Math.max(1, Math.floor(steps / 350)) : 1;
        if (!useShape) ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * Math.PI * 2 * 4;
            const eq = p.equationFn(
                Math.cos(p.freqA * theta + delta),
                Math.sin(p.freqB * theta),
                theta, p.freqA, p.freqB, i, steps
            );
            const mod = isFinite(eq) ? Math.abs(eq) * 0.5 + 0.5 : 1;
            const x = cx + rx * Math.cos(p.freqA * theta + delta) * mod;
            const y = cy + ry * Math.sin(p.freqB * theta) * mod;
            const t = i / steps;
            if (useShape) {
                if (i % sampleStep === 0) {
                    ctx.strokeStyle = colorFn(t);
                    ctx.fillStyle = colorFn(t);
                    applyShape(ctx, p.shape, x, y, shapeSize, p.sides);
                }
            } else {
                if (i % 120 === 0) {
                    ctx.stroke();
                    ctx.strokeStyle = colorFn(t);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }
                ctx.lineTo(x, y);
            }
        }
        if (!useShape) ctx.stroke();
    },

    // ── Rose Curve ────────────────────────────────────────────
    rose(ctx, W, H, p, colorFn, rng) {
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.45 * p.amplitude;
        const k = p.freqA / Math.max(p.freqB, 1);
        const steps = Math.floor(p.iterations);
        const totalAngle = Math.PI * (Number.isInteger(k) ? 1 : 2) * Math.max(p.freqA, p.freqB);
        const useShape = p.shape !== 'line';
        const shapeSize = Math.max(1.5, ctx.lineWidth * 2.5);
        const sampleStep = useShape ? Math.max(1, Math.floor(steps / 350)) : 1;
        if (!useShape) ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * totalAngle;
            const eq = p.equationFn(Math.cos(k * theta), Math.sin(theta), theta, p.freqA, p.freqB, i, steps);
            const rmod = isFinite(eq) ? eq : 1;
            const r = R * Math.cos(k * theta) * rmod;
            const x = cx + r * Math.cos(theta);
            const y = cy + r * Math.sin(theta);
            const t = i / steps;
            if (useShape) {
                if (i % sampleStep === 0) {
                    ctx.strokeStyle = colorFn(t);
                    ctx.fillStyle = colorFn(t);
                    applyShape(ctx, p.shape, x, y, shapeSize, p.sides);
                }
            } else {
                if (i % 100 === 0) {
                    ctx.stroke();
                    ctx.strokeStyle = colorFn(t);
                    ctx.beginPath();
                    if (i === 0) ctx.moveTo(x, y);
                }
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        if (!useShape) ctx.stroke();
    },

    // ── Flow Field ────────────────────────────────────────────
    flowfield(ctx, W, H, p, colorFn, rng) {
        const noise = makeNoise(Math.floor(p.seed));
        const scale = 0.003 + (p.freqA / 20) * 0.02;
        const numLines = Math.floor(p.density * 1.8);
        const steps = Math.max(50, Math.floor(p.iterations / numLines));
        const useShape = p.shape !== 'line';
        const shapeSize = Math.max(1.5, ctx.lineWidth * 2);
        for (let li = 0; li < numLines; li++) {
            let x = rng() * W;
            let y = rng() * H;
            const t0 = li / numLines;
            ctx.strokeStyle = colorFn(t0);
            ctx.fillStyle = colorFn(t0);
            if (!useShape) { ctx.beginPath(); ctx.moveTo(x, y); }
            for (let s = 0; s < steps; s++) {
                const angle = noise(x * scale, y * scale) * Math.PI * (4 + p.freqB * 0.5);
                const eq = p.equationFn(x / W, y / H, s / steps, p.freqA, p.freqB, s, steps);
                const speed = (isFinite(eq) ? Math.abs(eq) * 0.5 + 0.5 : 1) * (2 + p.amplitude * 3);
                x += Math.cos(angle) * speed;
                y += Math.sin(angle) * speed;
                if (x < 0 || x > W || y < 0 || y > H) break;
                if (useShape) { applyShape(ctx, p.shape, x, y, shapeSize, p.sides); }
                else { ctx.lineTo(x, y); }
            }
            if (!useShape) ctx.stroke();
        }
    },

    // ── Truchet Tiles ─────────────────────────────────────────
    truchet(ctx, W, H, p, colorFn, rng) {
        const cellSize = Math.max(6, Math.floor(100 - p.density));
        const cols = Math.ceil(W / cellSize) + 1;
        const rows = Math.ceil(H / cellSize) + 1;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellSize;
                const y = row * cellSize;
                const t = (row * cols + col) / (rows * cols);
                ctx.strokeStyle = colorFn(t);
                const eq = p.equationFn(x / W, y / H, t, p.freqA, p.freqB, row * cols + col, rows * cols);
                const variant = rng() + (isFinite(eq) ? eq * 0.1 : 0) > 0.5;
                ctx.beginPath();
                if (variant) {
                    ctx.arc(x, y, cellSize / 2, 0, Math.PI / 2);
                    ctx.arc(x + cellSize, y + cellSize, cellSize / 2, Math.PI, 1.5 * Math.PI);
                } else {
                    ctx.arc(x + cellSize, y, cellSize / 2, Math.PI / 2, Math.PI);
                    ctx.arc(x, y + cellSize, cellSize / 2, 1.5 * Math.PI, Math.PI * 2);
                }
                ctx.stroke();
            }
        }
    },

    // ── Grid Noise ────────────────────────────────────────────
    gridnoise(ctx, W, H, p, colorFn, rng) {
        const noise = makeNoise(Math.floor(p.seed));
        const cellSize = Math.max(4, Math.floor(80 - p.density * 0.7));
        const cols = Math.ceil(W / cellSize) + 1;
        const rows = Math.ceil(H / cellSize) + 1;
        const scale = 0.01 + p.freqA * 0.01;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellSize;
                const y = row * cellSize;
                const nv = noise(col * scale, row * scale * (p.freqB / p.freqA || 1));
                const eq = p.equationFn(x / W, y / H, nv, p.freqA, p.freqB, row * cols + col, rows * cols);
                const val = isFinite(eq) ? Math.abs(eq) % 1 : nv;
                const t = val;
                ctx.strokeStyle = colorFn(t);
                const angle = nv * Math.PI * 2;
                const len = cellSize * 0.55 * p.amplitude;
                const cx2 = x + cellSize / 2;
                const cy2 = y + cellSize / 2;
                ctx.beginPath();
                ctx.moveTo(cx2 - Math.cos(angle) * len, cy2 - Math.sin(angle) * len);
                ctx.lineTo(cx2 + Math.cos(angle) * len, cy2 + Math.sin(angle) * len);
                ctx.stroke();
            }
        }
    },

    // ── Fractal Burst ─────────────────────────────────────────
    fractal(ctx, W, H, p, colorFn, rng) {
        const maxDepth = Math.max(3, Math.min(9, Math.floor(p.freqA)));
        const branchFactor = 0.62 + p.amplitude * 0.25;
        const rootLen = Math.min(W, H) * 0.22 * p.amplitude;
        const numRoots = Math.max(1, Math.floor(p.density / 20));
        let drawn = 0;
        const maxLines = p.iterations;

        function branch(x, y, angle, len, depth, t) {
            if (depth === 0 || len < 1.2 || drawn > maxLines) return;
            const eq = p.equationFn(x / W, y / H, depth / maxDepth, p.freqA, p.freqB, drawn, maxLines);
            const mod = isFinite(eq) ? eq : 1;
            const ex = x + Math.cos(angle) * len * Math.abs(mod);
            const ey = y + Math.sin(angle) * len * Math.abs(mod);
            ctx.strokeStyle = colorFn(t % 1);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
            drawn++;
            const spread = 0.28 + p.freqB * 0.04;
            const numBranches = 2 + (depth % 2);
            for (let b = 0; b < numBranches; b++) {
                const newAngle = angle + (b - (numBranches - 1) / 2) * spread + (rng() - 0.5) * 0.3;
                branch(ex, ey, newAngle, len * branchFactor, depth - 1, t + 1 / (maxDepth * numBranches));
            }
        }

        for (let r = 0; r < numRoots; r++) {
            const angle = (r / numRoots) * Math.PI * 2 - Math.PI / 2;
            branch(W / 2, H / 2, angle, rootLen, maxDepth, r / numRoots);
        }
    },

    // ── Crosshatch ────────────────────────────────────────────
    crosshatch(ctx, W, H, p, colorFn, rng) {
        const noise = makeNoise(Math.floor(p.seed));
        const numAngles = Math.max(1, Math.floor(p.freqA * 0.75));
        const spacing = Math.max(3, Math.floor(60 - p.density * 0.55));
        const hasEq = !!state.equationStr.trim();
        const baseAlpha = ctx.globalAlpha;
        for (let ai = 0; ai < numAngles; ai++) {
            const angle = (ai / numAngles) * Math.PI;
            const t0 = ai / numAngles;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const diag = Math.sqrt(W * W + H * H);
            const perp = angle + Math.PI / 2;
            const hw = (W + H) / 2;
            for (let d = -diag / 2; d < diag / 2; d += spacing) {
                const lx = W / 2 + cos * d;
                const ly = H / 2 + sin * d;
                const nv = noise(lx * 0.004, ly * 0.004 + ai * 5);
                // Skip very sparse noise regions for natural hatching feel
                if (nv < 0.12) continue;
                const eq = p.equationFn(lx / W, ly / H, nv, p.freqA, p.freqB, Math.floor(d), diag);
                // With a custom equation: use it to gate lines. Without one: draw all.
                if (hasEq && isFinite(eq) && Math.abs(eq % 1) > 0.55) continue;
                // Modulate opacity by noise for texture
                ctx.globalAlpha = baseAlpha * (0.35 + nv * 0.65);
                ctx.strokeStyle = colorFn((t0 + nv * 0.3) % 1);
                ctx.beginPath();
                ctx.moveTo(lx + Math.cos(perp) * -hw, ly + Math.sin(perp) * -hw);
                ctx.lineTo(lx + Math.cos(perp) * hw, ly + Math.sin(perp) * hw);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = baseAlpha;
    },
};

// ── Math.lcm utility ─────────────────────────────────────────
Math.lcm = function (a, b) {
    a = Math.round(a); b = Math.round(b);
    if (!a || !b) return Math.max(a, b) || 1;
    let x = a, y = b;
    while (y) { [x, y] = [y, x % y]; }
    return Math.abs((a / x) * b);
};

// ── Grain / noise overlay texture ────────────────────────────
// NOTE: putImageData ignores canvas transforms so we must use actual
// device-pixel canvas dimensions (canvas.width / canvas.height), not CSS px.
function applyGrain(ctx, alpha, rng) {
    if (alpha <= 0) return;
    const cW = ctx.canvas.width;
    const cH = ctx.canvas.height;
    const grain = ctx.createImageData(cW, cH);
    const d = grain.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = rng() > 0.5 ? 220 : 30;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = alpha * 255;
    }
    ctx.putImageData(grain, 0, 0);
}

// ── Shape style wrappers ──────────────────────────────────────
function applyShape(ctx, shape, x, y, size, sides) {
    if (shape === 'dot') {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    } else if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
    } else if (shape === 'polygon') {
        const n = sides || 6;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
    } else if (shape === 'arc') {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI + size * 0.05);
        ctx.stroke();
    }
}

// ──────────────────────────────────────────────────────────────
//  APP STATE
// ──────────────────────────────────────────────────────────────
const state = {
    preset: 'abstract',
    pattern: 'spirograph',
    shape: 'line',
    palette: 'spectrum',
    freqA: 3,
    freqB: 2,
    amplitude: 0.8,
    iterations: 2000,
    density: 40,
    seed: 42,
    lineWeight: 1,
    opacity: 0.6,
    polygonSides: 6,
    equationStr: '',
    equationFn: null,
    animating: false,
    animT: 0,
    animFrame: null,
    // Pan
    panX: 0,
    panY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    panStartX: 0,
    panStartY: 0,
};

// ──────────────────────────────────────────────────────────────
//  DOM REFS
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('pattern-canvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const stageToolbar = document.getElementById('stage-toolbar');
const renderOverlay = document.getElementById('render-overlay');
const toast = document.getElementById('toast');
let toastTimer;

// ──────────────────────────────────────────────────────────────
//  CANVAS SIZING
// ──────────────────────────────────────────────────────────────
function resizeCanvas() {
    const stage = document.getElementById('stage');
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
//  EQUATION PARSER
// ──────────────────────────────────────────────────────────────
function parseEquation(str) {
    if (!str.trim()) return null;
    // Inject Math.* for common functions
    const wrapped = str
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bfloor\b/g, 'Math.floor')
        .replace(/\bceil\b/g, 'Math.ceil')
        .replace(/\bround\b/g, 'Math.round')
        .replace(/\bpow\b/g, 'Math.pow')
        .replace(/\blog\b/g, 'Math.log')
        .replace(/\bexp\b/g, 'Math.exp')
        .replace(/\bPI\b/g, 'Math.PI')
        .replace(/\bpi\b/g, 'Math.PI')
        .replace(/\bE\b/g, 'Math.E');
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('x', 'y', 't', 'a', 'b', 'i', 'n', `return (${wrapped});`);
        fn(0.5, 0.5, 0.5, 3, 2, 0, 100); // test call
        return fn;
    } catch {
        return 'error';
    }
}

const IDENTITY_FN = (x) => (isFinite(x) ? x : 1);
function getEquationFn() {
    if (!state.equationStr.trim()) return (x) => 1;
    if (state.equationFn && state.equationFn !== 'error') return state.equationFn;
    return () => 1;
}

// ──────────────────────────────────────────────────────────────
//  RENDER
// ──────────────────────────────────────────────────────────────
function render(animOffset = 0) {
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    const preset = PRESETS[state.preset] || PRESETS.abstract;
    const colorFn = PALETTES[state.palette] || PALETTES.spectrum;
    const renderer = RENDERERS[state.pattern];
    const rng = mulberry32(Math.floor(state.seed) + Math.floor(animOffset * 100));

    // Background fill
    ctx.save();
    ctx.fillStyle = preset.bgColor;
    ctx.globalAlpha = state.animating ? preset.bgAlpha : 1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Neon glow
    if (preset.neonGlow) {
        ctx.shadowColor = PALETTES.neon(animOffset % 1);
        ctx.shadowBlur = 18;
    } else {
        ctx.shadowBlur = 0;
    }

    // Draw pattern parameters object
    const freqA = state.freqA + Math.sin(animOffset * 0.7) * (state.animating ? 1.5 : 0);
    const freqB = state.freqB + Math.cos(animOffset * 0.5) * (state.animating ? 1.5 : 0);
    const amp = state.amplitude + Math.sin(animOffset * 0.3) * (state.animating ? 0.15 : 0);

    const params = {
        freqA: Math.max(1, freqA),
        freqB: Math.max(1, freqB),
        amplitude: Math.max(0.1, Math.min(1, amp)),
        iterations: state.iterations,
        density: state.density,
        seed: state.seed + animOffset,
        shape: state.shape,
        sides: state.polygonSides,
        equationFn: getEquationFn(),
    };

    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.lineWidth = state.lineWeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorFn(0);
    ctx.fillStyle = colorFn(0);
    // Apply pan offset
    ctx.translate(state.panX, state.panY);

    if (renderer) {
        renderer(ctx, W, H, params, colorFn, rng);
    }

    ctx.restore();

    // Grain overlay (grunge preset)
    if (preset.grainAlpha > 0) {
        applyGrain(ctx, preset.grainAlpha * 0.4, mulberry32(state.seed + 777));
    }
}

// ──────────────────────────────────────────────────────────────
//  ANIMATE
// ──────────────────────────────────────────────────────────────
function startAnimate() {
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    state.animating = true;
    function loop() {
        state.animT += 0.012;
        render(state.animT);
        state.animFrame = requestAnimationFrame(loop);
    }
    loop();
}

function stopAnimate() {
    state.animating = false;
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
    render();
}

// ──────────────────────────────────────────────────────────────
//  RANDOMIZE
// ──────────────────────────────────────────────────────────────
function randomize() {
    const rng = mulberry32(Date.now());
    const patterns = Object.keys(RENDERERS);
    const palettes = Object.keys(PALETTES);

    state.pattern = patterns[Math.floor(rng() * patterns.length)];
    state.palette = palettes[Math.floor(rng() * palettes.length)];
    state.freqA = 1 + Math.floor(rng() * 12);
    state.freqB = 1 + Math.floor(rng() * 12);
    state.amplitude = 0.3 + rng() * 0.7;
    state.iterations = 500 + Math.floor(rng() * 5000);
    state.density = 5 + Math.floor(rng() * 90);
    state.seed = Math.floor(rng() * 9999);
    state.lineWeight = 0.3 + rng() * 3.5;
    state.opacity = 0.2 + rng() * 0.75;

    syncUIFromState();
    render();
}

// ──────────────────────────────────────────────────────────────
//  PRESET APPLY
// ──────────────────────────────────────────────────────────────
function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    state.preset = name;
    state.lineWeight = preset.lineWeight;
    state.opacity = preset.opacity;
    state.palette = preset.palette;

    // Update body data-preset for CSS vars
    document.body.setAttribute('data-preset', name);

    // Sync UI
    document.getElementById('color-palette').value = state.palette;
    document.getElementById('line-weight').value = state.lineWeight;
    document.getElementById('opacity').value = state.opacity;
    updateSliderVal('line-weight', state.lineWeight);
    updateSliderVal('opacity', state.opacity);

    // Update accent badge
    document.getElementById('active-preset-badge').textContent = capitalize(name);
    const badge = document.getElementById('active-preset-badge');
    badge.style.color = getComputedStyle(document.documentElement).getPropertyValue('--preset-accent').trim() || '';

    render();
}

// ──────────────────────────────────────────────────────────────
//  UI SYNC
// ──────────────────────────────────────────────────────────────
function updateSliderVal(id, val) {
    const el = document.getElementById(id + '-val');
    if (el) el.textContent = parseFloat(val).toFixed(
        ['amplitude', 'opacity', 'line-weight'].includes(id) ? 2 : 0
    );
}

function syncUIFromState() {
    document.getElementById('pattern-type').value = state.pattern;
    document.getElementById('shape-type').value = state.shape;
    document.getElementById('color-palette').value = state.palette;
    document.getElementById('freq-a').value = state.freqA;
    document.getElementById('freq-b').value = state.freqB;
    document.getElementById('amplitude').value = state.amplitude;
    document.getElementById('iterations').value = state.iterations;
    document.getElementById('density').value = state.density;
    document.getElementById('seed').value = state.seed;
    document.getElementById('line-weight').value = state.lineWeight;
    document.getElementById('opacity').value = state.opacity;

    updateSliderVal('freq-a', state.freqA);
    updateSliderVal('freq-b', state.freqB);
    updateSliderVal('amplitude', state.amplitude);
    updateSliderVal('iterations', state.iterations);
    updateSliderVal('density', state.density);
    updateSliderVal('seed', state.seed);
    updateSliderVal('line-weight', state.lineWeight);
    updateSliderVal('opacity', state.opacity);

    document.getElementById('active-pattern-label').textContent = getPatternLabel(state.pattern);
}

function getPatternLabel(p) {
    const map = {
        spirograph: 'Spirograph',
        lissajous: 'Lissajous',
        rose: 'Rose Curve',
        flowfield: 'Flow Field',
        truchet: 'Truchet',
        gridnoise: 'Grid Noise',
        fractal: 'Fractal Burst',
        crosshatch: 'Crosshatch',
    };
    return map[p] || p;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ──────────────────────────────────────────────────────────────
//  TOAST
// ──────────────────────────────────────────────────────────────
function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ──────────────────────────────────────────────────────────────
//  EXPORT
// ──────────────────────────────────────────────────────────────
function exportPNG() {
    // Render at 2× resolution for crisp export
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const exportCanvas = document.createElement('canvas');
    const scale = 2;
    exportCanvas.width = W * scale;
    exportCanvas.height = H * scale;
    const ectx = exportCanvas.getContext('2d');
    ectx.scale(scale, scale);

    const preset = PRESETS[state.preset] || PRESETS.abstract;
    const colorFn = PALETTES[state.palette] || PALETTES.spectrum;
    const renderer = RENDERERS[state.pattern];
    const rng = mulberry32(Math.floor(state.seed));

    ectx.fillStyle = preset.bgColor;
    ectx.globalAlpha = 1;
    ectx.fillRect(0, 0, W, H);

    if (preset.neonGlow) {
        ectx.shadowColor = PALETTES.neon(0.5);
        ectx.shadowBlur = 18;
    }

    ectx.globalAlpha = state.opacity;
    ectx.lineWidth = state.lineWidth;
    ectx.lineCap = 'round';
    ectx.lineJoin = 'round';

    const params = {
        freqA: state.freqA,
        freqB: state.freqB,
        amplitude: state.amplitude,
        iterations: state.iterations,
        density: state.density,
        seed: state.seed,
        shape: state.shape,
        equationFn: getEquationFn(),
    };

    if (renderer) renderer(ectx, W, H, params, colorFn, rng);
    if (preset.grainAlpha > 0) {
        applyGrain(ectx, preset.grainAlpha * 0.4, mulberry32(state.seed + 777));
    }

    exportCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pattern-${state.pattern}-${state.preset}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 Pattern saved as PNG');
    }, 'image/png');
}

// ──────────────────────────────────────────────────────────────
//  EVENT WIRING
// ──────────────────────────────────────────────────────────────
function wireRange(id, key, format) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
        state[key] = format ? format(el.value) : parseFloat(el.value);
        updateSliderVal(id, el.value);
        if (!state.animating) render();
    });
}

function init() {
    // Sliders
    wireRange('freq-a', 'freqA', parseFloat);
    wireRange('freq-b', 'freqB', parseFloat);
    wireRange('amplitude', 'amplitude', parseFloat);
    wireRange('iterations', 'iterations', (v) => Math.floor(parseFloat(v)));
    wireRange('density', 'density', parseFloat);
    wireRange('seed', 'seed', parseFloat);
    wireRange('line-weight', 'lineWeight', parseFloat);
    wireRange('opacity', 'opacity', parseFloat);

    // Polygon sides
    wireRange('poly-sides', 'polygonSides', (v) => Math.round(parseFloat(v)));

    // Selects
    document.getElementById('pattern-type').addEventListener('change', (e) => {
        state.pattern = e.target.value;
        document.getElementById('active-pattern-label').textContent = getPatternLabel(state.pattern);
        if (!state.animating) render();
    });

    document.getElementById('shape-type').addEventListener('change', (e) => {
        state.shape = e.target.value;
        // Show/hide polygon sides slider
        const polySidesRow = document.getElementById('poly-sides-row');
        if (polySidesRow) polySidesRow.classList.toggle('visible', state.shape === 'polygon');
        if (!state.animating) render();
    });

    document.getElementById('color-palette').addEventListener('change', (e) => {
        state.palette = e.target.value;
        if (!state.animating) render();
    });

    // Preset pills
    document.getElementById('preset-pills').addEventListener('click', (e) => {
        const btn = e.target.closest('.preset-pill');
        if (!btn) return;
        document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        applyPreset(btn.dataset.preset);
    });

    // Equation field
    const eqInput = document.getElementById('equation');
    const eqStatus = document.getElementById('eq-status');
    eqInput.addEventListener('input', () => {
        state.equationStr = eqInput.value;
        if (!state.equationStr.trim()) {
            state.equationFn = null;
            eqInput.classList.remove('eq-error', 'eq-ok');
            eqStatus.textContent = '';
            if (!state.animating) render();
            return;
        }
        const fn = parseEquation(state.equationStr);
        if (fn === 'error') {
            state.equationFn = null;
            eqInput.classList.add('eq-error');
            eqInput.classList.remove('eq-ok');
            eqStatus.textContent = '✕';
        } else {
            state.equationFn = fn;
            eqInput.classList.add('eq-ok');
            eqInput.classList.remove('eq-error');
            eqStatus.textContent = '✓';
            if (!state.animating) render();
        }
    });

    // Action buttons
    document.getElementById('btn-generate').addEventListener('click', () => {
        stopAnimate();
        render();
    });

    document.getElementById('btn-randomize').addEventListener('click', () => {
        stopAnimate();
        randomize();
        showToast('🎲 Randomized!');
    });

    const btnAnimate = document.getElementById('btn-animate');
    btnAnimate.addEventListener('click', () => {
        if (state.animating) {
            stopAnimate();
            btnAnimate.classList.remove('is-animating');
            btnAnimate.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Animate`;
        } else {
            startAnimate();
            btnAnimate.classList.add('is-animating');
            btnAnimate.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
        }
    });

    document.getElementById('btn-export').addEventListener('click', exportPNG);

    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        stageToolbar.classList.add('visible');
        setTimeout(resizeCanvas, 360);
    });

    document.getElementById('expand-sidebar').addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        stageToolbar.classList.remove('visible');
        setTimeout(resizeCanvas, 360);
    });

    // Keyboard shortcut: G = generate, R = randomize, A = animate, E = export
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (e.key === 'g' || e.key === 'G') { stopAnimate(); render(); }
        if (e.key === 'r' || e.key === 'R') { stopAnimate(); randomize(); }
        if (e.key === 'a' || e.key === 'A') document.getElementById('btn-animate').click();
        if (e.key === 'e' || e.key === 'E') exportPNG();
    });

    // ── Mouse pan ────────────────────────────────────────────────
    const panHint = document.getElementById('pan-hint');
    let panHintHidden = false;

    function onDragStart(cx, cy) {
        state.dragging = true;
        state.dragStartX = cx;
        state.dragStartY = cy;
        state.panStartX = state.panX;
        state.panStartY = state.panY;
        canvas.classList.add('dragging');
        if (!panHintHidden) {
            panHintHidden = true;
            panHint.classList.add('hidden');
        }
    }

    function onDragMove(cx, cy) {
        if (!state.dragging) return;
        state.panX = state.panStartX + (cx - state.dragStartX);
        state.panY = state.panStartY + (cy - state.dragStartY);
        if (!state.animating) render();
    }

    function onDragEnd() {
        state.dragging = false;
        canvas.classList.remove('dragging');
    }

    // Mouse
    canvas.addEventListener('mousedown', (e) => onDragStart(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup', onDragEnd);
    canvas.addEventListener('mouseleave', onDragEnd);

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    canvas.addEventListener('touchend', onDragEnd);

    // Double-click to reset pan
    canvas.addEventListener('dblclick', () => {
        state.panX = 0;
        state.panY = 0;
        if (!state.animating) render();
        showToast('↩ Pan reset');
    });

    // Keyboard: Escape resets pan
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (state.panX !== 0 || state.panY !== 0)) {
            state.panX = 0;
            state.panY = 0;
            if (!state.animating) render();
        }
    });

    // ── Resize ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(document.getElementById('stage'));

    // Initial render
    syncUIFromState();
    resizeCanvas();
}

document.addEventListener('DOMContentLoaded', init);
