# ADR — SMDE Part 1 Decisions

## Context

For Part 1, I built the API in Node.js/TypeScript with Express, used SQLite for storage, and handled async extraction jobs through an in-process worker backed by a `jobs` table. I aimed for something that feels production-minded, but still realistic to build in assignment time.

## 1) Sync vs Async

If this were going to production tomorrow, I would make async the default.

Reason: LLM latency is noisy. Even with the same file type, response times can vary a lot based on model load, provider behavior, and document quality. If we block the request thread every time, the API will feel fine in light testing and then degrade quickly under burst traffic.

I still support sync because it is useful for quick operator workflows and demo/testing loops. But I would force async regardless of `mode=sync` once either of these is true:

- file size > ~2 MB
- active extraction jobs > 5 (or p95 sync latency > 3s in recent window)

That gives the best of both worlds: fast direct response for simple uploads, safer behavior for real-world volume.

## 2) Queue choice

I used a DB-backed queue pattern with SQLite (`jobs` table + claim/process/update status flow). It is simple and dependable for this stage:

- no extra infrastructure to run
- job state survives process restarts
- easy to inspect/debug by querying one table

If we need to run at 500 concurrent extractions/minute, I would move to Postgres + `pg-boss` (or BullMQ if Redis is already in our stack). At that point, we need better worker parallelism, retry controls, dead-letter handling, and visibility that an in-process loop cannot provide cleanly.

Current approach failure modes:

- one process is the bottleneck
- polling is not efficient at scale
- retry/backoff rules are basic
- no first-class dead-letter workflow

So: good for now, not my long-term queue strategy.

## 3) LLM provider abstraction

I chose to add a provider interface instead of hardwiring one vendor. Swapping providers is a real business need in LLM systems (cost, quality, quotas, outages), so I wanted this from day one.

The core interface is:

- `generateFromDocument(...)`
- `generateText(...)`
- `healthCheck()`

With that in place, extraction reliability logic is shared once (timeout, JSON cleanup, repair retry, low-confidence retry), instead of being rewritten inside each provider client.

Tradeoff: a bit more code up front. I think it is worth it here because provider churn is likely, not hypothetical.

## 4) Schema design

I intentionally used a hybrid schema:

- typed columns for fields we query often (`document_type`, `is_expired`, `applicable_role`, identity keys)
- JSON/text blobs for variable fields that depend on document type

This avoids forcing a giant rigid schema too early, but still lets us answer practical product queries fast.

The risk of leaning too hard on JSON is obvious: queries become painful, indexing is weaker, and field meaning can drift across prompt versions.

If this system needed strong search/analytics, I would:

1. move to Postgres,
2. add a normalized `extraction_fields` table for key/value extraction items,
3. index it for search/filter use cases,
4. keep raw JSON for audit/debug but stop using it as the primary query surface.

For queries like “all sessions where any document has an expired COC,” typed columns + indexes are the right path (not deep JSON filtering).

## 5) What I skipped (on purpose)

I left out several things that I would normally treat as required before production:

1. **Auth and tenancy controls**  
   Not part of assignment scope, so I prioritized extraction reliability and API behavior.

2. **Deep observability**  
   Logging is present, but not full metrics/tracing dashboards for queue health, model latency, failure classes, etc.

3. **Mature retry governance**  
   We have retry logic, but not full policy controls (attempt caps, backoff tuning, dead-letter review workflow).

4. **PII lifecycle hardening**  
   I did not fully implement retention windows, redaction jobs, or strict data-at-rest controls that I would expect in a compliant deployment.

5. **Full CI quality gates**  
   There are tests, but not yet full contract/load/perf gates in CI.

These were deliberate tradeoffs to deliver a complete Part 1 service while keeping the implementation focused and defendable.
