import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyOTP, createAuthToken } from '@/lib/otp'

export async function POST(req: NextRequest) {
  const { email, code, purpose } = await req.json()

  if (!email || !code || !purpose) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const valid = await verifyOTP(email, code, purpose)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  // For signup: mark the user as verified
  if (purpose === 'signup') {
    await prisma.user.update({ where: { email }, data: { emailVerified: true } })
  }

  // Create a short-lived one-time token for NextAuth to consume
  const authToken = await createAuthToken(email)
  return NextResponse.json({ authToken })
}
