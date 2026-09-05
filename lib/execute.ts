import { corsair } from './corsair';
import type { ParsedIntent } from './ai';

function buildRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  // Gmail requires base64url encoding (URL-safe base64, no padding)
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function executeIntent(intent: ParsedIntent, tenantId: string) {
  const client = corsair.withTenant(tenantId);
  const results: { emailSent?: boolean; eventCreated?: boolean; error?: string } = {};

  try {
    if (intent.action === 'send_email' || intent.action === 'both') {
      const raw = buildRawEmail(
        intent.recipient || '',
        intent.subject || '(no subject)',
        intent.emailBody || ''
      );

      await client.gmail.api.messages.send({ raw });
      results.emailSent = true;
    }

   if (intent.action === 'schedule_event' || intent.action === 'both') {
  const startTime = new Date(); // placeholder — real time parsing comes next
  startTime.setHours(startTime.getHours() + 1, 0, 0, 0); // default: next hour
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min duration

  await client.googlecalendar.api.events.create({
    event: {
      summary: intent.eventTitle || 'New event',
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    },
  });
  results.eventCreated = true;
}
  } catch (err) {
    console.error('Execution failed:', err);
    results.error = String(err);
  }

  return results;
}