require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { bot } = require("./bot");
const { ensureBootstrapAdmin } = require("./lib/admins");
const userRoutes = require("./routes/user");
const taskRoutes = require("./routes/tasks");
const withdrawRoutes = require("./routes/withdraw");
const adminRoutes = require("./routes/admin");
const engagementRoutes = require("./routes/engagement");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/user", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/engagement", engagementRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

const PORT = process.env.PORT || 3000;

ensureBootstrapAdmin()
  .catch((e) => console.error("Admin bootstrap failed:", e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Upohars-clone server running on port ${PORT}`);
    });
  });

// Long polling — fine for a small app. Switch to webhook (bot.api.setWebhook)
// once you're on a stable HTTPS host if you want faster delivery.
bot.start();
console.log("Bot polling started.");
