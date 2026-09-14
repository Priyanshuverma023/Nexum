import { db } from '@/lib/db';
import { chatMessages, actionsLog } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai';
import { executeIntent } from '@/lib/execute';

const userId = 'default';

export async function GET() {
  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);

    return NextResponse.json(messages);
  } catch (err) {
    console.error('Failed to load chat:', err);

    return NextResponse.json(
      { error: 'Failed to load chat messages' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    /*
     * Get previous conversation BEFORE inserting the current message.
     * This prevents the current message from being duplicated in context.
     */
    const previousMessages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);

    await db.insert(chatMessages).values({
      userId,
      role: 'user',
      content,
    });

    const intent = await parseIntent(
      content,
      previousMessages.map((message) => ({
        ...message,
        role: message.role as 'assistant' | 'user',
      })),
    );

    let reply: string;

    /*
     * Handle unclear/missing information.
     */
    if (intent.action === 'unclear') {
      reply =
        intent.clarificationNeeded ||
        'I need a little more information to complete that request.';

      await db.insert(actionsLog).values({
        userId,
        actionType: 'unclear',
        status: 'needs_clarification',
        details: intent,
      });
    } else {
      /*
       * Validate required information BEFORE executing anything.
       */
      const missingFields: string[] = [];

      if (
        (intent.action === 'send_email' || intent.action === 'both') &&
        !intent.recipient
      ) {
        missingFields.push('email address');
      }

      if (
        (intent.action === 'send_email' || intent.action === 'both') &&
        !intent.emailBody?.trim()
      ) {
        missingFields.push('email content');
      }

      if (
        (intent.action === 'schedule_event' || intent.action === 'both') &&
        !intent.eventTime?.trim()
      ) {
        missingFields.push('meeting time');
      }

      if (missingFields.length > 0) {
        reply = `I need the ${missingFields.join(
          ' and ',
        )} before I can complete that request.`;

        await db.insert(actionsLog).values({
          userId,
          actionType: intent.action,
          status: 'needs_clarification',
          details: {
            intent,
            missingFields,
          },
        });
      } else {
        const execResult = await executeIntent(intent, userId);

        await db.insert(actionsLog).values({
          userId,
          actionType: intent.action,
          status: execResult.error ? 'failed' : 'success',
          details: {
            intent,
            execResult,
          },
        });

        if (execResult.error) {
          /*
           * Give a useful response for partial execution.
           */
          if (execResult.emailSent && !execResult.eventCreated) {
            reply = `The email was sent successfully, but I couldn't create the calendar event: ${execResult.error}`;
          } else if (execResult.eventCreated && !execResult.emailSent) {
            reply = `The calendar event was created successfully, but I couldn't send the email: ${execResult.error}`;
          } else {
            reply = `I couldn't complete that request: ${execResult.error}`;
          }
        } else {
          if (intent.action === 'both') {
            reply = `Done — I scheduled "${intent.eventTitle || 'the meeting'}" for ${execResult.scheduledFor} and sent the email to ${intent.recipient}.`;
          } else if (intent.action === 'schedule_event') {
            reply = `Done — I scheduled "${intent.eventTitle || 'the meeting'}" for ${execResult.scheduledFor}.`;
          } else if (intent.action === 'send_email') {
            reply = `Done — I sent the email to ${intent.recipient}.`;
          } else if (intent.action === 'read_email') {
            reply = "I'll check your inbox for you.";
          } else {
            reply = 'Done.';
          }
        }
      }
    }

    await db.insert(chatMessages).values({
      userId,
      role: 'assistant',
      content: reply,
    });

    return NextResponse.json({
      reply,
      intent,
    });
  } catch (err) {
    console.error('Chat route failed:', err);

    return NextResponse.json(
      {
        error: 'Something went wrong',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
