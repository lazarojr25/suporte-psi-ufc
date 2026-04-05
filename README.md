# Sistema de Suporte Psicológico - UFC Quixadá

Aplicação web para apoio à gestão de atendimentos psicológicos de discentes da Universidade Federal do Ceará (UFC), campus Quixadá.

O projeto reúne:
- formulário público para solicitação de atendimento;
- área interna para equipe responsável;
- agendamento de sessões com integração ao Google Calendar;
- envio de e-mail de confirmação;
- upload e processamento de transcrições;
- geração de relatórios individuais e consolidados com apoio de IA.

## Visão Geral

O sistema foi desenvolvido para apoiar a organização do fluxo de atendimento psicológico universitário, sem substituir prontuários ou documentos psicológicos oficiais.

Principais capacidades:
- cadastro de solicitações de atendimento;
- gestão de discentes, solicitações e sessões;
- autenticação com Firebase Authentication e controle de acesso por perfil;
- persistência em Cloud Firestore;
- transcrição e análise textual com Gemini;
- exportação de relatórios em texto e PDF.

## Arquitetura

O repositório está dividido em duas aplicações:

```text
suporte-psi-ufc/
├── backend/   # API Node.js/Express, integrações externas, processamento de mídia e relatórios
├── frontend/  # SPA React/Vite
└── README.md
```

### Frontend

Tecnologias principais:
- React 18
- Vite
- React Router
- Firebase Web SDK

Responsabilidades:
- formulário público de solicitação;
- autenticação da equipe;
- navegação da área interna;
- leitura/escrita em coleções específicas do Firestore;
- consumo da API para operações que exigem backend.

### Backend

Tecnologias principais:
- Node.js
- Express
- Firebase Admin SDK
- Google APIs (`googleapis`)
- Gemini (`@google/genai`)
- FFmpeg (`fluent-ffmpeg`, `ffmpeg-static`, `ffprobe-static`)
- PDFKit
- Multer

Responsabilidades:
- autenticação e autorização de rotas;
- agendamento de encontros;
- integração com Google Calendar e Gmail;
- upload, conversão, segmentação e transcrição de mídia;
- análise textual;
- geração de relatórios;
- persistência de metadados e logs de processamento.

## Fluxos Principais

### 1. Solicitação de atendimento

O discente preenche um formulário público com:
- nome;
- e-mail;
- matrícula;
- curso;
- motivo da solicitação.

Esses dados geram registros nas coleções `discentes` e `solicitacoesAtendimento`.

### 2. Gestão interna

Usuários autenticados acessam a área interna para:
- consultar solicitações;
- visualizar discentes;
- acompanhar histórico;
- agendar encontros;
- anexar transcrições e documentos;
- consultar relatórios.

### 3. Agendamento

Ao criar um encontro:
- o backend registra o encontro no Firestore;
- tenta criar ou atualizar um evento no Google Calendar;
- envia e-mail de confirmação ao discente;
- atualiza o status da solicitação associada.

### 4. Transcrição e análise

O sistema aceita:
- mídia de áudio ou vídeo;
- arquivo textual já transcrito (`.txt`, `.doc`, `.docx`).

No fluxo de mídia:
- o upload é salvo temporariamente;
- o arquivo é convertido para WAV 16 kHz mono;
- mídias grandes podem ser segmentadas;
- a transcrição é processada em segundo plano;
- o texto resultante passa por análise estruturada;
- o texto completo é persistido no Firebase Storage;
- os metadados e análise são persistidos no Firestore.

## Estrutura de Dados

Coleções principais do Firestore:
- `users`
- `cursos`
- `discentes`
- `solicitacoesAtendimento`
- `encontros`
- `meetings` (legada)
- `metadados_transcricoes`
- `transcription_processing_errors`
- `relatorio_geral_cache`
- `semestreLetivo`

Arquivos auxiliares no projeto:
- uploads temporários em `backend/uploads` ou diretório configurado;
- transcrições completas no bucket Firebase Storage (`transcriptions/...`).

