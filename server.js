require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Supabase клиент
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Сессии
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Passport настройка
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify']  // Только базовая инфа
}, async (accessToken, refreshToken, profile, done) => {
  // Сохраняем/обновляем в Supabase
  const { data, error } = await supabase
    .from('users')
    .upsert({
      discord_id: profile.id,
      username: profile.username,
      avatar_url: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    }, { onConflict: 'discord_id' });

  if (error) return done(error);
  return done(null, profile);
}));

// Роуты
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/profile');  // После логина редирект на профиль
});

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  // Здесь можно рендерить профиль, но т.к. frontend статический, отправляем HTML с данными
  res.sendFile(__dirname + '/profile.html');
});

app.get('/user-data', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
  const { data } = await supabase.from('users').select('*').eq('discord_id', req.user.id).single();
  res.json(data);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
