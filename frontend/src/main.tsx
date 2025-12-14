import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { setupAuthInterceptors } from './lib/api'
import { useUserStore } from './stores/userStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

// M4: Setup axios interceptors for JWT authentication
setupAuthInterceptors(
  () => useUserStore.getState().accessToken,
  () => useUserStore.getState().refreshToken,
  (access, refresh) => useUserStore.getState().setTokens(access, refresh),
  () => useUserStore.getState().clearAuth()
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

