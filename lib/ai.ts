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
"schedule meet with Ayush and also email him let's catch up" →
{"action":"both","recipient":"Ayush","subject":"Let's catch up","emailBody":"Hi Ayush, would love to catch up — I've scheduled some time for us to meet.","eventTitle":"Catch up with Ayush","eventTime":""}

"tell me today's emails" →
{"action":"read_email","recipient":"","subject":"","emailBody":"","eventTitle":"","eventTime":""}`;

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