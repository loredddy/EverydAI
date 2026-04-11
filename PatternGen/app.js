/* ──────────────────────────────────────────────────────────────
   Audio Visualizer Hub — app.js
   EverydAI · Full 3D Camera + Trippy Visualizers
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
    psychedelic: (t) => `hsl(${(Math.abs(t) * 720 + animOffsetGlobal * 60) % 360},100%,${50 + Math.sin(t * 10) * 20}%)`,
};

// ── Preset configs ────────────────────────────────────────────
const PRESETS = {
    abstract: { bgAlpha: 0.06, neonGlow: false, bgColor: '#09100a' },
    minimal: { bgAlpha: 0.12, neonGlow: false, bgColor: '#0a110a' },
    neon: { bgAlpha: 0.04, neonGlow: true, bgColor: '#04040e' },
};

// ── Data Smoothers ───────────────────────────────────────
let smoothedData = new Float32Array(256);
let bassSmooth = 0;
let particles = [];
let animOffsetGlobal = 0;

// ══════════════════════════════════════════════════════════════
//  3D CAMERA SYSTEM (matplotlib-style orbit camera)
// ══════════════════════════════════════════════════════════════
const camera = {
    azimuth: 0.4,      // horizontal orbit angle (radians)
    elevation: 0.5,    // vertical orbit angle (radians)
    distance: 600,     // distance from origin (zoom)
    fov: 500,          // field of view (perspective strength)
    minDist: 150,
    maxDist: 2000,
};

/**
 * Project a 3D world point (x, y, z) to 2D screen coords.
 * Camera orbits around origin at (azimuth, elevation, distance).
 * Returns { sx, sy, depth } or null if behind camera.
 */
function project3D(x, y, z, W, H) {
    const cosA = Math.cos(camera.azimuth);
    const sinA = Math.sin(camera.azimuth);
    const cosE = Math.cos(camera.elevation);
    const sinE = Math.sin(camera.elevation);

    // Rotate around Y axis (azimuth)
    const x1 = x * cosA - z * sinA;
    const z1 = x * sinA + z * cosA;
    const y1 = y;

    // Rotate around X axis (elevation)
    const y2 = y1 * cosE - z1 * sinE;
    const z2 = y1 * sinE + z1 * cosE;
    const x2 = x1;

    // Translate by camera distance (camera is at distance along Z)
    const z3 = z2 + camera.distance;

    if (z3 <= 10) return null; // behind camera

    const scale = camera.fov / z3;
    const sx = W / 2 + x2 * scale;
    const sy = H / 2 - y2 * scale;

    return { sx, sy, depth: z3, scale };
}

/** Draw a 3D line segment */
function line3D(ctx, x1, y1, z1, x2, y2, z2, W, H) {
    const a = project3D(x1, y1, z1, W, H);
    const b = project3D(x2, y2, z2, W, H);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
}

