import axios from 'axios'

export class AIService {
  constructor(
    private apiUrl: string,
    private apiKey: string
  ) {}

  async getResponse(query: string) {
    try {
      const response = await axios.post(
        '/api/ai',
        { query },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          baseURL: this.apiUrl
        }
      )
      return response.data.response
    } catch (error: any) {
      throw new Error(`AI响应错误: ${error.message}`)
    }
  }
}
