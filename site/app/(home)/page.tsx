import { Footer } from '@/components/footer';

const features = [
  [
    'Open common files',
    'A focused home for text, Markdown, images, PDFs, and document formats as each capability earns implementation evidence.',
  ],
  [
    'Stay local-first',
    'Your documents remain on your device unless a future feature explicitly says otherwise and completes security review.',
  ],
  [
    'Keep context compact',
    'Small, keyboard-friendly tabs keep related files close without turning the viewer into a project-management workspace.',
  ],
];

export default function HomePage() {
  return (
    <div id="main-content" tabIndex={-1}>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              Desktop + Android · v0.1.3 community release
            </p>
            <h1>View your files.</h1>
            <p className="hero-summary">
              A fast, cross-platform viewer and editor for local files.
            </p>
            <p className="hero-endorsement">A ShruggieTech project.</p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href="https://github.com/ShruggieTech/glitchpad/releases/tag/v0.1.3"
              >
                Download
              </a>
              <a className="button button-secondary" href="/docs">
                Docs
              </a>
            </div>
          </div>
          <div className="feature-grid">
            {features.map(([title, description]) => (
              <article className="feature-card" key={title}>
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <Footer />
        </div>
      </section>
    </div>
  );
}
