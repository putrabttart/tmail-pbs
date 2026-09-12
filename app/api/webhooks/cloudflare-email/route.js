import { cloudflareEmailWebhookHealth, ingestCloudflareEmail } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await cloudflareEmailWebhookHealth();
    return respond(payload, { status: payload.ok ? 200 : 500 });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request) {
  try {
    const payload = await ingestCloudflareEmail(request);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}
