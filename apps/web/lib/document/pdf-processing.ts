import { DocumentMetadata } from '@ciphershare/shared';

export async function extractTxtText(file: File): Promise<string> {
  return await file.text();
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Set worker src if available in browser
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageStr);
    }

    return pageTexts.join('\n');
  } catch (err) {
    console.warn('[PDF.js Warning]: Falling back to stream text extraction:', (err as Error).message);
    // Fallback: extract ASCII/UTF-8 streams from PDF buffer
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(buffer);
    // Find text inside BT ... ET blocks or string objects
    const streamMatches = raw.match(/\((.*?)\)/g) || [];
    return streamMatches.map((s) => s.slice(1, -1)).join(' ');
  }
}

export async function extractDocumentText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return await extractPdfText(file);
  } else {
    return await extractTxtText(file);
  }
}

export function prepareDocumentMetadata(file: File): DocumentMetadata {
  return {
    originalName: file.name,
    mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
    sizeBytes: file.size,
    createdAt: Date.now(),
  };
}
