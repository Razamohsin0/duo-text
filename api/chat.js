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

  const { user, text } = req.body;

  try {
    // We await this so Vercel finishes the job before closing the connection
    await pusher.trigger("chat-room", "new-message", { user, text });
    
    // Performance header to keep the route warm
    res.setHeader('Connection', 'keep-alive');
    return res.status(200).json({ status: "Success" });
  } catch (error) {
    console.error("Pusher Error:", error);
    return res.status(500).json({ error: "Failed to send" });
  }
}