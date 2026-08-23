import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  LockKeyhole,
  Mail,
  Phone,
  Send,
  Truck,
  UserRound
} from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';

const accountTypes = [
  {
    value: 'TRANSPORT_COMPANY',
    title: 'Fleet transporter',
    hint: 'A transport company or fleet with its own trucks and company Drivers.',
    icon: Building2
  },
  {
    value: 'OWNER_OPERATOR',
    title: 'Owner-operator',
    hint: 'You drive and manage a truck you own.',
    icon: Truck
  },
  {
    value: 'SELF_MANAGED_DRIVER',
    title: 'Self-managed driver',
    hint: 'You operate another owner’s truck with authorization.',
    icon: UserRound
  }
];

export default async function ApplyPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const selectedType = accountTypes.some((type) => type.value === query.type)
    ? query.type
    : 'TRANSPORT_COMPANY';

  return <><PublicHeader/><main className="public-app-page public-form-workspace"><div className="container public-form-container">
    <div className="auth-heading"><span className="task-heading-icon"><Building2 aria-hidden="true"/></span><div><h1 className="page-title">Create a transporter account</h1><p className="page-subtitle">Choose how you operate, then publish truck capacity publicly or share it with trusted contacts.</p></div></div>
    <Flash error={query.error} success={query.success}/>
    <form action="/api/applications" method="post" className="form-card stack">
      <fieldset>
        <legend>Account type</legend>
        <div className="signup-role-grid">
          {accountTypes.map((type) => {
            const Icon = type.icon;
            return <label className="signup-role" key={type.value}>
              <input type="radio" name="applicationType" value={type.value} defaultChecked={selectedType === type.value} required/>
              <Icon aria-hidden="true"/>
              <strong>{type.title}</strong>
              <span>{type.hint}</span>
            </label>;
          })}
        </div>
      </fieldset>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="applicant-name"><UserRound aria-hidden="true"/>Your name</label><input id="applicant-name" name="name" autoComplete="name" required/></div>
        <div className="form-group"><label htmlFor="workspace-name"><Building2 aria-hidden="true"/>Transporter name</label><input id="workspace-name" name="businessName" autoComplete="organization" required/></div>
        <div className="form-group"><label htmlFor="application-email"><Mail aria-hidden="true"/>Account email</label><input id="application-email" name="email" type="email" autoComplete="email" required/><div className="meta">Private. Used to log in.</div></div>
        <div className="form-group"><label htmlFor="application-phone"><Phone aria-hidden="true"/>Account phone</label><input id="application-phone" name="phone" type="tel" autoComplete="tel" required/><div className="meta">Private. Add a public phone later.</div></div>
        <div className="form-group"><label htmlFor="application-password"><LockKeyhole aria-hidden="true"/>Password</label><input id="application-password" name="password" type="password" autoComplete="new-password" minLength={10} required/></div>
        <div className="form-group full"><label htmlFor="application-note"><Truck aria-hidden="true"/>About your transport work <span className="meta">(optional)</span></label><textarea id="application-note" name="notes"/></div>
      </div>
      <button className="button"><Send aria-hidden="true"/>Create transporter account</button>
    </form>
    <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true"/>Back to Truck Market</Link>
  </div></main></>;
}
