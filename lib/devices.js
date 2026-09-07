const { db } = require("./firebase");

/**
 * Basic anti-multi-accounting check. The client sends a random ID it
 * generated once and stored in localStorage (see public/app.js: getDeviceId).
 * The first Telegram account seen from a given device "claims" it; any other
 * Telegram account opening the app from the same device is blocked.
 *
 * Not bulletproof (clearing site storage / reinstalling generates a new ID),
 * but stops casual multi-accounting for referral farming.
 */
async function checkDevice(deviceId, telegramId) {
  if (!deviceId) return { allowed: true }; // client didn't send one — skip check
  const ref = db.collection("devices").doc(deviceId);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({ telegramId: String(telegramId), createdAt: new Date() });
    return { allowed: true };
  }

  const data = snap.data();
  if (String(data.telegramId) === String(telegramId)) {
    return { allowed: true };
  }
  return { allowed: false, ownerTelegramId: data.telegramId };
}

module.exports = { checkDevice };
