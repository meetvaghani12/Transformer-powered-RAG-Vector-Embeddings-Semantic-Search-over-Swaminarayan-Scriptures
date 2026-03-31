'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupForm) => {
    setServerError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })
      const result = await res.json()

      if (!res.ok) {
        setServerError(result.error || 'Something went wrong')
        return
      }

      router.push(`/auth/verify?purpose=signup&email=${encodeURIComponent(data.email)}`)
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
          <p className="text-sm text-muted-foreground mt-1">Create your account</p>
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
                placeholder="Min. 8 characters"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Confirm password</label>
              <input
                type="password"
                {...register('confirm')}
                placeholder="••••••••"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {errors.confirm && (
                <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>
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
              {isSubmitting ? 'Sending code...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-foreground hover:underline">
            Sign in
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
