import type { Plugin } from 'vite';
export function pdfWorkerCompatibility(): Plugin;
export function transformPdfWorker(code: string): string;
export const reviewedWorkerSha256: string;
