import { pdfResourceData } from '../pdf-generated/resources';

/** Fixed package resources only. Neither document names nor URLs reach fetch(). */
export class PdfBinaryDataFactory {
  fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    return Promise.resolve().then(() => {
    if (!/^[A-Za-z0-9_.-]+$/.test(filename)) throw new Error('Unknown PDF resource');
    const directory = kind === 'cMapUrl' ? 'cmaps' : kind === 'standardFontDataUrl' ? 'standard_fonts' : null;
    const encoded = directory ? pdfResourceData[directory + '/' + filename] : undefined;
    if (!encoded) throw new Error('Unavailable PDF resource');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
    });
  }
}
