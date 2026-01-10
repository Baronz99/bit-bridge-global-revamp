import React, { useEffect, useMemo, useRef, useState } from "react";

const dataUrlToBlob = (dataUrl) => {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] || "image/jpeg";
  const bytes = atob(content);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const isIOSSafari = () => {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit = /WebKit/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  // Safari on iOS is WebKit but not CriOS/FxiOS
  return isIOS && isWebKit && !isChromeIOS && !isFirefoxIOS;
};

// --- Simple image quality analysis (fast, no deps) ---
const analyzeImageQuality = (imageData /* Uint8ClampedArray */, w, h) => {
  let sum = 0;
  let sumSq = 0;

  let edgeSum = 0;
  let edgeCount = 0;

  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];

      const yLum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += yLum;
      sumSq += yLum * yLum;

      if (x + step < w) {
        const idx2 = (y * w + (x + step)) * 4;
        const r2 = imageData[idx2];
        const g2 = imageData[idx2 + 1];
        const b2 = imageData[idx2 + 2];
        const y2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
        edgeSum += Math.abs(yLum - y2);
        edgeCount++;
      }
      if (y + step < h) {
        const idx3 = ((y + step) * w + x) * 4;
        const r3 = imageData[idx3];
        const g3 = imageData[idx3 + 1];
        const b3 = imageData[idx3 + 2];
        const y3 = 0.2126 * r3 + 0.7152 * g3 + 0.0722 * b3;
        edgeSum += Math.abs(yLum - y3);
        edgeCount++;
      }
    }
  }

  const n = Math.max(1, Math.floor((w / step) * (h / step)));
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const std = Math.sqrt(variance);

  const sharpness = edgeCount > 0 ? edgeSum / edgeCount : 0;

  return {
    meanLum: mean,  // 0-255
    stdLum: std,
    sharpness,
  };
};

