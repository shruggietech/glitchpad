import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { ShellSession } from '../domain/contracts';
import {
  browserClipboardGateway,
  type ClipboardGateway,
} from '../domain/metadata-gateway';
import {
  bulkCopyText,
  formatMetadataFact,
  groupMetadataFacts,
  type MetadataFact,
  type MetadataSnapshot,
} from '../domain/metadata';

interface MetadataInspectorProps {
  session: ShellSession;
  snapshot: MetadataSnapshot;
  onClose: () => void;
  onRequestChecksum?: () => void;
  clipboardGateway?: ClipboardGateway;
}

export function MetadataInspector({
  session,
  snapshot,
  onClose,
  onRequestChecksum,
  clipboardGateway = browserClipboardGateway,
}: MetadataInspectorProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const snapshotSignatureRef = useRef('');
  const [disclosedKey, setDisclosedKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [phoneExpanded, setPhoneExpanded] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    setDisclosedKey(null);
    setAnnouncement('');
    setPhoneExpanded(false);
    snapshotSignatureRef.current = '';
  }, [session.id]);

  useEffect(() => {
    const signature = metadataSignature(snapshot);
    if (snapshotSignatureRef.current && snapshotSignatureRef.current !== signature)
      setAnnouncement('File information updated.');
    snapshotSignatureRef.current = signature;
  }, [snapshot]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };

  const copy = (fact: MetadataFact) => {
    const formatted = formatMetadataFact(fact);
    void clipboardGateway
      .write(formatted.value)
      .then(() => setAnnouncement(`${formatted.label} copied`))
      .catch(() => setAnnouncement('Copy failed. The value remains available.'));
  };

  const copyAll = () => {
    const value = bulkCopyText(snapshot);
    if (!value) {
      setAnnouncement('No copyable information is available.');
      return;
    }
    void clipboardGateway
      .write(value)
      .then(() => setAnnouncement('Available information copied'))
      .catch(() => setAnnouncement('Copy failed. The information remains available.'));
  };

  const displayNameFact = snapshot.facts.find(({ key }) => key === 'host.display_name');
  const displayName = displayNameFact?.availability === 'available'
    ? formatMetadataFact(displayNameFact).value
    : session.source.display_name;

  return (
    <aside
      className="metadata-inspector"
      role="complementary"
      aria-labelledby="metadata-inspector-title"
      data-layout="responsive-sheet"
      data-phone-expanded={phoneExpanded}
      onKeyDown={handleKeyDown}
    >
      <header className="metadata-inspector-header">
        <div>
          <h2 id="metadata-inspector-title">File information</h2>
          <p title={displayName}>{displayName}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close file information">
          Close
        </button>
      </header>
      <div className="metadata-inspector-actions">
        <button type="button" onClick={copyAll}>Copy available information</button>
        <button
          className="metadata-phone-expansion"
          type="button"
          aria-expanded={phoneExpanded}
          onClick={() => setPhoneExpanded((expanded) => !expanded)}
        >
          {phoneExpanded ? 'Collapse information' : 'Expand information'}
        </button>
        {onRequestChecksum && (
          <button type="button" onClick={onRequestChecksum}>Calculate SHA-256</button>
        )}
      </div>
      <div className="metadata-groups">
        {groupMetadataFacts(snapshot).map((group) => (
          <section key={group.group} className="metadata-group" aria-labelledby={`metadata-group-${group.group}`}>
            <h3 id={`metadata-group-${group.group}`}>{group.label}</h3>
            <dl>
              {group.facts.map((fact) => {
                const formatted = formatMetadataFact(fact);
                const canAct = fact.availability === 'available';
                const direct = canAct && formatted.copy_policy === 'direct';
                const confirm = canAct && formatted.copy_policy === 'explicit_confirmation';
                const disclosed = disclosedKey === fact.key;
                return (
                  <div className="metadata-fact" key={fact.key} data-availability={fact.availability}>
                    <dt>{formatted.label}</dt>
                    <dd>
                      <span className="metadata-value" title={formatted.value}>{formatted.value}</span>
                      <span className="metadata-provenance">{formatted.provenance}</span>
                      {direct && <button type="button" onClick={() => copy(fact)} aria-label={`Copy ${formatted.label}`}>Copy</button>}
                      {confirm && !disclosed && (
                        <button type="button" onClick={() => setDisclosedKey(fact.key)} aria-label={`Disclose ${formatted.label}`}>Disclose to copy</button>
                      )}
                      {confirm && disclosed && (
                        <span className="metadata-copy-confirmation">
                          <span>Copying this value may expose source identity.</span>
                          <button type="button" onClick={() => copy(fact)} aria-label={`Copy ${formatted.label}`}>Copy</button>
                          <button type="button" onClick={() => setDisclosedKey(null)}>Cancel</button>
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </aside>
  );
}

const metadataSignature = (snapshot: MetadataSnapshot): string => JSON.stringify({
  external_revision: snapshot.external_revision,
  facts: snapshot.facts.map(({ key, availability, value, error_code, renderer_revision }) => ({
    key,
    availability,
    value,
    error_code,
    renderer_revision,
  })),
});
