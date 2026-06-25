import type { ReactNode } from 'react';

interface SectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
}: SectionProps): ReactNode {
  return (
    <section id={id} className="section-card">
      <header className="section-card__header">
        <div className="section-card__copy">
          <p className="section-card__eyebrow">{eyebrow}</p>
          <h2 className="section-card__title">{title}</h2>
          {description ? <p className="section-card__description">{description}</p> : null}
        </div>
        {actions ? <div className="section-card__actions">{actions}</div> : null}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
