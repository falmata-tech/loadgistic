import { AppLink } from './app-link';
import { Card, Title, Copy } from './ui';
export function ProfileSetup({ published }: { published: boolean | null | undefined }) {
  if (published !== false) return null;
  return <Card><Title message={"Make your vehicles discoverable"}/><Copy message={"Your transporter profile is not published yet. Complete it so customers can see eligible vehicles you share with them."}/><AppLink href="/profile" style={{ paddingVertical: 12, color: '#0c7275' }} message={"Set up transporter profile"}/></Card>;
}
