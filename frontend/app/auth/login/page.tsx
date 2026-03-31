'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError('')
    try {
      const res = await fetch('/api/auth/login-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()

      if (!res.ok) {
        setServerError(result.error || 'Something went wrong')
        return
      }

      router.push(`/auth/verify?purpose=login&email=${encodeURIComponent(data.email)}`)
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <p className="text-5xl mb-3">ॐ</p>
          <h1 className="text-xl font-semibold text-foreground">AksharAI</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-foreground text-background font-medium text-sm py-2.5 rounded-xl hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Sending code...' : 'Continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-foreground hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground mt-3">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Continue without account
          </Link>
        </p>
      </div>
    </div>
  )
}
