# PR Review — `feat: add document extraction endpoint`

Thanks for getting this up quickly. You did the most important first step: prove we can go from upload to LLM output in one request path.

I’m marking this as **request changes**. Not because the direction is wrong, but because a few things here would hurt us badly in production if we merge as-is.

## Overall notes

Good stuff first:

- End-to-end flow works.
- Basic input guard (`if (!file)`) is there.
- You wrapped the route in `try/catch`, which is better than letting unhandled exceptions crash requests.

What needs to change before merge:

- hardcoded secret in source,
- fragile JSON parse path,
- no timeout/retry behavior,
- global/in-memory storage,
- risky file persistence of PII,
- no alignment yet with assignment response/error contract.

## Specific comments

### `const client = new Anthropic({ apiKey: 'sk-ant-REDACTED' });`

This has to go immediately. Secrets cannot live in code. Even “redacted” examples tend to become real keys in future edits.

Please move to env config:

- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_API_KEY`

That also satisfies the assignment requirement to swap providers/models without touching code.

### `fs.readFileSync(...)`

`readFileSync` in a request handler will block the event loop. It looks fine in single-user testing, then becomes a bottleneck under concurrency.

Use in-memory upload or async file operations.

### `fs.copyFileSync(file.path, savedPath)` with `file.originalname`

Saving raw uploads by original filename is risky:

- collisions,
- filename/path surprises,
- no retention controls,
- direct PII footprint on disk.

If we need persistence, use generated IDs, controlled storage paths, and explicit retention/encryption policy.

### `model: 'claude-opus-4-6'`

Opus is usually overkill (and expensive) for this kind of extraction pipeline. We should default to a cheaper/faster vision model and keep model choice configurable.

### prompt: `"Extract all information ... return as JSON."`

Too broad. You’ll get inconsistent keys and format drift. We need a strict schema prompt with allowed enums and exact output structure.

### `JSON.parse(response.content[0].text)`

This will break often in real LLM traffic. Models prepend text, wrap with code fences, or return nearly-valid JSON.

Expected behavior should be:

1. extract object boundaries (`{...}`),
2. parse,
3. if parse fails, run repair prompt once,
4. always store raw model output.

### `global.extractions = global.extractions || []`

This is okay for a quick sandbox, but not mergeable:

- lost on restart,
- not shared across instances,
- no query/index support,
- hard to debug/audit.

Need DB-backed storage.

### generic `500` on all failures

Right now we lose useful failure information. We need structured errors with stable codes (format, size, parse-fail, rate-limit, etc.) and retryability when relevant.

## Teaching moment

This PR is a classic “happy path first” implementation, and that’s honestly normal when moving fast.

The next step from junior -> senior backend mindset is: design for bad paths first in LLM systems.  
Not because optimism is wrong, but because model output is inherently noisy.

Rule of thumb I use: **never trust model formatting, never drop user input**.

If you follow just that one rule, you naturally end up adding timeout controls, repair parsing, durable job states, and raw-response retention.

## Suggested next revision

1. Move all LLM config to env variables.
2. Replace sync fs operations in request path.
3. Add durable schema for sessions/extractions/jobs.
4. Add timeout + parse-repair handling.
5. Add async job state machine and polling endpoint.
6. Return contract-compliant structured errors.

You’re on the right track. The shape is there; now we harden it.
