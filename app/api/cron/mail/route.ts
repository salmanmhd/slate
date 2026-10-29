import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { loadUserState } from '@/lib/db/user-data';
import { buildDigest, DIGEST_KINDS, type DigestKind } from '@/lib/email/digests';
import { sendEmail } from '@/lib/email/send';

/** The Mongo driver is a Node library — it cannot run on the edge runtime. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Task-alert emails. Vercel Cron calls this with
 * `Authorization: Bearer ${CRON_SECRET}` and `?kind=` set per schedule in
 * vercel.json. Every account with data gets the email for that kind, unless
 * the digest decides there's nothing worth saying.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: without a secret anyone could make this send mail.
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get('kind') as DigestKind | null;
  if (!kind || !DIGEST_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of ${DIGEST_KINDS.join(', ')}` }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const db = await getDb();
  const userIds = (await db.collection('tasks').distinct('userId')) as string[];
  const clerk = await clerkClient();

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const user = await clerk.users.getUser(userId);
      const to = user.primaryEmailAddress?.emailAddress;
      if (!to) {
        skipped++;
        continue;
      }

      const digest = buildDigest(kind, await loadUserState(userId), appUrl);
      if (!digest) {
        skipped++;
        continue;
      }

      const result = await sendEmail({ to, ...digest });
      if (result.success) sent++;
      else {
        skipped++;
        if (!result.skipped && result.error) errors.push(`${userId}: ${result.error}`);
      }
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return NextResponse.json({ ok: true, kind, users: userIds.length, sent, skipped, errors: errors.slice(0, 20) });
}
