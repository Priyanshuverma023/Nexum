import { db } from '@/lib/db';
import { chatMessages, actionsLog } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai';
import { executeIntent } from '@/lib/execute';

const userId = 'default';

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

    let reply: string;

    if (intent.action === 'unclear') {
      reply = intent.clarificationNeeded || "I couldn't quite understand that — can you rephrase?";
      await db.insert(actionsLog).values({
        userId,
        actionType: 'unclear',
        status: 'needs_clarification',
        details: intent,
      });
    } else {
      const execResult = await executeIntent(intent, userId);

      await db.insert(actionsLog).values({
        userId,
        actionType: intent.action,
        status: execResult.error ? 'failed' : 'success',
        details: { intent, execResult },
      });

      reply = execResult.error
        ? `I tried to ${intent.action.replace('_', ' ')} but hit an error: ${execResult.error}`
        : `Done — ${intent.action === 'both' ? 'scheduled the event and sent the email' : intent.action.replace('_', ' ')}${intent.recipient ? ` for ${intent.recipient}` : ''}.`;
    }

    await db.insert(chatMessages).values({ userId, role: 'assistant', content: reply });

    return NextResponse.json({ reply, intent });
  } catch (err) {
    console.error('Chat route failed:', err);
    return NextResponse.json({ error: 'Something went wrong', details: String(err) }, { status: 500 });
  }
}