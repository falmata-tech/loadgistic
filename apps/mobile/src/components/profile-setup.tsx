import { AppLink } from './app-link';
import { Card, Title, Copy } from './ui';
export function ProfileSetup({ published }: { published: boolean | null | undefined }) {
  if (published !== false) return null;
  return <Card><Title message={"Make your trucks discoverable"}/><Copy message={"Your transporter profile is not published yet. Complete it so customers can see eligible trucks you share with them."}/><AppLink href="/profile" style={{ paddingVertical: 12, color: '#0c7275' }} message={"Set up transporter profile"}/></Card>;
}
