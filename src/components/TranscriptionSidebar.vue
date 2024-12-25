<template>
  <div class="w-64 bg-gray-50 p-4 border-r border-gray-200 h-screen overflow-y-auto">
    <h3 class="text-lg font-medium mb-4">语音识别结果</h3>
    <div class="space-y-4">
      <div
        v-for="(text, index) in transcriptions"
        :key="index"
        class="p-3 bg-white rounded-md shadow-sm"
      >
        <p class="text-sm text-gray-700">{{ text }}</p>
        <span class="text-xs text-gray-400">{{ formatTime(timestamps[index]) }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent } from 'vue'
  import type { PropType } from 'vue'

  export default defineComponent({
    name: 'TranscriptionSidebar',
    props: {
      transcriptions: {
        type: Array as PropType<string[]>,
        default: () => []
      },
      timestamps: {
        type: Array as PropType<number[]>,
        default: () => []
      }
    },
    setup() {
      const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString()
      }

      return { formatTime }
    }
  })
</script>
