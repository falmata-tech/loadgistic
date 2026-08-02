---
id: FEAT-SUP-001
title: Native authenticated customer support inbox
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-ADM-001]
problem: Members need simple in-app help while platform owners need bounded assignment, scoped support-agent access, and accountable resolution without per-agent fees or a second operational platform.
behavior: Loadgistic presents Support as a simple New chat, Continue chat, and Past chats workflow; stores text-only conversations and messages in its authoritative database; lets either participant end an owned chat; routes one open member conversation to the least-loaded available support agent within an explicit limit; and keeps support authority separate from platform administration.
contracts: [SupportConversation, SupportMessage, SupportCategory, SupportAgentState, SupportQueueAssignment, SupportAccessPolicy, SupportAudit]
observability: [support_conversation_created, support_message_sent, support_conversation_assigned, support_conversation_claimed, support_conversation_closed, support_agent_availability_changed, support_assignment_capacity_reached, denied_support_access]
rollout: Additive schema and SUPPORT role. Start with visibility-aware five-second refreshes and bounded message/query windows; durable database records remain authoritative so Realtime or Telegram notifications can be added later without changing ownership.
---

# Customer support inbox

### Scenario: authenticated member requests help

Given an active signed-in Business, Fleet Transporter, or Driver has no open support conversation\
When the member selects a short help category and starts a conversation\
Then one open conversation owned by that user is created\
And the first message is stored with a bounded body\
And the conversation is assigned to the least-loaded available agent when capacity exists\
And the redirect immediately renders that stored message inside the member's active chat\
And no shipment, tracking, verification, location, or payment record is copied into chat automatically.

### Scenario: support agents receive bounded work

Given multiple available customer-service agents and queued conversations\
When automatic assignment runs\
Then an agent at the configured open-conversation limit receives no additional conversation\
And closing a conversation frees one assignment slot\
And equal-load agents are selected by the oldest assignment time\
And assignment, claim, availability, and closure remain visible in the support audit trail.

### Scenario: customer and agent reads are scoped

Given a support conversation exists\
When its customer, assigned support agent, or administrator opens it\
Then only the latest bounded message window and safe participant identity are returned\
And an unrelated customer or unassigned support agent receives no conversation\
And no account phone, password, tracking code, exact location, or private document is projected.

### Scenario: member conversations remain easy to find

Given a member has an active conversation and any number of closed conversations\
When the member opens Support or pages through conversation history\
Then the active conversation is fetched independently of the bounded history page\
And it cannot be hidden by a newer closed conversation or pagination\
And Support first shows one clear Continue chat action plus a separate bounded Past chats list\
And an owner may end the active chat so New chat becomes available immediately\
And when no active chat exists, New chat remains visible even when closed history exists\
And each history row shows status, update time, message count, and a short latest-message preview\
And selecting an owned closed conversation opens its read-only message history\
And another member's conversation remains inaccessible.

### Scenario: support authority is not administration

Given a user has the SUPPORT role\
When they request an application, document, billing, Operations, account-edit, or client-suspension page or command\
Then access is denied\
And the support role can access only its inbox, assigned conversations, availability, and account/logout controls.

### Scenario: message and lifecycle mutations remain strict

Given an open support conversation\
When the owning customer or assigned agent sends a non-empty message\
Then the body is length bounded, rate limited, stored once, and updates unread state\
And the owning member, assigned agent, or administrator may close it\
And closed conversations reject new messages\
And denied mutations write no success audit.

### Scenario: administrator triages support work

Given support conversations exist in Waiting, Open, and Closed states\
When an administrator opens Customer Support\
Then status tabs filter a bounded server page of safe conversation summaries\
And each row shows the customer workspace, topic, latest message preview, update time, assigned agent, and state\
And agent capacity and permissions remain managed separately from the conversation queue.

### Scenario: waiting work can be claimed

Given no available agent had capacity when a member opened a conversation\
When an available support agent below their limit claims the oldest waiting conversation\
Then assignment is atomic\
And another agent cannot claim the same conversation\
And the member sees the assigned agent name after refresh.

### Scenario: compact refresh preserves performance

Given a customer or agent keeps one conversation open\
When the page is visible\
Then it refreshes at a bounded interval\
And pauses refresh while hidden\
And each response contains at most 50 recent messages\
And queue and history lists use server pagination and supporting indexes.

## Contract ownership

- Pages: `/app/support`, `/support`, `/support/[id]`, `/admin/support`
- Application services: native support services in `src/lib/repository.js`
- Inbound adapters: `/api/support/*` and `/api/admin/support-agents`
- Persistence adapters: additive SQLite schema and Supabase migration `008`
- Tests: domain, repository authorization/routing, E2E customer/agent flow, and desktop/mobile UI audit
