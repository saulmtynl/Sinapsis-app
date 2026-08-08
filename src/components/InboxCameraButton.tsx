import { useRef, useState } from 'react'
import { useInboxStore } from '../inboxStore'

// <input type="file" capture> instead of a custom getUserMedia preview —
// simple and reliable on Chrome Android, and avoids duplicating the
// stream/preview plumbing useMediaRecorder already covers for audio/video.
// No OCR here (out of scope, Milestone 2 Paso 4) — the photo is saved as-is
// for visual review later, same treatment as audio/text inbox items.
export function InboxCameraButton(): React.JSX.Element {
  const addMediaItem = useInboxStore((s) => s.addMediaItem)
  const inputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0] ?? null
    e.target.value = '' // allows picking/shooting the same file again later
    if (!file) return
    if (file.size === 0) {
      setError('La foto salió vacía, probá de nuevo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addMediaItem('image', file, file.type || 'image/jpeg')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inbox-camera">
      <button type="button" className="btn-ghost" disabled={saving} onClick={() => inputRef.current?.click()}>
        {saving ? 'Guardando…' : '📷 Foto de pizarrón'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(e) => void handleChange(e)}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
