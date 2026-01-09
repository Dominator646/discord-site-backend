const CLIENT_ID = "1431712036626104401";
const REDIRECT_URI = "https://discord-site-backend-production.up.railway.app/";

document.getElementById("discordLogin").onclick = () => {
  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify`;

  window.open(url, "discord", "width=500,height=700");
};

window.addEventListener("message", (event) => {
  if (event.data === "discord-auth-success") {
    window.location.href = "/dashboard.html";
  }
});
