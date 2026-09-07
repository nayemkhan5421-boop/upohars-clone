const { Bot, InlineKeyboard } = require("grammy");
const { db } = require("./lib/firebase");
const { getOrCreateUser } = require("./lib/users");
const { decideWithdrawal } = require("./lib/withdrawals");
const { getSettings } = require("./lib/settings");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const bot = new Bot(BOT_TOKEN);

function openAppKeyboard() {
  return new InlineKeyboard().webApp("Open app 🚀", WEBAPP_URL);
}

bot.command("start", async (ctx) => {
  const tgUser = ctx.from;
  const payload = ctx.match; // text after "/start "
  const referredBy = payload && /^\d+$/.test(payload) ? payload : null;

  const { newUser, referrerNotify } = await getOrCreateUser(tgUser, referredBy);

  await ctx.reply(
    `Welcome ${process.env.BOT_USERNAME || "UpoharsBot"}!\n\n` +
      `➤ Hello, ${tgUser.first_name}!\n` +
      `➤ Your Telegram ID: ${tgUser.id}\n` +
      `➤ Your Username: ${tgUser.username ? "@" + tgUser.username : "-"}`,
    { reply_markup: openAppKeyboard() }
  );

  if (referrerNotify) {
    try {
      const settings = await getSettings();
      await bot.api.sendMessage(
        referredBy,
        `🎉 Your friend ${tgUser.first_name} has joined your link!\n\n` +
          `You'll earn your $${settings.referralBonus} referral bonus once they watch ${settings.referralRequiredAds} ads and complete ${settings.referralRequiredTasks} tasks.`
      );
    } catch (e) {
      console.error("Could not notify referrer:", e.message);
    }
  }
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Your Telegram ID: ${ctx.from.id}`);
});

// ---- Admin: approve/reject withdrawal ----
// Usage: /approve <withdrawId>   /reject <withdrawId>
bot.command("approve", async (ctx) => handleWithdrawDecision(ctx, "approved"));
bot.command("reject", async (ctx) => handleWithdrawDecision(ctx, "rejected"));

async function handleWithdrawDecision(ctx, decision) {
  if (!ADMIN_IDS.includes(String(ctx.from.id))) {
    return ctx.reply("⛔ You are not authorized.");
  }
  const id = (ctx.match || "").trim();
  if (!id) return ctx.reply(`Usage: /${decision === "approved" ? "approve" : "reject"} <withdrawId>`);

  try {
    await decideWithdrawal(id, decision, (w, d) =>
      bot.api.sendMessage(
        w.userId,
        d === "approved"
          ? `✅ Congratulations! Your withdrawal request for ${w.amount} $ has been approved.\n\nYour payment has been sent.`
          : `❌ Your withdrawal request for ${w.amount} $ was rejected. The amount has been refunded to your balance.`
      )
    );
    await ctx.reply(`Withdrawal ${id} marked ${decision}.`);
  } catch (e) {
    await ctx.reply(e.message);
  }
}

// Helper used by API routes to check channel membership for "Join Telegram Channel" tasks.
async function isMemberOfChannel(channelUsername, telegramId) {
  try {
    const member = await bot.api.getChatMember(`@${channelUsername}`, telegramId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (e) {
    console.error("getChatMember failed:", e.message);
    return false;
  }
}

// Helper used by API routes to notify admin of a new withdrawal request.
async function notifyAdminNewWithdrawal(withdrawId, w) {
  for (const id of ADMIN_IDS) {
    try {
      await bot.api.sendMessage(
        id,
        `🔔 New withdrawal request\n\nID: ${withdrawId}\nUser: ${w.userId}\nAmount: ${w.amount} $\nMethod: ${w.method}\nAccount: ${w.accountNumber}\n\nApprove: /approve ${withdrawId}\nReject: /reject ${withdrawId}`
      );
    } catch (e) {
      console.error(`Could not notify admin ${id}:`, e.message);
    }
  }
}

module.exports = { bot, isMemberOfChannel, notifyAdminNewWithdrawal };
