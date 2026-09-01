import { ProsePage } from '@/components/prose-page';
import { licenseText, noticeText } from '@/lib/generated/project';
import { routeMetadata } from '@/lib/metadata';

export const metadata = routeMetadata({
  title: 'License',
  description: 'Glitchpad license and attribution information.',
  path: '/license',
});

export default function LicensePage() {
  return (
    <ProsePage title="License">
      <p>Glitchpad is distributed under the Apache License, Version 2.0.</p>
      <pre>{licenseText}</pre>
      <h2>Notice</h2>
      <pre>{noticeText}</pre>
    </ProsePage>
  );
}
