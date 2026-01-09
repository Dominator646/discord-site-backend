import express from "express";
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser());
app.use(express.static("public"));

app.get("/auth/discord", (req, res) => {
  res.send(`
    <script>
      window.opener.postMessage("discord-auth-success", "*");
      window.close();
    </script>
  `);
});

app.get("/api/me", (req, res) => {
  if (!req.cookies.user) return res.json({});
  res.json(JSON.parse(req.cookies.user));
});

app.listen(3000, () => {
  console.log("Server running");
});
