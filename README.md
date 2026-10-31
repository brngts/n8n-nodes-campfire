# n8n-nodes-campfire

This is an n8n community node for [Campfire](https://campfire.ai), the AI-native ERP for general ledger, accounts payable and receivable, and revenue recognition. It adds two nodes:

- **Campfire**: work with bills, invoices, credit memos, journal entries, revenue contracts and subscriptions, the chart of accounts and other master data, file attachments and financial statements.
- **Campfire Trigger**: start a workflow when a bill, invoice, memo, journal entry or contract is created, updated, paid or deleted.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Trigger](#trigger) · [Things to know](#things-to-know) · [Development](#development)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-campfire`.

## Credentials

In Campfire, go to **Settings > API Keys**, create an API user and then an API key on that user. The user's role decides what the key can do:

| Role | Can do |
| --- | --- |
| admin | Everything, including managing webhooks (needed by the Campfire Trigger) |
| clerk | Read everything and post drafts |
| view only | Read only |

In n8n, create a **Campfire API** credential and paste the key. Campfire has a single API host (`api.meetcampfire.com`); sandbox and implementation workspaces are told apart by the key, not the URL.

The credential also works with the built-in **HTTP Request** node (Authentication: Predefined Credential Type > Campfire API) for any of the 230+ endpoints this node does not cover.

## Operations

| Resource | Operations |
| --- | --- |
| Account | Create, Delete, Get, Get Many, Update |
| Bill | Create, Delete, Get, Get Many, Mark as Paid, Reopen, Search by Number, Update, Void |
| Contract | Create, Delete, Get, Get Many, Search by Deal Name, Terminate, Update |
| Credit Memo | Create, Delete, Download (PDF), Get, Get Many, Update, Void |
| Custom Dimension | Create, Delete, Find or Create, Get, Get Many, Update |
| Department | Create, Delete, Find or Create, Get, Get Many, Update |
| Entity | Get, Get Many |
| File | Delete, Download, Get, Get Many, Upload (attach to a bill, invoice, journal entry and more) |
| Invoice | Create, Delete, Get, Get Many, Mark as Paid, Reopen, Update, Void |
| Journal Entry | Create, Delete, Get, Get Many, Update |
| Payee | Create, Delete, Find or Create, Get, Get Many, Update |
| Product | Create, Delete, Get, Get Many, Update |
| Report | Get Balance Sheet, Get Income Statement, Get Trial Balance |
| Subscription | Create, Delete, Get, Get Many, Update (within a contract) |

Every Get Many with paging supports Return All, plus the filters Campfire offers for that list. Most lists filter on **Last Modified After/Before**, which suits incremental syncs.

Records can be picked from a searchable list or entered by ID. Bills, invoices, credit memos and journal entries take their lines from a form; anything the form does not cover, such as book and consolidation amounts or intercompany entities, goes in **Additional Body Fields (JSON)** using the field names from the [Campfire API reference](https://docs.campfire.ai/). Form fields win over the same key in the JSON.

**Find or Create** on payees, departments and custom dimensions looks up a list of names in one request and, with **Create Missing** on, creates the ones that do not exist yet. That makes master-data imports self-reconciling without a mapping table.

## Trigger

The Campfire Trigger registers a webhook in Campfire when the workflow is activated, and removes it when the workflow is deactivated.

- Pick specific topics or **All Topics**. A Campfire webhook only receives the topics it subscribes to, so All Topics subscribes to every topic the node lists.
- **Payment** topics (`Invoice.payment`, `Bill.payment`) fire on every payment, including partial ones. **Paid** topics fire once the record is fully paid; Campfire then sends both.
- Every delivery is verified: the trigger checks the `Campfire-Webhook-Signature-v1` HMAC against the webhook's signing secret and rejects deliveries more than five minutes old.
- Each item holds `topic`, `data` (the full record, in the same shape as the API, or only `{ id }` for deletes) and `changes` (old and new value per changed field).
- The API key must belong to an **admin** user.

## Things to know

- **Amounts are in major units**: `12.50` is twelve fifty, not cents.
- **Bills and invoices post their journal entry on create.** There is no separate approve or post step.
- **Bill and invoice numbers are unique per vendor or customer.** Creating the same number twice fails with a 400 instead of making a duplicate, so a deterministic number makes retries safe. Treat that 400 as "already there" and look the record up.
- **Contracts and subscriptions have no such guard.** Run Contract > Search by Deal Name before creating, or keep your own mapping.
- **Deletes record a reason.** Every delete takes an optional reason that Campfire saves on the audit log. Payee deletes finish in the background, and deletes held by an approval workflow come back with `pendingApproval: true`.
- **Mark as Paid** records a payment from a cash or clearing account. Matching a bank transaction or applying credit memos instead goes in the JSON field (`transactions`, `credit_memos`).
- **Rate limit**: 10 requests per second per API user, shared across all endpoints. For large batches, use the node's batching options.

## Development

```bash
npm install
npm run dev     # starts n8n locally with this node loaded
npm test        # description tests against the Campfire OpenAPI spec, plus helper and signature tests
npm run lint
```

`npm run sync:openapi` refreshes `test/fixtures/campfire-paths.json` from Campfire's live OpenAPI spec and the trigger's topic list from the webhooks guide. The tests then fail if the node calls an endpoint, method or parameter Campfire does not document.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Campfire API documentation](https://docs.campfire.ai/)
- [Campfire webhooks guide](https://docs.campfire.ai/guides/webhooks)
