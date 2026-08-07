import { useEffect, useState } from 'react'

// The app shell (HTML/CSS/JS) is cached by the service worker and can open
// with no network, but every screen needs Drive to do anything useful — per
// the Milestone 9 spec this must fail loudly with a banner, never silently.
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = (): void => setOnline(true)
    const goOffline = (): void => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

export function OfflineBanner(): React.JSX.Element | null {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="offline-banner" role="status">
      Sin conexión — Sinapsis necesita internet para leer y guardar tus mapas en Google Drive.
    </div>
  )
}
