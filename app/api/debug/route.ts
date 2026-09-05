import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  const result = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages'`
  );
  return NextResponse.json(result.rows);
}