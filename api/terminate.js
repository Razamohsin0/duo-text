const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123", key: "f67a69ab8d352765a811", secret: "b092ee0e9a3a0c3278a2", cluster: "ap2", useTLS: true
});

export default async function handler(req, res) {
  // Destructure variables here
  const { userName, sessionId, roomID } = req.body;

  try {
    // Use the destructured variables directly
    await pusher.trigger(`room-${roomID}`, "terminate-session", { 
      userName, 
      sessionId 
    });
    
    return res.status(200).json({ status: "Signal Dispatched" });
  } catch (error) {
    console.error("Pusher Trigger Error:", error);
    return res.status(500).json({ error: error.message });
  }
}