// Port of Sinapsis/src/main/scripts.ts (Milestone 6/7) to work off the
// PWA's in-memory MapStateJson arrays instead of SQLite queries. Same
// subtree-walk, same hasContent gate, same prompt as desktop's original —
// with one deliberate divergence: the Spanish-variant rule below (added in
// PWA Milestone 3, per user request) isn't in desktop's copy. Scope for
// that milestone was PWA-only, so desktop's prompt was left untouched;
// port this rule there too if the user wants the same output style on
// both platforms.
import type { MapStateJson, MapStateNode } from '../types'
import { generateAnthropicText } from './ai'

export const SCRIPT_SYSTEM_PROMPT = `Sos un guionista experto en contenido audiovisual (videos, hilos) para canales de
"faceless content" — canales que no muestran el rostro del creador y se apoyan en la
narración, el material visual y el ritmo del guion para enganchar a la audiencia.

Vas a recibir el contenido de un árbol de conocimiento ya estructurado por el usuario: un
tema base (el hilo conductor central) y, debajo, sus exponentes y subtemas (el desarrollo y
los sub-puntos). Cada nodo puede tener texto propio y, opcionalmente, archivos multimedia
adjuntos (video, imagen, audio) que se te van a mencionar por su nombre cuando existan.

Tu tarea es transformar ese árbol en UN GUION LISTO PARA GRABAR O LEER EN VOZ ALTA — no un
resumen, no una lista de viñetas, no una versión acortada del árbol. Un guion real: oraciones
fluidas y conectadas, con ritmo, pensadas para ser dichas en voz alta frente a una cámara o
micrófono.

Reglas:
- Respetá la jerarquía del árbol: el tema base es el hilo conductor de todo el guion — todo
  debe volver a él. Los exponentes y subtemas son el desarrollo, en el orden en que aparecen.
- Escribí en el mismo idioma en el que está el contenido del árbol. Si ese idioma es
  español, usá español latinoamericano neutro (con "tú"), nunca español de España — evitá
  "vosotros" y modismos marcadamente peninsulares (ej. "vale", "tío", "currar").
- Empezá con un gancho breve que enganche a la audiencia en los primeros segundos, y cerrá
  con una conclusión o llamado a la acción natural — aunque esas partes no estén literalmente
  en el árbol, son parte de armar un guion real.
- Basate en el contenido real del árbol para el desarrollo — no inventes datos, afirmaciones
  o hechos que no estén en el material entregado.
- Desarrollá el guion con la mayor extensión que el contenido del árbol permita
  honestamente, apuntando a unas 1.500 palabras (pensado para un audio narrado de
  aproximadamente 10 minutos a un ritmo natural, ~150 palabras por minuto). No rellenes con
  paja, muletillas vacías ni repitas ideas solo para alargar el texto artificialmente.
- Si el material del árbol no alcanza para sostener esa extensión con honestidad, generá el
  guion que el contenido permita sostener bien —no lo estires más allá de lo que da el
  material— y agregá al final, después de una línea con exactamente
  "===NOTA PARA EL EDITOR (no leer en voz alta)===", una nota breve indicando que el árbol
  necesita más desarrollo para llegar a los 10 minutos. Esa nota es para quien edita el
  documento, nunca debe mezclarse con el guion ni sonar como si fuera parte de él.
- Cuando un nodo tenga un archivo adjunto (video, imagen o audio), podés hacer referencia a
  él dentro del guion entre corchetes cuando ayude al ritmo o a la narración (ej. "[acá entra
  el clip de X]"), pero no es obligatorio en cada caso.
- No uses encabezados de markdown (#), ni listas con viñetas o numeradas. Escribí en párrafos
  de guion, como si fuera para leer en voz alta.

Devolvé únicamente el texto del guion (y, si corresponde, la nota final separada como se
indicó arriba), sin explicaciones previas ni comentarios tuyos por fuera de eso.`

const TYPE_LABELS: Record<string, string> = {
  tema_base: 'Tema base',
  exponente: 'Exponente',
  subtema: 'Subtema'
}

const MEDIA_LABELS: Record<string, string> = {
  video: 'video',
  image: 'imagen',
  audio: 'audio'
}

interface SubtreeEntry {
  node: MapStateNode
  depth: number
}

// Plain recursive walk over the in-memory nodes array (already small — a
// personal knowledge tree, not a dataset), mirroring desktop's
// collectSubtree over getChildren but without a database round trip.
function collectSubtree(state: MapStateJson, root: MapStateNode): SubtreeEntry[] {
  const entries: SubtreeEntry[] = []
  function walk(node: MapStateNode, depth: number): void {
    entries.push({ node, depth })
    const children = state.nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.orderIndex - b.orderIndex)
    for (const child of children) walk(child, depth + 1)
  }
  walk(root, 0)
  return entries
}

function formatNodeSection(state: MapStateJson, entry: SubtreeEntry): { text: string; hasContent: boolean } {
  const indent = '  '.repeat(entry.depth)
  const blocks = state.blocks.filter((b) => b.nodeId === entry.node.id)
  const textBlocks = blocks.filter((b) => b.type === 'text' && b.textContent?.trim())
  const mediaBlocks = blocks.filter((b) => b.type !== 'text' && b.mediaId)

  const lines = [`${indent}[${TYPE_LABELS[entry.node.type] ?? entry.node.type}] ${entry.node.title}`]
  for (const block of textBlocks) {
    for (const line of (block.textContent ?? '').split('\n')) {
      lines.push(`${indent}  ${line}`)
    }
  }
  if (mediaBlocks.length > 0) {
    const items = mediaBlocks
      .map((b) => {
        const media = state.media.find((m) => m.id === b.mediaId)
        return `${MEDIA_LABELS[b.type] ?? b.type} "${media?.originalFilename ?? '(sin nombre)'}"`
      })
      .join(', ')
    lines.push(`${indent}  (Adjunto: ${items})`)
  }

  return { text: lines.join('\n'), hasContent: textBlocks.length > 0 || mediaBlocks.length > 0 }
}

// Same gate as desktop's generateScriptForNode: at least one node in the
// subtree needs a non-empty text block or a media attachment. Cheap enough
// to run on every render for a personal tree's size.
export function hasGeneratableContent(state: MapStateJson, nodeId: string): boolean {
  const root = state.nodes.find((n) => n.id === nodeId)
  if (!root) return false
  return collectSubtree(state, root).some((entry) => formatNodeSection(state, entry).hasContent)
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

export interface GeneratedScript {
  title: string
  content: string
}

export type GenerateScriptResult = { ok: true; script: GeneratedScript } | { ok: false; message: string }

export async function generateScriptForNode(state: MapStateJson, nodeId: string): Promise<GenerateScriptResult> {
  const root = state.nodes.find((n) => n.id === nodeId)
  if (!root) return { ok: false, message: 'Nodo no encontrado.' }

  const sections = collectSubtree(state, root).map((entry) => formatNodeSection(state, entry))
  if (!sections.some((s) => s.hasContent)) {
    return {
      ok: false,
      message: 'Este nodo (y sus subtemas) todavía no tiene texto ni archivos adjuntos. Agregá contenido antes de generar un guion.'
    }
  }

  const contextText = sections.map((s) => s.text).join('\n\n')
  const result = await generateAnthropicText(SCRIPT_SYSTEM_PROMPT, contextText)
  if (!result.ok || !result.text) {
    return { ok: false, message: result.message ?? 'No se pudo generar el guion.' }
  }

  const title = `Guion – ${root.title} – ${SHORT_DATE_FORMAT.format(new Date())}`
  return { ok: true, script: { title, content: result.text } }
}
