import { normalizeNativeLink } from '../navigation/native-link';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return normalizeNativeLink(path, __DEV__);
}
