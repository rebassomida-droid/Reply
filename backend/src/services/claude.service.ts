import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateAnswer(
  systemPrompt: string,
  userQuestion: string,
  context: string
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Contesto dalla knowledge base:\n${context}\n\nDomanda del cliente: ${userQuestion}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function generateCallSummary(transcript: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: 'Sei un assistente che riassume conversazioni telefoniche in italiano in modo conciso (max 3 frasi). Includi: argomento principale, esito, eventuali azioni richieste.',
    messages: [{ role: 'user', content: `Trascrizione chiamata:\n${transcript}` }],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function generateWhatsAppReply(
  systemPrompt: string,
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string
): Promise<string> {
  const messages: Anthropic.MessageParam[] = conversation.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Aggiunge il contesto RAG all'ultimo messaggio utente
  if (messages.length > 0 && context) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'user') {
      lastMsg.content = `Contesto:\n${context}\n\nMessaggio: ${lastMsg.content}`;
    }
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt + '\n\nStai rispondendo via WhatsApp: sii conciso, usa testo semplice senza markdown.',
    messages,
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}
