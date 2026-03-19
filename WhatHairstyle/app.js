const videoElement = document.getElementById('input_video');
const imageElement = document.getElementById('input_image');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const btnToggleCamera = document.getElementById('btn_toggle_camera');
const cameraBtnText = document.getElementById('camera_btn_text');
const btnUploadImage = document.getElementById('btn_upload_image');

const loadingOverlay = document.getElementById('loading_overlay');
const loadingText = document.getElementById('loading_text');
const viewport = document.getElementById('input_video').parentElement; // FIX: using parent container instead of missing viewport id

// UI Elements for Results
const resultShapeName = document.getElementById('result_shape_name');
const resultGenderName = document.getElementById('result_gender_name');
const resultGenderProb = document.getElementById('result_gender_prob');
const resultShapeDesc = document.getElementById('result_shape_desc');
const statusDot = document.getElementById('status_dot');
const statusText = document.getElementById('status_text');
const btnToggleMetrics = document.getElementById('btn_toggle_metrics');
const detailedMetrics = document.getElementById('detailed_metrics');

const metricLength = document.getElementById('metric_length');
const metricWidth = document.getElementById('metric_width');
const metricJaw = document.getElementById('metric_jaw');
const metricForehead = document.getElementById('metric_forehead');

const recommendationsContainer = document.getElementById('recommendations_container');
const hairstylesList = document.getElementById('hairstyles_list');
const resultsPanel = document.getElementById('results_panel');

let isCameraRunning = false;
let camera = null;
let mode = 'idle'; // 'idle', 'camera', 'image'
let currentGender = 'unknown'; // 'male', 'female', 'unknown'
let currentShape = 'Unknown';
let modelsLoaded = false;

// Metrics Toggle Logic
let metricsVisible = false;
btnToggleMetrics.addEventListener('click', () => {
    metricsVisible = !metricsVisible;
    detailedMetrics.classList.toggle('hidden', !metricsVisible);
    detailedMetrics.classList.toggle('grid', metricsVisible);
    btnToggleMetrics.innerHTML = metricsVisible
        ? '<span>Hide Raw Data</span><svg class="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>'
        : '<span>Show Raw Data</span><svg class="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
});

// Shape descriptions dictionary (Utilitarian)
const shapeDescriptions = {
    "Oval": "Balanced Y/X aspect ratio. Standard contour matching.",
    "Round": "1:1 Y/X aspect ratio. Curved jawline and hairline.",
    "Square": "1:1 Y/X aspect ratio. Angular jawline matching forehead width.",
    "Heart": "Tapered Y axis. Forehead width > Jaw width.",
    "Oblong": "Y/X aspect ratio > 1.4. Extended vertical plane.",
    "Diamond": "Angular contour. Cheekbone width > Forehead and Jaw widths.",
    "Unknown": "Awaiting analysis data."
};

