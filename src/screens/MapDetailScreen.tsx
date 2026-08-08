import { useState } from 'react'
import { useStore } from '../store'
import { NodeTree } from '../components/NodeTree'
import { MediaPlayer } from '../components/MediaPlayer'
import { RecordButton } from '../components/RecordButton'
import { generateScriptForNode, hasGeneratableContent } from '../lib/scriptGeneration'

function downloadTextFile(filename: string, content: string): void {
  // Leading BOM: a .txt has no encoding metadata of its own, and several
  // Android text/notes apps fall back to Latin-1 without one — garbling
  // tildes/ñ even though the file is valid UTF-8 (the Blob constructor
  // encodes JS strings as UTF-8). The BOM gives them something to detect.
  const utf8Bom = String.fromCharCode(0xfeff)
  const blob = new Blob([utf8Bom, content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'guion'
}

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
  const addDocument = useStore((s) => s.addDocument)
  const updateDocumentContent = useStore((s) => s.updateDocumentContent)
  const saveMap = useStore((s) => s.saveMap)
  const discardAndReload = useStore((s) => s.discardAndReload)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

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

  async function handleGenerateScript(nodeId: string): Promise<void> {
    if (!currentMap) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateScriptForNode(currentMap.state, nodeId)
      if (!result.ok) {
        setGenerateError(result.message)
        return
      }
      addDocument(nodeId, result.script.title, result.script.content, 'ai_guion')
    } finally {
      setGenerating(false)
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
            {hasGeneratableContent(state, selectedNode.id) && (
              <button type="button" className="btn-ghost" disabled={generating} onClick={() => void handleGenerateScript(selectedNode.id)}>
                {generating ? 'Generando guion…' : '✨ Generar guion'}
              </button>
            )}
          </div>
          {generateError && <p className="error-text">{generateError}</p>}

          {state.documents.filter((d) => d.nodeId === selectedNode.id).length > 0 && (
            <div className="document-list">
              <h3>Documentos</h3>
              {state.documents
                .filter((d) => d.nodeId === selectedNode.id)
                .map((doc) => (
                  <article key={doc.id} className="document-item">
                    <div className="document-item-header">
                      <h4>{doc.title}</h4>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => downloadTextFile(`${sanitizeFilename(doc.title)}.txt`, doc.content)}
                      >
                        Descargar .txt
                      </button>
                    </div>
                    <p className="text-muted">{doc.wordCount} palabras</p>
                    <textarea
                      className="block-textarea document-textarea"
                      value={doc.content}
                      onChange={(e) => updateDocumentContent(doc.id, e.target.value)}
                      rows={8}
                    />
                  </article>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
