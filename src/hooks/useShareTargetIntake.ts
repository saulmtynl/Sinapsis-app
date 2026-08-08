import { useEffect } from 'react'
import { useInboxStore } from '../inboxStore'
import { useStore } from '../store'

// Milestone 2 Paso 5 — "Compartir a Sinapsis" from other apps (WhatsApp,
// browser, notes). The manifest's share_target (vite.config.ts) is GET +
// text/url only, so Android hands the shared content back as query params
// on the app's own start_url — no server, no custom service worker. Runs
// once on load: pulls whatever's there into a new inbox item, then strips
// the params so a reload doesn't re-add it.
export function useShareTargetIntake(): void {
  const addTextItem = useInboxStore((s) => s.addTextItem)
  const setTab = useStore((s) => s.setTab)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const title = params.get('title')?.trim()
    const text = params.get('text')?.trim()
    const url = params.get('url')?.trim()
    if (!title && !text && !url) return

    const combined = [title, text, url].filter(Boolean).join('\n\n')
    void addTextItem(combined).then(() => setTab('inbox'))

    const cleanUrl = window.location.pathname + window.location.hash
    window.history.replaceState(null, '', cleanUrl)
    // Intentionally empty deps: this only ever needs to run once, on the
    // load that carried the shared content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
