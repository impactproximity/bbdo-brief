# Brief Generation API (v1)

Machine-to-machine access to the Brief Creator. A consuming platform sends a prompt and/or
documents as JSON and receives a structured brief back.

Base URL: `https://bbdo.briefomnicom.com/api/v1`

This is a **server-to-server** API. No CORS headers are sent and none will be added: an API
key in browser code is a leaked API key.

## Authentication

```
Authorization: Bearer bbdo_sk_xxxxxxxxxxxxxxxxxxxx
```

Keys are issued with `scripts/api-key-create.mjs` and are shown exactly once — only a
SHA-256 hash is stored, so a lost key must be revoked and replaced, never recovered.

A key may be scoped to specific clients and brief types. Out-of-scope requests get `403`;
requests for things that do not exist get `404`.

## Endpoints

### `POST /briefs`

Generates a brief. **Synchronous** — the connection stays open until the model finishes.

**A Big Idea brief typically takes 1–3 minutes.** Set your client timeout to at least
**180 seconds**. The `Idempotency-Key` header is required precisely because of this: if you
time out and retry with the same key, you get the stored brief back instead of paying for
the work twice.

```
POST /api/v1/briefs
Authorization: Bearer bbdo_sk_…
Idempotency-Key: 7f3c1b90-your-unique-value
Content-Type: application/json
```

```jsonc
{
  "clientId": "mcvities",          // required — see GET /clients
  "briefType": "big-idea",         // required — see GET /clients
  "prompt": "Client wants a Ramadan campaign in KSA and Egypt…",
  "voiceTranscript": "",           // optional
  "documents": [                   // optional, max 20
    { "filename": "deck.pdf",  "contentBase64": "JVBERi0…" },
    { "filename": "notes.txt", "text": "already-extracted text" }
  ],
  "externalId": "your-ref-123"     // optional, echoed back untouched
}
```

At least one of `prompt`, `documents` or `voiceTranscript` must be present.

Documents are either `contentBase64` (PDF, DOCX, XLSX or CSV, max 15 MB each — parsed with
the same code the web uploader uses) or `text` if you have already extracted it.

**Response `200`**

```jsonc
{
  "briefId": "0f8c…",
  "clientId": "mcvities",
  "briefType": "big-idea",
  "documentTitle": "Big Idea Brief",
  "title": "McVitie's MENA Masterbrand",
  "externalId": "your-ref-123",
  "model": "claude-sonnet-4-6-20260219",
  "questions": [{ "id": "brief_name", "title": "Brief name", "required": true }],
  "answers": {
    "brief_name": {
      "value": "McVitie's MENA Masterbrand",
      "confidence": "high",       // high | medium | low
      "missing": false,           // true when the inputs had no signal
      "suggestion": "Add success metrics"
    }
  },
  "createdAt": "2026-10-14T09:12:33.120Z",
  "idempotentReplay": false       // true when this is a stored replay
}
```

`answers` is keyed by question id. Call `GET /brief-types/{tier}` to know the keys in advance.

### `GET /clients`

The clients this key may use, each with its available brief types. New clients appear here
automatically as they are onboarded.

### `GET /brief-types/{tier}`

The full question schema for a tier — ids, titles, prompts, hints and required flags — so you
can build your own intake form and validate before calling.

### `GET /me`

Key name, scopes and remaining hourly quota. The cheapest integration smoke test: it proves
the key and the network path without spending any model tokens.

## Errors

Every error uses the same envelope:

```json
{ "error": { "code": "forbidden", "message": "This API key is not scoped to client: acme" } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed JSON, or a missing `Idempotency-Key` |
| 401 | `unauthorized` | Missing, unknown or revoked key |
| 403 | `forbidden` | Real client or tier, but outside this key's scope |
| 404 | `not_found` | Unknown client or brief type |
| 413 | `payload_too_large` | A document exceeds 15 MB |
| 422 | `validation_failed` | Field missing or wrong type; unsupported file type |
| 429 | `rate_limited` | Hourly quota exceeded — honour `Retry-After` |
| 502 | `upstream_error` | Model unavailable or returned nothing usable — safe to retry |
| 504 | `upstream_timeout` | Model did not respond in time — safe to retry |
| 500 | `internal_error` | Unexpected failure |

Retries for `502`, `504` and `429` are safe as long as you **reuse the same
`Idempotency-Key`**. A retry with a new key generates — and bills — a second brief.

## Rate limits

Per key, per hour; default 60. `GET /me` reports current usage. Replays of a stored
idempotent result do not count against the quota.

## Example

```bash
curl -X POST https://bbdo.briefomnicom.com/api/v1/briefs \
  -H "Authorization: Bearer $BBDO_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -d '{
        "clientId": "mcvities",
        "briefType": "big-idea",
        "prompt": "Ramadan campaign for KSA and Egypt. Awareness led. Launch June."
      }'
```

## Notes for operators

- Keys: `scripts/api-key-create.mjs`, `api-key-list.mjs`, `api-key-revoke.mjs`. Revocation
  takes effect on the next request — unlike human sessions, which persist up to 7 days.
- API traffic is isolated from the app: briefs go to `api_briefs`, never to `briefs`, so no
  user's history in `/agency/briefs` is affected.
- Model spend is still recorded in `usage_events` with `route = 'api/v1/briefs'` and an
  `api_key_id`, so the admin cost report stays complete.