// Modern, Rugged Hairstyle Recommendations
const hairstyleRecommendations = {
    "female": {
        "Oval": [
            { name: "Blunt Bob", desc: "Structured baseline. Maintains natural symmetry." },
            { name: "Wolf Cut", desc: "Heavy texture. Shag layers with volume." },
            { name: "Curtain Fringe", desc: "Face-framing elements. Center parted." }
        ],
        "Round": [
            { name: "Long Layers", desc: "Vertical extension. Breaks circular symmetry." },
            { name: "Asymmetrical Lob", desc: "Sharp angles. Creates jawline definition." },
            { name: "Side-Swept Pixie", desc: "Volume mapping diverted from center axis." }
        ],
        "Square": [
            { name: "Wavy Shag", desc: "Softened perimeter. Contrasts harsh jawline." },
            { name: "Wispy Bangs", desc: "Lightweight texture across forehead." },
            { name: "Softened Lob", desc: "Collarbone length. Diffuses sharp angles." }
        ],
        "Heart": [
            { name: "Bouncy Bob", desc: "Volume concentrated at jawline to balance width." },
            { name: "Deep Side Part", desc: "Asymmetry to break wide forehead measurements." },
            { name: "Modern Mullet", desc: "Edge focused. Narrow sides, heavy back." }
        ],
        "Oblong": [
            { name: "Fringe Bob", desc: "Horizontal bisection. Reduces visual Y-axis." },
            { name: "Wide Waves", desc: "Volume expanded on X-axis." },
            { name: "Textured Crop", desc: "Minimal top height. Focus on perimeter." }
        ],
        "Diamond": [
            { name: "Face-Framing Shag", desc: "Softens wide cheekbones. Narrow perimeter." },
            { name: "Textured Lob", desc: "Adds necessary width near chin coordinates." },
            { name: "Wispy Layered Pixie", desc: "Focused top texture. Tapered sides." }
        ]
    },
    "male": {
        "Oval": [
            { name: "Modern Quiff", desc: "Clean perimeter. Structured top elevation." },
            { name: "Textured Fringe", desc: "Forward styled. Matte finish." },
            { name: "Taper Fade", desc: "Standard tight sides. Natural top." }
        ],
        "Round": [
            { name: "High Skin Fade", desc: "Zero sides. Maximizes vertical illusion." },
            { name: "Faux Hawk", desc: "Center peaked volume. Angular styling." },
            { name: "Hard Part", desc: "Sharp asymmetry created via razor line." }
        ],
        "Square": [
            { name: "Buzz Cut", desc: "Uniform length. Exposes natural angularity." },
            { name: "French Crop", desc: "Blunt fringe. Tight sides. High contrast." },
            { name: "Slick Back Fade", desc: "Heavy pomade finish. Vintage structure." }
        ],
        "Heart": [
            { name: "Messy Fringe", desc: "Conceals wide forehead measurements." },
            { name: "Mid Fade Swept", desc: "Medium sides. Avoids extreme top volume." },
            { name: "Classic Pompadour", desc: "Structured curve. Balanced proportions." }
        ],
        "Oblong": [
            { name: "Crew Cut", desc: "Standard military specification. No top height." },
            { name: "Low Taper Side Part", desc: "Classic separation. Keeps sides filled." },
            { name: "Angular Fringe", desc: "Forward sweeping texture. Low elevation." }
        ],
        "Diamond": [
            { name: "Textured Crop", desc: "Heavy top weight. Forward motion." },
            { name: "Messy Quiff", desc: "Unstructured height. Softens sharp cheekbones." },
            { name: "Modern Mullet", desc: "Tight sides. Heavy weight line at back." }
        ]
    }
};

// Face-API Initialization
async function initializeFaceAPI() {
    if (modelsLoaded) return;
    updateStatus('analyzing', 'LOADING MODELS [FACE-API]...');
    showLoading('SYS INIT...');

    try {
        // Load weights directly from CDN to bypass local CORS/Download issues entirely
        await faceapi.nets.ssdMobilenetv1.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        await faceapi.nets.ageGenderNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        modelsLoaded = true;
        updateStatus('idle', 'MODELS LOADED. AWAITING INPUT.');
        hideLoading();
    } catch (e) {
        console.error("Model load error", e);
        updateStatus('error', 'MODEL LOAD FAILED. CHECK NETWORK.');
        hideLoading();
    }
}

function showLoading(text) {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    loadingOverlay.classList.remove('flex');
}

function updateStatus(state, msg) {
    statusText.textContent = msg;
    if (state === 'success') {
        statusDot.className = 'w-3 h-3 bg-green-500 rounded-full';
        viewport.classList.remove('border-off-white');
    } else if (state === 'analyzing') {
        statusDot.className = 'w-3 h-3 bg-yellow-500 rounded-full animate-pulse';
        viewport.classList.add('border-off-white');
    } else if (state === 'error') {
        statusDot.className = 'w-3 h-3 bg-red-500 rounded-full';
        viewport.classList.remove('border-off-white');
    } else {
        statusDot.className = 'w-3 h-3 bg-gray-500 rounded-full';
        viewport.classList.remove('border-off-white');
    }
}

