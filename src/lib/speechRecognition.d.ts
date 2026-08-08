// Minimal ambient types for the Web Speech API (SpeechRecognition). Not in
// lib.dom.d.ts — it's still non-standard/webkit-prefixed on the browsers
// that support it (Chrome for Android among them, our only real target per
// M9 §6) — and no official types package exists for the four members this
// app actually uses.
export {}

declare global {
  interface SpeechRecognitionResultItem {
    transcript: string
  }

  interface SpeechRecognitionResult {
    isFinal: boolean
    0: SpeechRecognitionResultItem
    length: number
  }

  interface SpeechRecognitionResultList {
    length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionEvent {
    resultIndex: number
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionErrorEvent {
    error: string
    message?: string
  }

  interface SpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
    abort(): void
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}
