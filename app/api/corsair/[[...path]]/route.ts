import { toNextJsHandler } from 'corsair';
import { getCorsair } from '@/lib/corsair';

export async function GET(req: Request) {
  const handlers = toNextJsHandler(getCorsair(), { basePath: '/api/corsair' });
  return handlers.GET(req);
}

export async function POST(req: Request) {
  const handlers = toNextJsHandler(getCorsair(), { basePath: '/api/corsair' });
  return handlers.POST(req);
}

export async function OPTIONS(req: Request) {
  const handlers = toNextJsHandler(getCorsair(), { basePath: '/api/corsair' });
  return handlers.OPTIONS(req);
}