const jwt = require("jsonwebtoken");
const { verifyInitData } = require("../lib/telegramAuth");

function requireTelegramAuth(req, res, next) {
  const initData = req.headers["x-telegram-init-data"];
  const user = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!user) {
    return res.status(401).json({ error: "Invalid or missing Telegram auth." });
  }
  req.tgUser = user;
  next();
}

function requireAdminAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required." });
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = payload; // { username, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired, please log in again." });
  }
}

function requireOwner(req, res, next) {
  if (req.admin?.role !== "owner") {
    return res.status(403).json({ error: "Only an owner can do this." });
  }
  next();
}

module.exports = { requireTelegramAuth, requireAdminAuth, requireOwner };
