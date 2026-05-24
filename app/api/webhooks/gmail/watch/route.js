/**
 * Admin endpoint to register/renew Gmail push notifications.
 *
 * Gmail watch() expires after 7 days, so this should be called periodically
 * (e.g., via cron job or manual trigger from admin dashboard).
 *
 * POST /api/webhooks/gmail/watch
 * Headers: Authorization: Bearer <admin-token>
 *
 * Requires env: GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/gmail-push
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/runtime';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await requireAdmin(request);

    const topic = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topic) {
      return NextResponse.json(
        { error: 'GMAIL_PUBSUB_TOPIC not configured' },
        { status: 400 }
      );
    }

    // Import ensureToken dynamically to get authenticated client
    const { ensureToken } = await import('@/lib/server/runtime');
    const client = await ensureToken();
    const gmail = google.gmail({ version: 'v1', auth: client });

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: topic,
        labelIds: ['INBOX']
      }
    });

    return NextResponse.json({
      status: 'ok',
      historyId: res.data.historyId,
      expiration: res.data.expiration,
      message: 'Gmail push notifications active. Expires in ~7 days.'
    });
  } catch (err) {
    console.error('Gmail watch setup error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to setup Gmail watch' },
      { status: err.status || 500 }
    );
  }
}
