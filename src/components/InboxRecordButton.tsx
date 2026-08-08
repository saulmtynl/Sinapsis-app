import { useEffect, useRef, useState } from 'react'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { useInboxStore } from '../inboxStore'

// Inbox-specific recorder: audio only (no video — captura rápida de
// notas de voz, no de video), and saves to the local inbox (IndexedDB)
// instead of uploading to Drive like components/RecordButton.tsx does for
// blocks inside an open map.
export function InboxRecordButton(): React.JSX.Element {
  const { status, error, blob, mimeType, elapsedSeconds, start, stop, reset } = useMediaRecorder()
  const addMediaItem = useInboxStore((s) => s.addMediaItem)
  const [saving, setSaving] = useState(false)

  const previewAudioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (previewAudioRef.current) previewAudioRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  async function confirm(): Promise<void> {
    if (!blob || !mimeType) return
    setSaving(true)
    try {
      await addMediaItem('audio', blob, mimeType)
      reset()
    } finally {
      setSaving(false)
    }
  }

  if (status === 'idle') {
    return (
      <div className="record-button">
        <button type="button" className="btn-ghost" onClick={() => void start('audio')}>
          🎙️ Grabar nota de voz
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (status === 'requesting') {
    return <p className="text-muted">Pidiendo acceso al micrófono…</p>
  }

  if (status === 'recording') {
    return (
      <div className="recorder-active">
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
      <audio ref={previewAudioRef} controls />
      <div className="recorder-actions">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void confirm()}>
          {saving ? 'Guardando…' : 'Guardar en el inbox'}
        </button>
        <button type="button" className="btn-ghost" disabled={saving} onClick={reset}>
          Descartar
        </button>
      </div>
    </div>
  )
}
