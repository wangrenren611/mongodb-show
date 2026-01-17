'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Database } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/layout/use-toast'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: loginData.email,
        password: loginData.password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          title: '登录失败',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: '登录成功',
          description: '正在跳转...',
        })
        router.push('/connections')
        router.refresh()
      }
    } catch (error) {
      toast({
        title: '登录失败',
        description: '发生错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <Database className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">Mongoose Show</span>
          </Link>
          <p className="text-muted-foreground mt-2">MongoDB 数据库可视化管理工具</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>使用邮箱和密码登录您的账户</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">还没有账户？</span>{' '}
                <Link href="/register" className="text-primary hover:underline">
                  立即注册
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
