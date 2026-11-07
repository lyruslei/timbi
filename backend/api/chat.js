import { route } from '../lib/http.js';
import { handleChat } from '../lib/chat.js';
import { deps } from '../lib/deps.js';

export default route({ methods: ['POST'], auth: true }, async (req) => ({ body: await handleChat(req.body, deps()) }));
