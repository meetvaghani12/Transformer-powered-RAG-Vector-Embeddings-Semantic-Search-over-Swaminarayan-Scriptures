export { auth as middleware } from '@/auth'

export const config = {
  // Only run on auth routes to handle redirects properly
  matcher: ['/auth/login', '/auth/signup'],
}
