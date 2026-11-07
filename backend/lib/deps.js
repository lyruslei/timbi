// Builds the real store and AI caller from env vars. Cached per warm function instance.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createStore } from './store.js';
import { askClaude, CLIENT_OPTIONS } from './claude.js';

let cached;

export function deps(env = process.env) {
  if (cached) return cached;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...CLIENT_OPTIONS });
  const model = env.CLAUDE_MODEL || undefined;
  cached = {
    store: createStore(supabase),
    ai: (args) => askClaude(args, { client, model }),
  };
  return cached;
}
