import { useState } from 'react'
import * as drive from '../lib/driveClient'
import type { MapStateMedia } from '../types'

interface MediaPlayerProps {
  media: MapStateMedia | null
}

// Fetches the actual file from Drive only on tap, not on node open — a
// node with several videos shouldn't burn mobile data just by being viewed.
export function MediaPlayer({ media }: MediaPlayerProps): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!media || !media.driveFileId) {
    return <p className="text-muted">Archivo no disponible.</p>
  }

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const blob = await drive.downloadFile(media!.driveFileId!)
      setUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!url) {
    const verb = media.type === 'image' ? 'Ver' : 'Reproducir'
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          {loading ? 'Cargando…' : `${verb} ${media.originalFilename}`}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (media.type === 'image') return <img src={url} alt={media.originalFilename} className="block-media-player" />
  if (media.type === 'video') return <video src={url} controls className="block-media-player" />
  return <audio src={url} controls className="block-media-player" />
}
