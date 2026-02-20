import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'YOUR_TOKEN',
})

export default async function handler(req, res) {
  const { userA, userB } = req.query;

  // ONLY User1 and User2 get to load history
  if ((userA === 'user1' && userB === 'user2') || (userA === 'user2' && userB === 'user1')) {
    const vaultKey = 'chat:vault-user1-user2';
    try {
      const history = await redis.lrange(vaultKey, 0, -1);
      return res.status(200).json(history.reverse());
    } catch (error) {
      return res.status(500).json([]);
    }
  } 

  // EVERYONE ELSE: Returns nothing. They start with a blank slate every time.
  return res.status(200).json([]);
}