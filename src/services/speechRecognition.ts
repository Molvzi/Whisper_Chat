export class SpeechRecognitionService {
  private recognition: any

  constructor(language = 'zh-CN') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) throw new Error('Browser not supported')

    this.recognition = new SpeechRecognition()
    this.recognition.lang = language
    this.recognition.continuous = false
    this.recognition.interimResults = false
  }

  start(callbacks: {
    onStart?: () => void
    onEnd?: () => void
    onError?: (error: string) => void
    onResult?: (transcript: string) => void
  }) {
    this.recognition.onstart = callbacks.onStart
    this.recognition.onend = callbacks.onEnd
    this.recognition.onerror = (event: any) => callbacks.onError?.(event.error)
    this.recognition.onresult = (event: any) => {
      callbacks.onResult?.(event.results[0][0].transcript)
    }

    try {
      this.recognition.start()
    } catch (err) {
      callbacks.onError?.('启动语音识别失败')
    }
  }
}
