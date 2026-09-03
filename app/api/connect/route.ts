import { corsair } from '@/lib/corsair';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const tenantId = 'demo-user';

    const { connectUrl } = await corsair.manage.connect.createLink({
      plugin: 'gmail',
      tenantId,
    });

    return NextResponse.redirect(connectUrl);
  } catch (err) {
    console.error('Connect route failed:', err);
    return NextResponse.json(
      { error: 'Failed to create connect link', details: String(err) },
      { status: 500 }
    );
  }
}