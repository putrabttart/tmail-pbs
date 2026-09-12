import { ingestCloudflareEmail } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const payload = await ingestCloudflareEmail(request);
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}
