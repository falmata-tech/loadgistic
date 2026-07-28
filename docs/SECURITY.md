# Security Model

## Implemented locally

- HTTP-only, SameSite=Lax signed session cookies
- Scrypt password hashes for local demo accounts
- Server-side role and record-scope checks
- Explicit shipment state-transition validation
- File size and MIME validation
- Private proof download route with shipment authorization
- No sensitive file placed under `public/`
- Keyed-digest tracking codes that never appear in URLs
- Five-minute HTTP-only tracking grants bound to one Business user and load
- Security headers and Content Security Policy
- Capacity expiry and visibility filtering
- Anonymous visitors cannot access company pages, transporter directory, loads, capacity, internal notes, proof, other-provider interest, or receiver details
- Audit records for sensitive mutations
- Explicit authorization contracts in `docs/AUTHORIZATION_MATRIX.md`
- Browse-only load visibility cannot grant status, internal-note, or private-proof access
- Partners loads and capacity require a mutual Connected relationship
- Terminal application and payment-proof decisions cannot be overwritten

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
- Security review of every authenticated company-page field before it is exposed beyond the owning workspace
