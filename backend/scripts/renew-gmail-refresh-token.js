import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');

dotenv.config({ path: envPath });

const CLIENT_ID = process.env.GMAIL_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET?.trim();
const DEFAULT_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI?.trim() || 'http://localhost';
const SCOPES = (
  process.env.GMAIL_OAUTH_SCOPES?.trim() ||
  'https://www.googleapis.com/auth/gmail.send'
)
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Variáveis ausentes no .env: GMAIL_CLIENT_ID e/ou GMAIL_CLIENT_SECRET.');
  process.exit(1);
}

function parseArgs(argv) {
  let redirectUri = null;
  let saveRedirectUri = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--save-redirect-uri') {
      saveRedirectUri = true;
      continue;
    }
    if (arg === '--redirect-uri') {
      redirectUri = argv[i + 1]?.trim() || null;
      i += 1;
      continue;
    }
    if (arg.startsWith('--redirect-uri=')) {
      redirectUri = arg.slice('--redirect-uri='.length).trim() || null;
    }
  }

  return { redirectUri, saveRedirectUri };
}

const { redirectUri: redirectUriArg, saveRedirectUri } = parseArgs(process.argv.slice(2));
const REDIRECT_URI = redirectUriArg || DEFAULT_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: true,
  scope: SCOPES,
});

const rl = readline.createInterface({ input, output });

function maskToken(token) {
  if (!token) return '***';
  if (token.length <= 10) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function upsertEnvVar(content, key, value) {
  const escaped = value.replace(/\r?\n/g, '').trim();
  const line = `${key}=${escaped}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    return content.replace(regex, line);
  }

  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  return `${normalized}${line}\n`;
}

async function main() {
  try {
    console.log(`Redirect URI em uso: ${REDIRECT_URI}`);
    console.log('\n1) Abra a URL abaixo e autorize o acesso da aplicação:\n');
    console.log(authUrl);
    console.log('\n2) Cole aqui o "code" retornado pelo Google.\n');

    const authCode = (await rl.question('Authorization code: ')).trim();

    if (!authCode) {
      throw new Error('Nenhum authorization code informado.');
    }

    const { tokens } = await oauth2Client.getToken(authCode);
    const refreshToken = tokens.refresh_token?.trim();

    if (!refreshToken) {
      throw new Error(
        'Google não retornou refresh_token. Revogue o acesso do app na conta Google e execute novamente.'
      );
    }

    const envContent = await fs.readFile(envPath, 'utf8');
    let updated = upsertEnvVar(envContent, 'GMAIL_REFRESH_TOKEN', refreshToken);
    if (saveRedirectUri) {
      updated = upsertEnvVar(updated, 'GMAIL_REDIRECT_URI', REDIRECT_URI);
    }
    await fs.writeFile(envPath, updated, 'utf8');

    console.log('\nRefresh token atualizado no backend/.env.');
    console.log(`GMAIL_REFRESH_TOKEN=${maskToken(refreshToken)}`);
    if (saveRedirectUri) {
      console.log('GMAIL_REDIRECT_URI atualizado no backend/.env.');
    }
    console.log('Nenhum valor sensível do .env foi exibido.');
  } catch (error) {
    if (String(error?.message || '').includes('redirect_uri_mismatch')) {
      console.error('\nFalha de OAuth: redirect_uri_mismatch.');
      console.error(`A URI usada foi: ${REDIRECT_URI}`);
      console.error(
        'Cadastre essa URI no OAuth Client do Google Cloud ou rode o script com --redirect-uri "<uri-autorizada>".'
      );
      console.error(
        'Exemplo: npm run gmail:refresh-token -- --redirect-uri "http://localhost:3000/oauth2callback" --save-redirect-uri'
      );
      process.exitCode = 1;
      return;
    }
    console.error('\nFalha ao renovar token:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
