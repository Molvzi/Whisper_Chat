<template>
  <div>
    <div class="flex justify-end mb-4">
      <button @click="toggleSettings" class="text-gray-600 hover:text-gray-800">
        <span class="text-sm">⚙️ 设置</span>
      </button>
    </div>

    <div v-if="modelValue" class="mb-6 p-4 bg-gray-50 rounded-md">
      <h2 class="text-lg font-medium mb-4">API 设置</h2>
      <div class="space-y-4">
        <div>
          <label for="apiKey" class="block text-sm font-medium text-gray-700">API 密钥</label>
          <input
            id="apiKey"
            v-model="apiKeyLocal"
            type="password"
            class="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="输入你的 API 密钥"
          />
        </div>
        <div>
          <label for="apiUrl" class="block text-sm font-medium text-gray-700">API 地址</label>
          <input
            id="apiUrl"
            v-model="apiUrlLocal"
            type="text"
            class="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="https://api.example.com/v1"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref, watch } from 'vue'

  export default defineComponent({
    name: 'ApiSettings',
    props: {
      modelValue: Boolean,
      apiKey: String,
      apiUrl: String
    },
    emits: ['update:modelValue', 'update:apiKey', 'update:apiUrl'],
    setup(props, { emit }) {
      const apiKeyLocal = ref(props.apiKey || '')
      const apiUrlLocal = ref(props.apiUrl || '')

      watch(
        () => props.apiKey,
        (newVal) => {
          apiKeyLocal.value = newVal || ''
        }
      )

      watch(
        () => props.apiUrl,
        (newVal) => {
          apiUrlLocal.value = newVal || ''
        }
      )

      watch(apiKeyLocal, (newVal) => {
        emit('update:apiKey', newVal)
      })

      watch(apiUrlLocal, (newVal) => {
        emit('update:apiUrl', newVal)
      })

      const toggleSettings = () => {
        emit('update:modelValue', !props.modelValue)
      }

      return {
        apiKeyLocal,
        apiUrlLocal,
        toggleSettings
      }
    }
  })
</script>
