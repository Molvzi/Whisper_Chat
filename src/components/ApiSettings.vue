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
            class="mt-1 w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="输入你的 API 密钥"
          />
        </div>
        <div>
          <label for="apiUrl" class="block text-sm font-medium text-gray-700">API 地址</label>
          <div class="flex gap-2 mt-1">
            <input
              id="apiUrl"
              v-model="apiUrlLocal"
              type="text"
              class="w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="https://api.example.com/v1"
            />
            <button
              @click="testConnection"
              class="px-4 py-2 h-10 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm font-medium flex items-center justify-center min-w-[60px]"
              :disabled="!apiUrlLocal || !apiKeyLocal"
            >
              检查
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <label for="model" class="block text-sm font-medium text-gray-700">模型</label>
        <div class="mt-1">
          <select
            id="model"
            v-model="selectedModel"
            class="w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            :disabled="!models.length"
          >
            <option value="" disabled>{{ models.length ? '选择模型' : '加载中...' }}</option>
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.id }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref, watch, onMounted } from 'vue'

  interface ModelData {
    id: string
    name: string
    type: string
    sub_type: string
  }

  export default defineComponent({
    name: 'ApiSettings',
    props: {
      modelValue: Boolean,
      apiKey: String,
      apiUrl: String,
      model: String
    },
    emits: ['update:modelValue', 'update:apiKey', 'update:apiUrl', 'update:model'],
    setup(props, { emit }) {
      const apiKeyLocal = ref(props.apiKey || localStorage.getItem('apiKey') || '')
      const apiUrlLocal = ref(props.apiUrl || localStorage.getItem('apiUrl') || '')
      const models = ref<ModelData[]>([])
      const selectedModel = ref(props.model || '')

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
        localStorage.setItem('apiKey', newVal)
      })

      watch(apiUrlLocal, (newVal) => {
        emit('update:apiUrl', newVal)
        localStorage.setItem('apiUrl', newVal)
      })

      const toggleSettings = () => {
        emit('update:modelValue', !props.modelValue)
      }

      const testConnection = async () => {
        try {
          const response = await fetch(apiUrlLocal.value, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKeyLocal.value}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'deepseek-ai/deepseek-vl2',
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 512,
              temperature: 0.7,
              stream: false
            })
          })

          if (response.ok) {
            alert('连接成功！')
          } else {
            const data = await response.json()
            throw new Error(data.error?.message || `HTTP error! status: ${response.status}`)
          }
        } catch (error: any) {
          alert(`连接失败: ${error.message}`)
        }
      }

      const fetchModels = async () => {
        if (!apiUrlLocal.value || !apiKeyLocal.value) return

        try {
          const baseUrl = apiUrlLocal.value.replace('/chat/completions', '')
          const response = await fetch(`${baseUrl}/models?type=text&sub_type=chat`, {
            headers: {
              Authorization: `Bearer ${apiKeyLocal.value}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            console.log('Models response:', data)
            models.value = Array.isArray(data.data) ? data.data : []
          }
        } catch (error) {
          console.error('获取模型列表失败:', error)
          models.value = []
        }
      }

      watch([apiUrlLocal, apiKeyLocal], () => {
        fetchModels()
      })

      watch(selectedModel, (newVal) => {
        emit('update:model', newVal)
      })

      watch(
        () => props.model,
        (newVal) => {
          selectedModel.value = newVal || ''
        }
      )

      onMounted(() => {
        fetchModels()
      })

      return {
        apiKeyLocal,
        apiUrlLocal,
        toggleSettings,
        testConnection,
        models,
        selectedModel
      }
    }
  })
</script>