// Math Utility
function calculateDistance2D(point1, point2, w, h) {
    const dx = (point1.x - point2.x) * w;
    const dy = (point1.y - point2.y) * h;
    return Math.sqrt(dx * dx + dy * dy);
}

// MediaPipe Face Mesh Init - Optimized
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

faceMesh.onResults(onResults);

function getHairstyleVector(name, gender) {
    const n = name.toLowerCase();

    // Clean, perfectly matching line-art base (U-shape face + ears)
    const baseGroup = `
        <g stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <!-- U-shaped jawline -->
            <path d="M 28,45 Q 28,80 50,85 Q 72,80 72,45" />
            <!-- Ears -->
            <path d="M 28,50 C 18,50 18,65 28,62" />
            <path d="M 72,50 C 82,50 82,65 72,62" />
    `;

    let hairPaths = "";

    if (gender === 'female') {
        if (n.includes('bob') || n.includes('lob')) {
            // Elegant Bob
            hairPaths = `
                <path d="M 28,45 C 20,40 15,20 50,15 C 85,20 80,40 72,45" />
                <path d="M 28,45 C 18,55 25,75 35,75 M 72,45 C 82,55 75,75 65,75" />
                <!-- Part -->
                <path d="M 45,16 Q 40,25 35,35 M 55,16 Q 60,25 65,35" />
            `;
        } else if (n.includes('pixie')) {
            // Chic Pixie Cut
            hairPaths = `
                <path d="M 25,45 C 20,25 35,10 50,15 C 65,10 80,25 75,45" />
                <!-- sweeping layer -->
                <path d="M 35,35 Q 50,25 75,40" />
                <path d="M 25,40 Q 35,35 45,25" />
            `;
        } else if (n.includes('shag') || n.includes('wolf')) {
            // Textured Wolf Cut / Shag
            hairPaths = `
                <!-- messy outer -->
                <path d="M 25,45 C 15,30 20,15 50,10 C 80,15 85,30 75,45" />
                <path d="M 20,55 L 25,65 M 22,65 L 28,75 M 80,55 L 75,65 M 78,65 L 72,75" />
                <!-- face framing bangs -->
                <path d="M 28,40 Q 40,30 50,20 Q 60,30 72,40" />
            `;
        } else if (n.includes('fringe') || n.includes('bangs')) {
            // Straight with Bangs
            hairPaths = `
                <path d="M 50,15 C 15,15 15,40 18,90 M 50,15 C 85,15 85,40 82,90" />
                <!-- Bangs -->
                <path d="M 28,35 Q 50,45 72,35 M 35,36 L 35,22 M 50,39 L 50,20 M 65,36 L 65,22" />
            `;
        } else {
            // Elegant Long Waves
            hairPaths = `
                <path d="M 45,15 C 20,15 15,30 20,50 Q 25,60 18,75 Q 15,85 20,95" />
                <path d="M 45,15 Q 55,15 60,18 C 80,15 85,30 80,50 Q 75,60 82,75 Q 85,85 80,95" />
                <!-- Inner lines -->
                <path d="M 28,45 Q 15,60 25,80 M 72,45 Q 85,60 75,80" />
            `;
        }
    } else {
        if (n.includes('fade')) {
            // Clean Fade Cut (from image)
            hairPaths = `
                <!-- top mass -->
                <path d="M 25,40 C 20,25 35,15 50,15 C 65,15 80,25 75,40 C 75,45 60,40 50,38 C 40,40 25,45 25,40 Z" />
                <!-- sweep line -->
                <path d="M 35,35 Q 50,25 75,40" />
                <!-- side fade detail -->
                <path d="M 28,45 L 30,50 M 72,45 L 70,50" />
            `;
        } else if (n.includes('buzz') || n.includes('crew')) {
            // Buzz Cut (from image)
            hairPaths = `
                <!-- close crop -->
                <path d="M 25,45 C 25,20 75,20 75,45" />
                <path d="M 33,35 L 36,40 M 42,33 L 45,38 M 55,33 L 52,38 M 64,35 L 61,40 M 72,40 L 69,44 M 28,40 L 31,44" />
            `;
        } else if (n.includes('quiff') || n.includes('pompadour') || n.includes('hawk')) {
            // Pompadour / Quiff (from image)
            hairPaths = `
                <path d="M 25,40 C 20,15 40,5 50,10 C 60,15 75,20 75,40" />
                <!-- swooshes -->
                <path d="M 35,35 Q 40,25 55,20 M 45,40 Q 55,30 65,25 M 65,45 Q 70,40 75,40" />
                <path d="M 28,45 L 25,40 M 72,45 L 75,40" />
            `;
        } else if (n.includes('fringe') || n.includes('crop')) {
            // Messy / Spiky / Textured Crop (from image)
            hairPaths = `
                <!-- jagged outline -->
                <path d="M 22,45 L 28,35 L 22,25 L 35,18 L 45,10 L 55,18 L 65,12 L 75,22 L 70,35 L 78,45" />
                <!-- inner short spikes -->
                <path d="M 35,32 L 40,25 M 48,32 L 53,24 M 62,32 L 67,26 M 38,40 L 45,35 M 55,40 L 60,35" />
            `;
        } else if (n.includes('mullet') || n.includes('bun')) {
            // Man Bun / Mullet (from image)
            hairPaths = `
                <path d="M 25,45 C 25,25 40,15 50,15 C 60,15 75,25 75,45" />
                <path d="M 30,35 Q 45,25 50,15 M 40,40 Q 55,30 60,20 M 60,45 Q 65,30 70,25" />
                <!-- Bun -->
                <path d="M 40,15 Q 50,5 60,15" />
                <path d="M 45,10 Q 50,0 55,10" />
            `;
        } else {
            // Classic Short Hair / Side Part (from image)
            hairPaths = `
                <path d="M 25,45 C 20,20 40,10 55,15 C 65,20 75,30 75,45" />
                <!-- part -->
                <path d="M 55,15 C 45,25 35,30 28,35 M 65,22 Q 55,30 45,35 M 72,35 Q 65,38 58,40" />
            `;
        }
    }

    return `<svg viewBox="0 0 100 100" class="w-full h-full p-2">
        ${baseGroup}
        ${hairPaths}
        </g>
    </svg>`;
}

