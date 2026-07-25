export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><h1 className="page-title">{title}</h1>{subtitle ? <p className="page-subtitle">{subtitle}</p> : null}</div>{action}</div>;
}
