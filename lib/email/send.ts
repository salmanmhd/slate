/**
 * Minimal email sender using the Resend HTTP API directly (no SDK dependency).
 * Activate by setting RESEND_API_KEY (and optionally RESEND_FROM) in the env.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet — a soft skip so cron runs don't hard-fail.
    return { success: false, skipped: true, error: 'RESEND_API_KEY not set' };
  }

  const from = process.env.RESEND_FROM || 'Slate <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      return { success: false, error: `Resend ${res.status}: ${await res.text()}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}
