import { useEffect, useRef, useState } from 'react';
import {
  applicationDestinations,
  nativeApplicationInfoGateway,
  type ApplicationInfo,
  type ApplicationInfoGateway,
} from '../domain/application-info';
import {
  nativeMarkdownExternalLinkGateway,
  type MarkdownExternalLinkGateway,
} from '../domain/markdown-gateway';
interface Props {
  gateway?: ApplicationInfoGateway;
  external?: MarkdownExternalLinkGateway;
  help?: boolean;
}
export function AboutPanel({
  gateway = nativeApplicationInfoGateway,
  external = nativeMarkdownExternalLinkGateway,
  help = false,
}: Props) {
  const [info, setInfo] = useState<ApplicationInfo | null>(null);
  const [status, setStatus] = useState(
    'Reading installed application information…',
  );
  const [notices, setNotices] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let current = true;
    void gateway
      .info()
      .then((v) => {
        if (current) {
          setInfo(v);
          setStatus('');
        }
      })
      .catch(() => {
        if (current)
          setStatus('Installed application information is unavailable.');
      });
    return () => {
      current = false;
      active.current = false;
    };
  }, [gateway]);
  const run = async (action: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      await action();
    } catch {
      if (active.current) setStatus(failure);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <section
      className="about-panel"
      aria-label={help ? 'Help and support' : 'About Glitchpad'}
    >
      <h3>Glitchpad</h3>
      <p>A local file viewer and editor by ShruggieTech.</p>
      {help && (
        <>
        <p>
          Use Add document to create Markdown, create a text file, or open a
          file. Document tools apply to the current file. Support links open
          only when selected; reports and diagnostics are never attached
          automatically.
        </p>
        <p>
          Open PDFs with Open file, a desktop file association, or Android Open/Share.
          PDF controls provide pages and fit; More PDF tools contains search, outline,
          thumbnails, links, file information and Print. PDFs remain read only.
          DOCX and ODT viewing are planned.
        </p>
        </>
      )}
      {info && (
        <dl data-application-info>
          <dt>Version</dt>
          <dd>{info.version}</dd>
          <dt>Package</dt>
          <dd>{info.package_identifier}</dd>
          <dt>Version code</dt>
          <dd>{info.version_code ?? 'Unavailable'}</dd>
          <dt>Build</dt>
          <dd>{info.build_commit ?? 'Unavailable'}</dd>
          <dt>Channel</dt>
          <dd>{info.channel}</dd>
          <dt>Platform</dt>
          <dd>{info.platform}</dd>
        </dl>
      )}
      <nav aria-label="Application destinations">
        {applicationDestinations.map((d) => (
          <button
            key={d.target}
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => external.open(d.target),
                'The destination could not be opened. Please try again.',
              )
            }
          >
            {d.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        aria-expanded={noticeOpen}
        disabled={busy}
        onClick={() => {
          if (noticeOpen) {
            setNoticeOpen(false);
            return;
          }
          setNoticeOpen(true);
          if (notices === null)
            void run(async () => {
              const text = await gateway.notices();
              if (active.current) setNotices(text);
            }, 'Offline license notices could not be loaded.');
        }}
      >
        Offline licenses and notices
      </button>
      {noticeOpen && notices !== null && (
        <pre
          className="application-notices"
          tabIndex={0}
          aria-label="Offline license notices"
        >
          {notices}
        </pre>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
