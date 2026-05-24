import { listMessages } from '@/lib/server/runtime';
import { respond, handleError } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias') || '';
    const pin = searchParams.get('pin') || '';
    const payload = await listMessages(alias, { pin });
    return respond(payload);
  } catch (err) {
    return handleError(err);
  }
}
