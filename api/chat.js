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
  const vaultKey = `chat:${[user, target].sort().join(':')}`;
  const roomID = `room-${[user, target].sort().join('-')}`;

  try {
    const msg = { id, user, text, timestamp: Date.now() };
    
    // Save only to this private vault
    await redis.lpush(vaultKey, JSON.stringify(msg));
    await redis.ltrim(vaultKey, 0, 49); 

    // Broadcast only to the people in this room
    await pusher.trigger(roomID, "new-message", msg);
    
    return res.status(200).json({ status: "Vaulted" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}