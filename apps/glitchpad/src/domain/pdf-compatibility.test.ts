import { expect, it } from 'vitest';
import {
  normalizePdfPostMessage,
  type PdfMessagePort,
} from './pdf-compatibility';

it('normalizes absent transfer lists while preserving the actual port, payload and transfer ownership', () => {
  const calls: Array<{ owner: unknown; message: unknown; transfer: unknown }> =
    [];
  const port: PdfMessagePort = {
    postMessage(message, transfer) {
      calls.push({ owner: this, message, transfer });
    },
  };
  normalizePdfPostMessage(port);
  const payload = { action: 'GetDocRequest' };
  const transfer = [new ArrayBuffer(8)];
  const options = { transfer };
  port.postMessage(payload, null);
  port.postMessage(payload);
  port.postMessage(payload, transfer);
  port.postMessage(payload, options);
  expect(calls.map((call) => call.owner)).toEqual([port, port, port, port]);
  expect(calls.every((call) => call.message === payload)).toBe(true);
  expect(calls[0].transfer).toEqual([]);
  expect(calls[1].transfer).toEqual([]);
  expect(calls[2].transfer).toBe(transfer);
  expect(calls[3].transfer).toBe(options);
});
