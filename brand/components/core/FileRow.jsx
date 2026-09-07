export function FileRow({ name, kind, size, modified, selected = false }) {
  return <div className="gl-file-row" role="row" aria-selected={selected}><div className="gl-file-row__name" role="cell">{name}</div><div className="gl-file-row__kind" role="cell">{kind}</div><div className="gl-file-row__size" role="cell">{size}</div><div className="gl-file-row__modified" role="cell">{modified}</div></div>;
}
