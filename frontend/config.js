// Where the backend lives: the local dev server when running on this computer,
// the Vercel backend everywhere else (phone, deployed site).
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

export const BACKEND_URL = LOCAL ? 'http://localhost:3001' : 'https://timbi-backend.vercel.app';
