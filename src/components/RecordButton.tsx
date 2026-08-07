import { useEffect, useRef, useState } from 'react'
import { extensionForMimeType, useMediaRecorder, type RecordingKind } from '../hooks/useMediaRecorder'
import { useStore } from '../store'

interface RecordButtonProps {
  nodeId: string
  kind: RecordingKind
}

export function RecordButton({ nodeId, kind }: RecordButtonProps): React.JSX.Element {
  const { status, error, blob, mimeType, elapsedSeconds, stream, start, stop, reset } = useMediaRecorder()
  const addMediaBlock = useStore((s) => s.addMediaBlock)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (liveVideoRef.current) liveVideoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const el = kind === 'video' ? previewVideoRef.current : previewAudioRef.current
    if (el) el.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob, kind])

  async function confirm(): Promise<void> {
    if (!blob || !mimeType) return
    setUploading(true)
    setUploadError(null)
    try {
      await addMediaBlock(nodeId, kind, blob, extensionForMimeType(mimeType))
      reset()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const label = kind === 'audio' ? 'Grabar audio' : 'Grabar video'

  if (status === 'idle') {
    return (
      <div className="record-button">
        <button type="button" className="btn-ghost" onClick={() => void start(kind)}>
          {kind === 'audio' ? '🎙️' : '🎥'} {label}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (status === 'requesting') {
    return <p className="text-muted">Pidiendo acceso a {kind === 'audio' ? 'micrófono' : 'cámara y micrófono'}…</p>
  }

  if (status === 'recording') {
    return (
      <div className="recorder-active">
        {kind === 'video' && <video ref={liveVideoRef} autoPlay muted playsInline className="recorder-live" />}
        <p className="recorder-timer">● Grabando… {elapsedSeconds}s</p>
        <button type="button" className="btn-primary" onClick={stop}>
          Detener
        </button>
      </div>
    )
  }

  // status === 'stopped'
  return (
    <div className="recorder-preview">
      {kind === 'video' ? (
        <video ref={previewVideoRef} controls playsInline className="recorder-live" />
      ) : (
        <audio ref={previewAudioRef} controls />
      )}
      {uploadError && <p className="error-text">{uploadError}</p>}
      <div className="recorder-actions">
        <button type="button" className="btn-primary" disabled={uploading} onClick={() => void confirm()}>
          {uploading ? 'Subiendo…' : 'Usar esta grabación'}
        </button>
        <button type="button" className="btn-ghost" disabled={uploading} onClick={reset}>
          Descartar
        </button>
      </div>
    </div>
  )
}
