import { route } from '../lib/http.js';
import { handleChat } from '../lib/chat.js';
import { checkImage } from '../lib/image.js';
import { deps } from '../lib/deps.js';

export default route({ methods: ['POST'], auth: true }, async (req) => ({ body: await handleChat({ ...req.body, image: checkImage(req.body?.image) }, deps()) }));
