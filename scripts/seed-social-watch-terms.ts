import dotenv from 'dotenv'
import { getPool } from '@/lib/db/pool'

dotenv.config({ path: '.env.local' })

async function run() {
  const pool = getPool()
  const result = await pool.query<{ term: string }>(
    `INSERT INTO social_watch_terms (term, term_type)
     SELECT seed.term, seed.term_type
     FROM (VALUES
       ('Commit Happens', 'brand'),
       ('commithappens.com', 'domain')
     ) AS seed(term, term_type)
     WHERE NOT EXISTS (
       SELECT 1
       FROM social_watch_terms existing
       WHERE lower(existing.term) = lower(seed.term)
     )
     RETURNING term`,
  )

  console.log(JSON.stringify({ inserted: result.rows.map((row) => row.term) }, null, 2))
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await getPool().end()
  })
