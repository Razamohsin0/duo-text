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
  
  let vaultKey = '';
  let roomID = '';

  // Check if this message belongs in the Private Vault or Public Plaza
  if ((user === 'user1' && target === 'user2') || (user === 'user2' && target === 'user1')) {
    vaultKey = 'chat:vault-user1-user2';
    roomID = 'room-vault-user1-user2';
  } else {
    vaultKey = 'chat:public-plaza';
    roomID = 'room-public-plaza';
  }

  try {
    const msg = { id, user, text, timestamp: Date.now() };
    
    await redis.lpush(vaultKey, JSON.stringify(msg));
    await redis.ltrim(vaultKey, 0, 49); 

    await pusher.trigger(roomID, "new-message", msg);
    
    return res.status(200).json({ status: "Routed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}