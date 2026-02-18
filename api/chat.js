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

  // This triggers the message to everyone subscribed to 'chat-room'
  await pusher.trigger("chat-room", "new-message", {
    user: user,
    text: text
  });

  res.status(200).json({ status: "Success" });
}