const express = require("express");
const jwt = require("jsonwebtoken");
const { db } = require("../lib/firebase");
const { getSettings, defaults } = require("../lib/settings");
const { decideWithdrawal } = require("../lib/withdrawals");
const { verifyLogin, listAdmins, createAdmin, deleteAdmin } = require("../lib/admins");
const { requireAdminAuth, requireOwner } = require("./middleware");

const router = express.Router();

// Lazily require bot.js only when needed to avoid circular require at module load.
function getBot() {
  return require("../bot").bot;
}

// ---- Login (public — issues a JWT for this admin account) ----
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await verifyLogin(username, password);
  if (!admin) return res.status(401).json({ error: "Wrong username or password." });

  const token = jwt.sign(
    { username: admin.username, role: admin.role },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, username: admin.username, role: admin.role });
});

router.use(requireAdminAuth);

router.get("/me", (req, res) => res.json(req.admin));

// ---- Admin account management (owner only) ----
router.get("/admins", requireOwner, async (req, res) => {
  res.json(await listAdmins());
});

router.post("/admins", requireOwner, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: "Username and a password (6+ chars) are required." });
  }
  try {
    await createAdmin(username, password, role, req.admin.username);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/admins/:username", requireOwner, async (req, res) => {
  try {
    await deleteAdmin(req.params.username, req.admin.username);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Stats ----
router.get("/stats", async (req, res) => {
  const usersSnap = await db.collection("users").get();
  const pendingSnap = await db
    .collection("withdrawals")
    .where("status", "==", "pending")
    .get();
  const paidSnap = await db
    .collection("withdrawals")
    .where("status", "==", "approved")
    .get();

  let totalPaid = 0;
  paidSnap.forEach((d) => (totalPaid += d.data().amount || 0));

  res.json({
    totalUsers: usersSnap.size,
    pendingWithdrawals: pendingSnap.size,
    totalPaidOut: totalPaid,
  });
});

// ---- Users ----
router.get("/users", async (req, res) => {
  const snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
  res.json(snap.docs.map((d) => d.data()));
});

// ---- Withdrawals ----
router.get("/withdrawals", async (req, res) => {
  const status = req.query.status;
  let q = db.collection("withdrawals").orderBy("createdAt", "desc").limit(200);
  if (status) q = q.where("status", "==", status);
  const snap = await q.get();
  res.json(snap.docs.map((d) => d.data()));
});

router.post("/withdrawals/:id/:decision", async (req, res) => {
  const { id, decision } = req.params;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Invalid decision" });
  }
  try {
    const bot = getBot();
    const result = await decideWithdrawal(id, decision, (w, d) =>
      bot.api.sendMessage(
        w.userId,
        d === "approved"
          ? `✅ Congratulations! Your withdrawal request for ${w.amount} $ has been approved.\n\nYour payment has been sent.`
          : `❌ Your withdrawal request for ${w.amount} $ was rejected. The amount has been refunded to your balance.`
      )
    );
    res.json({ ok: true, withdrawal: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Settings ----
router.get("/settings", async (req, res) => {
  res.json(await getSettings());
});

router.put("/settings", async (req, res) => {
  const numericKeys = [
    "minWithdrawBalance",
    "minReferrals",
    "referralBonus",
    "friendBonus",
    "dailyAdLimit",
    "hourlyAdLimit",
    "adReward",
    "autoAdIntervalMinutes",
    "referralRequiredAds",
    "referralRequiredTasks",
    "checkInBaseBonus",
    "checkInStreakIncrement",
    "checkInStreakCapDays",
  ];
  const stringKeys = ["rewardedAdNetwork", "autoAdNetwork", "monetagZoneId", "adsgramBlockId", "spinPrizesCsv"];
  const update = {};
  for (const key of numericKeys) {
    if (req.body[key] !== undefined) update[key] = Number(req.body[key]);
  }
  for (const key of stringKeys) {
    if (req.body[key] !== undefined) update[key] = String(req.body[key]).trim();
  }
  await db.collection("settings").doc("config").set(update, { merge: true });
  res.json(await getSettings());
});

// ---- Tasks ----
router.get("/tasks", async (req, res) => {
  const snap = await db.collection("tasks").get();
  res.json(snap.docs.map((d) => d.data()));
});

router.post("/tasks", async (req, res) => {
  const { id, type, title, description, reward, channelUsername, active } = req.body;
  if (!id || !type || !title) {
    return res.status(400).json({ error: "id, type and title are required" });
  }
  const task = {
    id,
    type,
    title,
    description: description || "",
    reward: Number(reward) || 0,
    active: active !== false,
  };
  if (type === "channel") task.channelUsername = channelUsername || "";
  await db.collection("tasks").doc(id).set(task, { merge: true });
  res.json({ ok: true, task });
});

router.delete("/tasks/:id", async (req, res) => {
  await db.collection("tasks").doc(req.params.id).delete();
  res.json({ ok: true });
});

// ---- Broadcast (send a message to every user via the bot) ----
router.post("/broadcast", async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message text is required." });
  }
  const snap = await db.collection("users").get();
  const ids = snap.docs.map((d) => d.id);

  res.json({ ok: true, targeting: ids.length });

  // Fire-and-forget after responding — Telegram allows ~30 msgs/sec to
  // distinct chats, so a small delay per message keeps this well under that.
  const bot = getBot();
  (async () => {
    for (const id of ids) {
      try {
        await bot.api.sendMessage(id, message);
      } catch (e) {
        console.error(`Broadcast failed for ${id}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  })();
});

// ---- Analytics (last 7 days) ----
router.get("/analytics", async (req, res) => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }

  const usersSnap = await db.collection("users").get();
  const signupsByDay = Object.fromEntries(days.map((d) => [d, 0]));
  usersSnap.forEach((doc) => {
    const createdAt = doc.data().createdAt;
    if (!createdAt || !createdAt.toDate) return;
    const day = createdAt.toDate().toISOString().slice(0, 10);
    if (signupsByDay[day] !== undefined) signupsByDay[day]++;
  });

  const withdrawalsSnap = await db.collection("withdrawals").where("status", "==", "approved").get();
  const paidByDay = Object.fromEntries(days.map((d) => [d, 0]));
  withdrawalsSnap.forEach((doc) => {
    const w = doc.data();
    const decidedAt = w.decidedAt;
    const date = decidedAt && decidedAt.toDate ? decidedAt.toDate() : decidedAt ? new Date(decidedAt) : null;
    if (!date) return;
    const day = date.toISOString().slice(0, 10);
    if (paidByDay[day] !== undefined) paidByDay[day] += w.amount || 0;
  });

  res.json({
    signups: days.map((d) => ({ date: d, count: signupsByDay[d] })),
    paidOut: days.map((d) => ({ date: d, amount: paidByDay[d] })),
  });
});

module.exports = router;
