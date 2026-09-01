export function SectionHeading({ eyebrow, title, description }) {
  return <header className="gp-section-heading"><div className="gp-eyebrow">{eyebrow}</div><h2 className="gp-section-heading__title">{title}</h2>{description ? <p className="gp-section-heading__description">{description}</p> : null}</header>;
}
