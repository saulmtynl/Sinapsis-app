import { useCallback, useRef, useState } from 'react'

export type RecordingKind = 'audio' | 'video'
export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopped'

interface UseMediaRecorderResult {
  status: RecordingStatus
  error: string | null
  blob: Blob | null
  mimeType: string | null
  elapsedSeconds: number
  stream: MediaStream | null
  start: (kind: RecordingKind) => Promise<void>
  stop: () => void
  reset: () => void
}

// Ordered by preference — the first one this browser's MediaRecorder
// supports wins. webm/opus is what Chrome for Android (the only target per
// Milestone 9 §6) supports natively, mp4 candidates are there for whatever
// engine ends up running this next.
const AUDIO_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
const VIDEO_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
]

function pickMimeType(kind: RecordingKind): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = kind === 'audio' ? AUDIO_CANDIDATES : VIDEO_CANDIDATES
  return candidates.find((c) => MediaRecorder.isTypeSupported(c))
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm'
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const start = useCallback(async (kind: RecordingKind) => {
    setError(null)
    setBlob(null)
    setStatus('requesting')
    try {
      const constraints: MediaStreamConstraints = kind === 'audio' ? { audio: true } : { audio: true, video: true }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      const chosenMimeType = pickMimeType(kind)
      const recorder = chosenMimeType
        ? new MediaRecorder(mediaStream, { mimeType: chosenMimeType })
        : new MediaRecorder(mediaStream)

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const finalMimeType = chosenMimeType ?? recorder.mimeType ?? `${kind}/webm`
        setBlob(new Blob(chunksRef.current, { type: finalMimeType }))
        setMimeType(finalMimeType)
        setStatus('stopped')
        stopTimer()
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setStream(null)
      }

      recorderRef.current = recorder
      streamRef.current = mediaStream
      setStream(mediaStream)
      setElapsedSeconds(0)
      recorder.start()
      setStatus('recording')
      timerRef.current = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setStream(null)
    setBlob(null)
    setMimeType(null)
    setElapsedSeconds(0)
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, blob, mimeType, elapsedSeconds, stream, start, stop, reset }
}
