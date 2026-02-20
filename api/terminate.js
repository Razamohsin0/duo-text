const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", 
  key: "f67a69ab8d352765a811", 
  secret: "b092ee0e9a3a0c3278a2", 
  cluster: "ap2", 
  useTLS: true
});

export default async function handler(req, res) {
  const { userName, sessionId, roomID } = req.body;

  try {
    // We must prepend 'private-' because the frontend is subscribed to private channels
    const channelName = roomID.startsWith('private-') ? roomID : `private-${roomID}`;

    await pusher.trigger(channelName, 'terminate-session', {
      userName,
      sessionId
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Termination Error:", error);
    return res.status(500).json({ error: error.message });
  }
}