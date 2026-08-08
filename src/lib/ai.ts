// Browser port of the Anthropic call in
// Sinapsis/src/main/ai/providers.ts (generateAnthropicText, Milestone 6).
// Desktop calls this from Electron's main process, which has no CORS
// restriction; here it's a static site with no backend to proxy through,
// so this uses the anthropic-dangerous-direct-browser-access header
// (Anthropic added CORS support for direct browser calls in 2024) instead.
// The API key comes from import.meta.env, baked in at build time — same
// public-but-limited tradeoff as VITE_GOOGLE_CLIENT_ID (see .env.example).
const ANTHROPIC_API_VERSION = '2023-06-01'
const ANTHROPIC_MODEL = 'claude-sonnet-5'
// Same ceiling as desktop (Milestone 7): target ~1,500-1,700 words
// (~10 min narrated at a natural pace) — comfortable headroom in Spanish
// without risking a mid-sentence cutoff.
const SCRIPT_MAX_TOKENS = 6000

export interface GenerateTextResult {
  ok: boolean
  text?: string
  message?: string
}

function describeAnthropicError(status: number, body: { error?: { message?: string } } | null): string {
  const detail = body?.error?.message
  if (status === 401) return 'La API key de Anthropic es inválida o fue revocada.'
  if (status === 400 || status === 404) return detail ?? 'El modelo no está disponible para esta key.'
  if (status === 429) return 'Se alcanzó el límite de gasto/uso configurado para esta key.'
  return detail ?? `Error de la API de Anthropic (HTTP ${status}).`
}

export async function generateAnthropicText(systemPrompt: string, userPrompt: string): Promise<GenerateTextResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      message: 'Falta VITE_ANTHROPIC_API_KEY. Configuralo en .env (ver .env.example) para poder generar guiones.'
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: SCRIPT_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string }; content?: Array<{ type: string; text?: string }> }
      | null

    if (!res.ok) {
      return { ok: false, message: describeAnthropicError(res.status, body) }
    }

    const text = body?.content?.find((block) => block.type === 'text')?.text
    if (!text) return { ok: false, message: 'La API respondió sin contenido de texto.' }
    return { ok: true, text }
  } catch (err) {
    return {
      ok: false,
      message: `No se pudo conectar con Anthropic: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
