import dotenv from 'dotenv'
import { searchMentionsAcrossProviders } from '../lib/social/searchMentions'

dotenv.config({ path: '.env.local' })

async function run() {
  const terms = ['Commit Happens', 'commithappens.com']

  const results = await searchMentionsAcrossProviders(terms)
  console.log(JSON.stringify(results, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})