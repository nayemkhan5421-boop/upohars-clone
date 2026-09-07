const express = require("express");
const { db, admin } = require("../lib/firebase");
const { userRef, resetDailyIfNeeded } = require("../lib/users");
const { getSettings } = require("../lib/settings");
const { checkAndPayReferralBonus } = require("../lib/referrals");
const { requireTelegramAuth } = require("./middleware");
const { isMemberOfChannel } = require("../bot");

const FieldValue = admin.firestore.FieldValue;
const router = express.Router();

// GET /api/tasks — list all active tasks from Firestore (seeds defaults on first run)
router.get("/", requireTelegramAuth, async (req, res) => {
  const snap = await db.collection("tasks").where("active", "==", true).get();
  if (snap.empty) {
    const settings = await getSettings();
    const seed = [
      {
        id: "watch-ads",
        type: "ad",
        title: "Watch Ads",
        description: "Watch short videos",
        reward: settings.adReward,
        active: true,
      },
      {
        id: "join-channel-1",
        type: "channel",
        title: "Join Telegram Channel",
        description: "Sponsors Channel 02",
        channelUsername: "your_sponsor_channel",
        reward: 0.03,
        active: true,
      },
      {
        id: "payment-proof",
        type: "channel",
        title: "Payment Proof Channel",
        description: "Join Our Payment Proof Channel",
        channelUsername: "your_proof_channel",
        reward: 0.01,
        active: true,
      },
    ];
    const batch = db.batch();
    seed.forEach((t) => batch.set(db.collection("tasks").doc(t.id), t));
    await batch.commit();
    return res.json(seed);
  }
  res.json(snap.docs.map((d) => d.data()));
});

// POST /api/tasks/watch-ads — reward for one completed rewarded-ad view
router.post("/watch-ads", requireTelegramAuth, async (req, res) => {
  const settings = await getSettings();
  const uid = String(req.tgUser.id);
  const user = await resetDailyIfNeeded(uid);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.dailyAdsWatched >= settings.dailyAdLimit) {
    return res.status(429).json({ error: "Daily ad limit reached" });
  }
  if (user.hourlyAdsWatched >= settings.hourlyAdLimit) {
    return res.status(429).json({ error: "Hourly ad limit reached, try again later" });
  }

  await userRef(uid).update({
    balance: FieldValue.increment(settings.adReward),
    totalEarning: FieldValue.increment(settings.adReward),
    dailyAdsWatched: FieldValue.increment(1),
    hourlyAdsWatched: FieldValue.increment(1),
    totalAdsWatched: FieldValue.increment(1),
  });
  await checkAndPayReferralBonus(uid);

  res.json({ ok: true, reward: settings.adReward });
});

// POST /api/tasks/:taskId/verify-channel — checks bot's getChatMember for the user
router.post("/:taskId/verify-channel", requireTelegramAuth, async (req, res) => {
  const uid = String(req.tgUser.id);
  const taskSnap = await db.collection("tasks").doc(req.params.taskId).get();
  if (!taskSnap.exists) return res.status(404).json({ error: "Task not found" });
  const task = taskSnap.data();

  const user = await resetDailyIfNeeded(uid);
  if (user.tasksCompleted && user.tasksCompleted[task.id]) {
    return res.status(400).json({ error: "Already completed" });
  }

  const joined = await isMemberOfChannel(task.channelUsername, uid);
  if (!joined) {
    return res.status(400).json({ error: "Not joined yet. Join the channel first." });
  }

  await userRef(uid).update({
    balance: FieldValue.increment(task.reward),
    totalEarning: FieldValue.increment(task.reward),
    [`tasksCompleted.${task.id}`]: true,
  });
  await checkAndPayReferralBonus(uid);

  res.json({ ok: true, reward: task.reward });
});

module.exports = router;