// ── Visualizer Engines (TRUE 3D) ──────────────────────────────
const VISUALIZERS = {

    // ═══════ Pulse Ring — orbiting 3D ring ═══════
    pulse_ring(ctx, W, H, dataArray, colorFn, params) {
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const baseRadius = 120 + beatDrop * 0.4;

        if (!dataArray || dataArray.length === 0) {
            // Static ring
            const numPts = 80;
            for (let i = 0; i < numPts; i++) {
                const a1 = (i / numPts) * Math.PI * 2;
                const a2 = ((i + 1) / numPts) * Math.PI * 2;
                ctx.strokeStyle = colorFn(i / numPts + animOffsetGlobal * 0.1);
                ctx.lineWidth = params.lineWeight * 2;
                line3D(ctx,
                    Math.cos(a1) * baseRadius, 0, Math.sin(a1) * baseRadius,
                    Math.cos(a2) * baseRadius, 0, Math.sin(a2) * baseRadius,
                    W, H);
            }
            return;
        }

        const numBars = 120;
        const angleStep = (Math.PI * 2) / numBars;

        // Draw the ring with frequency spikes going outward in 3D
        for (let i = 0; i < numBars; i++) {
            const mirroredIndex = i > numBars / 2 ? numBars - i : i;
            const dataIndex = Math.floor((mirroredIndex / (numBars / 2)) * 80);
            const val = dataArray[dataIndex] || 0;
            smoothedData[i] += (val - smoothedData[i]) * 0.2;
            const boost = (dataIndex < 10) ? params.bassBoost : 1;
            const amp = smoothedData[i] * params.sensitivity * boost * 0.8;

            const angle = i * angleStep;
            const x1 = Math.cos(angle) * baseRadius;
            const z1 = Math.sin(angle) * baseRadius;
            const x2 = Math.cos(angle) * (baseRadius + amp);
            const z2 = Math.sin(angle) * (baseRadius + amp);

            // Add vertical oscillation for trippiness
            const yOsc = Math.sin(angle * 3 + animOffsetGlobal * 3) * amp * 0.3;

            ctx.strokeStyle = colorFn(i / numBars + animOffsetGlobal * 0.05);
            ctx.lineWidth = Math.max(2, params.lineWeight * 2);
            ctx.globalAlpha = params.opacity;
            line3D(ctx, x1, yOsc * 0.3, z1, x2, yOsc, z2, W, H);
        }

        // Inner pulsing circle at different height
        const innerR = baseRadius * 0.4;
        const numPts = 60;
        for (let i = 0; i < numPts; i++) {
            const a1 = (i / numPts) * Math.PI * 2;
            const a2 = ((i + 1) / numPts) * Math.PI * 2;
            const yOff = Math.sin(animOffsetGlobal * 2) * 30;
            ctx.strokeStyle = colorFn(i / numPts + 0.5);
            ctx.lineWidth = params.lineWeight;
            ctx.globalAlpha = params.opacity * 0.6;
            line3D(ctx,
                Math.cos(a1) * innerR, yOff, Math.sin(a1) * innerR,
                Math.cos(a2) * innerR, yOff, Math.sin(a2) * innerR,
                W, H);
        }
    },

    // ═══════ Sonic Wave — 3D waveform ribbon ═══════
    sonic_wave(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const numBars = Math.min(dataArray.length, 100);
        const spread = 400;

        // Draw multiple wave layers at different depths for trippy depth
        for (let layer = 0; layer < 5; layer++) {
            const zOff = (layer - 2) * 80;
            const phaseOff = layer * 0.4 + animOffsetGlobal * 1.5;

            for (let i = 0; i < numBars - 1; i++) {
                const val = dataArray[i] || 0;
                smoothedData[i] += (val - smoothedData[i]) * 0.3;
                const boost = (i < 10) ? params.bassBoost : 1;
                const amp = smoothedData[i] * params.sensitivity * boost * 0.5;

                const x1 = (i / numBars - 0.5) * spread;
                const x2 = ((i + 1) / numBars - 0.5) * spread;
                const y1 = amp * Math.sin(i * 0.3 + phaseOff);
                const y2 = (dataArray[i + 1] || 0) * params.sensitivity * boost * 0.5 * Math.sin((i + 1) * 0.3 + phaseOff);

                ctx.strokeStyle = colorFn(i / numBars + layer * 0.15);
                ctx.lineWidth = params.lineWeight * (1 + layer * 0.3);
                ctx.globalAlpha = params.opacity * (1 - layer * 0.15);
                line3D(ctx, x1, y1, zOff, x2, y2, zOff, W, H);
            }
        }
    },

    // ═══════ Bass Core — 3D geometry that pulses ═══════
    bass_core(ctx, W, H, dataArray, colorFn, params) {
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const scale = 1 + (beatDrop / 500);
        const r = 100 * scale;

        // Spawn 3D particles
        if (beatDrop > 100 && Math.random() > 0.5) {
            for (let p = 0; p < 4; p++) {
                const a = Math.random() * Math.PI * 2;
                const e = (Math.random() - 0.5) * Math.PI;
                particles.push({
                    x: 0, y: 0, z: 0,
                    vx: Math.cos(a) * Math.cos(e) * 6 * scale,
                    vy: Math.sin(e) * 6 * scale,
                    vz: Math.sin(a) * Math.cos(e) * 6 * scale,
                    life: 1.0,
                    color: colorFn(Math.random())
                });
            }
        }

        // Update & Draw 3D Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy; p.z += p.vz;
            p.life -= 0.012;
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                const proj = project3D(p.x, p.y, p.z, W, H);
                if (proj) {
                    ctx.beginPath();
                    ctx.arc(proj.sx, proj.sy, Math.max(1, p.life * 4 * proj.scale * 0.15), 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life * params.opacity;
                    ctx.fill();
                }
            }
        }

        ctx.globalAlpha = params.opacity;

        // 3D rotating hexagon
        const n = 6;
        const rot = animOffsetGlobal * 0.5;
        for (let i = 0; i < n; i++) {
            const a1 = (i / n) * Math.PI * 2 + rot;
            const a2 = ((i + 1) / n) * Math.PI * 2 + rot;
            ctx.strokeStyle = colorFn(bassSmooth / 255 + i / n);
            ctx.lineWidth = params.lineWeight * 3;
            line3D(ctx,
                Math.cos(a1) * r, 0, Math.sin(a1) * r,
                Math.cos(a2) * r, 0, Math.sin(a2) * r,
                W, H);
        }

        // Inner 3D triangle at a different Y level
        const innerR = r * 0.4;
        const yOff = Math.sin(animOffsetGlobal) * 40;
        for (let i = 0; i < 3; i++) {
            const a1 = (i / 3) * Math.PI * 2 + rot * 1.5;
            const a2 = ((i + 1) / 3) * Math.PI * 2 + rot * 1.5;
            ctx.strokeStyle = colorFn((bassSmooth / 255) + 0.5);
            ctx.lineWidth = params.lineWeight * 2;
            line3D(ctx,
                Math.cos(a1) * innerR, yOff, Math.sin(a1) * innerR,
                Math.cos(a2) * innerR, yOff, Math.sin(a2) * innerR,
                W, H);
        }

        // Vertical pillars connecting hex to triangle
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + rot;
            ctx.strokeStyle = colorFn(i / 3);
            ctx.lineWidth = params.lineWeight;
            ctx.globalAlpha = params.opacity * 0.4;
            line3D(ctx,
                Math.cos(a) * r, 0, Math.sin(a) * r,
                Math.cos(a + rot * 0.5) * innerR, yOff, Math.sin(a + rot * 0.5) * innerR,
                W, H);
        }
    },

    // ═══════ Stardust Vortex — 3D spiraling galaxy ═══════
    stardust_vortex(ctx, W, H, dataArray, colorFn, params) {
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const scale = 1 + (beatDrop / 400);

        // Spawn particles in spiral pattern
        if (beatDrop > 30 && Math.random() > 0.3) {
            for (let p = 0; p < 5; p++) {
                const angle = Math.random() * Math.PI * 2;
                const elevation = (Math.random() - 0.5) * 0.5;
                const dist = 20 + Math.random() * 30;
                particles.push({
                    x: Math.cos(angle) * dist,
                    y: Math.sin(elevation) * dist * 0.3,
                    z: Math.sin(angle) * dist,
                    vx: Math.cos(angle) * 1.5 * scale,
                    vy: (Math.random() - 0.5) * 1.5,
                    vz: Math.sin(angle) * 1.5 * scale,
                    angle: angle,
                    spin: (Math.random() - 0.5) * 0.08,
                    life: 1.0,
                    color: colorFn(Math.random())
                });
            }
        }

        // Update & Draw 3D spiraling particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];

            // Spiral motion
            p.angle += p.spin || 0.03;
            const dist = Math.sqrt(p.x * p.x + p.z * p.z);
            p.vx = Math.cos(p.angle) * (1 + dist * 0.005) * scale;
            p.vz = Math.sin(p.angle) * (1 + dist * 0.005) * scale;
            p.vy *= 0.98;

            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.life -= 0.005;

            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                const proj = project3D(p.x, p.y, p.z, W, H);
                if (proj) {
                    const size = Math.max(1, p.life * 5 * proj.scale * 0.12);
                    ctx.beginPath();
                    ctx.arc(proj.sx, proj.sy, size, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life * params.opacity;
                    ctx.fill();

                    // Glow trail
                    if (p.life > 0.3) {
                        ctx.beginPath();
                        ctx.arc(proj.sx, proj.sy, size * 3, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = p.life * params.opacity * 0.1;
                        ctx.fill();
                    }
                }
            }
        }

        // Central axis lines for reference
        ctx.globalAlpha = params.opacity * 0.15;
        ctx.strokeStyle = colorFn(0.5);
        ctx.lineWidth = 1;
        line3D(ctx, -200, 0, 0, 200, 0, 0, W, H);
        line3D(ctx, 0, -200, 0, 0, 200, 0, W, H);
        line3D(ctx, 0, 0, -200, 0, 0, 200, W, H);
    },

    // ═══════ Quantum Grid — true 3D surface mesh ═══════
    quantum_grid(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const gridSize = 15;
        const spacing = 25;
        const halfGrid = gridSize / 2;

        ctx.lineWidth = params.lineWeight;

        // Build height values from audio data
        for (let gx = -halfGrid; gx <= halfGrid; gx++) {
            for (let gz = -halfGrid; gz <= halfGrid; gz++) {
                const i = Math.floor((Math.abs(gx * 3 + gz * 7) + 1) % dataArray.length);
                const val = dataArray[i] || 0;
                smoothedData[i] += (val - smoothedData[i]) * 0.2;

                const boost = (i < 10) ? params.bassBoost : 1;
                const amp = smoothedData[i] * params.sensitivity * boost * 0.4;

                // Height = audio amplitude + sine wave for trippy terrain
                const wx = gx * spacing;
                const wz = gz * spacing;
                const terrainWave = Math.sin(gx * 0.5 + animOffsetGlobal * 2) *
                    Math.cos(gz * 0.5 + animOffsetGlobal * 1.5) * 30;
                const wy = amp + terrainWave;

                // Draw grid lines
                if (gx < halfGrid) {
                    const ni = Math.floor((Math.abs((gx + 1) * 3 + gz * 7) + 1) % dataArray.length);
                    const nval = dataArray[ni] || 0;
                    smoothedData[ni] += (nval - smoothedData[ni]) * 0.2;
                    const nboost = (ni < 10) ? params.bassBoost : 1;
                    const namp = smoothedData[ni] * params.sensitivity * nboost * 0.4;
                    const nTerrainWave = Math.sin((gx + 1) * 0.5 + animOffsetGlobal * 2) *
                        Math.cos(gz * 0.5 + animOffsetGlobal * 1.5) * 30;
                    const nx = (gx + 1) * spacing;
                    const ny = namp + nTerrainWave;

                    const distFromCenter = Math.sqrt(gx * gx + gz * gz) / halfGrid;
                    ctx.strokeStyle = colorFn((gx + halfGrid) / gridSize + animOffsetGlobal * 0.05);
                    ctx.globalAlpha = params.opacity * Math.max(0.1, 1 - distFromCenter * 0.6);
                    line3D(ctx, wx, wy, wz, nx, ny, wz, W, H);
                }
                if (gz < halfGrid) {
                    const ni = Math.floor((Math.abs(gx * 3 + (gz + 1) * 7) + 1) % dataArray.length);
                    const nval = dataArray[ni] || 0;
                    smoothedData[ni] += (nval - smoothedData[ni]) * 0.2;
                    const nboost = (ni < 10) ? params.bassBoost : 1;
                    const namp = smoothedData[ni] * params.sensitivity * nboost * 0.4;
                    const nTerrainWave = Math.sin(gx * 0.5 + animOffsetGlobal * 2) *
                        Math.cos((gz + 1) * 0.5 + animOffsetGlobal * 1.5) * 30;
                    const nz = (gz + 1) * spacing;
                    const ny = namp + nTerrainWave;

                    const distFromCenter = Math.sqrt(gx * gx + gz * gz) / halfGrid;
                    ctx.strokeStyle = colorFn((gz + halfGrid) / gridSize + animOffsetGlobal * 0.05);
                    ctx.globalAlpha = params.opacity * Math.max(0.1, 1 - distFromCenter * 0.6);
                    line3D(ctx, wx, wy, wz, wx, ny, nz, W, H);
                }
            }
        }
    },

    // ═══════ Neon Threads — 3D tentacles from origin ═══════
    neon_threads(ctx, W, H, dataArray, colorFn, params) {
        if (!dataArray || dataArray.length === 0) return;

        const numThreads = 12;
        const segments = 25;
        const maxReach = 250;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let t = 0; t < numThreads; t++) {
            const baseAngle = (t / numThreads) * Math.PI * 2;
            const baseElevation = Math.sin(t * 1.7) * 0.5;

            let prevProj = project3D(0, 0, 0, W, H);
            if (!prevProj) continue;

            for (let s = 1; s <= segments; s++) {
                const i = ((t * segments + s) * 2) % dataArray.length;
                const val = dataArray[i] || 0;
                smoothedData[i] += (val - smoothedData[i]) * 0.25;

                const boost = (i < 15) ? params.bassBoost : 1;
                const amp = smoothedData[i] * params.sensitivity * boost * 0.003;

                const reach = (s / segments) * maxReach;
                const wobble = Math.sin(s * 0.8 + animOffsetGlobal * 3 + t) * amp * reach;
                const yWobble = Math.cos(s * 0.6 + animOffsetGlobal * 2.5 + t * 0.7) * amp * reach;

                const angle = baseAngle + wobble;
                const elev = baseElevation + yWobble * 0.5;

                const x = Math.cos(angle) * Math.cos(elev) * reach;
                const y = Math.sin(elev) * reach + Math.sin(s * 0.3 + animOffsetGlobal) * 20;
                const z = Math.sin(angle) * Math.cos(elev) * reach;

                const proj = project3D(x, y, z, W, H);
                if (proj && prevProj) {
                    ctx.beginPath();
                    ctx.moveTo(prevProj.sx, prevProj.sy);
                    ctx.lineTo(proj.sx, proj.sy);
                    ctx.lineWidth = params.lineWeight * (1.5 + (1 - s / segments) * 2);
                    ctx.strokeStyle = colorFn(t / numThreads + s / segments * 0.3);
                    ctx.globalAlpha = params.opacity * (1 - (s / segments) * 0.3);
                    ctx.stroke();
                }
                prevProj = proj;
            }
        }
    },

    // ═══════ Fractal Destruction — shape shatters with loud music, rebuilds in silence ═══════
    fractal_destruction(ctx, W, H, dataArray, colorFn, params) {
        const beatDrop = bassSmooth * params.bassBoost * params.sensitivity;
        const intensity = Math.min(beatDrop / 180, 1); // 0 = silence, 1 = full destruction

        // Build an icosphere of triangular faces if not yet built
        if (!VISUALIZERS._fractalShards || VISUALIZERS._fractalShards.length === 0) {
            VISUALIZERS._fractalShards = [];
            const phi = (1 + Math.sqrt(5)) / 2;
            // Icosahedron vertices
            const verts = [
                [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
                [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
                [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
            ].map(v => {
                const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
                return [v[0] / len * 120, v[1] / len * 120, v[2] / len * 120];
            });

            const faces = [
                [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
                [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
                [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
                [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
            ];

            // Subdivide each face once for more shards
            const subdivide = (v0, v1, v2) => {
                const mid = (a, b) => {
                    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
                    const len = Math.sqrt(m[0] ** 2 + m[1] ** 2 + m[2] ** 2);
                    return [m[0] / len * 120, m[1] / len * 120, m[2] / len * 120];
                };
                const a = mid(v0, v1), b = mid(v1, v2), c = mid(v0, v2);
                return [[v0, a, c], [a, v1, b], [c, b, v2], [a, b, c]];
            };

            for (const f of faces) {
                const subFaces = subdivide(verts[f[0]], verts[f[1]], verts[f[2]]);
                for (const sf of subFaces) {
                    // Center of the triangle
                    const cx = (sf[0][0] + sf[1][0] + sf[2][0]) / 3;
                    const cy = (sf[0][1] + sf[1][1] + sf[2][1]) / 3;
                    const cz = (sf[0][2] + sf[1][2] + sf[2][2]) / 3;
                    // Direction outward from center
                    const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
                    VISUALIZERS._fractalShards.push({
                        verts: sf.map(v => [...v]),      // home position
                        home: sf.map(v => [...v]),
                        dirX: cx / cLen, dirY: cy / cLen, dirZ: cz / cLen,
                        offset: [0, 0, 0],                // current displacement
                        velOffset: [0, 0, 0],
                        rotAngle: 0, rotVel: 0,
                        colorT: Math.random(),
                    });
                }
            }
        }

        const shards = VISUALIZERS._fractalShards;
        const rot = animOffsetGlobal * 0.3; // slow auto-rotation for coolness

        for (let si = 0; si < shards.length; si++) {
            const s = shards[si];

            // Target displacement: loud = fly outward, quiet = return home
            const explodeDist = intensity * (250 + Math.sin(si * 0.7) * 100);
            const targetX = s.dirX * explodeDist;
            const targetY = s.dirY * explodeDist;
            const targetZ = s.dirZ * explodeDist;

            // Spring physics: accelerate toward target, dampen
            const stiffness = intensity > 0.3 ? 0.08 : 0.03; // snappy explosion, gentle return
            const damping = 0.85;
            s.velOffset[0] += (targetX - s.offset[0]) * stiffness;
            s.velOffset[1] += (targetY - s.offset[1]) * stiffness;
            s.velOffset[2] += (targetZ - s.offset[2]) * stiffness;
            s.velOffset[0] *= damping;
            s.velOffset[1] *= damping;
            s.velOffset[2] *= damping;
            s.offset[0] += s.velOffset[0];
            s.offset[1] += s.velOffset[1];
            s.offset[2] += s.velOffset[2];

            // Tumble rotation when exploded
            s.rotVel += (intensity * 0.05 - s.rotAngle * 0.001);
            s.rotVel *= 0.95;
            s.rotAngle += s.rotVel;

            // Build actual vertex positions
            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);
            const cosT = Math.cos(s.rotAngle);
            const sinT = Math.sin(s.rotAngle);

            const projVerts = [];
            for (const v of s.home) {
                // Global y-axis rotation
                let x = v[0] * cosR - v[2] * sinR;
                let z = v[0] * sinR + v[2] * cosR;
                let y = v[1];

                // Apply per-shard displacement
                x += s.offset[0];
                y += s.offset[1];
                z += s.offset[2];

                // Per-shard tumble (around the shard's outward axis)
                if (intensity > 0.05) {
                    const localX = x - s.offset[0];
                    const localY = y - s.offset[1];
                    x = s.offset[0] + localX * cosT - localY * sinT;
                    y = s.offset[1] + localX * sinT + localY * cosT;
                }

                const p = project3D(x, y, z, W, H);
                projVerts.push(p);
            }

            if (projVerts[0] && projVerts[1] && projVerts[2]) {
                ctx.beginPath();
                ctx.moveTo(projVerts[0].sx, projVerts[0].sy);
                ctx.lineTo(projVerts[1].sx, projVerts[1].sy);
                ctx.lineTo(projVerts[2].sx, projVerts[2].sy);
                ctx.closePath();

                const dist = Math.sqrt(s.offset[0] ** 2 + s.offset[1] ** 2 + s.offset[2] ** 2);
                const glow = Math.min(1, dist / 200);

                ctx.strokeStyle = colorFn(s.colorT + animOffsetGlobal * 0.05);
                ctx.lineWidth = params.lineWeight * (1 + glow);
                ctx.globalAlpha = params.opacity * (0.4 + glow * 0.6);
                ctx.stroke();

                // Fill with faint color when exploded for visual mass
                if (glow > 0.2) {
                    ctx.fillStyle = colorFn(s.colorT + 0.3);
                    ctx.globalAlpha = params.opacity * glow * 0.15;
                    ctx.fill();
                }
            }
        }
    },
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
};

// ──────────────────────────────────────────────────────────────
//  DOM REFS
// ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('pattern-canvas');
const ctx2d = canvas.getContext('2d');
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
    ctx2d.scale(dpr, dpr);
    // Remove any lingering CSS transforms from old approach
    canvas.style.transform = '';
    render();
}

// ──────────────────────────────────────────────────────────────
//  RENDER
// ──────────────────────────────────────────────────────────────
function render(timestamp = 0) {
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    animOffsetGlobal += 0.016;

    const preset = PRESETS[state.preset] || PRESETS.abstract;
    const colorFn = PALETTES[state.palette] || PALETTES.spectrum;
    const renderer = VISUALIZERS[state.visualizerStyle];

    // Background fade (trippy trails with low alpha)
    ctx2d.save();
    ctx2d.fillStyle = preset.bgColor;
    ctx2d.globalAlpha = state.animating || state.audioReactive ? preset.bgAlpha : 1;
    ctx2d.fillRect(0, 0, W, H);
    ctx2d.restore();

    // Neon glow
    if (preset.neonGlow) {
        ctx2d.shadowColor = PALETTES.neon(animOffsetGlobal % 1);
        ctx2d.shadowBlur = 18;
    } else {
        ctx2d.shadowBlur = 0;
    }

    // Audio capture
    if (state.audioReactive && state.analyser && state.dataArray) {
        state.analyser.getByteFrequencyData(state.dataArray);
        let sum = 0;
        const limit = Math.min(10, state.dataArray.length);
        for (let i = 0; i < limit; i++) sum += state.dataArray[i];
        const rawBass = sum / limit;
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

    ctx2d.save();
    ctx2d.globalAlpha = state.opacity;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';

    if (renderer) {
        renderer(ctx2d, W, H, state.dataArray, colorFn, params);
    }

    ctx2d.restore();

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

    // ──────────────────────────────────────────────────────────
    //  3D CAMERA CONTROLS (mouse orbit + scroll zoom)
    // ──────────────────────────────────────────────────────────
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

    // Orbit: drag to rotate camera around origin
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            camera.azimuth += deltaX * 0.008;
            camera.elevation += deltaY * 0.008;

            // Clamp elevation to avoid flipping
            camera.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camera.elevation));

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            if (!state.animating && !state.audioReactive) render();
        }
    });

    // Zoom: scroll to move closer or further from origin
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.distance += e.deltaY * 0.8;
        camera.distance = Math.max(camera.minDist, Math.min(camera.maxDist, camera.distance));
        if (!state.animating && !state.audioReactive) render();
    }, { passive: false });

    // Double-click to reset camera
    canvas.addEventListener('dblclick', () => {
        camera.azimuth = 0.4;
        camera.elevation = 0.5;
        camera.distance = 600;
        if (!state.animating && !state.audioReactive) render();
    });

    // Touch support for mobile
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastMouseX;
            const dy = e.touches[0].clientY - lastMouseY;
            camera.azimuth += dx * 0.008;
            camera.elevation += dy * 0.008;
            camera.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camera.elevation));
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
            if (!state.animating && !state.audioReactive) render();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            camera.distance -= (dist - lastTouchDist) * 1.5;
            camera.distance = Math.max(camera.minDist, Math.min(camera.maxDist, camera.distance));
            lastTouchDist = dist;
            if (!state.animating && !state.audioReactive) render();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Selects
    const visSelect = document.getElementById('visualizer-style');
    if (visSelect) {
        visSelect.addEventListener('change', (e) => {
            state.visualizerStyle = e.target.value;
            particles = [];
            smoothedData = new Float32Array(256);
            if (VISUALIZERS._fractalShards) VISUALIZERS._fractalShards = [];
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

                    analyser.fftSize = 512;
                    analyser.smoothingTimeConstant = state.smoothing;

                    state.audioCtx = audioCtx;
                    state.analyser = analyser;
                    state.dataArray = new Uint8Array(analyser.frequencyBinCount);

                    showToast('🎤 Visualizer tracking enabled');
                    render();
                } catch (err) {
                    console.error("Audio init error", err);
                    state.audioReactive = false;
                    e.target.checked = false;
                    showToast('✕ Microphone access denied');
                }
            } else {
                if (state.stream) state.stream.getTracks().forEach(t => t.stop());
                if (state.audioCtx) state.audioCtx.close();
                bassSmooth = 0;
                showToast('🔇 Visualizer tracking disabled');
            }
        });
    }

    // Preset pills
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
        btnGen.addEventListener('click', () => {
            state.animating = true;
            if (!state.animFrame) render();
            setTimeout(() => { if (!state.audioReactive) state.animating = false; }, 2000);
            showToast('▶ Preview running');
        });
    }

    const btnRandomize = document.getElementById('btn-randomize');
    if (btnRandomize && colSelect && visSelect) {
        btnRandomize.addEventListener('click', () => {
            const styles = ['pulse_ring', 'sonic_wave', 'bass_core', 'stardust_vortex', 'quantum_grid', 'neon_threads', 'fractal_destruction'];
            const palettes = Object.keys(PALETTES);
            state.visualizerStyle = styles[Math.floor(Math.random() * styles.length)];
            state.palette = palettes[Math.floor(Math.random() * palettes.length)];

            visSelect.value = state.visualizerStyle;
            colSelect.value = state.palette;
            const el = document.getElementById('active-pattern-label');
            if (el) el.textContent = visSelect.options[visSelect.selectedIndex].text;

            // Randomize camera angle for extra trip
            camera.azimuth = Math.random() * Math.PI * 2;
            camera.elevation = (Math.random() - 0.5) * 1.2;

            particles = [];
            showToast('🎲 Randomized!');
            if (!state.animating && !state.audioReactive) render();
        });
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', exportPNG);

    // ──────────────────────────────────────────────────────────
    //  AUTO-HIDE SIDEBAR
    // ──────────────────────────────────────────────────────────
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
