import { startScreenCapture, getAudioTrack } from './screenCapture'

export class AudioProcessor {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording: boolean = false

  async startRecording(): Promise<void> {
    try {
      // 1. 获取屏幕和音频流
      const mediaStream = await startScreenCapture()
      const audioTrack = getAudioTrack(mediaStream)

      if (!audioTrack) {
        throw new Error('No audio track found in the media stream')
      }

      // 创建仅包含音频轨道的新 MediaStream
      const audioStream = new MediaStream([audioTrack])

      // 2. 设置 MediaRecorder
      this.mediaRecorder = new MediaRecorder(audioStream)
      this.audioChunks = []

      // 收集音频数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      // 开始录制
      this.mediaRecorder.start(1000) // 每秒触发一次 dataavailable 事件
      this.isRecording = true
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }

  stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('No recording in progress')
    }

    return new Promise<Blob>((resolve) => {
      this.mediaRecorder!.onstop = () => {
        // 将所有音频块合并为一个 Blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        this.isRecording = false
        resolve(audioBlob)
      }

      this.mediaRecorder!.stop()
    })
  }

  // 3. 发送音频到语音识别模型
  async sendToSpeechRecognition(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob)

      // 这里替换为实际的 API 端点
      const response = await fetch('YOUR_SPEECH_RECOGNITION_API_ENDPOINT', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Speech recognition request failed')
      }

      const result = await response.json()
      return result.text // 假设 API 返回包含 text 字段的 JSON
    } catch (error) {
      console.error('Error in speech recognition:', error)
      throw error
    }
  }

  // 获取当前录制状态
  isCurrentlyRecording(): boolean {
    return this.isRecording
  }
}
