import { db } from '@/lib/db';
import { chatMessages, actionsLog } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai';

const userId = 'demo-user';

export async function GET() {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(chatMessages.createdAt);

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    await db.insert(chatMessages).values({ userId, role: 'user', content });

    const intent = await parseIntent(content);

    await db.insert(actionsLog).values({
      userId,
      actionType: intent.action,
      status: 'parsed',
      details: intent,
    });

    const reply =
      intent.action === 'unclear'
        ? intent.clarificationNeeded || "I couldn't quite understand that — can you rephrase?"
        : `Got it — I'll ${intent.action.replace('_', ' ')}${intent.recipient ? ` for ${intent.recipient}` : ''}. (Execution coming next.)`;

    await db.insert(chatMessages).values({ userId, role: 'assistant', content: reply });

    return NextResponse.json({ reply, intent });
  } catch (err) {
    console.error('Chat route failed:', err);
    return NextResponse.json(
      { error: 'Something went wrong', details: String(err) },
      { status: 500 }
    );
  }
}