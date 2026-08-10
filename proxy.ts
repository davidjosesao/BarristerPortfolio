import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without Supabase configured we cannot verify anyone, so fail closed with a
  // legible message rather than throwing — an unconfigured deployment used to
  // surface as an opaque MIDDLEWARE_INVOCATION_FAILED 500 on every staff route.
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse(
      'Staff area unavailable: Supabase environment variables are not configured.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    )
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/staff') && pathname !== '/staff/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/staff/login'
    const redirectResponse = NextResponse.redirect(url)
    // Carry refreshed session cookies so Supabase auth state survives the redirect
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  if (user && pathname === '/staff/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/staff/briefs'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/staff/:path*'],
}
