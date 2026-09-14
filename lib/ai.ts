import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const ai = new GoogleGenAI({ apiKey });

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ParsedIntent = {
  action: 'send_email' | 'schedule_event' | 'both' | 'read_email' | 'unclear';

  recipient?: string;
  subject?: string;
  emailBody?: string;
  eventTitle?: string;
  eventTime?: string;
  clarificationNeeded?: string;
};

const SYSTEM_PROMPT = `
You are the intent parser for Nexum, an AI email and calendar assistant.

Your job is to understand the user's CURRENT request using the previous conversation as context.

Return JSON only.

Schema:
{
  "action": "send_email" | "schedule_event" | "both" | "read_email" | "unclear",
  "recipient": "",
  "subject": "",
  "emailBody": "",
  "eventTitle": "",
  "eventTime": "",
  "clarificationNeeded": ""
}

IMPORTANT RULES:

1. CONVERSATION CONTEXT
Use previous messages to understand follow-up responses.

Example:

Previous user:
"Schedule a meeting with Ayush tomorrow and email him."

Assistant:
"I need Ayush's email address and a meeting time."

Current user:
"ayush@gmail.com, 3 PM"

The result MUST combine the information:

{
  "action": "both",
  "recipient": "ayush@gmail.com",
  "eventTitle": "Meeting with Ayush",
  "eventTime": "tomorrow at 3 PM"
}

Do NOT treat the current message as an isolated request.

2. EMAIL RECIPIENT
If an email address is provided, use it exactly.

Never invent an email address.

If an email action requires a recipient and no email address is available from the current message or previous conversation, return "unclear".

3. EMAIL BODY
If the user explicitly provides email content, use it.

For example:
"email him let's catch up"

emailBody should be:
"Let's catch up."

If the user wants to send an email but provides no meaningful email content, return "unclear" and ask what they want the email to say.

4. EVENT TIME
Extract every date/time phrase exactly from the user's request.

Examples:
"tomorrow at 3pm" → "tomorrow at 3pm"
"next Monday" → "next Monday"
"tomorrow evening" → "tomorrow evening"
"in 2 hours" → "in 2 hours"

NEVER invent a time.

If a meeting is requested but NO time is provided, return "unclear" and ask for the meeting time.

Do NOT use a default time.

5. EVENT TITLE
Create a useful title from the request.

"schedule a meeting with Ayush" →
"Meeting with Ayush"

Do not incorrectly change people's names.

6. ACTION
Use:

"send_email" → only email
"schedule_event" → only calendar event
"both" → email + calendar event
"read_email" → user asks about inbox/emails
"unclear" → required information is missing or request is ambiguous

7. IMPORTANT
If the user is answering a previous clarification question, combine their answer with the previous request.

Example:

Previous:
"I can schedule the meeting, but I need the email address."

Current:
"priyanshu@example.com"

This is NOT an unclear request.

It should produce the previously requested action with:
recipient = "priyanshu@example.com"

8. Do not execute anything yourself. Only return structured JSON.
`;

export async function parseIntent(
  userMessage: string,
  conversation: ConversationMessage[] = [],
): Promise<ParsedIntent> {
  const conversationText =
    conversation.length > 0
      ? conversation
          .map(
            (message) =>
              `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`,
          )
          .join('\n')
      : '(No previous conversation)';

  const prompt = `
PREVIOUS CONVERSATION:
${conversationText}

CURRENT USER MESSAGE:
${userMessage}

Now determine the complete intent using the previous conversation and the current message.
Return JSON only.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '{}';

  try {
    return JSON.parse(raw) as ParsedIntent;
  } catch {
    return {
      action: 'unclear',
      clarificationNeeded:
        "I couldn't understand that request. Could you rephrase it?",
    };
  }
}
