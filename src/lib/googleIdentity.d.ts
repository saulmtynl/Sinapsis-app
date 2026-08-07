// Minimal ambient types for the slice of Google Identity Services (GIS) this
// app uses. GIS ships no official npm types package, and pulling in a full
// community typings package for four fields isn't worth the dependency.
export {}

declare global {
  interface TokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    error?: string
    error_description?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }

  interface TokenClient {
    requestAccessToken: (overrideConfig?: { prompt?: '' | 'consent' | 'select_account' }) => void
  }

  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
          revoke: (accessToken: string, done?: () => void) => void
        }
      }
    }
  }
}
