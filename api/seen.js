const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", 
  key: "f67a69ab8d352765a811", 
  secret: "b092ee0e9a3a0c3278a2", 
  cluster: "ap2", 
  useTLS: true
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { id, viewer, target } = req.body;

  try {
    // We must use the SAME room naming logic as the Chat API
    const roomID = `room-${[viewer, target].sort().join('-')}`;

    // Broadcast the "seen" event only to this private room
    await pusher.trigger(roomID, "message-seen", { id });
    
    return res.status(200).json({ status: "Sync Signal Sent" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}