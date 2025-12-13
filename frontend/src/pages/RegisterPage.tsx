/**
 * 注册页面
 * M4: Multi-user authentication
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, UserPlus } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useUserStore } from '@/stores/userStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { setUser, setTokens } = useUserStore()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 前端验证
    if (!username.trim() || !email.trim() || !password.trim()) {
      toast({
        title: '验证失败',
        description: '请填写所有必填字段',
        variant: 'destructive',
      })
      return
    }

    if (username.length < 3) {
      toast({
        title: '验证失败',
        description: '用户名至少需要3个字符',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 8) {
      toast({
        title: '验证失败',
        description: '密码至少需要8个字符',
        variant: 'destructive',
      })
      return
    }

    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      toast({
        title: '验证失败',
        description: '密码必须包含字母和数字',
        variant: 'destructive',
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: '验证失败',
        description: '两次输入的密码不一致',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.register({ username, email, password })

      // 保存用户信息和tokens
      setUser(response.user)
      setTokens(response.access_token, response.refresh_token)

      toast({
        title: '注册成功',
        description: `欢迎加入 LabelHub，${response.user.username}！`,
      })

      // 跳转到主页
      navigate('/')
    } catch (error: any) {
      console.error('Register error:', error)
      const errorMsg = error.response?.data?.detail
      
      // 处理详细错误信息
      if (Array.isArray(errorMsg)) {
        const msg = errorMsg.map((e: any) => e.msg).join(', ')
        toast({
          title: '注册失败',
          description: msg,
          variant: 'destructive',
        })
      } else {
        toast({
          title: '注册失败',
          description: errorMsg || '注册时发生错误，请稍后重试',
          variant: 'destructive',
        })
      }
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
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            创建账户
          </CardTitle>
          <CardDescription className="text-base">
            加入 LabelHub 开始您的标注之旅
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="至少3个字符"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                邮箱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="至少8个字符，包含字母和数字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                确认密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  注册中...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  注册
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              已有账户？{' '}
              <Link
                to="/login"
                className="text-primary font-medium hover:underline"
              >
                立即登录
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

