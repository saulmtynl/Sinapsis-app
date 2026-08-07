import { useState } from 'react'
import { useStore } from '../store'
import { NodeTree } from '../components/NodeTree'
import { MediaPlayer } from '../components/MediaPlayer'
import { RecordButton } from '../components/RecordButton'

export function MapDetailScreen(): React.JSX.Element {
  const currentMap = useStore((s) => s.currentMap)
  const remoteChangedWarning = useStore((s) => s.remoteChangedWarning)
  const dirty = useStore((s) => s.dirty)
  const saving = useStore((s) => s.saving)
  const saveError = useStore((s) => s.saveError)
  const backToList = useStore((s) => s.backToList)
  const updateNodeTitle = useStore((s) => s.updateNodeTitle)
  const updateBlockText = useStore((s) => s.updateBlockText)
  const addTextBlock = useStore((s) => s.addTextBlock)
  const deleteBlock = useStore((s) => s.deleteBlock)
  const saveMap = useStore((s) => s.saveMap)
  const discardAndReload = useStore((s) => s.discardAndReload)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  if (!currentMap) {
    return (
      <div className="screen map-detail-screen">
        <p className="error-text">No hay ningún mapa cargado.</p>
        <button type="button" className="btn-ghost" onClick={backToList}>
          ← Volver
        </button>
      </div>
    )
  }

  const { state } = currentMap
  const selectedNode = state.nodes.find((n) => n.id === selectedId) ?? null
  const selectedBlocks = state.blocks.filter((b) => b.nodeId === selectedId).sort((a, b) => a.orderIndex - b.orderIndex)

  function handleBack(): void {
    if (dirty && !confirm('Tienes cambios sin guardar en este mapa. ¿Salir de todas formas?')) return
    backToList()
  }

  function handleDeleteBlock(blockId: string): void {
    if (!confirm('¿Borrar este bloque? Esto no se puede deshacer una vez guardado.')) return
    deleteBlock(blockId)
  }

  async function handleDiscardAndReload(): Promise<void> {
    setReloading(true)
    try {
      await discardAndReload()
    } finally {
      setReloading(false)
    }
  }

  return (
    <div className="screen map-detail-screen">
      <header className="screen-header">
        <button type="button" className="btn-ghost" onClick={handleBack}>
          ← Mapas
        </button>
        <h1>{state.nodes.find((n) => n.parentId === null)?.title ?? 'Mapa'}</h1>
      </header>

      {remoteChangedWarning ? (
        <div className="conflict-box">
          <p className="warning-text">
            Este mapa cambió en Drive desde que lo abriste (probablemente desde otro dispositivo). Elige qué
            hacer con tus cambios locales antes de seguir editando.
          </p>
          <div className="conflict-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveMap({ force: true })}>
              Sobrescribir Drive con mis cambios
            </button>
            <button type="button" className="btn-ghost" disabled={reloading} onClick={() => void handleDiscardAndReload()}>
              {reloading ? 'Recargando…' : 'Descartar mis cambios y recargar'}
            </button>
          </div>
        </div>
      ) : (
        (dirty || saving || saveError) && (
          <div className="save-bar">
            <span className="text-muted">{saving ? 'Guardando…' : saveError ? 'Error al guardar' : 'Cambios sin guardar'}</span>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveMap()}>
              Guardar cambios
            </button>
          </div>
        )
      )}
      {saveError && !remoteChangedWarning && <p className="error-text">{saveError}</p>}

      <NodeTree nodes={state.nodes} parentId={null} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedNode && (
        <section className="node-detail-panel">
          <input
            className="node-title-input"
            value={selectedNode.title}
            onChange={(e) => updateNodeTitle(selectedNode.id, e.target.value)}
            placeholder="Título del nodo"
          />

          <ul className="block-list">
            {selectedBlocks.map((block) => {
              const media = block.mediaId ? state.media.find((m) => m.id === block.mediaId) ?? null : null
              return (
                <li key={block.id} className={`block-item block-type-${block.type}`}>
                  {block.type === 'text' ? (
                    <textarea
                      className="block-textarea"
                      value={block.textContent ?? ''}
                      onChange={(e) => updateBlockText(block.id, e.target.value)}
                      placeholder="Escribe algo…"
                      rows={3}
                    />
                  ) : (
                    <MediaPlayer media={media} />
                  )}
                  <button
                    type="button"
                    className="btn-ghost block-delete"
                    onClick={() => handleDeleteBlock(block.id)}
                    aria-label="Borrar bloque"
                  >
                    Borrar
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="node-actions">
            <button type="button" className="btn-ghost" onClick={() => addTextBlock(selectedNode.id)}>
              + Bloque de texto
            </button>
            <RecordButton nodeId={selectedNode.id} kind="audio" />
            <RecordButton nodeId={selectedNode.id} kind="video" />
          </div>

          {state.documents.filter((d) => d.nodeId === selectedNode.id).length > 0 && (
            <div className="document-list">
              <h3>Documentos</h3>
              {state.documents
                .filter((d) => d.nodeId === selectedNode.id)
                .map((doc) => (
                  <article key={doc.id} className="document-item">
                    <h4>{doc.title}</h4>
                    <p className="text-muted">{doc.wordCount} palabras</p>
                  </article>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
