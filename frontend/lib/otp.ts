import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

const OTP_TTL_MS = 10 * 60 * 1000   // 10 minutes
const AUTH_TOKEN_TTL_MS = 5 * 60 * 1000  // 5 minutes

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function saveOTP(email: string, otp: string, purpose: 'signup' | 'login'): Promise<void> {
  // Invalidate any previous unused OTPs for this email+purpose
  await prisma.oTPCode.updateMany({
    where: { email, purpose, used: false },
    data: { used: true },
  })

  const codeHash = await bcrypt.hash(otp, 10)
  await prisma.oTPCode.create({
    data: {
      email,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
}

export async function verifyOTP(
  email: string,
  code: string,
  purpose: 'signup' | 'login'
): Promise<boolean> {
  const record = await prisma.oTPCode.findFirst({
    where: {
      email,
      purpose,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) return false

  const valid = await bcrypt.compare(code, record.codeHash)
  if (!valid) return false

  await prisma.oTPCode.update({ where: { id: record.id }, data: { used: true } })
  return true
}

export async function createAuthToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  await prisma.authToken.create({
    data: {
      email,
      token,
      expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS),
    },
  })
  return token
}
