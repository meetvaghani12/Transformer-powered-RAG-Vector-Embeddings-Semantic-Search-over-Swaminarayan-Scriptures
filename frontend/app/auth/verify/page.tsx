'use client'

import { useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

const STORAGE_KEY = 'vie_chats'

function VerifyForm() {
  const params      = useSearchParams()
  const router      = useRouter()
  const purpose     = params.get('purpose') as 'signup' | 'login'
  const email       = params.get('email') || ''

  const [otp, setOtp]       = useState(['', '', '', '', '', ''])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      inputs.current[5]?.focus()
    }
  }

  const migrateLocalChats = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const chats = JSON.parse(stored)
      if (!Array.isArray(chats) || chats.length === 0) return

      await Promise.all(
        chats.map((chat: object) =>
          fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chat),
          })
        )
      )
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Migration failure is non-fatal — chats stay in localStorage
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      setError('Enter all 6 digits')
      return
    }

    setError('')
    setLoading(true)

    try {
      // 1. Verify OTP
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, purpose }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid code')
        return
      }

      // 2. Sign in via NextAuth using one-time auth token
      const result = await signIn('credentials', {
        email,
        authToken: data.authToken,
        redirect: false,
      })

      if (result?.error) {
        setError('Sign-in failed. Please try again.')
        return
      }

      // 3. Migrate localStorage chats to DB
      await migrateLocalChats()

      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    const endpoint = purpose === 'signup' ? '/api/auth/signup' : '/api/auth/login-request'
    // We don't have password here — just show a message to go back
    router.push(purpose === 'signup' ? `/auth/signup` : `/auth/login`)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">ॐ</p>
          <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a 6-digit code to<br />
            <span className="text-foreground font-medium">{email}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit}>
            {/* OTP input */}
            <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputs.current[idx] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className="w-11 h-13 text-center text-xl font-bold bg-secondary border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  style={{ height: '52px' }}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.join('').length < 6}
              className="w-full bg-foreground text-background font-medium text-sm py-2.5 rounded-xl hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Didn&apos;t receive it?{' '}
          <button onClick={handleResend} className="text-foreground hover:underline">
            Go back to resend
          </button>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  )
}
