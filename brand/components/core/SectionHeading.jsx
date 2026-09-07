export function SectionHeading({ eyebrow, title, description }) {
  return <header className="gl-section-heading">{eyebrow ? <div className="gl-eyebrow">{eyebrow}</div> : null}<h2 className="gl-section-heading__title">{title}</h2>{description ? <p className="gl-section-heading__description">{description}</p> : null}</header>;
}