function updateHairstyles(shape, gender) {
    if (shape === "Unknown" || gender === "unknown") {
        recommendationsContainer.classList.add('hidden');
        hairstylesList.innerHTML = '';
        return;
    }

    recommendationsContainer.classList.remove('hidden');
    hairstylesList.innerHTML = '';

    // Fallback to male if detection is weak, but usually face-api sets male/female
    const genderKey = (gender === 'male' || gender === 'female') ? gender : 'male';

    const styles = hairstyleRecommendations[genderKey][shape] || [];
    styles.forEach((style, index) => {
        const svgIcon = getHairstyleVector(style.name, genderKey);
        // Minimalist layout for recommendations
        const cardHtml = `
            <div class="border-2 border-off-black p-4 bg-off-white hover:bg-gray-100 transition-colors flex flex-col sm:flex-row gap-4">
                <div class="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-off-black text-off-white flex items-center justify-center pointer-events-none">
                    ${svgIcon}
                </div>
                <div class="flex-1 flex flex-col justify-center gap-1">
                    <div class="flex flex-wrap lg:flex-nowrap justify-between items-start lg:items-center border-b-2 border-off-black pb-2 mb-2 gap-2">
                        <span class="font-black uppercase text-lg inline-block">${style.name}</span>
                        <span class="text-xs font-mono bg-off-black text-off-white px-2 py-1 uppercase tracking-widest shrink-0">Match 0${index + 1}</span>
                    </div>
                    <p class="text-sm font-medium text-gray-700 font-mono uppercase tracking-tight">${style.desc}</p>
                </div>
            </div>
        `;
        hairstylesList.insertAdjacentHTML('beforeend', cardHtml);
    });
}

