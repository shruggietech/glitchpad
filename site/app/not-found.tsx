import { ProsePage } from '@/components/prose-page';

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
