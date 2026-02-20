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
  
  // 1. ELITE PAIR: Save AND Broadcast
  if ((user === 'user1' && target === 'user2') || (user === 'user2' && target === 'user1')) {
    const vaultKey = 'chat:vault-user1-user2';
    const roomID = 'room-vault-user1-user2';
    
    const msg = { id, user, text, timestamp: Date.now() };
    await redis.lpush(vaultKey, JSON.stringify(msg));
    await redis.ltrim(vaultKey, 0, 49); 
    await pusher.trigger(roomID, "new-message", msg);
    
    return res.status(200).json({ status: "Vaulted" });
  } 

  // 2. PUBLIC USERS: Broadcast ONLY (No Redis saving)
  else {
    const roomID = 'room-public-plaza';
    const msg = { id, user, text, timestamp: Date.now() };
    
    // We do NOT call redis.lpush here. The message exists only in the air.
    await pusher.trigger(roomID, "new-message", msg);
    
    return res.status(200).json({ status: "Transient" });
  }
}