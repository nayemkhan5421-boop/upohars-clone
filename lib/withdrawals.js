const { db, admin } = require("./firebase");

const FieldValue = admin.firestore.FieldValue;

/**
 * Approves or rejects a pending withdrawal. Returns the withdrawal record
 * (post-update) or throws an Error with a user-facing message.
 */
async function decideWithdrawal(withdrawId, decision, notifyFn) {
  const ref = db.collection("withdrawals").doc(withdrawId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Withdrawal not found.");

  const w = snap.data();
  if (w.status !== "pending") throw new Error(`Already ${w.status}.`);

  await ref.update({ status: decision, decidedAt: new Date() });

  if (decision === "rejected") {
    await db
      .collection("users")
      .doc(w.userId)
      .update({ balance: FieldValue.increment(w.amount) });
  }

  if (notifyFn) {
    await notifyFn(w, decision).catch((e) =>
      console.error("Could not notify user:", e.message)
    );
  }

  return { ...w, status: decision };
}

module.exports = { decideWithdrawal };
