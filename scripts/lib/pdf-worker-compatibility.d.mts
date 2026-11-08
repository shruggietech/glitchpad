export function pdfWorkerCompatibility(): {
  name: string;
  enforce: 'pre';
  transform(code: string, id: string): { code: string; map: null } | null;
};
export function transformPdfWorker(code: string): string;
export const reviewedWorkerSha256: string;
