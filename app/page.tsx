import { auth } from '@clerk/nextjs/server';
import { SlateApp } from '@/components/slate-app';

/**
 * The auth check lives here rather than in the proxy: path matching in
 * middleware can drift from how Next.js actually routes a request, so the
 * guard sits on the resource it protects. Unauthenticated visitors are
 * redirected to sign-in before any task data is requested.
 */
export default async function Page() {
  await auth.protect();
  return <SlateApp />;
}
