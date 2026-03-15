import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:     { type: 'email' },
        authToken: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.authToken) return null

        const record = await prisma.authToken.findFirst({
          where: {
            email:     credentials.email as string,
            token:     credentials.authToken as string,
            used:      false,
            expiresAt: { gt: new Date() },
          },
          include: { user: true },
        })

        if (!record) return null

        // Consume the token — single use only
        await prisma.authToken.update({ where: { id: record.id }, data: { used: true } })

        return { id: record.user.id, email: record.user.email }
      },
    }),
  ],
  pages: { signIn: '/auth/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
