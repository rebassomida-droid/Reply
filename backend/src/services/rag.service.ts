import OpenAI from 'openai';
import pool from '../db';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Genera embedding per un testo usando text-embedding-3-small
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  });
  return response.data[0].embedding;
}

// Divide il testo in chunk da ~500 token (circa 400 parole)
export function splitIntoChunks(text: string, chunkSize = 400): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk.trim());
  }
  return chunks;
}

// Salva i chunk con embedding nel DB
export async function indexDocument(documentId: number, text: string): Promise<number> {
  const chunks = splitIntoChunks(text);
  let saved = 0;

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    const embeddingStr = `[${embedding.join(',')}]`;
    await pool.query(
      `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4)`,
      [documentId, i, chunks[i], embeddingStr]
    );
    saved++;
  }

  await pool.query('UPDATE documents SET chunk_count = $1 WHERE id = $2', [saved, documentId]);
  return saved;
}

// Recupera i chunk più rilevanti per una domanda (filtro opzionale per company)
export async function searchRelevantChunks(question: string, limit = 5, companyId?: number | null): Promise<string> {
  const embedding = await generateEmbedding(question);
  const embeddingStr = `[${embedding.join(',')}]`;

  let query: string;
  let params: unknown[];

  if (companyId) {
    query = `
      SELECT dc.content, 1 - (dc.embedding <=> $1::vector) AS similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d.company_id = $3
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2`;
    params = [embeddingStr, limit, companyId];
  } else {
    query = `
      SELECT content, 1 - (embedding <=> $1::vector) AS similarity
      FROM document_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2`;
    params = [embeddingStr, limit];
  }

  const result = await pool.query(query, params);
  if (result.rows.length === 0) return '';

  return result.rows
    .filter((r) => r.similarity > 0.3)
    .map((r) => r.content)
    .join('\n\n---\n\n');
}
