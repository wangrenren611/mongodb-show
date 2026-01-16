export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/connections/:path*',
    '/databases/:path*',
    '/documents/:path*',
    '/query/:path*',
    '/charts/:path*',
  ],
}
