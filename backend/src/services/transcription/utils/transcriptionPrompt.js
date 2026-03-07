export const buildTranscriptionAnalysisPrompt = (text) => `
Contexto: você é um(a) psicólogo(a) clínico(a) analisando uma transcrição de sessão com um discente universitário (contexto acadêmico/psicossocial). Use linguagem neutra, sem diagnósticos formais. Gere APENAS um JSON com:
1. "sentiments": objeto { "positive": 0.0, "neutral": 0.0, "negative": 0.0 } (valores 0–1, somando ≈1)
2. "keywords": até 10 palavras-chave ou frases curtas (sem artigos/preposições isoladas)
3. "topics": até 5 tópicos principais (ex.: “adaptação acadêmica”, “rede de apoio”, “saúde mental”)
4. "summary": resumo conciso em até 3 frases, mencionando o contexto universitário quando relevante
5. "actionableInsights": 3 a 5 sugestões de ações/observações clínicas curtas, focadas em apoio ao discente (ex.: fortalecer rede de apoio, estratégias de estudo, encaminhar para serviço de assistência)

Texto a ser analisado:
"${text}"

Retorne somente o JSON, sem markdown.`;
