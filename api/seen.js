const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

// Example /api/terminate backend handler
export default async function handler(req, res) {
  const { userName, sessionId, roomID } = req.body;

  try {
    await pusher.trigger(roomID, 'terminate-session', { 
      userName, 
      sessionId 
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}