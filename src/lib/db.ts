import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let _client: NeonQueryFunction<false, false> | null = null;

// Lazy init: neon() is only called on the first actual query, not at module load time.
// This prevents build failures when DATABASE_URL is not available during `next build`.
const sql = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_, thisArg, args) {
      if (!_client) _client = neon(process.env.DATABASE_URL!);
      return Reflect.apply(_client as never, thisArg, args);
    },
    get(_, prop) {
      if (!_client) _client = neon(process.env.DATABASE_URL!);
      return (_client as never)[prop as never];
    },
  }
);

export default sql;
