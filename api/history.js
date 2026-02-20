import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'Aei1AAIncDI4OWIwMTVmZjZmZjg0ZDQ3YWE2ZTAwNWJmMDY1NGNhYnAyNTk1NzM',
})

export default async function handler(req, res) {
  const { userA, userB } = req.query;
  if(!userA || !userB) return res.status(400).json([]);

  // Create unique key for just these two users
  const vaultKey = `chat:${[userA, userB].sort().join(':')}`;

  try {
    const history = await redis.lrange(vaultKey, 0, -1);
    return res.status(200).json(history.reverse());
  } catch (error) {
    return res.status(500).json([]);
  }
}