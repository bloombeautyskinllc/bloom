import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routes } from '@/data/site';
import { authModalUrl } from '@/lib/auth/redirect';

const CORRELATION_HEADER = 'x-correlation-id';

// Routes that need a session. Role and onboarding checks happen in their layouts (they need the database).
const PROTECTED_PREFIXES = [routes.dashboard, routes.admin, routes.booking];

const isProtected = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest) {
  const correlationId = request.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID();

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(CORRELATION_HEADER, correlationId);
    return NextResponse.next({ request: { headers } });
  };

  let response = forward();

  // Refresh the Supabase session and write the new cookies to both the request and the response
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims validates the JWT; never trust an unverified session in a guard
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && isProtected(pathname)) {
    // Direct visits (bookmarks, shared links) land on the home page with the sign-in modal open.
    // Links clicked inside the site are intercepted client-side and never get here.
    const redirect = NextResponse.redirect(new URL(authModalUrl('signin', `${pathname}${search}`), request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  // Everything except static assets and images
  matcher: ['/((?!_next/static|_next/image|favicon.png|.*\\.(?:png|jpg|jpeg|webp|svg|ico|gif|woff2?)$).*)'],
};
