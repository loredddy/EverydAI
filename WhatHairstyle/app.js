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
function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
        // Minimalist layout for recommendations
        const cardHtml = `
            <div class="border-2 border-off-black p-4 bg-off-white hover:bg-gray-100 transition-colors flex flex-col gap-1">
                <div class="flex justify-between items-center border-b-2 border-off-black pb-2 mb-2">
                    <span class="font-black uppercase text-lg inline-block">${style.name}</span>
                    <span class="text-xs font-mono bg-off-black text-off-white px-2 py-1 uppercase tracking-widest">Match 0${index + 1}</span>
                </div>
                <p class="text-sm font-medium text-gray-700 font-mono uppercase tracking-tight">${style.desc}</p>
            </div>
        `;
        hairstylesList.insertAdjacentHTML('beforeend', cardHtml);
    });
}

async function analyzeFaceShapeAndGender(landmarks, sourceElement) {
    // MediaPipe specific Landmark Indices
    const faceLength = calculateDistance(landmarks[10], landmarks[152]);
    const faceWidth = calculateDistance(landmarks[234], landmarks[454]);
    const foreheadWidth = calculateDistance(landmarks[54], landmarks[284]);
    const jawWidth = calculateDistance(landmarks[132], landmarks[361]);

    // Update UI Metrics
    metricLength.textContent = faceLength.toFixed(3);
    metricWidth.textContent = faceWidth.toFixed(3);
    metricJaw.textContent = jawWidth.toFixed(3);
    metricForehead.textContent = foreheadWidth.toFixed(3);

    // Classification Logic
    let shape = "Unknown";
    const aspectRatio = faceLength / faceWidth;

    if (aspectRatio > 1.4) {
        shape = "Oblong";
    } else if (jawWidth > faceWidth - 0.05 && foreheadWidth > faceWidth - 0.05) {
        shape = "Square";
    } else if (faceWidth > foreheadWidth + 0.05 && faceWidth > jawWidth + 0.05 && faceLength / faceWidth < 1.3) {
        if (aspectRatio < 1.15) {
            shape = "Round";
        } else {
            shape = "Diamond";
        }
    } else if (foreheadWidth > jawWidth + 0.05 && faceWidth > jawWidth + 0.05) {
        shape = "Heart";
    } else {
        if (aspectRatio >= 1.25 && aspectRatio <= 1.45) {
            shape = "Oval";
        } else if (aspectRatio < 1.25) {
            shape = "Round";
        } else {
            shape = "Oval";
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
            resultGenderProb.textContent = `CONF: ${(prob * 100).toFixed(1)}%`;
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

function disableCamera() {
    if (camera) {
        camera.stop();
    }
    isCameraRunning = false;
    mode = 'idle';
    cameraBtnText.textContent = "Start Camera";

    btnToggleCamera.classList.replace('bg-red-600', 'bg-off-black');
    btnToggleCamera.classList.replace('border-red-600', 'border-off-black');
    btnToggleCamera.classList.replace('text-white', 'text-off-white');

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
