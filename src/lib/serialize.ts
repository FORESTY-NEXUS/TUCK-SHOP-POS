/**
 * Recursively convert Mongoose ObjectId instances (and any nested objects
 * that look like them — e.g. { i0, i1, i2, i3, … }) to plain hex strings.
 *
 * Next.js serialises Server → Client props through its own RSC pipe, which
 * only accepts plain JSON-safe values. Raw ObjectId objects have a toJSON
 * method and internal buffer fields that trigger the
 * "Only plain objects can be passed to Client Components" invariant.
 *
 * Call this on the final response shape before returning it from a server
 * component or an API route.
 */
export function sanitizeForClient<T>(value: T): T {
  if (value === null || value === undefined) return value;

  // Date — convert to ISO string before the generic object handler runs.
  // Without this, a Date falls into the typeof === "object" branch and its
  // internal numeric properties (0-7, epoch-millisecond parts) are copied as
  // a plain object, which new Date() then parses as Invalid Date.
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  // ObjectId: constructor name or the classic { i0, i1, i2, i3 } shape
  if (
    typeof (value as any).constructor?.name === "string" &&
    /ObjectId/i.test((value as any).constructor.name)
  ) {
    const oid = value as any;
    return (oid.toHexString ? oid.toHexString() : oid.toString()) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForClient) as unknown as T;
  }

  if (typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = sanitizeForClient(v);
    }
    return obj as T;
  }

  return value;
}
