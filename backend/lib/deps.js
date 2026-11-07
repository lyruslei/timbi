// Builds the real store and Claude caller from env vars. Cached per warm function instance.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createStore } from './store.js';
import { askClaude } from './claude.js';

let cached;

export function deps(env = process.env) {
  if (cached) return cached;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.CLAUDE_MODEL || undefined;
  cached = {
    store: createStore(supabase),
    claude: (args) => askClaude(args, { client, model }),
  };
  return cached;
}
