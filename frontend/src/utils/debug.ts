/**
 * Debug utility for API calls
 */
export const logApiCall = (method: string, url: string, data?: any) => {
  console.group(`🌐 API ${method.toUpperCase()} ${url}`)
  console.log('Timestamp:', new Date().toISOString())
  if (data) {
    console.log('Payload:', JSON.stringify(data, null, 2))
  }
  console.log('Auth Token:', localStorage.getItem('accessToken') ? 'Present' : 'Missing')
  console.groupEnd()
}

export const logApiResponse = (response: any) => {
  console.group('✅ API Response')
  console.log('Status:', response.status)
  console.log('Data:', response.data)
  console.groupEnd()
}

export const logApiError = (error: any) => {
  console.group('❌ API Error')
  console.error('Error:', error)
  if (error.response) {
    console.error('Status:', error.response.status)
    console.error('Status Text:', error.response.statusText)
    console.error('Data:', error.response.data)
    console.error('Headers:', error.response.headers)
  } else if (error.request) {
    console.error('Request made but no response received:', error.request)
  } else {
    console.error('Error setting up request:', error.message)
  }
  console.groupEnd()
}

