# Security Model

## Implemented locally

- HTTP-only, SameSite=Lax signed session cookies
- Scrypt password hashes for local demo accounts
- Server-side role and record-scope checks
- Explicit shipment state-transition validation
- File size and MIME validation
- Private proof download route with shipment authorization
- No sensitive file placed under `public/`
- Opaque tracking tokens
- Security headers and Content Security Policy
- Capacity expiry and visibility filtering
- External open-load viewers do not receive internal notes, proof, other-provider interest, or receiver details
- Audit records for sensitive mutations

## Required before public launch

- Supabase Auth or another managed identity provider
- Production session-key rotation
- PostgreSQL RLS verification
- Rate limiting backed by a shared store
- Bot protection on public application endpoints
- Malware scanning for uploads
- Managed secret storage
- HTTPS-only deployment
- Central logging and alerting
- Database backups and recovery exercises
- Security review of every public-company-page field
