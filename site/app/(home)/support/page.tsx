import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose-page';
import { supportText } from '@/lib/generated/project';

export const metadata: Metadata = {
  title: 'Support',
  description: 'How to get help with Glitchpad.',
  alternates: { canonical: '/support' },
};

export default function SupportPage() {
  return (
    <ProsePage title="Support">
      <p className="authority-copy">{supportText}</p>
      <p>
        <a href="https://github.com/ShruggieTech/glitchpad/issues">
          Open or review a GitHub issue
        </a>
        .
      </p>
    </ProsePage>
  );
}
