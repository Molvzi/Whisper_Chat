class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.isProcessing = true
    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this.isProcessing = false
      }
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isProcessing) return false // 返回 false 会停止处理器

    const input = inputs[0][0]
    if (input) {
      const volume = Math.max(...input.map(Math.abs))
      this.port.postMessage({
        audioData: input,
        volume: volume
      })
    }
    return this.isProcessing
  }
}

registerProcessor('audio-processor', AudioProcessor)
