import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface User {
  id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  role: string
  mfa_enabled: boolean
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>) => {
      state.isAuthenticated = true
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      localStorage.setItem('accessToken', action.payload.accessToken)
      localStorage.setItem('refreshToken', action.payload.refreshToken)
    },
    logout: (state) => {
      state.isAuthenticated = false
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    },
  },
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer

