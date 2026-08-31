import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose-page';
import { securityText } from '@/lib/generated/project';

export const metadata: Metadata = {
  title: 'Security',
  description: 'How to report a Glitchpad security vulnerability.',
  alternates: { canonical: '/security' },
};

export default function SecurityPage() {
  return (
    <ProsePage title="Security">
      <p className="authority-copy">{securityText}</p>
      <p>Do not disclose vulnerabilities in a public issue.</p>
    </ProsePage>
  );
}
