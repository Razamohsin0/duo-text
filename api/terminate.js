const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  const { userName, sessionId, target } = req.body;
  const roomID = `room-${[userName, target].sort().join('-')}`;

  try {
    // Shouting to the room: "If you are 'userName' and don't have this 'sessionId', GET OUT!"
    await pusher.trigger(roomID, "terminate-session", { userName, sessionId });
    return res.status(200).json({ status: "Terminator Active" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}