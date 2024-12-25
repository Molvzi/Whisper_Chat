import { startScreenCapture, getAudioTrack } from './screenCapture'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private analyser: AnalyserNode | null = null
  private audioData: Float32Array[] = []
  private isRecording: boolean = false
  private processingTimeout: number | null = null
  private mediaStream: MediaStream | null = null
  private readonly VOLUME_THRESHOLD = 0.01
  private readonly BUFFER_SIZE = 2048
  private readonly MAX_BUFFERS = 15
  private source: MediaStreamAudioSourceNode | null = null
  private lastText: string = ''
  private debounceTimer: number | null = null
  private readonly DEBOUNCE_DELAY = 1000
  private isProcessing: boolean = false
  private silenceTimer: number | null = null
  private readonly SILENCE_THRESHOLD = 500

  async startRecording(existingStream?: MediaStream): Promise<void> {
    try {
      this.mediaStream = existingStream || (await startScreenCapture())
      const audioTrack = getAudioTrack(this.mediaStream)

      if (!audioTrack) throw new Error('No audio track found')

      this.audioContext = new AudioContext({ sampleRate: 16000 })

      // 加载 AudioWorklet 处理器
      await this.audioContext.audioWorklet.addModule(`data:text/javascript,
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.silentCount = 0;
            this.SILENT_THRESHOLD = 0.01;
            this.MAX_SILENT_COUNTS = 50;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0][0];
            if (input) {
              const volume = Math.max(...input.map(Math.abs));

              if (volume > this.SILENT_THRESHOLD) {
                this.silentCount = 0;
                this.port.postMessage({
                  audioData: input,
                  volume: volume,
                  type: 'audio'
                });
              } else {
                this.silentCount++;
                if (this.silentCount >= this.MAX_SILENT_COUNTS) {
                  this.port.postMessage({ type: 'silence' });
                  this.silentCount = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `)

      this.source = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]))
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048

      // 创建 AudioWorklet 节点
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor')

      this.workletNode.port.onmessage = (e) => {
        if (e.data.type === 'silence') {
          if (!this.silenceTimer) {
            this.silenceTimer = window.setTimeout(() => {
              if (this.audioData.length > 0) {
                this.processAudioData()
              }
              this.silenceTimer = null
            }, this.SILENCE_THRESHOLD)
          }
          return
        }

        const { audioData, volume } = e.data
        if (volume > this.VOLUME_THRESHOLD && !this.isProcessing) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
          }

          this.audioData.push(new Float32Array(audioData))

          if (this.audioData.length >= this.MAX_BUFFERS) {
            this.processAudioData()
          }
        }
      }

      // 连接节点
      this.source.connect(this.analyser!)
      this.analyser!.connect(this.workletNode!)
      this.workletNode!.connect(this.audioContext.destination)

      this.isRecording = true
      console.log('Recording started with settings:', {
        sampleRate: this.audioContext.sampleRate,
        bufferSize: this.BUFFER_SIZE
      })
    } catch (error) {
      console.error('Recording setup error:', error)
      this.stopRecording()
      throw error
    }
  }

  private async processAudioData() {
    if (this.audioData.length === 0 || !this.audioContext || !this.isRecording || this.isProcessing)
      return

    try {
      this.isProcessing = true

      // 合并音频数据
      const totalLength = this.audioData.reduce((acc, buf) => acc + buf.length, 0)
      const mergedData = new Float32Array(totalLength)
      let offset = 0

      for (const buffer of this.audioData) {
        mergedData.set(buffer, offset)
        offset += buffer.length
      }

      // 创建音频缓冲区
      const audioBuffer = this.audioContext.createBuffer(
        1,
        mergedData.length,
        this.audioContext.sampleRate
      )
      audioBuffer.getChannelData(0).set(mergedData)

      // 转换为 WAV
      const wavBlob = this.audioBufferToWav(audioBuffer)

      const text = await this.sendToSpeechRecognition(wavBlob)
      if (text?.trim() && this.isRecording) {
        if (this.isSimilarText(text, this.lastText)) {
          return
        }

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer)
        }

        this.debounceTimer = window.setTimeout(() => {
          if (this.isRecording) {
            this.onTranscription?.(text)
            this.lastText = text
          }
        }, this.DEBOUNCE_DELAY)
      }
    } catch (error) {
      console.error('Processing error:', error)
    } finally {
      this.audioData = []
      this.isProcessing = false
    }
  }

  private isSimilarText(text1: string, text2: string): boolean {
    // 如果两个文本完全相同
    if (text1 === text2) return true

    // 如果其中一个文本包含另一个
    if (text1.includes(text2) || text2.includes(text1)) return true

    // 计算编辑距离
    const distance = this.levenshteinDistance(text1, text2)
    const maxLength = Math.max(text1.length, text2.length)

    // 如果编辑距离小于文本长度的30%，认为是相似的
    return distance / maxLength < 0.3
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1)
        }
      }
    }

    return dp[m][n]
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording) return

    try {
      // 首先发送停止命令给 worklet
      if (this.workletNode) {
        this.workletNode.port.postMessage({ command: 'stop' })
      }

      // 等待一小段时间确保消息被处理
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 断开连接
      if (this.source) {
        this.source.disconnect()
        this.source = null
      }

      if (this.workletNode) {
        this.workletNode.disconnect()
        this.workletNode = null
      }

      if (this.analyser) {
        this.analyser.disconnect()
        this.analyser = null
      }

      // 关闭音频上下文
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close()
      }
      this.audioContext = null

      this.audioData = []
      this.isRecording = false

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }
    } catch (error) {
      console.error('Error stopping audio processor:', error)
      throw error
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = 1
    const sampleRate = 16000
    const format = 1 // PCM
    const bitDepth = 16
    const blockAlign = (numChannels * bitDepth) / 8
    const byteRate = sampleRate * blockAlign
    const dataSize = buffer.length * blockAlign
    const bufferSize = 44 + dataSize
    const arrayBuffer = new ArrayBuffer(bufferSize)
    const view = new DataView(arrayBuffer)

    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)

    // 写入音频数据
    const channelData = buffer.getChannelData(0)
    let offset = 44
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  private async sendToSpeechRecognition(audioBlob: Blob): Promise<string> {
    try {
      const apiUrl = localStorage.getItem('apiUrl')?.replace(/\/$/, '')
      const apiKey = localStorage.getItem('apiKey')

      if (!apiUrl || !apiKey) {
        throw new Error('API settings not configured')
      }

      // 创建一个新的 FormData 对象
      const formData = new FormData()
      const audioFile = new File([audioBlob], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      })
      formData.append('file', audioFile)
      formData.append('model', 'FunAudioLLM/SenseVoiceSmall')

      // 发送请求
      const response = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      })

      const responseData = await response.json()
      console.log('API Response:', responseData)

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

  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  onTranscription?: (text: string) => void
}
