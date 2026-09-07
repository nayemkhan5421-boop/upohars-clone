const express = require("express");
const { db, admin } = require("../lib/firebase");
const { userRef } = require("../lib/users");
const { getSettings } = require("../lib/settings");
const { requireTelegramAuth } = require("./middleware");
const { notifyAdminNewWithdrawal } = require("../bot");

const FieldValue = admin.firestore.FieldValue;
const router = express.Router();

const METHODS = ["Bkash", "Nagad", "Binance", "USDT (POL)"];

router.post("/", requireTelegramAuth, async (req, res) => {
  const { method, accountNumber, amount } = req.body || {};
  const uid = String(req.tgUser.id);

  if (!METHODS.includes(method)) {
    return res.status(400).json({ error: "Invalid payment method" });
  }
  if (!accountNumber || !amount || amount <= 0) {
    return res.status(400).json({ error: "Account number and amount are required" });
  }

  const settings = await getSettings();
  const ref = userRef(uid);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "User not found" });
  const user = snap.data();

  if (user.balance < settings.minWithdrawBalance) {
    return res.status(400).json({
      error: `Minimum balance ${settings.minWithdrawBalance} $ required`,
    });
  }
  if (user.referralsCount < settings.minReferrals) {
    return res.status(400).json({
      error: `Minimum ${settings.minReferrals} referrals required`,
    });
  }
  if (amount > user.balance) {
    return res.status(400).json({ error: "Amount exceeds balance" });
  }

  const withdrawRef = db.collection("withdrawals").doc();
  const withdrawal = {
    id: withdrawRef.id,
    userId: uid,
    amount: Number(amount),
    method,
    accountNumber,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  };
  await withdrawRef.set(withdrawal);
  await ref.update({ balance: FieldValue.increment(-Number(amount)) });

  notifyAdminNewWithdrawal(withdrawRef.id, withdrawal);

  res.json({ ok: true, withdrawalId: withdrawRef.id });
});

router.get("/history", requireTelegramAuth, async (req, res) => {
  const uid = String(req.tgUser.id);
  const snap = await db
    .collection("withdrawals")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  res.json(snap.docs.map((d) => d.data()));
});

module.exports = router;
