import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { generateOTP, saveOTP } from '@/lib/otp'
import { sendOTPEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Constant-time response to prevent user enumeration
  if (!user || !user.emailVerified) {
    await bcrypt.compare(password, '$2b$12$invalid.hash.to.prevent.timing.attack.padding')
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const otp = generateOTP()
  await saveOTP(email, otp, 'login')
  await sendOTPEmail(email, otp, 'login')

  return NextResponse.json({ status: 'otp_sent' })
}
