import type { GoogleAccountInfo } from '../types'

// Same Drive scope desktop uses (see Sinapsis/src/main/sync/googleAuth.ts),
// but reached through Google Identity Services' browser token-client flow
// instead of the OAuth-code-exchange-with-client-secret flow desktop uses —
// a static site has nowhere safe to keep a client secret. Only the public
// Client ID (VITE_GOOGLE_CLIENT_ID) is needed here.
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface Session {
  accessToken: string
  expiresAt: number
  email: string | null
}

// In-memory only, deliberately. Never written to localStorage/sessionStorage
// unencrypted — closing the tab or reloading loses it, and the user signs in
// again, same as any other GIS token-client app.
let session: Session | null = null

function waitForGis(): Promise<NonNullable<Window['google']>> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timeoutMs = 10_000
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        resolve(window.google)
        return
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error('No se pudo cargar Google Identity Services. Revisa tu conexión.'))
      }
    }, 100)
  })
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return null
    const body = (await res.json()) as { email?: string }
    return body.email ?? null
  } catch {
    return null
  }
}

export async function signIn(): Promise<GoogleAccountInfo> {
  if (!CLIENT_ID) {
    throw new Error(
      'Falta VITE_GOOGLE_CLIENT_ID. Configúralo en .env (ver .env.example) con el Client ID de tipo "Aplicación web".'
    )
  }
  const google = await waitForGis()

  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res) => (res.error ? reject(new Error(res.error_description ?? res.error)) : resolve(res)),
      error_callback: (err) => reject(new Error(err.message ?? err.type))
    })
    client.requestAccessToken({ prompt: 'consent' })
  })

  const email = await fetchEmail(response.access_token)
  session = {
    accessToken: response.access_token,
    expiresAt: Date.now() + (response.expires_in - 60) * 1000,
    email
  }
  return { connected: true, email }
}

export function signOut(): void {
  if (session?.accessToken && window.google) {
    window.google.accounts.oauth2.revoke(session.accessToken)
  }
  session = null
}

export function getGoogleAccount(): GoogleAccountInfo {
  return { connected: !!session, email: session?.email ?? null }
}

// Every Drive call goes through this. Throws if there's no valid session —
// callers (driveClient.ts) should only be invoked from screens gated behind
// signIn(), so this is a programming-error guard, not a normal-flow path.
export function getAccessToken(): string {
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error('La sesión de Google expiró. Vuelve a iniciar sesión.')
  }
  return session.accessToken
}

export function isSessionValid(): boolean {
  return !!session && session.expiresAt > Date.now()
}
