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
  const { id, user, target, text } = req.body;
  const isElite = (user === 'user1' && target === 'user2') || (user === 'user2' && target === 'user1');
  const vaultKey = isElite ? 'chat:vault-user1-user2' : null;
  const roomID = `private-${isElite ? 'vault-user1-user2' : 'public-plaza'}`;

  try {
    const msg = { id, user, text, timestamp: Date.now() };

    if (isElite && vaultKey) {
      await redis.lpush(vaultKey, JSON.stringify(msg));
      await redis.ltrim(vaultKey, 0, 99); 
    }

    await pusher.trigger(roomID, "new-message", msg);
    return res.status(200).json({ status: "processed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}