import { useCallback, useRef, useState } from 'react'

interface UseSpeechTranscriptionResult {
  available: boolean
  transcript: string
  // Exposed (not swallowed) so the UI can show *why* a transcript didn't
  // show up — e.g. "not-allowed", "no-speech", "audio-capture" — instead of
  // a generic "not available", which is otherwise impossible to diagnose
  // on a device that isn't in front of you.
  lastError: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

// Live, in-browser transcription via the Web Speech API — runs alongside
// useMediaRecorder while recording (Milestone 2 Paso 3). Not a substitute
// for the audio itself: best-effort, never blocks or fails the recording
// if unsupported or if recognition errors out mid-way.
export function useSpeechTranscription(): UseSpeechTranscriptionResult {
  const Ctor = typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined
  const available = !!Ctor

  const [transcript, setTranscript] = useState('')
  const [lastError, setLastError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTextRef = useRef('')
  // Distinguishes an intentional stop() from Chrome-on-Android's
  // SpeechRecognition ending on its own (it does this often — a short
  // silence, or an internal time limit — even with continuous: true).
  // While this is true, an unexpected onend restarts recognition instead
  // of letting the transcript go silent for the rest of the recording.
  const listeningRef = useRef(false)

  const start = useCallback(() => {
    if (!Ctor) return
    finalTextRef.current = ''
    setTranscript('')
    setLastError(null)
    listeningRef.current = true

    const recognition = new Ctor()
    recognition.lang = navigator.language || 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalTextRef.current += `${result[0].transcript} `
        else interim += result[0].transcript
      }
      setTranscript(`${finalTextRef.current}${interim}`.trim())
    }
    recognition.onerror = (event) => {
      setLastError(event.error)
    }
    recognition.onend = () => {
      if (listeningRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          // Already starting/started somehow — ignore, next onend retries.
        }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [Ctor])

  const stop = useCallback(() => {
    listeningRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const reset = useCallback(() => {
    listeningRef.current = false
    recognitionRef.current?.abort()
    recognitionRef.current = null
    finalTextRef.current = ''
    setTranscript('')
    setLastError(null)
  }, [])

  return { available, transcript, lastError, start, stop, reset }
}
