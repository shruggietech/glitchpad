import ReactMarkdown from 'react-markdown';

export function RepositoryMarkdown({ children }: { children: string }) {
  return (
    <div className="authority-copy">
      <ReactMarkdown skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
