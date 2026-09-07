const { db, admin } = require("./firebase");
const { userRef } = require("./users");
const { getSettings } = require("./settings");

const FieldValue = admin.firestore.FieldValue;

/**
 * Call this after a referred user watches an ad or completes a task. If they
 * were referred, haven't unlocked their referrer's bonus yet, and now meet
 * the admin-configured requirements (referralRequiredAds / referralRequiredTasks),
 * this pays the referrer and marks the bonus as paid so it never double-fires.
 */
async function checkAndPayReferralBonus(telegramId) {
  const ref = userRef(telegramId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const user = snap.data();

  if (!user.referredBy || user.referralBonusPaid) return;

  const settings = await getSettings();
  const adsOk = (user.totalAdsWatched || 0) >= settings.referralRequiredAds;
  const tasksOk = Object.keys(user.tasksCompleted || {}).length >= settings.referralRequiredTasks;
  if (!adsOk || !tasksOk) return;

  const referrerRef = userRef(user.referredBy);
  const referrerSnap = await referrerRef.get();
  if (!referrerSnap.exists) return;

  await referrerRef.update({
    balance: FieldValue.increment(settings.referralBonus),
    totalEarning: FieldValue.increment(settings.referralBonus),
    commissionEarned: FieldValue.increment(settings.referralBonus),
    referralsCount: FieldValue.increment(1),
  });
  await ref.update({ referralBonusPaid: true });

  try {
    const bot = require("../bot").bot;
    await bot.api.sendMessage(
      user.referredBy,
      `🎉 Congratulations! Your friend ${user.firstName || "a user"} completed the requirements.\n` +
        `You've earned a $${settings.referralBonus} referral bonus!`
    );
  } catch (e) {
    console.error("Could not notify referrer of unlocked bonus:", e.message);
  }
}

module.exports = { checkAndPayReferralBonus };
