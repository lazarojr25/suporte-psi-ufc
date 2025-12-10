# Sistema de Suporte Psicológico – UFC Quixadá

Aplicação web (frontend + backend) para gestão de atendimentos psicológicos a discentes da Universidade Federal do Ceará – Campus Quixadá.

O sistema permite:
- Solicitação de atendimentos pelos alunos
- Gerenciamento administrativo das demandas
- Upload de áudios de atendimentos
- Geração de transcrições e relatórios com apoio de IA (Google AI / Gemini)

---

## Tecnologias

- **Frontend:** React + Vite
- **Backend:** Node.js
- **Banco de dados:** Firebase Firestore
- **Autenticação:** Firebase Authentication (login anônimo)
- **IA:** Google AI Studio / Gemini

---

## Estrutura do Projeto

```text
suporte-psi-ufc/
├── backend/   # API Node.js (IA, transcrições, integrações)
└── frontend/  # Interface React (Vite)
