import React, { useEffect, useMemo, useRef, useState } from 'react'

const dataUrlToBlob = (dataUrl) => {
  const [meta, content] = dataUrl.split(',')
  const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
  const bytes = atob(content)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

const SelfieCapture = ({
  value,              // base64 dataURL
  onChange,           // (dataUrl, blob) => void
  onError,            // (message) => void
  title = 'Selfie capture',
  hint = 'Use good lighting, remove cap/face covering, face centered.',
}) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [starting, setStarting] = useState(false)
  const [started, setStarted] = useState(false)

  const hasValue = useMemo(() => !!value, [value])

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks()?.forEach((t) => t.stop())
        streamRef.current = null
      }
    } catch (_) {}
    setStarted(false)
  }

  const startCamera = async () => {
    setStarting(true)
    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStarted(true)
    } catch (e) {
      const msg =
        e?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : 'Unable to open camera. Check permissions and try again.'
      onError?.(msg)
    } finally {
      setStarting(false)
    }
  }

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    const w = video.videoWidth || 720
    const h = video.videoHeight || 720

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)

    // JPEG keeps payload smaller than PNG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const blob = dataUrlToBlob(dataUrl)

    onChange?.(dataUrl, blob)
    // Stop camera after capture (less creepy + more compliant)
    stopCamera()
  }

  const retake = () => {
    onChange?.(null, null)
    startCamera()
  }

  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-1">
            {title}
          </div>
          <div className="text-xs text-slate-300/80">{hint}</div>
        </div>

        {!started && !hasValue ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={starting}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-alt text-alt text-xs font-semibold hover:bg-alt/10 transition disabled:opacity-60"
          >
            {starting ? 'Starting…' : 'Open camera'}
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
                className="w-full max-h-[280px] object-contain"
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition"
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
          </>
        )}
      </div>
    </div>
  )
}

export default SelfieCapture
