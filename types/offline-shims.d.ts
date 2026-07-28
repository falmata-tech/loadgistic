declare const process: any;
declare const Buffer: any;
declare namespace React { type ReactNode = any; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare module 'react' { export type ReactNode = any; const React: any; export default React; }
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'next' { export type Metadata = any; }
declare module 'next/link' { const Link: any; export default Link; }
declare module 'next/navigation' { export function redirect(path: string): never; export function notFound(): never; export function usePathname(): string; export function useRouter(): { replace(path:string):void }; }
declare module 'next/headers' { export function cookies(): Promise<any>; }
declare module 'next/server' {
  export class NextRequest { url: string; method: string; headers: { get(name: string): string | null }; formData(): Promise<FormData>; }
  export class NextResponse {
    constructor(body?: any, init?: any);
    cookies: any;
    static redirect(url: URL, status?: number): NextResponse;
    static json(data: any, init?: any): NextResponse;
    static next(): NextResponse;
  }
}
declare module '@supabase/supabase-js' { export type SupabaseClient = any; export function createClient(url: string, key: string, options?: any): any; }
declare module '@playwright/test' { export const test: any; export const expect: any; export const devices: any; export function defineConfig(value: any): any; }
declare module 'node:fs' { const fs: any; export default fs; }
