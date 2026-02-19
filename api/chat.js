const Pusher = require("pusher");
const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  const { id, user, text } = req.body; // Ensure 'id' is extracted here
  try {
    await pusher.trigger("chat-room", "new-message", { id, user, text });
    return res.status(200).json({ status: "Success" });
  } catch (error) {
    return res.status(500).json({ error: "Failed" });
  }
}