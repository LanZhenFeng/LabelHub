/**
 * 用户状态管理 Store (Zustand)
 * 
 * M4: Multi-user authentication
 * - 存储当前用户信息和JWT tokens
 * - 提供登录/登出方法
 * - 持久化到localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'annotator' | 'reviewer'
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UserState {
  // 状态
  user: User | null
  accessToken: string | null
  refreshToken: string | null

  // Actions
  setUser: (user: User) => void
  setTokens: (access: string, refresh: string) => void
  clearAuth: () => void
  logout: () => void // M4: Alias for clearAuth

  // Computed
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isAnnotator: () => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,

      // Actions
      setUser: (user) => set({ user }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      logout: () => {
        // M4: Clear auth and optionally call logout API
        set({ user: null, accessToken: null, refreshToken: null })
      },

      // Computed
      isAuthenticated: () => {
        const { accessToken, user } = get()
        return !!accessToken && !!user
      },

      isAdmin: () => {
        const { user } = get()
        return user?.role === 'admin'
      },

      isAnnotator: () => {
        const { user } = get()
        return user?.role === 'annotator'
      },
    }),
    {
      name: 'labelhub-user-storage', // localStorage key
      // 只持久化token和user，不持久化computed函数
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

