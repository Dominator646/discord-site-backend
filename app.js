function login() {
  window.location.href = "https://discord-site-backend-production.up.railway.app/auth/discord/callback";
}

const token = new URLSearchParams(window.location.search).get("token");

if (token) {
  document.getElementById("auth").classList.add("hidden");
  document.getElementById("profile").classList.remove("hidden");

  // тут позже запрос в Supabase по JWT
}
