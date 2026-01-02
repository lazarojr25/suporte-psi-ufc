import { google } from 'googleapis';

const {
  GMAIL_USER,
  GMAIL_FROM,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
} = process.env;

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

function getOAuthClient() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;
  const client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return client;
}

const encodeSubject = (subject) => {
  if (!subject) return '';
  const bytes = Buffer.from(subject, 'utf8');
  const encoded = Array.from(bytes)
    .map((b) => {
      // RFC 2047 "Q" encoding
      if (
        (b >= 33 && b <= 60) ||
        (b >= 62 && b <= 126) &&
        b !== 63 && // ?
        b !== 61 && // =
        b !== 95    // _
      ) {
        return String.fromCharCode(b);
      }
      if (b === 32) return '_';
      return `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
    })
    .join('');
  return `=?UTF-8?Q?${encoded}?=`;
};

function buildRawMessage({ from, to, subject, text, html }) {
  const lines = [];
  lines.push('MIME-Version: 1.0');
  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${encodeSubject(subject)}`);
  if (html) {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('');
    lines.push(html);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('');
    lines.push(text || '');
  }
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
  return raw;
}

export async function sendMeetingEmail({ to, subject, text, html }) {
  if (!to || !subject) return { success: false, message: 'Destinatário ou assunto ausente.' };
  const from = GMAIL_FROM || GMAIL_USER;
  if (!from) return { success: false, message: 'Remetente não configurado (GMAIL_FROM ou GMAIL_USER).' };

  const auth = getOAuthClient();
  if (!auth) {
    console.warn('Gmail API não configurada (client/secret/refresh ausentes).');
    return { success: false, message: 'Gmail API não configurada.' };
  }

  try {
    const accessToken = await auth.getAccessToken();
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = buildRawMessage({ from, to, subject, text, html });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
      headers: { Authorization: `Bearer ${accessToken.token}` },
    });
    return { success: true };
  } catch (err) {
    console.error('Erro ao enviar e-mail via Gmail API:', err?.message);
    return { success: false, message: err?.message };
  }
}
