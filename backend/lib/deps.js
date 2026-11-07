// Builds the real store and AI caller from env vars. Cached per warm function instance.
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { createStore } from './store.js';
import { askGemini } from './gemini.js';

let cached;

export function deps(env = process.env) {
  if (cached) return cached;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = env.GEMINI_MODEL || undefined;
  cached = {
    store: createStore(supabase),
    ai: (args) => askGemini(args, { client, model }),
  };
  return cached;
}
