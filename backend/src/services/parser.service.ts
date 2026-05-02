import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';

export async function extractText(filePath: string, fileType: string): Promise<string> {
  if (fileType === 'pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (fileType === 'txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error(`Tipo file non supportato: ${fileType}`);
}
