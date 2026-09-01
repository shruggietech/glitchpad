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
            <p className="eyebrow">Desktop + Android · Early development</p>
            <h1>
              See the file.
              <br />
              Keep your flow.
            </h1>
            <p className="hero-summary">
              Glitchpad is a focused, cross-platform viewer and editor for
              common local files. The foundation is under active development,
              and no installable release is available yet.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/docs">
                Read the documentation
              </a>
              <a
                className="button button-secondary"
                href="https://github.com/ShruggieTech/glitchpad"
              >
                Follow development on GitHub
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
