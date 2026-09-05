import { toNextJsHandler } from 'corsair';
import { corsair } from '@/lib/corsair';

export async function GET(req: Request) {
  const handlers = toNextJsHandler(corsair, { basePath: '/api/corsair' });
  return handlers.GET(req);
}

export async function POST(req: Request) {
  const handlers = toNextJsHandler(corsair, { basePath: '/api/corsair' });
  return handlers.POST(req);
}

export async function OPTIONS(req: Request) {
  const handlers = toNextJsHandler(corsair, { basePath: '/api/corsair' });
  return handlers.OPTIONS(req);
}