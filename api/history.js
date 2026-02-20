import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'Aei1AAIncDI4OWIwMTVmZjZmZjg0ZDQ3YWE2ZTAwNWJmMDY1NGNhYnAyNTk1NzM',
})

export default async function handler(req, res) {
  const { userA, userB } = req.query;

  // IMPORTANT: The logic here MUST match chat.js exactly
  const isElite = (userA === 'user1' || userA === 'user2') && (userB === 'user1' || userB === 'user2');

  if (isElite) {
    const vaultKey = 'chat:vault-user1-user2';
    try {
      // Fetch history from the specific vault key
      const history = await redis.lrange(vaultKey, 0, -1);
      
      // Redis returns them in order of "newest first" because we used LPUSH
      // We return it reversed so the frontend displays it in chronological order
      return res.status(200).json(history.reverse().map(msg => 
        typeof msg === 'string' ? JSON.parse(msg) : msg
      ));
    } catch (error) {
      console.error("Vault Retrieval Error:", error);
      return res.status(500).json([]);
    }
  } 

  // For everyone else (Public Plaza), return an empty array to keep it transient
  return res.status(200).json([]);
}