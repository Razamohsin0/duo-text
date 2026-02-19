import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'Aei1AAIncDI4OWIwMTVmZjZmZjg0ZDQ3YWE2ZTAwNWJmMDY1NGNhYnAyNTk1NzM',
})

export default async function handler(req, res) {
  try {
    const history = await redis.lrange('chat_history', 0, -1);
    // Reverse because Redis LPUSH makes the newest first
    return res.status(200).json(history.reverse());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}