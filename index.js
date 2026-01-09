const CLIENT_ID = "1431712036626104401";
const REDIRECT_URI = "https://discord-site-backend-production.up.railway.app/";

document.getElementById("discordLogin").onclick = () => {
  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify email`;

  const popup = window.open(
    url,
    "discordLogin",
    "width=500,height=700"
  );

  const timer = setInterval(() => {
    if (popup.closed) {
      clearInterval(timer);
      checkAuth();
    }
  }, 500);
};

function checkAuth() {
  fetch("/api/me")
    .then(res => res.json())
    .then(user => {
      if (user.id) {
        window.location.href = "/dashboard.html";
      }
    });
}
