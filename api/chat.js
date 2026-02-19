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
  // Create a unique ID for this specific message
  const messageId = `msg-${Date.now()}`; 

  try {
    // We now send the ID and a Timestamp with the message
    await pusher.trigger("chat-room", "new-message", { 
      id: messageId,
      user, 
      text,
      timestamp: new Date().toISOString()
    });
    
    res.setHeader('Connection', 'keep-alive');
    // Return the ID to the sender so they can track it
    return res.status(200).json({ id: messageId, status: "UPLINKED" });
  } catch (error) {
    console.error("Pusher Error:", error);
    return res.status(500).json({ error: "Failed to send" });
  }
}