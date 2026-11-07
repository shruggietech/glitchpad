import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import './DocumentTools.css';

import type { ShellSession } from '../domain/contracts';
import {
  browserClipboardGateway,
  type ClipboardGateway,
} from '../domain/metadata-gateway';
import {
  bulkCopyText,
  formatMetadataFact,
  groupMetadataFacts,
  metadataCatalogEntry,
  type MetadataFact,
  type MetadataSnapshot,
} from '../domain/metadata';

interface MetadataInspectorProps {
  session: ShellSession;
  snapshot: MetadataSnapshot;
  onClose: () => void;
  onRequestChecksum?: () => void;
  clipboardGateway?: ClipboardGateway;
  embedded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function MetadataInspector({
  session,
  snapshot,
  onClose,
  onRequestChecksum,
  clipboardGateway = browserClipboardGateway,
  embedded = false,
  onExpandedChange,
}: MetadataInspectorProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const snapshotSignatureRef = useRef('');
  const generation = useRef(0);
  const copying = useRef(false);
  const disclosureRefs = useRef(new Map<string, HTMLButtonElement>());
  const [copyPending, setCopyPending] = useState(false);
  const [disclosedKey, setDisclosedKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [phoneExpanded, setPhoneExpanded] = useState(false);

  useEffect(() => {
    if (!embedded) closeRef.current?.focus();
    generation.current += 1;
    copying.current = false;
    setCopyPending(false);
    setDisclosedKey(null);
    setAnnouncement('');
    setPhoneExpanded(false);
    snapshotSignatureRef.current = '';
    return () => {
      generation.current += 1;
    };
  }, [session.id, embedded]);

  useEffect(() => {
    const signature = metadataSignature(snapshot);
    if (
      snapshotSignatureRef.current &&
      snapshotSignatureRef.current !== signature
    ) {
      generation.current += 1;
      copying.current = false;
      setCopyPending(false);
      setDisclosedKey(null);
      setAnnouncement('File information updated.');
    }
    snapshotSignatureRef.current = signature;
  }, [snapshot]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || embedded) return;
    event.preventDefault();
    onClose();
  };

  const write = async (value: string, completed: string, failed: string) => {
    if (copying.current) return;
    const expected = generation.current;
    copying.current = true;
    setCopyPending(true);
    setAnnouncement('Copying information');
    try {
      await clipboardGateway.write(value);
      if (generation.current === expected) setAnnouncement(completed);
    } catch {
      if (generation.current === expected) setAnnouncement(failed);
    } finally {
      if (generation.current === expected) {
        copying.current = false;
        setCopyPending(false);
      }
    }
  };
  const copy = (fact: MetadataFact) => {
    const formatted = formatMetadataFact(fact);
    void write(
      formatted.value,
      formatted.label + ' copied',
      'Copy failed. The value remains available.',
    );
  };
  const copyAll = () => {
    const value = bulkCopyText(snapshot);
    if (!value) {
      setAnnouncement('No copyable information is available.');
      return;
    }
    void write(
      value,
      'Available information copied',
      'Copy failed. The information remains available.',
    );
  };

  const displayNameFact = snapshot.facts.find(
    ({ key }) => key === 'host.display_name',
  );
  const displayName =
    displayNameFact?.availability === 'available'
      ? formatMetadataFact(displayNameFact).value
      : session.source.display_name;

  return (
    <aside
      className={
        embedded
          ? 'metadata-content document-tools'
          : 'metadata-inspector document-tools'
      }
      role="complementary"
      aria-labelledby="metadata-inspector-title"
      data-layout="responsive-sheet"
      data-phone-expanded={phoneExpanded}
      onKeyDown={handleKeyDown}
    >
      <header className="metadata-inspector-header">
        <div>
          <h2
            id="metadata-inspector-title"
            className={embedded ? 'visually-hidden' : undefined}
          >
            File information
          </h2>
          <p title={displayName}>{displayName}</p>
        </div>
        {!embedded && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close file information"
          >
            Close
          </button>
        )}
      </header>
      <div className="metadata-inspector-actions">
        <button type="button" disabled={copyPending} onClick={copyAll}>
          Copy available information
        </button>
        <button
          className="metadata-phone-expansion"
          type="button"
          aria-expanded={phoneExpanded}
          onClick={() => {
            const expanded = !phoneExpanded;
            setPhoneExpanded(expanded);
            onExpandedChange?.(expanded);
          }}
        >
          {phoneExpanded ? 'Collapse information' : 'Expand information'}
        </button>
        {onRequestChecksum && (
          <button type="button" onClick={onRequestChecksum}>
            Calculate SHA-256
          </button>
        )}
      </div>
      <div className="metadata-groups">
        {session.image_document?.metadata && (
          <section
            className="metadata-group"
            aria-label="Embedded image observations"
          >
            <h3>Embedded observations</h3>
            <p>
              {session.image_document.metadata.unknown_fields} unknown fields
              (values withheld).
            </p>
            {session.image_document.metadata.observations.map(
              (observation, index) => (
                <details
                  key={`${observation.family}-${observation.block}-${index}`}
                >
                  <summary>
                    {metadataCatalogEntry(observation.key).label}:{' '}
                    {observation.family.toUpperCase()} / {observation.tag}
                    {observation.duplicate
                      ? ' (duplicate; first observation is used in facts)'
                      : ''}
                  </summary>
                  <p>
                    Metadata block {observation.block}.{' '}
                    {observation.availability.replaceAll('_', ' ')}.
                  </p>
                  {observation.availability === 'available' &&
                    observation.key !== 'image.location' &&
                    observation.original && (
                      <p>
                        Original typed value:{' '}
                        <code>{JSON.stringify(observation.original)}</code>
                      </p>
                    )}
                </details>
              ),
            )}
          </section>
        )}
        {groupMetadataFacts(snapshot).map((group) => (
          <section
            key={group.group}
            className="metadata-group"
            aria-labelledby={`metadata-group-${group.group}`}
          >
            <h3 id={`metadata-group-${group.group}`}>{group.label}</h3>
            <dl>
              {group.facts.map((fact) => {
                const formatted = formatMetadataFact(fact);
                const canAct = fact.availability === 'available';
                const direct = canAct && formatted.copy_policy === 'direct';
                const confirm =
                  canAct && formatted.copy_policy === 'explicit_confirmation';
                const disclosed = disclosedKey === fact.key;
                return (
                  <div
                    className="metadata-fact"
                    key={fact.key}
                    data-availability={fact.availability}
                  >
                    <dt>{formatted.label}</dt>
                    <dd>
                      <span className="metadata-value" title={formatted.value}>
                        {formatted.value}
                      </span>
                      <span className="metadata-provenance">
                        {formatted.provenance}
                      </span>
                      {direct && (
                        <button
                          type="button"
                          disabled={copyPending}
                          onClick={() => copy(fact)}
                          aria-label={`Copy ${formatted.label}`}
                        >
                          Copy
                        </button>
                      )}
                      {confirm && !disclosed && (
                        <button
                          type="button"
                          ref={(element) => {
                            if (element)
                              disclosureRefs.current.set(fact.key, element);
                            else disclosureRefs.current.delete(fact.key);
                          }}
                          onClick={() => setDisclosedKey(fact.key)}
                          aria-label={`Disclose ${formatted.label}`}
                        >
                          Disclose to copy
                        </button>
                      )}
                      {confirm && disclosed && (
                        <span className="metadata-copy-confirmation">
                          <span>
                            Copying this value may expose source identity.
                            Confirm the value shown for {formatted.label}.
                          </span>
                          <button
                            type="button"
                            onClick={() => copy(fact)}
                            aria-label={`Copy ${formatted.label}`}
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDisclosedKey(null);
                              requestAnimationFrame(() =>
                                disclosureRefs.current.get(fact.key)?.focus(),
                              );
                            }}
                          >
                            Cancel
                          </button>
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
      <p
        className="metadata-feedback"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
    </aside>
  );
}

const metadataSignature = (snapshot: MetadataSnapshot): string =>
  JSON.stringify({
    external_revision: snapshot.external_revision,
    facts: snapshot.facts.map(
      ({ key, availability, value, error_code, renderer_revision }) => ({
        key,
        availability,
        value,
        error_code,
        renderer_revision,
      }),
    ),
  });
