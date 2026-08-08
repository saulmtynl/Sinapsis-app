import { useEffect, useRef, useState } from 'react'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { useSpeechTranscription } from '../hooks/useSpeechTranscription'
import { useInboxStore } from '../inboxStore'

// Inbox-specific recorder: audio only (no video — captura rápida de
// notas de voz, no de video), and saves to the local inbox (IndexedDB)
// instead of uploading to Drive like components/RecordButton.tsx does for
// blocks inside an open map.
//
// Transcription (Milestone 2 Paso 3): runs live via the Web Speech API
// alongside the recording, not as a post-process step on the saved blob —
// the Anthropic Messages API has no audio-input/transcription endpoint
// (verified August 2026), so there's no "send the file to Claude" path
// here. Best-effort: if unsupported or empty, the audio still saves fine.
export function InboxRecordButton(): React.JSX.Element {
  const { status, error, blob, mimeType, elapsedSeconds, start, stop, reset } = useMediaRecorder()
  const speech = useSpeechTranscription()
  const addMediaItem = useInboxStore((s) => s.addMediaItem)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const previewAudioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (previewAudioRef.current) previewAudioRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  async function handleStart(): Promise<void> {
    setSaveError(null)
    // Sequenced, not concurrent: let the recorder's getUserMedia settle
    // first, then start recognition — avoids both racing for the mic
    // permission prompt on first use.
    await start('audio')
    speech.start()
  }

  function handleStop(): void {
    stop()
    speech.stop()
  }

  function handleReset(): void {
    reset()
    speech.reset()
  }

  async function confirm(): Promise<void> {
    if (!blob || !mimeType) return
    if (blob.size === 0) {
      setSaveError('La grabación salió vacía, probá de nuevo.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const transcript = speech.transcript.trim()
      await addMediaItem('audio', blob, mimeType, {
        textContent: transcript || null,
        transcriptStatus: transcript ? 'done' : 'unavailable'
      })
      handleReset()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (status === 'idle') {
    return (
      <div className="record-button">
        <button type="button" className="btn-ghost" onClick={() => void handleStart()}>
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
        {speech.available && speech.transcript && <p className="text-muted recorder-live-transcript">{speech.transcript}</p>}
        {speech.lastError && <p className="text-muted">(diagnóstico transcripción: {speech.lastError})</p>}
        <button type="button" className="btn-primary" onClick={handleStop}>
          Detener
        </button>
      </div>
    )
  }

  // status === 'stopped'
  return (
    <div className="recorder-preview">
      <audio ref={previewAudioRef} controls />
      {speech.available ? (
        speech.transcript ? (
          <p className="text-muted">Transcripción (se puede editar después de guardar): {speech.transcript}</p>
        ) : (
          <p className="text-muted">No se detectó texto al transcribir — se guarda solo el audio.</p>
        )
      ) : (
        <p className="text-muted">Este navegador no soporta transcripción automática — se guarda solo el audio.</p>
      )}
      {speech.lastError && <p className="text-muted">(diagnóstico transcripción: {speech.lastError})</p>}
      {saveError && <p className="error-text">{saveError}</p>}
      <div className="recorder-actions">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void confirm()}>
          {saving ? 'Guardando…' : 'Guardar en el inbox'}
        </button>
        <button type="button" className="btn-ghost" disabled={saving} onClick={handleReset}>
          Descartar
        </button>
      </div>
    </div>
  )
}
