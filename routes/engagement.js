const express = require("express");
const { db, admin } = require("../lib/firebase");
const { userRef, resetDailyIfNeeded } = require("../lib/users");
const { getSettings } = require("../lib/settings");
const { requireTelegramAuth } = require("./middleware");

const FieldValue = admin.firestore.FieldValue;
const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/engagement/checkin — requires the user to have watched at least
// one ad today (via the Watch Ads task) before they can claim.
router.post("/checkin", requireTelegramAuth, async (req, res) => {
  const uid = String(req.tgUser.id);
  const settings = await getSettings();
  const user = await resetDailyIfNeeded(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  if ((user.dailyAdsWatched || 0) < 1) {
    return res.status(400).json({ error: "Watch an ad first to unlock check-in." });
  }
  const today = todayStr();
  if (user.lastCheckInDate === today) {
    return res.status(400).json({ error: "Already checked in today." });
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const continuingStreak = user.lastCheckInDate === yesterday;
  const streak = Math.min(
    continuingStreak ? (user.checkInStreak || 0) + 1 : 1,
    settings.checkInStreakCapDays
  );
  const reward = settings.checkInBaseBonus + (streak - 1) * settings.checkInStreakIncrement;

  await userRef(uid).update({
    balance: FieldValue.increment(reward),
    totalEarning: FieldValue.increment(reward),
    lastCheckInDate: today,
    checkInStreak: streak,
  });

  res.json({ ok: true, reward, streak });
});

// POST /api/engagement/spin — same daily-ad-watch gate as check-in.
router.post("/spin", requireTelegramAuth, async (req, res) => {
  const uid = String(req.tgUser.id);
  const settings = await getSettings();
  const user = await resetDailyIfNeeded(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  if ((user.dailyAdsWatched || 0) < 1) {
    return res.status(400).json({ error: "Watch an ad first to unlock the spin." });
  }
  const today = todayStr();
  if (user.lastSpinDate === today) {
    return res.status(400).json({ error: "Already spun today." });
  }

  const prizes = settings.spinPrizesCsv
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => !Number.isNaN(n));
  const reward = prizes.length ? prizes[Math.floor(Math.random() * prizes.length)] : 0;

  await userRef(uid).update({
    balance: FieldValue.increment(reward),
    totalEarning: FieldValue.increment(reward),
    lastSpinDate: today,
  });

  res.json({ ok: true, reward });
});

// GET /api/engagement/leaderboard — top 20 earners (first name only, no PII)
router.get("/leaderboard", requireTelegramAuth, async (req, res) => {
  const snap = await db.collection("users").orderBy("totalEarning", "desc").limit(20).get();
  res.json(
    snap.docs.map((d, i) => {
      const u = d.data();
      return { rank: i + 1, firstName: u.firstName || "User", totalEarning: u.totalEarning || 0 };
    })
  );
});

module.exports = router;
