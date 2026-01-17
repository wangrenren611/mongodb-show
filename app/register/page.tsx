'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Database } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/layout/use-toast'

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  const validateForm = () => {
    const newErrors: typeof errors = {}

    if (!registerData.name.trim()) {
      newErrors.name = '请输入姓名'
    }

    if (!registerData.email.trim()) {
      newErrors.email = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerData.email)) {
      newErrors.email = '请输入有效的邮箱地址'
    }

    if (!registerData.password) {
      newErrors.password = '请输入密码'
    } else if (registerData.password.length < 8) {
      newErrors.password = '密码至少需要 8 个字符'
    } else if (!/[A-Z]/.test(registerData.password)) {
      newErrors.password = '密码必须包含至少一个大写字母'
    } else if (!/[a-z]/.test(registerData.password)) {
      newErrors.password = '密码必须包含至少一个小写字母'
    } else if (!/[0-9]/.test(registerData.password)) {
      newErrors.password = '密码必须包含至少一个数字'
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(registerData.password)) {
      newErrors.password = '密码必须包含至少一个特殊字符'
    }

    if (!registerData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码'
    } else if (registerData.password !== registerData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerData.name,
          email: registerData.email,
          password: registerData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: '注册失败',
          description: data.error || '注册失败，请稍后重试',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: '注册成功',
        description: '账户已创建，请登录',
      })

      router.push('/login')
    } catch (error) {
      toast({
        title: '注册失败',
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
            <CardTitle>注册</CardTitle>
            <CardDescription>创建一个新账户以开始使用</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="您的姓名"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  disabled={isLoading}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  disabled={isLoading}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  密码至少 8 个字符，包含大小写字母、数字和特殊字符
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">已有账户？</span>{' '}
                <Link href="/login" className="text-primary hover:underline">
                  立即登录
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
