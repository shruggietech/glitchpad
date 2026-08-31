import { ProsePage } from '@/components/prose-page';
import { routeMetadata } from '@/lib/metadata';

export const metadata = routeMetadata({
  title: 'Page not found',
  description: 'The requested Glitchpad page does not exist.',
  path: '/404',
});

export default function NotFound() {
  return (
    <ProsePage title="Page not found" landmark>
      <p>The requested Glitchpad page does not exist.</p>
      <p>
        <a href="/">Return to the landing page</a> or{' '}
        <a href="/docs">open the documentation</a>.
      </p>
    </ProsePage>
  );
}
