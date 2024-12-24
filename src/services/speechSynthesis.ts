export class SpeechSynthesisService {
  speak(text: string, options = { lang: 'zh-CN', rate: 1.0, pitch: 1.0 }) {
    const utterance = new SpeechSynthesisUtterance(text)
    Object.assign(utterance, options)
    window.speechSynthesis.speak(utterance)
  }
}
