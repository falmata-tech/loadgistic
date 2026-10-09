export const backgroundDisclosureVersion = 'shipment-location-2026-10-09';
export const backgroundConsentKey = (actor: string) => `loadgistic.location.consent.${actor}`;
type Permission = { granted: boolean };
export type BackgroundConsentPort = {
 current: () => boolean;
 read: () => Promise<string | null>;
 write: (value: string) => Promise<void>;
 disclose: () => Promise<boolean>;
 foreground: () => Promise<Permission>;
 background: () => Promise<Permission>;
 requestForeground: () => Promise<Permission>;
 requestBackground: () => Promise<Permission>;
};
// OS permission is separate from explicit consent to our stated use/sharing.
// Never prompt from a poll, start a task on decline, or save another actor's consent.
export async function authorizeBackgroundLocation(port: BackgroundConsentPort, deliberate = false) {
 if (!port.current()) return false;
 const accepted = await port.read() === backgroundDisclosureVersion;
 if (!port.current()) return false;
 if (!accepted) {
  if (!deliberate || !await port.disclose() || !port.current()) return false;
  await port.write(backgroundDisclosureVersion);
  if (!port.current()) return false;
 }
 let foreground = await port.foreground();
 if (!port.current()) return false;
 if (!foreground.granted && deliberate) foreground = await port.requestForeground();
 if (!port.current() || !foreground.granted) return false;
 let background = await port.background();
 if (!port.current()) return false;
 if (!background.granted && deliberate) background = await port.requestBackground();
 return port.current() && background.granted;
}
