import type { ZodSchema } from 'zod';

// Throws ZodError on failure — let it propagate to the route's catch(err) /
// next(err) so app.ts's global error handler can turn it into a clean 400.
export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}