async function analyzeFaceShapeAndGender(landmarks, sourceElement) {
    // Optical screen width and height
    const w = sourceElement.videoWidth || sourceElement.width || 640;
    const h = sourceElement.videoHeight || sourceElement.height || 480;

    // MediaPipe specific Landmark Indices - using pure 2D optical projection for face typing
    const faceLength = calculateDistance2D(landmarks[10], landmarks[152], w, h);
    const faceWidth = calculateDistance2D(landmarks[234], landmarks[454], w, h);
    const foreheadWidth = calculateDistance2D(landmarks[54], landmarks[284], w, h);
    const jawWidth = calculateDistance2D(landmarks[132], landmarks[361], w, h);

    // Update UI Metrics
    metricLength.textContent = faceLength.toFixed(0) + 'px';
    metricWidth.textContent = faceWidth.toFixed(0) + 'px';
    metricJaw.textContent = jawWidth.toFixed(0) + 'px';
    metricForehead.textContent = foreheadWidth.toFixed(0) + 'px';

    // Classification Logic
    let shape = "Unknown";
    const aspectRatio = faceLength / faceWidth;

    // Strict ratio-based heuristics
    if (aspectRatio > 1.38) {
        shape = "Oblong"; // Vertically dominant
    } else if (faceWidth > foreheadWidth * 1.15 && faceWidth > jawWidth * 1.15) {
        shape = "Diamond"; // Cheekbones are significantly wider than forehead and jaw
    } else if (jawWidth > faceWidth * 0.85 && foreheadWidth > faceWidth * 0.85 && aspectRatio < 1.28) {
        shape = "Square"; // Boxy structure (width is retained at top and bottom) plus a shorter aspect ratio
    } else if (foreheadWidth > jawWidth * 1.15) {
        shape = "Heart"; // Forehead is significantly wider than the tapered jaw
    } else {
        if (aspectRatio < 1.25) {
            shape = "Round"; // Shorter aspect ratio without the boxy corners of a square
        } else {
            shape = "Oval"; // Standard proportions
        }
    }

    // Only run heavy gender detection if models loaded and shape is valid
    let gender = currentGender;
    let prob = 1.0;

    if (modelsLoaded && shape !== "Unknown") {
        try {
            // face-api.js detection
            const detection = await faceapi.detectSingleFace(sourceElement).withAgeAndGender();
            if (detection) {
                gender = detection.gender;
                prob = detection.genderProbability;
            }
        } catch (e) {
            console.warn("Face API failed on this frame", e);
        }
    }

    // Update UI if things changed significantly (to prevent flickering)
    if (currentShape !== shape || currentGender !== gender) {
        currentShape = shape;
        currentGender = gender;

        resultShapeName.textContent = shape;
        resultShapeDesc.textContent = shapeDescriptions[shape] || shapeDescriptions["Unknown"];

        if (gender !== 'unknown') {
            resultGenderName.textContent = gender;
            resultGenderProb.textContent = `CONF: ${(prob * 100).toFixed(1)}% `;
        } else {
            resultGenderName.textContent = "---";
            resultGenderProb.textContent = "CONF: --%";
        }

        updateHairstyles(shape, gender);

        // Scroll to results cleanly
        setTimeout(() => {
            resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

async function onResults(results) {
    if (mode === 'idle' || mode === 'snapshot') return;

    hideLoading();

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const isImage = mode === 'image';
    const source = isImage ? imageElement : videoElement;

    if (!isImage) {
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);
    }

    canvasCtx.drawImage(source, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        updateStatus('success', 'ANALYSIS COMPLETE');

        for (const landmarks of results.multiFaceLandmarks) {
            // Unobtrusive wireframe
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#111111', lineWidth: 2 });

            await analyzeFaceShapeAndGender(landmarks, source);

            // Auto-stop camera on successful scan containing all required data
            if (isCameraRunning && currentShape !== "Unknown" && currentGender !== "unknown") {
                // Short delay to draw the final confident frame to canvas
                setTimeout(() => {
                    if (isCameraRunning) disableCamera(false);
                }, 800);
            }
        }
    } else {
        updateStatus('analyzing', 'SCANNING FOR SUBJECT...');
        if (currentShape !== "Unknown") {
            currentShape = "Unknown";
            currentGender = "unknown";
            resultShapeName.textContent = "---";
            resultGenderName.textContent = "---";
            resultGenderProb.textContent = "CONF: --%";
            resultShapeDesc.textContent = "Awaiting analysis data.";
            metricLength.textContent = "--";
            metricWidth.textContent = "--";
            metricJaw.textContent = "--";
            metricForehead.textContent = "--";
            updateHairstyles("Unknown", "unknown");
        }
    }
    canvasCtx.restore();
}

// Camera Helper
async function enableCamera() {
    if (!modelsLoaded) {
        await initializeFaceAPI();
    }

    if (!camera) {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: videoElement });
            },
            width: 480,
            height: 480
        });
    }

    videoElement.setAttribute('playsinline', '');

    await camera.start();
    isCameraRunning = true;
    mode = 'camera';
    cameraBtnText.textContent = "Stop Camera";
    btnToggleCamera.classList.replace('bg-off-black', 'bg-red-600');
    btnToggleCamera.classList.replace('border-off-black', 'border-red-600');
    btnToggleCamera.classList.replace('text-off-white', 'text-white');

    imageElement.style.display = 'none';
    videoElement.style.display = 'block';

    canvasElement.width = videoElement.videoWidth || 480;
    canvasElement.height = videoElement.videoHeight || 480;
}