const SelfieCapture = ({
  value, // base64 dataURL
  onChange, // (dataUrl, blob) => void
  onError, // (message) => void
  title = "Selfie capture",
  hint = "Use good lighting, remove cap/face covering, face centered.",
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [qualityMsg, setQualityMsg] = useState("");

  const hasValue = useMemo(() => !!value, [value]);

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks()?.forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch (_) {}
    setStarted(false);
  };

  const startCamera = async () => {
    setStarting(true);
    setQualityMsg("");
    try {
      stopCamera();

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this browser/device.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const v = videoRef.current;
      if (v) {
        // iOS friendliness
        v.setAttribute("playsinline", "true");
        v.setAttribute("autoplay", "true");
        v.muted = true;

        v.srcObject = stream;

        // Wait metadata
        await new Promise((resolve) => {
          const done = () => resolve(true);
          if (v.readyState >= 2 && v.videoWidth > 0) return resolve(true);
          v.onloadedmetadata = done;
          setTimeout(done, 700);
        });

        // play retries (iOS sometimes fails first attempt)
        let ok = false;
        for (let i = 0; i < 4; i++) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await v.play();
            ok = true;
            break;
          } catch (_) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 250));
          }
        }

        if (!ok) {
          // still show UI; user can retry
          onError?.(
            "Camera opened but preview may be blocked. Refresh the page and confirm camera permission in Safari settings."
          );
        }
      }

      setStarted(true);
    } catch (e) {
      stopCamera();
      const msg =
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : e?.message || "Unable to open camera. Check permissions and try again.";
      setQualityMsg(msg);
      onError?.(msg);
    } finally {
      setStarting(false);
    }
  };

  const validateFrame = async (w, h) => {
    const sampleW = 180;
    const sampleH = 180;

    const tmp = document.createElement("canvas");
    tmp.width = sampleW;
    tmp.height = sampleH;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });

    // Use the already-rendered main canvas as source
    tctx.drawImage(canvasRef.current, 0, 0, w, h, 0, 0, sampleW, sampleH);

    const img = tctx.getImageData(0, 0, sampleW, sampleH);
    const { meanLum, stdLum, sharpness } = analyzeImageQuality(img.data, sampleW, sampleH);

    // iOS Safari needs looser blur threshold (camera softness)
    const blurThreshold = isIOSSafari() ? 7.0 : 10.0;

    const tooDark = meanLum < 70;
    const tooBright = meanLum > 205;
    const tooLowContrast = stdLum < 16;
    const tooBlurry = sharpness < blurThreshold;

    // IMPORTANT: message accuracy reduces friction
    if (tooDark) return "Too dark. Move into better light (light your face from the front).";
    if (tooBright) return "Too bright. Avoid harsh light or bright bulb behind/above you.";
    if (tooLowContrast) return "Low contrast. Face not clear—adjust lighting and try again.";

    // Face framing (if FaceDetector exists)
    const FaceDetector = window.FaceDetector;
    if (FaceDetector) {
      try {
        const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(tmp);
        if (!faces || faces.length === 0) {
          return "No face detected. Center your face and remove hats/coverings.";
        }
        const box = faces[0].boundingBox;
        const faceArea = box.width * box.height;
        const frameArea = sampleW * sampleH;
        const ratio = faceArea / frameArea;

        // Gentle bounds
        if (ratio < 0.08) return "Face too small. Move closer to the camera.";
        if (ratio > 0.50) return "Too close. Move slightly back so your full face fits.";

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        const dx = Math.abs(cx - sampleW / 2) / (sampleW / 2);
        const dy = Math.abs(cy - sampleH / 2) / (sampleH / 2);
        if (dx > 0.35 || dy > 0.35) return "Center your face in the frame.";
      } catch (_) {
        // ignore FaceDetector failures
      }
    }

    // Blur last (so we don't blame blur when it's framing/lighting)
    if (tooBlurry) return "Blurry. Hold steady, clean lens, and ensure your face is well-lit.";

    return "";
  };

  const capture = async () => {
    setQualityMsg("");

    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < 2 || !video.videoWidth) {
      const msg = "Camera not ready yet. Please wait a moment and try again.";
      setQualityMsg(msg);
      onError?.(msg);
      return;
    }

    // iOS autofocus benefit: tiny wait before capture
    await new Promise((r) => setTimeout(r, isIOSSafari() ? 200 : 80));

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const side = Math.min(vw, vh);
    const sx = Math.floor((vw - side) / 2);
    const sy = Math.floor((vh - side) / 2);

    const out = 720;
    canvas.width = out;
    canvas.height = out;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    try {
      ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
    } catch (e) {
      const msg = "Preview is blocked. Please retry and ensure camera permissions are enabled.";
      setQualityMsg(msg);
      onError?.(msg);
      return;
    }

    const validationMsg = await validateFrame(out, out);
    if (validationMsg) {
      setQualityMsg(validationMsg);
      onError?.(validationMsg);
      return;
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
    const blob = dataUrlToBlob(dataUrl);

    onChange?.(dataUrl, blob);
    stopCamera();
  };

  const retake = () => {
    setQualityMsg("");
    onChange?.(null, null);
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-1">
            {title}
          </div>
          <div className="text-xs text-slate-300/80">{hint}</div>
          {qualityMsg ? (
            <div className="mt-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {qualityMsg}
            </div>
          ) : null}
        </div>

        {!started && !hasValue ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={starting}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-alt text-alt text-xs font-semibold hover:bg-alt/10 transition disabled:opacity-60"
          >
            {starting ? "Starting…" : "Open camera"}
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        {hasValue ? (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/30">
              <img
                src={value}
                alt="Selfie preview"
                className="w-full max-h-[280px] object-contain"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={retake}
                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition"
              >
                Retake
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/30">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full max-h-[280px] object-contain"
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition disabled:opacity-60"
                disabled={!started}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={capture}
                className="px-4 py-2 rounded-lg bg-alt text-black text-xs font-semibold hover:brightness-110 transition disabled:opacity-60"
                disabled={!started}
              >
                Capture selfie
              </button>
            </div>

            <div className="mt-2 text-[11px] text-slate-400">
              Tips: face centered • no hat/glasses • steady hands • light from front
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelfieCapture;
