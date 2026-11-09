import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button, Field, TextInput } from '../../../../brand/web/react/server';
import type { PdfController, PdfPageSurface } from '../domain/pdf-controller';
import type { ShellSession } from '../domain/contracts';
import {
  nativePdfPrintGateway,
  parsePdfPrintRange,
  pdfPrintScale,
  type PdfPrintGateway,
} from '../domain/pdf-print-gateway';
import { TaskSurface } from './TaskSurface';
export interface PdfPrintHandle {
  open: (opener: HTMLElement) => boolean;
}
let activePrint: object | null = null;
export const PdfPrintTools = forwardRef<
  PdfPrintHandle,
  { controller: PdfController; session: ShellSession }
>(function PdfPrintTools({ controller, session }, ref) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [range, setRange] = useState('all');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [gateway, setGateway] = useState<PdfPrintGateway | null>(null);
  const abort = useRef<AbortController | null>(null);
  const ownedGateway = useRef<PdfPrintGateway | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void nativePdfPrintGateway(session)
      .available()
      .then((value) => {
        if (mounted.current) controller.setPrintAvailable(value);
      })
      .catch(() => {
        if (mounted.current) controller.setPrintAvailable(false);
      });
    return () => {
      mounted.current = false;
      abort.current?.abort();
      ownedGateway.current?.dispose();
    };
  }, [controller, session.id, session.revision]);
  useImperativeHandle(ref, () => ({
    open(target) {
      if (controller.state.capabilities.print !== 'available') return false;
      opener.current = target;
      setOpen(true);
      return true;
    },
  }));
  const prepare = async () => {
    if (activePrint) {
      setStatus('Another print job is being prepared.');
      return;
    }
    let pages: number[];
    try {
      pages = parsePdfPrintRange(range, controller.state.page_count ?? 0);
    } catch {
      setStatus('Enter all, a page number, or ranges such as 1-3, 5.');
      return;
    }
    const identity = {};
    activePrint = identity;
    const cancel = new AbortController();
    abort.current = cancel;
    const job = nativePdfPrintGateway(session);
    setGateway(job);
    ownedGateway.current = job;
    setBusy(true);
    setHandedOff(false);
    let surface: PdfPageSurface | null = null;
    let didHandoff = false;
    try {
      await job.begin(pages.length);
      for (let index = 0; index < pages.length; index++) {
        if (cancel.signal.aborted) throw new Error('print_cancelled');
        if (mounted.current)
          setStatus(
            'Preparing page ' +
              String(index + 1) +
              ' / ' +
              String(pages.length),
          );
        const size = await controller.pageSize(pages[index], 0);
        const canvas = document.createElement('canvas');
        const scale = pdfPrintScale(size.width, size.height);
        surface = await controller.renderPage(
          pages[index],
          canvas,
          document.createElement('div'),
          scale,
          0,
          cancel.signal,
          false,
        );
        const pixelBytes = surface.bytes;
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error('print_page_unavailable')),
            'image/png',
          ),
        );
        surface.dispose();
        surface = null;
        await job.append(
          index,
          { blob, width: size.width, height: size.height, pixelBytes },
          cancel.signal,
        );
      }
      if (cancel.signal.aborted) throw new Error('print_cancelled');
      const receipt = await job.handoff();
      didHandoff = true;
      if (mounted.current) {
        setHandedOff(true);
        setStatus(
          receipt.status === 'failed'
            ? 'The print service failed.'
            : 'System print dialog requested. Completion has not been confirmed.',
        );
      }
    } catch (error) {
      await job.cancel().catch(() => undefined);
      if (mounted.current)
        setStatus(
          cancel.signal.aborted
            ? 'Print preparation cancelled.'
            : error instanceof Error && /pending/.test(error.message)
              ? 'Close the current system print dialog before preparing another job.'
              : error instanceof Error && /limit/.test(error.message)
                ? 'This print range exceeds the print budget. Choose a smaller range.'
                : 'PDF print preparation or system handoff failed.',
        );
    } finally {
      surface?.dispose();
      if (!didHandoff) job.dispose();
      else if (session.source.kind !== 'document_uri') {
        // Native print returns after its request; retain snapshots through the print task.
        if (mounted.current) setGateway(job);
        else job.dispose();
      }
      if (activePrint === identity) activePrint = null;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <TaskSurface
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          abort.current?.abort();
          if (!busy) {
            gateway?.dispose();
            setGateway(null);
          }
          setOpen(false);
        }
      }}
      title="Print PDF"
      opener={opener.current}
      className="pdf-tools"
    >
      <p>Print a snapshot of the document. The original file is unchanged.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void prepare();
        }}
      >
        <Field
          id="pdf-print-range"
          label="Pages (all or ranges)"
          control={
            <TextInput
              value={range}
              disabled={busy}
              onChange={(event) => setRange(event.target.value)}
            />
          }
        />
        <Button
          type="submit"
          disabled={busy || controller.state.capabilities.print !== 'available'}
        >
          Open system print dialog
        </Button>
      </form>
      {busy && (
        <Button variant="secondary" onClick={() => abort.current?.abort()}>
          Cancel preparation
        </Button>
      )}
      {handedOff && session.source.kind === 'document_uri' && (
        <Button
          variant="secondary"
          onClick={() => {
            void gateway
              ?.inspect()
              .then((receipt) =>
                setStatus(
                  receipt.status === 'written'
                    ? 'Print output written to the system spool (' +
                        String(receipt.pages_written) +
                        ' pages).'
                    : receipt.status === 'finished'
                      ? 'Print adapter finished. Physical output has not been confirmed.'
                      : receipt.status === 'cancelled'
                        ? 'System print work was cancelled.'
                        : receipt.status === 'failed'
                          ? 'The system print work failed.'
                          : 'System print status: ' + receipt.status,
                ),
              )
              .catch(() => setStatus('System print status unavailable.'));
          }}
        >
          Refresh print status
        </Button>
      )}
      {status && <p role="status">{status}</p>}
    </TaskSurface>
  );
});