function disableCamera(clearUI = true) {
    if (camera) {
        camera.stop();
    }
    isCameraRunning = false;
    cameraBtnText.textContent = "Start Camera";

    btnToggleCamera.classList.replace('bg-red-600', 'bg-off-black');
    btnToggleCamera.classList.replace('border-red-600', 'border-off-black');
    btnToggleCamera.classList.replace('text-white', 'text-off-white');

    if (clearUI) {
        mode = 'idle';
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        updateStatus('idle', 'IDLE. AWAITING INPUT.');
        currentShape = "Unknown";
        currentGender = "unknown";
        resultShapeName.textContent = "---";
        resultGenderName.textContent = "---";
        resultGenderProb.textContent = "CONF: --%";
        resultShapeDesc.textContent = "Awaiting analysis data.";
        metricLength.textContent = "--";
        metricWidth.textContent = "--";
        metricJaw.textContent = "--";
        metricForehead.textContent = "--";
        updateHairstyles("Unknown", "unknown");
    } else {
        mode = 'snapshot';
        updateStatus('success', 'ANALYSIS COMPLETE. SNAPSHOT SAVED.');

        // Freeze the last frame as an image element!
        imageElement.src = canvasElement.toDataURL('image/png');
        imageElement.style.display = 'block';
        videoElement.style.display = 'none';
        viewport.classList.add('is-image');
    }
}

// Listeners
btnToggleCamera.addEventListener('click', () => {
    if (isCameraRunning) {
        disableCamera();
    } else {
        showLoading('INIT...');
        enableCamera().catch(console.error);
    }
});

btnUploadImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!modelsLoaded) {
        await initializeFaceAPI();
    }

    if (isCameraRunning) {
        disableCamera();
    }

    mode = 'image';
    showLoading('PROC...');

    const url = URL.createObjectURL(file);
    imageElement.src = url;
    viewport.classList.add('is-image');
    imageElement.style.display = 'block';
    videoElement.style.display = 'none';

    imageElement.onload = async () => {
        const maxW = 600;
        const maxH = 600;
        let w = imageElement.naturalWidth;
        let h = imageElement.naturalHeight;

        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }

        canvasElement.width = w;
        canvasElement.height = h;

        updateStatus('analyzing', 'MAPPING...');
        await faceMesh.send({ image: imageElement });
    };
});

// Load the model immediately so we don't have to wait completely on first click
initializeFaceAPI();
updateStatus('idle', 'IDLE. AWAITING INPUT.');
