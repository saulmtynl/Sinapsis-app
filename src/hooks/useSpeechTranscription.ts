import { useCallback, useRef, useState } from 'react'

interface UseSpeechTranscriptionResult {
  available: boolean
  transcript: string
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
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTextRef = useRef('')

  const start = useCallback(() => {
    if (!Ctor) return
    finalTextRef.current = ''
    setTranscript('')

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
    // Best-effort: swallow errors (e.g. "no-speech", "aborted") rather than
    // surfacing them — the recording itself is unaffected either way.
    recognition.onerror = () => {}

    recognitionRef.current = recognition
    recognition.start()
  }, [Ctor])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    finalTextRef.current = ''
    setTranscript('')
  }, [])

  return { available, transcript, start, stop, reset }
}
