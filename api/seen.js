const Pusher = require("pusher");
const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  const { id, viewer } = req.body;
  try {
    await pusher.trigger("chat-room", "message-seen", { id, viewer });
    return res.status(200).json({ status: "ok" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}