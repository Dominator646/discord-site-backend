
fetch('/api/me')
  .then(r => r.json())
  .then(u => {
    const div = document.getElementById('user');
    div.innerHTML = `
      <img src="https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png" />
      <span>${u.username}</span>
      <b>💰 ${u.coins}</b>
    `;
  });
