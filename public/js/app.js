async function loadUser() {
  const res = await fetch('/api/me');

  if (res.status === 401) {
    window.location.href = '/';
    return;
  }

  const u = await res.json();

  renderTopBar(u);
}

function renderTopBar(u) {
  const div = document.getElementById('user');
  div.innerHTML = `
    <div class="avatar-wrapper" onclick="toggleUserMenu()">
      <img src="https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png" />
      <span class="coins">💰 ${u.coins}</span>
    </div>

    <div id="userMenu" class="user-menu hidden">
      <button onclick="openProfile()">Профиль</button>
    </div>
  `;
}

loadUser();
