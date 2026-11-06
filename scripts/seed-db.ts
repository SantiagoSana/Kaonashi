// Applies the schema and seeds the database named by DATABASE_URL (Neon) from your machine.
// Optional: the deployed app also seeds itself on its first request.
//   DATABASE_URL="postgres://..." npm run db:seed
import { getStore } from '../src/server/store';

const started = Date.now();
const store = await getStore();
const counts = await store.sql(`SELECT collection, count(*)::int AS n FROM docs GROUP BY 1 ORDER BY 2 DESC`);
console.table(counts);
console.log(`Ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(0);
