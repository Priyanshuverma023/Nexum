import { getCorsair } from './corsair';
import type { ParsedIntent } from './ai';
import * as chrono from 'chrono-node';

function buildRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function resolveEventTime(eventTime: string | undefined): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  console.log('[resolveEventTime] input eventTime:', JSON.stringify(eventTime));

  if (eventTime && eventTime.trim()) {
    const parsed = chrono.parseDate(eventTime, now);
    console.log('[resolveEventTime] chrono parsed:', parsed);
    if (parsed) {
      const end = new Date(parsed.getTime() + 30 * 60 * 1000);
      return { start: parsed, end };
    }
  }

  console.log('[resolveEventTime] falling back to next-hour default');
  const start = new Date(now);
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
}

export async function executeIntent(intent: ParsedIntent, tenantId: string) {
  const client = getCorsair().withTenant(tenantId);
  const results: {
    emailSent?: boolean;
    eventCreated?: boolean;
    error?: string;
    scheduledFor?: string;
  } = {};

  try {
    if (intent.action === 'send_email' || intent.action === 'both') {
      const raw = buildRawEmail(
        intent.recipient || '',
        intent.subject || '(no subject)',
        intent.emailBody || '',
      );
      await client.gmail.api.messages.send({ raw });
      results.emailSent = true;
    }

    if (intent.action === 'schedule_event' || intent.action === 'both') {
      const { start, end } = resolveEventTime(intent.eventTime);

      await client.googlecalendar.api.events.create({
        event: {
          summary: intent.eventTitle || 'New event',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });
      results.eventCreated = true;
      results.scheduledFor = start.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
  } catch (err) {
    console.error('Execution failed:', err);
    results.error = String(err);
  }

  return results;
}
