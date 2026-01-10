import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import cors from "cors";

const app = express();
app.use(cors());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// 👉 редирект на Discord
app.get("/auth/discord", (req, res) => {
  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify`;

  res.redirect(url);
});

// 👉 callback
app.get("/auth/discord/callback", async (req, res) => {
  const code = req.query.code;

  // токен
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();

  // пользователь
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const user = await userRes.json();

  // сохранить в Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      discord_id: user.id,
      username: user.username,
      avatar: user.avatar
    }),
  });

  const jwtToken = jwt.sign({ discord_id: user.id }, JWT_SECRET);

res.send(`
<script>
  window.opener.postMessage(
    { token: "${jwtToken}" },
    "*"
  );
  window.close();
</script>
`);
});

app.listen(3000, () => console.log("Server started"));
