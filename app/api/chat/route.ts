import { db } from '@/lib/db';
import { chatMessages } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const userId = 'demo-user'; // placeholder until real auth/session wiring

export async function GET() {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(chatMessages.createdAt);

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const { content } = await req.json();

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Save the user's message
  await db.insert(chatMessages).values({
    userId,
    role: 'user',
    content,
  });

  // Placeholder assistant response — we'll replace this with real AI parsing next
  const reply = `Got it — you said: "${content}". (AI parsing coming next.)`;

  await db.insert(chatMessages).values({
    userId,
    role: 'assistant',
    content: reply,
  });

  return NextResponse.json({ reply });
}