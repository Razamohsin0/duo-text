import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: 'https://fun-horse-59573.upstash.io',
  token: 'Aei1AAIncDI4OWIwMTVmZjZmZjg0ZDQ3YWE2ZTAwNWJmMDY1NGNhYnAyNTk1NzM',
})

export default async function handler(req, res) {
  const { userA, userB } = req.query;
  let vaultKey = '';

  // SECURITY: Only allow access to the private vault if the pair is user1 & user2
  if ((userA === 'user1' && userB === 'user2') || (userA === 'user2' && userB === 'user1')) {
    vaultKey = 'chat:vault-user1-user2';
  } else {
    // Everyone else shares the public history key
    vaultKey = 'chat:public-plaza';
  }

  try {
    const history = await redis.lrange(vaultKey, 0, -1);
    return res.status(200).json(history.reverse());
  } catch (error) {
    return res.status(500).json([]);
  }
}