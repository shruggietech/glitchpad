import { ProsePage } from '@/components/prose-page';
import { RepositoryMarkdown } from '@/components/repository-markdown';
import { supportText } from '@/lib/generated/project';
import { routeMetadata } from '@/lib/metadata';

export const metadata = routeMetadata({
  title: 'Support',
  description: 'How to get help with Glitchpad.',
  path: '/support',
});

export default function SupportPage() {
  return (
    <ProsePage title="Support">
      <RepositoryMarkdown>{supportText}</RepositoryMarkdown>
    </ProsePage>
  );
}
