export function FileRow({ name, kind, size, modified, selected = false }) {
  return <div className="gp-file-row" role="row" aria-selected={selected}><div className="gp-file-row__name" role="cell"><span>{name}</span></div><div className="gp-file-row__kind" role="cell">{kind}</div><div role="cell">{size}</div><div className="gp-file-row__modified" role="cell">{modified}</div></div>;
}
