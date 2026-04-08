# API examples

Replace the file paths (`./document1.png`, `./document2.pdf`, etc.) with your corresponding file paths.

Replace the UUIDs where noted: copy `sessionId` from the first extract response, and `jobId` from the async extract response.

---

## 1. Health check

```bash
curl -sS -X GET "http://localhost:3000/api/health" | jq .
```

---

## 2. Extract document (sync, new session, sync is default)

```bash
curl -sS -X POST "http://localhost:3000/api/extract" \
  -F "document=@./document1.png" | jq .
```

Explicit sync mode:

```bash
curl -sS -X POST "http://localhost:3000/api/extract?mode=sync" \
  -F "document=@./document1.png" | jq .
```

---

## 3. Extract document (sync, existing session)

Use the `sessionId` value returned by the previous extract (example below uses a placeholder UUID—substitute yours).

```bash
curl -sS -X POST "http://localhost:3000/api/extract" \
  -F "document=@./document1.png" \
  -F "sessionId=<<sessionId>>" | jq .
```

---

## 4. Extract document (async)

Returns `202` with `jobId` and `pollUrl`. Substitute the same `sessionId` you are using for the session.

```bash
curl -sS -X POST "http://localhost:3000/api/extract?mode=async" \
  -F "document=@./document1.png" \
  -F "sessionId=<<sessionId>>" | jq .
```

New session (no `sessionId` field):

```bash
curl -sS -X POST "http://localhost:3000/api/extract?mode=async" \
  -F "document=@./document1.png" | jq .
```

All extraction endpoints are rate-limited to **10 requests per minute per IP**. Space out calls if you hit `429`.

---

## 5. Poll async job status

Substitute `jobId` from the async extract response (example UUID below).

```bash
curl -sS -X GET "http://localhost:3000/api/jobs/<<jobId>>" | jq .
```

---

## 6. Get session summary

Substitute `sessionId` with the session you are testing.

```bash
curl -sS -X GET "http://localhost:3000/api/sessions/<<sessionId>>" | jq .
```

---

## 7. Validate session (cross-document)

Requires at least **two** completed extractions in that session. Substitute `sessionId`.

```bash
curl -sS -X POST "http://localhost:3000/api/sessions/<<sessionId>>/validate" \
  -H "Content-Type: application/json" \
  -d "{}" | jq .
```

---

## 8. Session report

Substitute `sessionId`.

```bash
curl -sS -X GET "http://localhost:3000/api/sessions/<<sessionId>>/report" | jq .
```