Diagramas auxiliares do banco:
- [modelo_banco_firestore_integral.md](./modelo_banco_firestore_integral.md)
- [modelo_banco_firestore_tcc.md](./modelo_banco_firestore_tcc.md)
- [modelo_banco_firestore_tcc_agrupado.md](./modelo_banco_firestore_tcc_agrupado.md)

## Endpoints da API

Rotas principais expostas pelo backend:

### Saúde
- `GET /api/health`

### Solicitações
- `GET /api/solicitacoes`
- `GET /api/solicitacoes/:id`

### Sessões / encontros
- `GET /api/meetings`
- `POST /api/meetings`
- `GET /api/meetings/available-slots/:date`
- `GET /api/meetings/can-schedule/:discenteId`
- `GET /api/meetings/:id`
- `PUT /api/meetings/:id`
- `DELETE /api/meetings/:id`
- `POST /api/meetings/:id/complete`

### Transcrição
- `POST /api/transcription/upload`
- `POST /api/transcription/upload-text`
- `GET /api/transcription/list`
- `GET /api/transcription/by-discente/:discenteId`
- `GET /api/transcription/errors`
- `GET /api/transcription/:fileName`
- `DELETE /api/transcription/:fileName`
- `POST /api/transcription/analyze`
- `POST /api/transcription/reprocess-all`

### Relatórios
- `GET /api/reports/overview`
- `GET /api/reports/overview/export`
- `GET /api/reports/overview/export-pdf`
- `GET /api/reports/by-course-details`
- `GET /api/reports/by-discente/:discenteId`
- `GET /api/reports/by-discente/:discenteId/export`
- `GET /api/reports/by-discente/:discenteId/export-pdf`
- `GET /api/reports/analytics`
- `GET /api/reports/export-json`
- `GET /api/reports/export-text`
- `GET /api/reports/search`

### Administração
- `GET /api/attendance-config`
- `PUT /api/attendance-config`
- `POST /api/users`

## Requisitos

Antes de rodar o projeto, tenha instalado:
- Node.js 18+ recomendado
- npm
- uma conta/projeto Firebase configurado
- credenciais do Google Cloud para Calendar, Gmail e Gemini

Observações:
- o projeto usa `ffmpeg-static` e `ffprobe-static`, então normalmente não é necessário instalar FFmpeg globalmente;
- o backend usa Firebase Admin via `applicationDefault()`, então é necessário configurar credenciais de aplicação padrão ou ambiente equivalente;
- para persistir transcrições completas, configure o bucket (`FIREBASE_STORAGE_BUCKET` ou `GCLOUD_STORAGE_BUCKET`).

## Configuração do Frontend

O frontend está em `frontend/`.

### Instalação

```bash
cd frontend
npm install
```

### Execução em desenvolvimento

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Observação importante sobre Firebase no frontend

Atualmente a configuração do Firebase Web está definida diretamente em:

- [`frontend/src/services/firebase.js`](./frontend/src/services/firebase.js)

Se você for adaptar o projeto para outro ambiente, esse arquivo deverá ser ajustado.

## Configuração do Backend

O backend está em `backend/`.

### Instalação

```bash
cd backend
npm install
```

### Execução em desenvolvimento

```bash
npm run dev
```

### Execução padrão

```bash
npm start
```

## Variáveis de Ambiente do Backend

Crie um arquivo `backend/.env` com os valores necessários.

Exemplo:

```env
NODE_ENV=development
PORT=5001

FIREBASE_PROJECT_ID=seu-projeto-firebase

GOOGLE_AI_API_KEY=sua-chave-gemini
GEMINI_MODEL=gemini-2.0-flash

GMAIL_CLIENT_ID=seu-client-id
GMAIL_CLIENT_SECRET=seu-client-secret
GMAIL_REFRESH_TOKEN=seu-refresh-token
GMAIL_REDIRECT_URI=http://localhost
GMAIL_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.send

GOOGLE_CALENDAR_ID=seu-calendar-id
GOOGLE_CALENDAR_TIMEZONE=America/Fortaleza

UPLOAD_DIR=uploads

TRANSCRIPTION_DEBOUNCE_MS=1200
TRANSCRIPTION_MAX_RETRIES=2
TRANSCRIPTION_RETRY_BASE_MS=900
TRANSCRIPTION_RETRY_JITTER_MS=250
TRANSCRIPTION_RETRY_MAX_MS=8000
REPROCESS_PARALLELISM=4
```

