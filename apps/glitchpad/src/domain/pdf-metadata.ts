import type { MetadataObservation } from './metadata';
export function pdfMetadataFacts(
  info: Record<string, unknown>,
  pages: number,
  permissions: number[] | null,
  dimensions: { width: number; height: number },
  outline: { count: number; limited: boolean },
): MetadataObservation[] {
  const facts: MetadataObservation[] = [];
  const text = (key: string, value: unknown) =>
    facts.push(
      typeof value === 'string' && value.length
        ? {
            key,
            availability: 'available',
            value: {
              kind: 'text',
              value: Array.from(value).slice(0, 1024).join(''),
            },
          }
        : { key, availability: 'not_provided' },
    );
  const integer = (key: string, value: number) =>
    facts.push({
      key,
      availability: 'available',
      value: { kind: 'integer', value: String(value) },
    });
  const bool = (key: string, value: unknown) =>
    facts.push(
      typeof value === 'boolean'
        ? { key, availability: 'available', value: { kind: 'boolean', value } }
        : { key, availability: 'not_provided' },
    );
  text('pdf.version', info.PDFFormatVersion);
  integer('pdf.pages', pages);
  bool('pdf.encrypted', typeof info.EncryptFilterName === 'string');
  text('pdf.encryption_filter', info.EncryptFilterName);
  const permissionNames:Record<number,string>={4:'Print',8:'Modify contents',16:'Copy',32:'Annotate',256:'Fill forms',512:'Accessibility copy',1024:'Assemble',2048:'High quality print'};
  text('pdf.permissions', permissions === null ? null : permissions.length?permissions.map(value=>permissionNames[value]??String(value)).join(', '):'No permitted operations listed (informational)');
  for (const [key, source] of [
    ['title', 'Title'],
    ['author', 'Author'],
    ['subject', 'Subject'],
    ['keywords', 'Keywords'],
    ['creator', 'Creator'],
    ['producer', 'Producer'],
    ['created', 'CreationDate'],
    ['modified', 'ModDate'],
  ] as const)
    text('pdf.' + key, info[source]);
  text(
    'pdf.current_page_dimensions',
    String(Number(dimensions.width.toFixed(3))) +
      ' × ' +
      String(Number(dimensions.height.toFixed(3))) +
      ' PDF points',
  );
  integer('pdf.outline_entries', outline.count);
  bool('pdf.outline_limited', outline.limited);
  bool('pdf.forms_present', info.IsAcroFormPresent);
  bool('pdf.xfa_present', info.IsXFAPresent);
  bool('pdf.signatures_present', info.IsSignaturesPresent);
  bool('pdf.collection_present', info.IsCollectionPresent);
  text(
    'pdf.feature_policy',
    'Read only. PDF scripts, action execution, form submission, attachments, embedded media and remote resources are not activated. Stored permissions are informational.',
  );
  text(
    'pdf.display_policy',
    'Embedded fonts and platform font fallback; embedded ICC profiles are not applied.',
  );
  return facts;
}
