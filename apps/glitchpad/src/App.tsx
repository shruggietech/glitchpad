const productVersion = '0.0.0';

export function App() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card" aria-labelledby="product-title">
        <p className="eyebrow">Foundation build</p>
        <h1 id="product-title">Glitchpad</h1>
        <p className="summary">A focused, cross-platform viewer and editor for the files you already have.</p>
        <p className="status" role="status">
          Product shell ready <span aria-hidden="true">·</span> Version {productVersion}
        </p>
      </section>
    </main>
  );
}
