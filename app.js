function login() {
  window.location.href = "https://discord.com/oauth2/authorize?client_id=1431712036626104401&response_type=code&redirect_uri=https%3A%2F%2Fdiscord-site-backend-production.up.railway.app%2Fauth%2Fdiscord%2Fcallback&scope=identify";
}

const token = new URLSearchParams(window.location.search).get("token");

if (token) {
  document.getElementById("auth").classList.add("hidden");
  document.getElementById("profile").classList.remove("hidden");

  // тут позже запрос в Supabase по JWT
}