### Variáveis identificadas no código

- `NODE_ENV`
- `PORT`
- `UPLOAD_DIR`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_CLOUD_PROJECT`
- `GCLOUD_PROJECT`
- `PROJECT_ID`
- `GOOGLE_AI_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_REDIRECT_URI`
- `GMAIL_OAUTH_SCOPES`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_CALENDAR_TIMEZONE`
- `TRANSCRIPTION_DEBOUNCE_MS`
- `TRANSCRIPTION_MAX_RETRIES`
- `TRANSCRIPTION_RETRY_BASE_MS`
- `TRANSCRIPTION_RETRY_JITTER_MS`
- `TRANSCRIPTION_RETRY_MAX_MS`
- `REPROCESS_PARALLELISM`

## Google Gmail: geração/renovação do refresh token

O backend possui um script auxiliar:

```bash
cd backend
npm run gmail:refresh-token
```

Esse script:
- abre o fluxo OAuth;
- solicita autorização;
- recebe o `authorization code`;
- grava `GMAIL_REFRESH_TOKEN` no `backend/.env`.

Também é possível informar uma redirect URI específica:

```bash
npm run gmail:refresh-token -- --redirect-uri "http://localhost:3000/oauth2callback" --save-redirect-uri
```

## Firebase Admin

O backend usa `applicationDefault()` em:

- [`backend/src/firebaseAdmin.js`](./backend/src/firebaseAdmin.js)

Na prática, você precisa garantir um destes cenários:
- credenciais padrão já configuradas no ambiente;
- variável de ambiente apropriada apontando para credenciais do serviço;
- execução em ambiente autenticado no Google Cloud.

## Regras de Segurança do Firestore

O projeto depende de regras de segurança alinhadas ao fluxo da aplicação, especialmente porque parte do frontend acessa o Firestore diretamente.

De forma resumida:
- `cursos` pode ser lido publicamente;
- `discentes` e `solicitacoesAtendimento` aceitam criação no fluxo público com vínculo válido de curso;
- leituras e alterações internas exigem usuário autenticado com perfil apropriado;
- `users`, `semestreLetivo` e estruturas administrativas possuem restrições mais fortes;
- metadados de transcrição não devem ser gravados diretamente pelo cliente.

## Scripts Disponíveis

### Frontend

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### Backend

- `npm run dev`
- `npm start`
- `npm run gmail:refresh-token`

## Observações de Desenvolvimento

### Porta da API

O frontend consome a API em:

- `http://localhost:5001/api`

Essa URL está definida em:

- [`frontend/src/services/api.js`](./frontend/src/services/api.js)

O backend, por padrão, usa:
- `PORT=5000`

Para rodar sem conflito, use uma destas abordagens:
- definir `PORT=5001` no backend;
- ou ajustar a URL base no frontend.

### Uploads e armazenamento

Arquivos enviados ficam temporariamente no backend durante o processamento. O conteúdo final das transcrições é persistido no Firebase Storage e os metadados ficam no Firestore.

### IA como apoio, não substituição

As funcionalidades de IA do projeto têm papel assistivo:
- transcrição;
- estruturação textual;
- apoio à geração de relatórios.

Os resultados não devem ser tratados como diagnóstico, laudo ou substituição do julgamento profissional.

## Estrutura de Pastas

```text
backend/
├── scripts/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   │   └── transcription/
│   ├── app.js
│   └── firebaseAdmin.js
└── package.json

frontend/
├── src/
│   ├── assets/
│   ├── components/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   ├── styles/
│   └── main.jsx
└── package.json
```

## Estado do Projeto

O sistema já possui fluxo funcional de ponta a ponta para:
- solicitação;
- autenticação interna;
- agendamento;
- upload e transcrição;
- geração de relatórios.

Ainda assim, para uso institucional mais robusto, continuam relevantes:
- auditoria e rastreabilidade;
- políticas de retenção de dados;
- maior observabilidade;
- amadurecimento do pipeline de IA;
- refinamento de UX e governança de dados.

## Licença

Este repositório não possui licença definida neste momento.
