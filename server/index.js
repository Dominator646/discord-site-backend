
import express from 'express';
import fetch from 'node-fetch';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3000;

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    })
  });

  const tokenData = await tokenRes.json();

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  const user = await userRes.json();

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', user.id)
    .single();

  if (!existing) {
    await supabase.from('users').insert({
      discord_id: user.id,
      username: user.username,
      avatar: user.avatar,
      coins: 100,
      last_login: new Date().toISOString()
    });
  } else {
    await supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('discord_id', user.id);
  }

  const token = jwt.sign(
    { discord_id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, { httpOnly: true });
  res.redirect('/app.html');
});

app.get('/api/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', decoded.discord_id)
      .single();

    res.json(data);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.listen(PORT, () => {
  console.log('NeСкам server running on port', PORT);
});
