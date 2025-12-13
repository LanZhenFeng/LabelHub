/**
 * 受保护路由组件
 * M4: Multi-user authentication - Route guards
 */

import { Navigate } from 'react-router-dom'
import { useUserStore } from '@/stores/userStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin } = useUserStore()

  // 未登录，跳转到登录页
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  // 需要管理员权限但用户不是管理员
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />
  }

  // 已认证且权限符合，渲染子组件
  return <>{children}</>
}

