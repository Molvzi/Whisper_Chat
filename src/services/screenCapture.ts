/**
 * 开始屏幕捕获
 * 使用 navigator.mediaDevices.getDisplayMedia API 来请求屏幕共享
 */
export async function startScreenCapture(): Promise<MediaStream> {
  try {
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: false,
      audio: true // 启用音频捕获
    })

    return mediaStream
  } catch (error) {
    console.error('Error capturing screen:', error)
    throw error
  }
}

/**
 * 停止屏幕捕获
 * 通过停止所有轨道来释放媒体流资源
 * @param {MediaStream} mediaStream - 要停止的媒体流对象
 */
export function stopScreenCapture(mediaStream: MediaStream) {
  mediaStream.getTracks().forEach((track) => track.stop())
}

/**
 * 获取媒体流中的音频轨道
 */
export function getAudioTrack(mediaStream: MediaStream): MediaStreamTrack | undefined {
  return mediaStream.getAudioTracks()[0]
}
