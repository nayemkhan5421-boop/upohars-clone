const express = require("express");
const { userRef, getOrCreateUser, resetDailyIfNeeded } = require("../lib/users");
const { getSettings } = require("../lib/settings");
const { checkDevice } = require("../lib/devices");
const { requireTelegramAuth } = require("./middleware");

const router = express.Router();

// Called once when the mini app opens. Creates the user if new, applies
// referral credit (referredBy passed once from the /start deep-link, cached
// client-side via localStorage — see public/app.js).
router.post("/verify", requireTelegramAuth, async (req, res) => {
  const { referredBy, deviceId } = req.body || {};

  const deviceCheck = await checkDevice(deviceId, req.tgUser.id);
  if (!deviceCheck.allowed) {
    return res.status(403).json({
      error: "This device already has an account. Multiple accounts on one device aren't allowed.",
    });
  }

  await getOrCreateUser(req.tgUser, referredBy);
  const data = await resetDailyIfNeeded(req.tgUser.id);
  const settings = await getSettings();
  res.json({ user: data, settings });
});

router.get("/me", requireTelegramAuth, async (req, res) => {
  const data = await resetDailyIfNeeded(req.tgUser.id);
  if (!data) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

module.exports = router;
