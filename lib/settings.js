const { db } = require("./firebase");

const defaults = {
  minWithdrawBalance: Number(process.env.MIN_WITHDRAW_BALANCE || 0.15),
  minReferrals: Number(process.env.MIN_REFERRALS || 2),
  referralBonus: Number(process.env.REFERRAL_BONUS || 0.02),
  friendBonus: Number(process.env.FRIEND_BONUS || 0.01),
  dailyAdLimit: Number(process.env.DAILY_AD_LIMIT || 50),
  hourlyAdLimit: Number(process.env.HOURLY_AD_LIMIT || 10),
  adReward: Number(process.env.AD_REWARD || 0.003),
  rewardedAdNetwork: process.env.REWARDED_AD_NETWORK || "none", // used by the "Watch Ads" task
  autoAdNetwork: process.env.AUTO_AD_NETWORK || "none", // used by the periodic non-rewarded ad
  monetagZoneId: process.env.MONETAG_ZONE_ID || "",
  adsgramBlockId: process.env.ADSGRAM_BLOCK_ID || "",
  autoAdIntervalMinutes: Number(process.env.AUTO_AD_INTERVAL_MINUTES || 0), // 0 = disabled
  referralRequiredAds: Number(process.env.REFERRAL_REQUIRED_ADS || 3),
  referralRequiredTasks: Number(process.env.REFERRAL_REQUIRED_TASKS || 2),
  checkInBaseBonus: Number(process.env.CHECKIN_BASE_BONUS || 0.002),
  checkInStreakIncrement: Number(process.env.CHECKIN_STREAK_INCREMENT || 0.001),
  checkInStreakCapDays: Number(process.env.CHECKIN_STREAK_CAP_DAYS || 7),
  spinPrizesCsv: process.env.SPIN_PRIZES_CSV || "0.001,0.002,0.003,0.005,0.01,0",
};

async function getSettings() {
  const ref = db.collection("settings").doc("config");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(defaults);
    return defaults;
  }
  return { ...defaults, ...snap.data() };
}

module.exports = { getSettings, defaults };
