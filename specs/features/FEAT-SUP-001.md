---
id: FEAT-SUP-001
title: Authenticated customer support inbox
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-ADM-001]
problem: Members need in-app help while platform owners need bounded assignment, scoped support-agent access, and accountable resolution without making the product database a new real-time chat platform.
behavior: A provider-backed support adapter identifies signed-in members without exposing provider secrets, routes conversations to customer-service agents with explicit capacity, and keeps platform administration permissions separate from chat assignment.
contracts: [SupportProvider, SupportIdentityToken, SupportConversationReference, SupportAgentCapacity, SupportWebhook, StaffPermissionPolicy]
observability: [support_widget_opened, conversation_created, conversation_assigned, conversation_closed, assignment_capacity_reached, provider_webhook_rejected]
rollout: Planned behind a disabled feature flag until a reviewed Chatwoot deployment, secrets, data residency, retention, backup, and webhook endpoints are configured and verified.
---

# Customer support inbox

### Scenario: authenticated member opens support

Given support is enabled and a signed-in member opens chat\
When the support widget initializes\
Then the server supplies a provider identity protected by a server-held secret\
And the browser never receives the provider signing secret\
And only the member's approved support identity fields are sent.

### Scenario: support agents receive bounded work

Given multiple available customer-service agents and queued conversations\
When automatic assignment runs\
Then an agent at the configured open-conversation limit receives no additional conversation\
And closing a conversation frees one assignment slot\
And assignment, reassignment, and closure remain visible in the support audit trail.

### Scenario: platform permissions remain scoped

Given a customer-service team member can access the external support inbox\
When they enter Loadgistic administration\
Then chat assignment does not grant platform administrator authority\
And application, document, billing, client-view, and client-edit capabilities are granted separately\
And every granted platform mutation is enforced by the server and audited.

### Scenario: disabled support fails closed

Given provider configuration is absent, invalid, or deliberately disabled\
When a member opens Loadgistic\
Then no broken chat launcher is rendered\
And no member data is sent to an external service\
And administrators see configuration status without secrets.

### Scenario: provider events are authenticated

Given the support provider sends a conversation event\
When Loadgistic receives the webhook\
Then the request signature is verified before any local reference or metric changes\
And duplicate provider events are idempotent\
And invalid events are rejected and recorded without member data in logs.

## Contract ownership

- Domain port: planned `SupportProvider`
- External adapter: planned Chatwoot identity, widget, API, and webhook adapter
- Platform authorization: scoped staff capability policy
- Tests: provider contract, signature, authorization, and disabled-state browser tests required before rollout
