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

function resolveEventTime(eventTime: string): {
  start: Date;
  end: Date;
} | null {
  if (!eventTime?.trim()) {
    return null;
  }

  const now = new Date();

  console.log('[resolveEventTime] input eventTime:', JSON.stringify(eventTime));

  const parsed = chrono.parseDate(eventTime, now);

  console.log('[resolveEventTime] chrono parsed:', parsed);

  if (!parsed) {
    return null;
  }

  const end = new Date(parsed.getTime() + 30 * 60 * 1000);

  return {
    start: parsed,
    end,
  };
}

export async function executeIntent(intent: ParsedIntent, tenantId: string) {
  const results: {
    emailSent?: boolean;
    eventCreated?: boolean;
    error?: string;
    scheduledFor?: string;
  } = {};

  try {
    const client = getCorsair().withTenant(tenantId);

    if (intent.action === 'send_email' || intent.action === 'both') {
      if (!intent.recipient) {
        results.error = 'An email address is required.';
        return results;
      }

      if (!intent.emailBody?.trim()) {
        results.error = 'Email content is required.';
        return results;
      }

      const raw = buildRawEmail(
        intent.recipient,
        intent.subject || '(no subject)',
        intent.emailBody,
      );

      await client.gmail.api.messages.send({ raw });

      results.emailSent = true;
    }

    if (intent.action === 'schedule_event' || intent.action === 'both') {
      if (!intent.eventTime?.trim()) {
        results.error = 'A meeting time is required.';
        return results;
      }

      const resolved = resolveEventTime(intent.eventTime);

      if (!resolved) {
        results.error = `I couldn't understand the meeting time "${intent.eventTime}".`;
        return results;
      }

      const { start, end } = resolved;

      await client.googlecalendar.api.events.create({
        event: {
          summary: intent.eventTitle || 'New event',
          start: {
            dateTime: start.toISOString(),
          },
          end: {
            dateTime: end.toISOString(),
          },
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

    results.error = err instanceof Error ? err.message : String(err);
  }

  return results;
}
