
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import type {ReactNode} from 'react';
import {ArrowLeft, MapPinned} from 'lucide-react';

type PublicAuthShellProps={
  variant:'login'|'signup';
  taskKicker:ReactNode;
  title:ReactNode;
  description:ReactNode;
  contextKicker?:ReactNode;
  contextTitle?:ReactNode;
  contextDescription?:ReactNode;
  contextNoteTitle?:ReactNode;
  contextNote?:ReactNode;
  footerNote?:ReactNode;
  feedback?:ReactNode;
  children:ReactNode;
};

export function PublicAuthShell({
  variant,taskKicker,title,description,contextKicker,contextTitle,
  contextDescription,contextNoteTitle,contextNote,footerNote,feedback,children
}:PublicAuthShellProps){
  return <main className={`public-app-page auth-page-workspace${variant==='login'?' auth-login-workspace':''}`}>
    <div className="container auth-page-container">
      <section className={`auth-access-shell auth-shell ${variant}`} data-testid="auth-access-shell">
        <div className="auth-task-panel">
          <header className="auth-task-header">
            <span>{typeof taskKicker==='string'?<Text message={taskKicker}/>: taskKicker}</span>
            <h1>{typeof title==='string'?<Text message={title}/>: title}</h1>
            <p>{typeof description==='string'?<Text message={description}/>: description}</p>
          </header>
          {feedback}
          <div className="auth-task-content">{children}</div>
          <footer className="auth-task-footer">
            {footerNote?<p>{typeof footerNote==='string'?<Text message={footerNote}/>: footerNote}</p>:null}
            <Link className="auth-market-link" href="/"><ArrowLeft aria-hidden="true"/><Text message="Back to Open capacity"/></Link>
          </footer>
        </div>
        {variant!=='login'?<Localized as="aside" copy={["aria-label"]} className="auth-context-panel" aria-label="About Loadgistic transporter access">
          <div>
            <span>{typeof contextKicker==='string'?<Text message={contextKicker}/>: contextKicker}</span>
            <h2>{typeof contextTitle==='string'?<Text message={contextTitle}/>: contextTitle}</h2>
            <p>{typeof contextDescription==='string'?<Text message={contextDescription}/>: contextDescription}</p>
          </div>
          {contextNoteTitle&&contextNote?<div className="auth-context-note">
            <MapPinned aria-hidden="true"/>
            <span><strong>{typeof contextNoteTitle==='string'?<Text message={contextNoteTitle}/>: contextNoteTitle}</strong><small>{typeof contextNote==='string'?<Text message={contextNote}/>: contextNote}</small></span>
          </div>:null}
        </Localized>:null}
      </section>
    </div>
  </main>;
}
