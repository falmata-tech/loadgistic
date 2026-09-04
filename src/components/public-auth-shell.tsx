import Link from 'next/link';
import type {ReactNode} from 'react';
import {ArrowLeft, MapPinned} from 'lucide-react';

type PublicAuthShellProps={
  variant:'login'|'signup';
  taskKicker:string;
  title:string;
  description:string;
  contextKicker:string;
  contextTitle:string;
  contextDescription:string;
  contextNoteTitle?:string;
  contextNote?:string;
  footerNote?:string;
  feedback?:ReactNode;
  children:ReactNode;
};

export function PublicAuthShell({
  variant,taskKicker,title,description,contextKicker,contextTitle,
  contextDescription,contextNoteTitle,contextNote,footerNote,feedback,children
}:PublicAuthShellProps){
  return <main className="public-app-page auth-page-workspace">
    <div className="container auth-page-container">
      <section className={`auth-access-shell auth-shell ${variant}`} data-testid="auth-access-shell">
        <div className="auth-task-panel">
          <header className="auth-task-header">
            <span>{taskKicker}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {feedback}
          <div className="auth-task-content">{children}</div>
          <footer className="auth-task-footer">
            {footerNote?<p>{footerNote}</p>:null}
            <Link className="auth-market-link" href="/"><ArrowLeft aria-hidden="true"/>Back to Open capacity</Link>
          </footer>
        </div>
        <aside className="auth-context-panel" aria-label="About Loadgistic transporter access">
          <div>
            <span>{contextKicker}</span>
            <h2>{contextTitle}</h2>
            <p>{contextDescription}</p>
          </div>
          {contextNoteTitle&&contextNote?<div className="auth-context-note">
            <MapPinned aria-hidden="true"/>
            <span><strong>{contextNoteTitle}</strong><small>{contextNote}</small></span>
          </div>:null}
        </aside>
      </section>
    </div>
  </main>;
}
