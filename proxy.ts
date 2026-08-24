import { clerkMiddleware } from "@clerk/nextjs/server"

/**
 * Session handling only — no route matching. Clerk deprecated
 * `createRouteMatcher` because middleware path patterns can drift from how
 * Next.js actually routes a request, which quietly leaves protected resources
 * reachable. Each resource guards itself instead: the app page calls
 * `auth.protect()`, and `/api/state` answers a missing session with 401.
 */
export default clerkMiddleware()

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path. It only activates on production keys, so a
    // missing entry here breaks handshake and session refresh at deploy time
    // while looking perfectly fine in development.
    "/__clerk/:path*",
  ],
}
