const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2117123",
  key: "f67a69ab8d352765a811",
  secret: "b092ee0e9a3a0c3278a2",
  cluster: "ap2",
  useTLS: true
});

export default async function handler(req, res) {
  // 1. Tell the browser to not wait for a cache check
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { user, text } = req.body;

  // 2. REMOVED 'await'. We fire the message to Pusher 
  // and immediately tell the user "Success" without waiting.
  pusher.trigger("chat-room", "new-message", {
    user: user,
    text: text
  });

  // 3. Respond immediately
  res.status(200).json({ status: "Success" });
}