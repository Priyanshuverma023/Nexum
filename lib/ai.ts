import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type ParsedIntent = {
  action: 'send_email' | 'schedule_event' | 'both' | 'read_email' | 'unclear';
  recipient?: string;
  subject?: string;
  emailBody?: string;
  eventTitle?: string;
  eventTime?: string;
  clarificationNeeded?: string;
};

const SYSTEM_PROMPT = `You are an intent parser for an AI email/calendar assistant called Nexum.
Given a user's natural language request, extract structured intent as JSON only.

IMPORTANT RULES:
1. If the action requires sending an email (send_email or both) and the user only gave a name (not a full email address like "name@domain.com"), set action to "unclear" and ask for the email address in clarificationNeeded. Do NOT guess or invent an email address.
2. ALWAYS extract any time/date phrase the user mentions (e.g. "tomorrow at 3pm", "next Monday", "in 2 hours") into eventTime EXACTLY as the user said it, word for word. Do NOT leave eventTime empty if the user mentioned any time reference, even a vague one like "tomorrow" or "this evening".
3. If no time is mentioned at all, leave eventTime as an empty string.

Schema:
{
  "action": "send_email" | "schedule_event" | "both" | "read_email" | "unclear",
  "recipient": string,
  "subject": string,
  "emailBody": string,
  "eventTitle": string,
  "eventTime": string,
  "clarificationNeeded": string
}

Examples:
"schedule meet with Ayush tomorrow at 3pm and also email ayush@gmail.com let's catch up" →
{"action":"both","recipient":"ayush@gmail.com","subject":"Let's catch up","emailBody":"Hi Ayush, would love to catch up — I've scheduled some time for us to meet.","eventTitle":"Catch up with Ayush","eventTime":"tomorrow at 3pm"}

"schedule meet with Ayush and also email him let's catch up" (no email address given) →
{"action":"unclear","recipient":"Ayush","subject":"","emailBody":"","eventTitle":"","eventTime":"","clarificationNeeded":"I can schedule the meeting, but I need Ayush's email address to send the invite email. What's his email?"}

"tell me today's emails" →
{"action":"read_email","recipient":"","subject":"","emailBody":"","eventTitle":"","eventTime":""}

"schedule a meeting with Priyanshu next Monday" (calendar-only, no email needed) →
{"action":"schedule_event","recipient":"Priya","subject":"","emailBody":"","eventTitle":"Meeting with Priya","eventTime":"next Monday"}`;

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '{}';
  return JSON.parse(raw) as ParsedIntent;
}
