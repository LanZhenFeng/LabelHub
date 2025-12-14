/**
 * 登录页面
 * M4: Multi-user authentication
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useUserStore } from '@/stores/userStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { setUser, setTokens } = useUserStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      toast({
        title: '验证失败',
        description: '请输入用户名和密码',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.login({ username, password })
      
      // 保存用户信息和tokens
      setUser(response.user)
      setTokens(response.access_token, response.refresh_token)

      toast({
        title: '登录成功',
        description: `欢迎回来，${response.user.username}！`,
      })

      // 跳转到主页
      navigate('/')
    } catch (error: any) {
      console.error('Login error:', error)
      toast({
        title: '登录失败',
        description: error.response?.data?.detail || '用户名或密码错误',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Logo背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-primary/10">
        <CardHeader className="space-y-1 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            欢迎回来
          </CardTitle>
          <CardDescription className="text-base">
            登录到 LabelHub 开始标注工作
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名或邮箱</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名或邮箱"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                {/* 暂不实现忘记密码 */}
                {/* <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  忘记密码？
                </Link> */}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              还没有账户？{' '}
              <Link
                to="/register"
                className="text-primary font-medium hover:underline"
              >
                立即注册
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* 页脚信息 */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-sm text-muted-foreground">
        <p>LabelHub v1.1.0 - M4 Multi-user Authentication</p>
      </div>
    </div>
  )
}

