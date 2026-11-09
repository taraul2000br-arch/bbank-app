// Face detection / recognition helpers using face-api.js.
// Lazy-imported so it never runs during SSR/Worker bundling.

const MODELS_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

let apiPromise: Promise<typeof import("face-api.js")> | null = null;
function getApi() {
  if (!apiPromise) apiPromise = import("face-api.js");
  return apiPromise;
}

let loadingPromise: Promise<void> | null = null;
export function loadFaceModels(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const faceapi = await getApi();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
  })().catch((e) => {
    loadingPromise = null;
    throw e;
  });
  return loadingPromise;
}

export type Direction = "front" | "left" | "right" | "up" | "down";

export type FaceCheck = {
  faceCount: number;
  detection: any | null;
  direction: Direction | null;
  sizeRatio: number;
  centered: boolean;
};

export async function checkFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<FaceCheck> {
  const faceapi = await getApi();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const results = await faceapi.detectAllFaces(input, opts).withFaceLandmarks(true);

  const empty: FaceCheck = { faceCount: results.length, detection: null, direction: null, sizeRatio: 0, centered: false };
  if (results.length !== 1) return empty;

  const det = results[0];
  const box = det.detection.box;
  const w = (input as any).videoWidth ?? (input as any).naturalWidth ?? input.width;
  const h = (input as any).videoHeight ?? (input as any).naturalHeight ?? input.height;
  if (!w || !h) return empty;

  const sizeRatio = (box.width * box.height) / (w * h);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const centered = Math.abs(cx / w - 0.5) < 0.18 && Math.abs(cy / h - 0.5) < 0.2;

  const direction = estimateDirection(det.landmarks, box);
  return { faceCount: 1, detection: det, direction, sizeRatio, centered };
}

function estimateDirection(landmarks: any, box: any): Direction {
  const nose = landmarks.getNose()[3];
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const jaw = landmarks.getJawOutline();

  const eyeLx = avgX(leftEye);
  const eyeRx = avgX(rightEye);
  const eyeY = (avgY(leftEye) + avgY(rightEye)) / 2;
  const faceLeft = jaw[0].x;
  const faceRight = jaw[jaw.length - 1].x;
  const faceWidth = faceRight - faceLeft;

  const eyeCenter = (eyeLx + eyeRx) / 2;
  const yawRatio = (nose.x - eyeCenter) / (faceWidth || 1);

  const chin = jaw[8].y;
  const pitchRatio = (nose.y - eyeY) / ((chin - eyeY) || 1);

  // Video is mirrored visually; raw coords are not. When user turns head to
  // their right, nose moves to the left side of the image (smaller x).
  if (yawRatio < -0.08) return "right";
  if (yawRatio > 0.08) return "left";
  if (pitchRatio > 0.75) return "down";
  if (pitchRatio < 0.30) return "up";
  return "front";
}

function avgX(pts: any[]) { return pts.reduce((a, p) => a + p.x, 0) / pts.length; }
function avgY(pts: any[]) { return pts.reduce((a, p) => a + p.y, 0) / pts.length; }

export async function computeDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const faceapi = await getApi();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const r = await faceapi.detectSingleFace(input, opts).withFaceLandmarks(true).withFaceDescriptor();
  return r?.descriptor ?? null;
}

export async function faceDistance(a: Float32Array, b: Float32Array): Promise<number> {
  const faceapi = await getApi();
  return faceapi.euclideanDistance(a, b);
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function snapshotVideo(v: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d")!.drawImage(v, 0, 0);
  return c;
}
