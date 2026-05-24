/**
 * Server-Sent Events (SSE) endpoint for real-time inbox updates.
 *
 * Frontend connects to this endpoint and receives "newmail" events
 * when Gmail push notification arrives. This eliminates polling delay.
 *
 * Usage in frontend:
 *   const es = new EventSource('/api/messages/stream?alias=user@domain.com');
 *   es.addEventListener('newmail', () => refreshInbox());
 */

import { subscribeNewMail, unsubscribeNewMail } from '@/lib/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const alias = searchParams.get('alias') || '';

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      // Keep-alive every 25 seconds to prevent timeout
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25000);

      // Subscribe to new mail notifications
      const listener = (payload) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: newmail\ndata: ${JSON.stringify(payload || {})}\n\n`)
          );
        } catch {
          // Client disconnected
        }
      };

      subscribeNewMail(listener);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(keepAlive);
        unsubscribeNewMail(listener);
        try { controller.close(); } catch {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    }
  });
}
