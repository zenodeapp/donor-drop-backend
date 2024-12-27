import { initialize } from '@/lib/init';

// This will run when the server starts, not on each request
if (typeof window === 'undefined') {  // Only run on server side
  initialize().catch(console.error);
}

export default async function handler(req, res) {
  res.status(200).json({ message: 'Server initialized' });
} 