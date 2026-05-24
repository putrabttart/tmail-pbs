/**
 * Gmail Push Notification Webhook
 *
 * Google Pub/Sub sends a POST here when new email arrives.
 * This invalidates the message cache so the next poll gets fresh data instantly.
 *
 * Setup required:
 * 1. Create a Google Cloud Pub/Sub topic (e.g. "gmail-push")
 * 2. Create a push subscription pointing to: https://yourdomain.com/api/webhooks/gmail
 * 3. Grant gmail-api-push@system.gserviceaccount.com "Pub/Sub Publisher" on the topic
 * 4. Call gmail.users.watch() with the topic name (done via /api/webhooks/gmail/watch)
 *
 * Env vars needed:
 *   GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/gmail-push
 */

import { NextResponse } from 'next/server';
import { invalidateMessageCache, notifyNewMail } from '@/lib/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    // Google Pub/Sub wraps the notification in a "message" field
    const message = body?.message;
    if (!message?.data) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // Decode base64 data from Pub/Sub
    const decoded = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8')
    );

    // decoded contains: { emailAddress, historyId }
    const { emailAddress, historyId } = decoded || {};

    if (emailAddress) {
      // Invalidate message list cache so next poll gets fresh data
      invalidateMessageCache();
      // Notify SSE subscribers (if connected)
      notifyNewMail({ emailAddress, historyId });
    }

    // Must return 200 to acknowledge, otherwise Pub/Sub retries
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('Gmail webhook error:', err);
    // Still return 200 to prevent Pub/Sub retry storm
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
