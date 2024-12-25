import { startScreenCapture, getAudioTrack } from './screenCapture'

export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private audioChunks: Blob[] = []
  private isRecording: boolean = false
  private readonly VOLUME_THRESHOLD = 1.5
  private readonly MAX_CHUNKS = 3

  async startRecording(existingStream?: MediaStream): Promise<void> {
    try {
      const stream = existingStream || (await startScreenCapture())
      const audioTrack = getAudioTrack(stream)

      if (!audioTrack) throw new Error('No audio track found')

      // 创建音频上下文和分析器
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]))
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      source.connect(this.analyser)

      // 设置 MediaRecorder
      const audioStream = new MediaStream([audioTrack])
      this.mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      })

      console.log('Audio setup:', {
        context: 'created',
        analyser: 'connected',
        recorder: this.mediaRecorder.state
      })

      // 设置数据可用事件处理
      this.mediaRecorder.ondataavailable = async (event) => {
        console.log('Data available event:', {
          size: event.data.size,
          type: event.data.type
        })

        if (event.data.size > 0) {
          const hasSound = this.checkAudioLevel()
          console.log('Audio check:', {
            hasSound,
            dataSize: event.data.size
          })

          if (hasSound) {
            this.audioChunks.push(event.data)
            console.log('Chunks collected:', this.audioChunks.length)

            if (this.audioChunks.length >= 2) {
              // 收集到足够的数据就处理
              await this.processAudioChunks()
            }
          }
        }
      }

      // 开始录制
      this.mediaRecorder.start(1000) // 每秒触发一次 ondataavailable
      this.isRecording = true
      console.log('Recording started')
    } catch (error) {
      console.error('Recording setup error:', error)
      throw error
    }
  }

  private checkAudioLevel(): boolean {
    if (!this.analyser) return false

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    console.log('Audio level:', average)

    return average > this.VOLUME_THRESHOLD
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
      console.log('Processing chunks:', {
        totalSize: audioBlob.size,
        chunksCount: this.audioChunks.length
      })

      const text = await this.sendToSpeechRecognition(audioBlob)
      console.log('Recognition result:', text)

      if (text?.trim()) {
        this.onTranscription?.(text)
      }
    } catch (error) {
      console.error('Processing error:', error)
    } finally {
      this.audioChunks = [] // 清空缓存
    }
  }

  stopRecording(): void {
    console.log('Stopping recording')
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  // 3. 发送音频到语音识别模型
  async sendToSpeechRecognition(audioBlob: Blob): Promise<string> {
    try {
      const apiUrl = localStorage.getItem('apiUrl')?.replace(/\/$/, '')
      const apiKey = localStorage.getItem('apiKey')

      if (!apiUrl || !apiKey) {
        throw new Error('API settings not configured')
      }

      // 转换音频格式
      const wavBlob = await this.convertToWav(audioBlob)
      console.log('Audio conversion:', {
        originalType: audioBlob.type,
        originalSize: audioBlob.size,
        convertedSize: wavBlob.size
      })

      const formData = new FormData()
      const audioFile = new File([wavBlob], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      })
      formData.append('file', audioFile)
      formData.append('model', 'FunAudioLLM/SenseVoiceSmall')

      const response = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      })

      const responseData = await response.json()
      console.log('API Response:', {
        status: response.status,
        data: responseData
      })

      if (!response.ok) {
        throw new Error(
          `Speech recognition failed: ${response.status} ${JSON.stringify(responseData)}`
        )
      }

      return responseData.text || ''
    } catch (error) {
      console.error('Speech recognition error:', error)
      throw error
    }
  }

  // 添加音频格式转换方法
  private async convertToWav(webmBlob: Blob): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      try {
        const audioContext = new AudioContext()
        const arrayBuffer = await webmBlob.arrayBuffer()

        audioContext.decodeAudioData(
          arrayBuffer,
          async (audioBuffer) => {
            // 创建离线上下文
            const offlineContext = new OfflineAudioContext({
              numberOfChannels: 1, // 单声道
              length: audioBuffer.length,
              sampleRate: 16000 // 设置采样率为16kHz
            })

            // 创建音频源
            const source = offlineContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(offlineContext.destination)
            source.start()

            // 渲染音频
            const renderedBuffer = await offlineContext.startRendering()

            // 转换为 WAV
            const wavData = this.audioBufferToWav(renderedBuffer)
            const wavBlob = new Blob([wavData], { type: 'audio/wav' })

            resolve(wavBlob)
          },
          reject
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  // WAV 格式转换辅助方法
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = 1
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = buffer.length * blockAlign
    const bufferSize = 44 + dataSize
    const arrayBuffer = new ArrayBuffer(bufferSize)
    const view = new DataView(arrayBuffer)

    // WAV 文件头
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    this.writeString(view, 8, 'WAVE')
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // 写入音频数据
    const channelData = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return arrayBuffer
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // 取当前录制状态
  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  // 添加回调函数类型
  onTranscription?: (text: string) => void
}
