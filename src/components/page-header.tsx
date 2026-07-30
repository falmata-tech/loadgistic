import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="page-header">
      <div className="task-heading">
        {Icon ? <span className="task-heading-icon"><Icon aria-hidden="true"/></span> : null}
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
