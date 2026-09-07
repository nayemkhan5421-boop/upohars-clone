const { db, admin } = require("./firebase");
const { getSettings } = require("./settings");

const FieldValue = admin.firestore.FieldValue;

function userRef(telegramId) {
  return db.collection("users").doc(String(telegramId));
}

async function getOrCreateUser(tgUser, referredBy) {
  const ref = userRef(tgUser.id);
  const snap = await ref.get();
  if (snap.exists) return snap.data();

  const settings = await getSettings();
  const newUser = {
    telegramId: String(tgUser.id),
    username: tgUser.username || null,
    firstName: tgUser.first_name || "",
    balance: 0,
    totalEarning: 0,
    commissionEarned: 0,
    referralsCount: 0,
    referredBy: referredBy ? String(referredBy) : null,
    referralBonusPaid: false, // only meaningful when referredBy is set
    dailyAdsWatched: 0,
    dailyAdsDate: new Date().toISOString().slice(0, 10),
    hourlyAdsWatched: 0,
    hourlyAdsSlot: new Date().toISOString().slice(0, 13),
    totalAdsWatched: 0, // lifetime counter, used to unlock the referrer's bonus
    tasksCompleted: {},
    lastCheckInDate: null,
    checkInStreak: 0,
    lastSpinDate: null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await ref.set(newUser);

  // The new user gets their "friend bonus" right away. The REFERRER's bonus
  // is conditional — it only pays out once this new user hits the activity
  // requirements (see lib/referrals.js: checkAndPayReferralBonus).
  if (referredBy && String(referredBy) !== String(tgUser.id)) {
    const referrerSnap = await userRef(referredBy).get();
    if (referrerSnap.exists) {
      await ref.update({
        balance: FieldValue.increment(settings.friendBonus),
        totalEarning: FieldValue.increment(settings.friendBonus),
      });
      newUser.balance += settings.friendBonus;
      newUser.totalEarning += settings.friendBonus;
      return { newUser, referrerNotify: referrerSnap.data() };
    }
  }

  return { newUser, referrerNotify: null };
}

async function resetDailyIfNeeded(telegramId) {
  const ref = userRef(telegramId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hourSlot = now.toISOString().slice(0, 13); // e.g. 2026-09-06T13

  const updates = {};
  if (data.dailyAdsDate !== today) {
    updates.dailyAdsWatched = 0;
    updates.dailyAdsDate = today;
  }
  if (data.hourlyAdsSlot !== hourSlot) {
    updates.hourlyAdsWatched = 0;
    updates.hourlyAdsSlot = hourSlot;
  }
  if (Object.keys(updates).length) {
    await ref.update(updates);
    Object.assign(data, updates);
  }
  return data;
}

module.exports = { userRef, getOrCreateUser, resetDailyIfNeeded, FieldValue };
