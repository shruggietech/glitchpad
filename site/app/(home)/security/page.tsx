import { ProsePage } from '@/components/prose-page';
import { RepositoryMarkdown } from '@/components/repository-markdown';
import { securityText } from '@/lib/generated/project';
import { routeMetadata } from '@/lib/metadata';

export const metadata = routeMetadata({
  title: 'Security',
  description: 'How to report a Glitchpad security vulnerability.',
  path: '/security',
});

export default function SecurityPage() {
  return (
    <ProsePage title="Security">
      <RepositoryMarkdown>{securityText}</RepositoryMarkdown>
      <p>Do not disclose vulnerabilities in a public issue.</p>
    </ProsePage>
  );
}
