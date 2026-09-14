import { db } from '@/lib/db';
import { chatMessages, actionsLog } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { parseIntent } from '@/lib/ai';
import { executeIntent } from '@/lib/execute';

const USER_ID_COOKIE = 'nexum_user_id';

async function getUserId(): Promise<{
  userId: string;
  isNew: boolean;
}> {
  const cookieStore = await cookies();

  const existingUserId = cookieStore.get(USER_ID_COOKIE)?.value;

  if (existingUserId) {
    return {
      userId: existingUserId,
      isNew: false,
    };
  }

  const userId = randomUUID();

  cookieStore.set(USER_ID_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return {
    userId,
    isNew: true,
  };
}

export async function GET() {
  try {
    const { userId } = await getUserId();

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);

    return NextResponse.json(messages);
  } catch (err) {
    console.error('Failed to load chat:', err);

    return NextResponse.json(
      {
        error: 'Failed to load chat messages',
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getUserId();

    const body = await req.json();
    const content = body?.content;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        {
          error: 'content is required',
        },
        {
          status: 400,
        },
      );
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return NextResponse.json(
        {
          error: 'content cannot be empty',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Get this user's previous conversation.
     *
     * IMPORTANT:
     * We use the browser-specific userId, so users no longer
     * share the same conversation history.
     */
    const previousMessages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);

    /*
     * Store the current user message.
     */
    await db.insert(chatMessages).values({
      userId,
      role: 'user',
      content: trimmedContent,
    });

    /*
     * Give Gemini the previous conversation so it can understand
     * follow-up messages.
     *
     * Example:
     *
     * User:
     * "Schedule a meeting with Ayush tomorrow and email him."
     *
     * Assistant:
     * "What's his email address?"
     *
     * User:
     * "ayush@gmail.com"
     *
     * Gemini can now understand that the email address belongs
     * to the previous request.
     */
    const intent = await parseIntent(
      trimmedContent,
      previousMessages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    );

    let reply: string;

    /*
     * ---------------------------------------------------------
     * UNCLEAR / CLARIFICATION
     * ---------------------------------------------------------
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
       * ---------------------------------------------------------
       * VALIDATE REQUIRED INFORMATION
       * ---------------------------------------------------------
       */
      const missingFields: string[] = [];

      /*
       * Email requirements
       */
      if (
        (intent.action === 'send_email' || intent.action === 'both') &&
        !intent.recipient?.trim()
      ) {
        missingFields.push('email address');
      }

      if (
        (intent.action === 'send_email' || intent.action === 'both') &&
        !intent.emailBody?.trim()
      ) {
        missingFields.push('email content');
      }

      /*
       * Calendar requirements
       */
      if (
        (intent.action === 'schedule_event' || intent.action === 'both') &&
        !intent.eventTime?.trim()
      ) {
        missingFields.push('meeting time');
      }

      /*
       * If information is missing, DO NOT execute anything.
       */
      if (missingFields.length > 0) {
        if (missingFields.length === 1) {
          reply = `I need the ${missingFields[0]} before I can complete that request.`;
        } else {
          reply = `I need the ${missingFields.join(
            ' and ',
          )} before I can complete that request.`;
        }

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
        /*
         * -------------------------------------------------------
         * EXECUTE INTENT
         * -------------------------------------------------------
         *
         * IMPORTANT:
         * userId is also used as the Corsair tenant ID.
         *
         * Therefore:
         *
         * Browser A → tenant A → Gmail A / Calendar A
         * Browser B → tenant B → Gmail B / Calendar B
         */
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

        /*
         * -------------------------------------------------------
         * EXECUTION ERROR / PARTIAL SUCCESS
         * -------------------------------------------------------
         */
        if (execResult.error) {
          if (execResult.emailSent && !execResult.eventCreated) {
            reply = `The email was sent successfully, but I couldn't create the calendar event: ${execResult.error}`;
          } else if (execResult.eventCreated && !execResult.emailSent) {
            reply = `The calendar event was created successfully, but I couldn't send the email: ${execResult.error}`;
          } else {
            reply = `I couldn't complete that request: ${execResult.error}`;
          }
        } else {
          /*
           * -----------------------------------------------------
           * SUCCESS RESPONSES
           * -----------------------------------------------------
           */
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

    /*
     * Store assistant response for THIS user only.
     */
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
      {
        status: 500,
      },
    );
  }
}
