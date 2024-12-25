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

  watch(transcript, (newText) => {
    if (newText) {
      transcriptionHistory.value.push(newText)
      timestamps.value.push(Date.now())
    }
  })

  async function toggleScreenCapture() {
    if (!isCapturing.value) {
      try {
        mediaStream.value = await startScreenCapture()
        if (videoPreview.value && mediaStream.value) {
          videoPreview.value.srcObject = mediaStream.value
        }
        isCapturing.value = true
      } catch (error) {
        console.error('Failed to start screen capture:', error)
      }
    } else {
      if (mediaStream.value) {
        stopScreenCapture(mediaStream.value)
        if (videoPreview.value) {
          videoPreview.value.srcObject = null
        }
        mediaStream.value = null
      }
      isCapturing.value = false
    }
  }
</script>
