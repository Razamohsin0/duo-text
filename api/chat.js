import { Redis } from '@upstash/redis'
const Pusher = require("pusher");

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'Aei1AAIncDI4OWIwMTVmZjZmZjg0ZDQ3YWE2ZTAwNWJmMDY1NGNhYnAyNTk1NzM',
})

const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { id, user, text } = req.body;

  try {
    const msg = { id, user, text, timestamp: Date.now() };
    
    // 1. Store in Mumbai Redis (Keep last 50)
    await redis.lpush('chat_history', JSON.stringify(msg));
    await redis.ltrim('chat_history', 0, 49); 

    // 2. Broadcast to active users
    await pusher.trigger("chat-room", "new-message", msg);
    
    return res.status(200).json({ status: "Archived & Broadcasted" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}