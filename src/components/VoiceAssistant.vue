<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- 左侧语音识别结果 -->
    <TranscriptionSidebar :transcriptions="transcriptionHistory" :timestamps="timestamps" />

    <!-- 主要内容区域 -->
    <div class="flex-1 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
        <ApiSettings
          v-model="showSettings"
          v-model:apiKey="apiKey"
          v-model:apiUrl="apiUrl"
          v-model:model="selectedModel"
        />

        <h1 class="text-3xl font-bold text-gray-900 text-center mb-8">语音助手</h1>

        <button
          @click="toggleScreenCapture"
          :disabled="isListening"
          class="w-full flex justify-center items-center px-4 py-3 rounded-md text-white font-medium disabled:bg-gray-400 disabled:cursor-not-allowed enabled:bg-indigo-600 enabled:hover:bg-indigo-700 transition-colors duration-200"
        >
          <img
            src="../assets/microphone.svg"
            v-if="isListening"
            alt="microphone"
            class="w-5 h-5 mr-2"
          />
          {{ isListening ? '正在识别...' : '开始识别' }}
        </button>

        <div v-if="error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p class="text-red-600">{{ error }}</p>
        </div>

        <div v-if="transcript" class="mt-4 p-4 bg-gray-50 rounded-md">
          <p class="text-sm text-gray-500">识别结果:</p>
          <p class="mt-1 text-gray-900">{{ transcript }}</p>
        </div>

        <div v-if="aiResponse" class="mt-4 p-4 bg-blue-50 rounded-md">
          <p class="text-sm text-blue-500">AI 回复:</p>
          <p class="mt-1 text-gray-900">{{ aiResponse }}</p>
        </div>

        <div class="mt-6">
          <label for="output" class="block text-sm font-medium text-gray-700">模型输出结果</label>
          <textarea
            id="output"
            v-model="aiResponse"
            rows="4"
            readonly
            class="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="AI 响应将显示在这里..."
          ></textarea>
        </div>

        <video ref="videoPreview" autoplay muted class="mt-4 w-full max-w-2xl"></video>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import ApiSettings from './ApiSettings.vue'
  import TranscriptionSidebar from './TranscriptionSidebar.vue'
  import { startScreenCapture, stopScreenCapture } from '../services/screenCapture'
  import { AudioProcessor } from '../services/audioProcessing'

  const transcript = ref('')
  const aiResponse = ref('')
  const isListening = ref(false)
  const error = ref('')
  const showSettings = ref(false)
  const apiKey = ref('')
  const apiUrl = ref('')
  const selectedModel = ref('')

  const videoPreview = ref<HTMLVideoElement | null>(null)
  const mediaStream = ref<MediaStream | null>(null)
  const isCapturing = ref(false)

  const transcriptionHistory = ref<string[]>([])
  const timestamps = ref<number[]>([])

  const audioProcessor = ref(new AudioProcessor())

  async function startContinuousRecording() {
    try {
      isListening.value = true
      mediaStream.value = await startScreenCapture()

      // 设置音频处理器的回调
      audioProcessor.value.onTranscription = (text: string) => {
        if (text.trim()) {
          // 添加新的识别结果到历史记录
          transcriptionHistory.value.push(text)
          timestamps.value.push(Date.now())

          // 更新当前识别结果
          transcript.value = text

          // 可以在这里添加发送到 AI 模型的逻辑
          sendToAI(text)
        }
      }

      await audioProcessor.value.startRecording(mediaStream.value)
      isCapturing.value = true
    } catch (error: any) {
      error.value = error.message
      isListening.value = false
    }
  }

  async function stopRecording() {
    try {
      audioProcessor.value.stopRecording()
      if (mediaStream.value) {
        stopScreenCapture(mediaStream.value)
        mediaStream.value = null
      }
    } finally {
      isCapturing.value = false
      isListening.value = false
    }
  }

  // 发送文本到 AI 模型
  async function sendToAI(text: string) {
    try {
      const response = await fetch(`${apiUrl.value}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel.value,
          messages: [
            {
              role: 'user',
              content: text
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`AI response failed: ${response.status}`)
      }

      const result = await response.json()
      aiResponse.value = result.choices[0].message.content
    } catch (error: any) {
      console.error('Error sending to AI:', error)
      error.value = error.message
    }
  }

  // 修改 toggleScreenCapture 函数
  function toggleScreenCapture() {
    if (!isCapturing.value) {
      startContinuousRecording()
    } else {
      stopRecording()
    }
  }
</script>
