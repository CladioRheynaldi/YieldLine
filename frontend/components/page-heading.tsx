import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <div className="page-heading__aside">{aside}</div> : null}
    </header>
  );
}
