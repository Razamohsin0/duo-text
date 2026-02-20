const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  const { id, viewer, target } = req.body;
  
  const isElite = (viewer === 'user1' && target === 'user2') || (viewer === 'user2' && target === 'user1');
  const roomID = `room-${isElite ? 'vault-user1-user2' : 'public-plaza'}`;

  try {
    await pusher.trigger(roomID, 'message-seen', { id });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Seen API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}