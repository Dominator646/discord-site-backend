function login() {
  const width = 500;
  const height = 700;
  const left = (screen.width / 2) - (width / 2);
  const top = (screen.height / 2) - (height / 2);

  window.open(
    "https://discord-site-backend-production.up.railway.app/auth/discord/callback",
    "DiscordLogin",
    `width=${width},height=${height},top=${top},left=${left}`
  );
}


const token = new URLSearchParams(window.location.search).get("token");

if (token) {
  document.getElementById("auth").classList.add("hidden");
  document.getElementById("profile").classList.remove("hidden");

  // тут позже запрос в Supabase по JWT
}
