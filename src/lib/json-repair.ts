export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (ch === "\\") {
      isEscaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonObject<T>(raw: string): T {
  const boundary = extractJsonObject(raw);
  if (!boundary) {
    throw new Error("No JSON object boundaries found.");
  }
  return JSON.parse(boundary) as T;
}
