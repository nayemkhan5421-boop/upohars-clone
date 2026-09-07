const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// ---- Config (fill these in for your deployment) ----
const BOT_USERNAME = "smart_earning_bd_24_bot"; // no @
const SUPPORT_USERNAME = "smart_earning_bd_24_support"; // change to your real support username/channel

const initData = tg?.initData || "";

function getDeviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("device_id", id);
  }
  return id;
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

let state = { user: null, settings: null, tasks: [] };

// ---- i18n ----
const translations = {
  en: {
    status_online: "Online now",
    welcome_title: "👋 Welcome",
    welcome_sub: "Complete tasks to earn rewards.",
    stat_total_earning: "Total Earning",
    stat_referrals: "Referrals",
    stat_commission: "Commission Earned",
    daily_progress: "Daily Progress",
    checkin_title: "📅 Daily Check-in",
    checkin_btn: "Claim Daily Bonus",
    spin_title: "🎡 Daily Spin",
    spin_btn: "Spin Now",
    refer_earn: "Refer & Earn",
    share_btn: "↗ Share",
    leaderboard_title: "🏆 Top Earners",
    support_title: "How Can I Help You?",
    support_sub: "Contact support for any issues.",
    support_btn: "Contact Support",
    withdraw_title: "Withdraw Funds",
    withdraw_requirements: "ⓘ Withdrawal Requirements",
    payment_method: "Payment Method",
    account_info: "Account Information",
    amount_label: "Amount ($)",
    withdraw_submit_btn: "Request Withdrawal",
    withdraw_history: "Withdrawal History",
    tab_home: "HOME",
    tab_tasks: "TASKS",
    tab_leaderboard: "TOP",
    tab_support: "SUPPORT",
    tab_withdraw: "WITHDRAW",
  },
  bn: {
    status_online: "অনলাইন আছে",
    welcome_title: "👋 স্বাগতম",
    welcome_sub: "রিওয়ার্ড পেতে টাস্ক সম্পন্ন করো।",
    stat_total_earning: "মোট আয়",
    stat_referrals: "রেফারেল",
    stat_commission: "কমিশন আয়",
    daily_progress: "দৈনিক অগ্রগতি",
    checkin_title: "📅 দৈনিক চেক-ইন",
    checkin_btn: "বোনাস নিন",
    spin_title: "🎡 দৈনিক স্পিন",
    spin_btn: "স্পিন করো",
    refer_earn: "রেফার করে আয় করো",
    share_btn: "↗ শেয়ার করো",
    leaderboard_title: "🏆 সেরা আয়কারীরা",
    support_title: "কীভাবে সাহায্য করতে পারি?",
    support_sub: "যেকোনো সমস্যায় সাপোর্টে যোগাযোগ করো।",
    support_btn: "সাপোর্টে যোগাযোগ",
    withdraw_title: "টাকা তোলো",
    withdraw_requirements: "ⓘ উত্তোলনের শর্ত",
    payment_method: "পেমেন্ট মেথড",
    account_info: "একাউন্ট তথ্য",
    amount_label: "পরিমাণ ($)",
    withdraw_submit_btn: "উত্তোলনের অনুরোধ",
    withdraw_history: "উত্তোলনের ইতিহাস",
    tab_home: "হোম",
    tab_tasks: "টাস্ক",
    tab_leaderboard: "টপ",
    tab_support: "সাপোর্ট",
    tab_withdraw: "উত্তোলন",
  },
};

let currentLang = localStorage.getItem("lang") || "bn";

function applyTranslations() {
  const dict = translations[currentLang];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  document.getElementById("lang-toggle").textContent = currentLang === "bn" ? "EN" : "বাং";
}

document.getElementById("lang-toggle").onclick = () => {
  currentLang = currentLang === "bn" ? "en" : "bn";
  localStorage.setItem("lang", currentLang);
  applyTranslations();
};

// ---- Boot loader (Render free tier can take ~30-50s to wake up) ----
function showBootMessage(text) {
  let el = document.getElementById("boot-loader");
  if (!el) {
    el = document.createElement("div");
    el.id = "boot-loader";
    el.style.cssText =
      "position:fixed;inset:0;background:#f2faf6;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:999;padding:20px;text-align:center;";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="logo-badge" style="width:56px;height:56px;font-size:20px;">SE</div><p style="color:#12332c;font-size:14px;">${text}</p>`;
}
function hideBootMessage() {
  document.getElementById("boot-loader")?.remove();
}

// ---- Tabs ----
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById(`view-${name}`).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "tasks") loadTasks();
  if (name === "withdraw") loadWithdrawHistory();
  if (name === "leaderboard") loadLeaderboard();
}

// ---- Init ----
async function init() {
  applyTranslations();
  showBootMessage("Loading... server ghumiye thakle 30-50 second lagte pare, ektu opekkha koro.");

  const tgUser = tg?.initDataUnsafe?.user;
  if (tgUser) {
    document.getElementById("username").textContent = tgUser.first_name || tgUser.username || "User";
    if (tgUser.photo_url) {
      document.getElementById("avatar").src = tgUser.photo_url;
      document.getElementById("avatar").classList.remove("hidden");
      document.getElementById("avatar-badge").classList.add("hidden");
    }
  }

  // Referral: read startapp payload once, cache so re-opens don't re-trigger it server-side
  const startParam = tg?.initDataUnsafe?.start_param;
  const referredBy = startParam && !localStorage.getItem("verified_once") ? startParam : undefined;

  try {
    const { user, settings } = await api("/user/verify", {
      method: "POST",
      body: JSON.stringify({ referredBy, deviceId: getDeviceId() }),
    });
    localStorage.setItem("verified_once", "1");
    state.user = user;
    state.settings = settings;
    hideBootMessage();
    renderHome();
    loadAdNetworkScript(settings);
    startAutoAds(settings);
  } catch (e) {
    if (e.status === 403) {
      showBootMessage(`🚫 ${e.message}`);
    } else {
      showBootMessage("Connect হচ্ছে না। Internet check kore app ta abar open koro.");
    }
    throw e;
  }
}

function renderHome() {
  const { user, settings } = state;
  document.getElementById("balance").textContent = user.balance.toFixed(3);
  document.getElementById("total-earning").textContent = `$${user.totalEarning.toFixed(3)}`;
  document.getElementById("referrals-count").textContent = user.referralsCount;
  document.getElementById("commission").textContent = `$${user.commissionEarned.toFixed(3)}`;

  document.getElementById("daily-limit-text").textContent = `You can complete ${settings.dailyAdLimit} ads today`;
  document.getElementById("daily-today").textContent = `Today: ${user.dailyAdsWatched}/${settings.dailyAdLimit} • This Hour: ${user.hourlyAdsWatched || 0}/${settings.hourlyAdLimit}`;
  const pct = Math.min(100, (user.dailyAdsWatched / settings.dailyAdLimit) * 100);
  document.getElementById("daily-progress-fill").style.width = `${pct}%`;

  document.getElementById("refer-bonus-badge").textContent = `Earn $${settings.referralBonus} / referral`;
  document.getElementById("friend-bonus").textContent = settings.friendBonus;
  document.getElementById("referral-bonus").textContent = settings.referralBonus;
  document.getElementById("refer-requirement").textContent =
    `⏳ Bonus unlocks after your friend watches ${settings.referralRequiredAds} ads and completes ${settings.referralRequiredTasks} tasks`;
  const link = `https://t.me/${BOT_USERNAME}?startapp=${user.telegramId}`;
  document.getElementById("refer-link").textContent = link;
  document.getElementById("share-btn").onclick = () => tg?.openTelegramLink(
    `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join and earn rewards!")}`
  );

  renderEngagement();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function renderEngagement() {
  const { user } = state;
  const watchedAdToday = (user.dailyAdsWatched || 0) >= 1;

  const checkinDone = user.lastCheckInDate === todayStr();
  document.getElementById("checkin-streak-badge").textContent = `Streak: ${user.checkInStreak || 0}`;
  const checkinBtn = document.getElementById("checkin-btn");
  const checkinStatus = document.getElementById("checkin-status");
  if (checkinDone) {
    checkinBtn.disabled = true;
    checkinStatus.textContent = "✅ Already claimed today — come back tomorrow!";
  } else if (!watchedAdToday) {
    checkinBtn.disabled = false;
    checkinStatus.textContent = "📺 Tapping this will show a short ad first, then claim your bonus.";
  } else {
    checkinBtn.disabled = false;
    checkinStatus.textContent = "Ready to claim!";
  }

  const spinDone = user.lastSpinDate === todayStr();
  const spinBtn = document.getElementById("spin-btn");
  const spinStatus = document.getElementById("spin-status");
  if (spinDone) {
    spinBtn.disabled = true;
    spinStatus.textContent = "✅ Already spun today — come back tomorrow!";
  } else if (!watchedAdToday) {
    spinBtn.disabled = false;
    spinStatus.textContent = "📺 Tapping this will show a short ad first, then spin.";
  } else {
    spinBtn.disabled = false;
    spinStatus.textContent = "Ready to spin!";
  }
}

async function ensureAdWatchedToday() {
  if ((state.user.dailyAdsWatched || 0) >= 1) return;
  await showAdNow("rewarded");
  const { reward } = await api("/tasks/watch-ads", { method: "POST" });
  state.user.balance += reward;
  state.user.totalEarning += reward;
  state.user.dailyAdsWatched += 1;
  state.user.hourlyAdsWatched = (state.user.hourlyAdsWatched || 0) + 1;
}

document.getElementById("checkin-btn").onclick = async () => {
  try {
    await ensureAdWatchedToday();
    const { reward, streak } = await api("/engagement/checkin", { method: "POST" });
    state.user.balance += reward;
    state.user.totalEarning += reward;
    state.user.lastCheckInDate = todayStr();
    state.user.checkInStreak = streak;
    renderHome();
    tg?.showAlert(`✅ +$${reward} check-in bonus! Streak: ${streak}`);
  } catch (e) {
    tg?.showAlert(e.message || "Could not check in, try again.");
  }
};

document.getElementById("spin-btn").onclick = async () => {
  try {
    await ensureAdWatchedToday();
    const { reward } = await api("/engagement/spin", { method: "POST" });
    state.user.balance += reward;
    state.user.totalEarning += reward;
    state.user.lastSpinDate = todayStr();
    renderHome();
    tg?.showAlert(`🎉 You won $${reward}!`);
  } catch (e) {
    tg?.showAlert(e.message || "Could not spin, try again.");
  }
};

async function loadLeaderboard() {
  const items = await api("/engagement/leaderboard");
  const box = document.getElementById("leaderboard-list");
  box.innerHTML = "";
  if (!items.length) {
    box.innerHTML = `<p style="color:#94a3b8;font-size:13px;">No data yet.</p>`;
    return;
  }
  items.forEach((u) => {
    const medal = u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : u.rank === 3 ? "🥉" : `#${u.rank}`;
    const row = document.createElement("div");
    row.className = "wh-item";
    row.innerHTML = `
      <div><strong>${medal} ${u.firstName}</strong></div>
      <span class="stat-value blue" style="font-size:14px;">$${u.totalEarning.toFixed(3)}</span>`;
    box.appendChild(row);
  });
}

// ---- Ad network (configured entirely from the admin panel — no code change needed) ----
function loadAdNetworkScript(settings) {
  const usesMonetag = settings.rewardedAdNetwork === "monetag" || settings.autoAdNetwork === "monetag";
  if (usesMonetag && settings.monetagZoneId) {
    if (!document.getElementById("monetag-sdk")) {
      const s = document.createElement("script");
      s.id = "monetag-sdk";
      s.src = "//libtl.com/sdk.js";
      s.setAttribute("data-zone", settings.monetagZoneId);
      s.setAttribute("data-sdk", `show_${settings.monetagZoneId}`);
      document.head.appendChild(s);
    }
  }
  // Adsgram's SDK is already loaded generically in index.html (sad.min.js);
  // it just needs a blockId at show-time, no per-zone script tag required.
}

/** Shows one ad via whichever network is configured for the given placement
 * ("rewarded" for the Watch Ads task, "auto" for the periodic ad). Resolves
 * on a completed view, rejects if skipped/closed early or not configured. */
function showAdNow(placement) {
  const { settings } = state;
  const network = placement === "auto" ? settings.autoAdNetwork : settings.rewardedAdNetwork;

  if (network === "monetag" && settings.monetagZoneId) {
    const fn = window[`show_${settings.monetagZoneId}`];
    if (typeof fn !== "function") return Promise.reject(new Error("Ad not ready yet"));
    return fn();
  }
  if (network === "adsgram" && settings.adsgramBlockId) {
    if (!window.Adsgram) return Promise.reject(new Error("Ad SDK loading"));
    const controller = window.Adsgram.init({ blockId: settings.adsgramBlockId });
    return controller.show();
  }
  return Promise.reject(new Error("Ad network not configured"));
}

// Periodic ad shown automatically — the user gets NO reward for these; it's
// purely extra ad-impression revenue for the admin. Interval and network are
// set from the admin panel (0 minutes / "none" = disabled).
function startAutoAds(settings) {
  const minutes = Number(settings.autoAdIntervalMinutes) || 0;
  if (minutes <= 0 || settings.autoAdNetwork === "none") return;
  setInterval(() => {
    showAdNow("auto").catch(() => {
      // network not ready / user closed it — ignore, try again next interval
    });
  }, minutes * 60 * 1000);
}

// ---- Tasks ----
async function loadTasks() {
  const tasks = await api("/tasks");
  state.tasks = tasks;
  const list = document.getElementById("tasks-list");
  list.innerHTML = "";
  tasks.forEach((task) => list.appendChild(renderTaskCard(task)));
}

function renderTaskCard(task) {
  const el = document.createElement("div");
  el.className = "task-card";

  if (task.type === "ad") {
    el.innerHTML = `
      <div class="task-top">
        <div><p class="task-title">▶ ${task.title}</p><p class="task-desc">${task.description}</p></div>
        <div class="task-reward">$${task.reward}</div>
      </div>
      <button class="btn-blue" style="width:100%">▶ Watch Video</button>`;
    el.querySelector("button").onclick = () => watchAd(el);
  } else {
    el.innerHTML = `
      <div class="task-top">
        <div><p class="task-title">➤ ${task.title}</p><p class="task-desc">${task.description}</p></div>
        <div class="task-reward">$${task.reward}</div>
      </div>
      <div class="task-actions">
        <button class="btn-secondary">Join</button>
        <button class="btn-blue">Verify</button>
      </div>`;
    const [joinBtn, verifyBtn] = el.querySelectorAll("button");
    joinBtn.onclick = () => tg?.openTelegramLink(`https://t.me/${task.channelUsername}`);
    verifyBtn.onclick = () => verifyChannelTask(task, el);
  }
  return el;
}

function watchAd(cardEl) {
  showAdNow("rewarded")
    .then(async () => {
      const { reward } = await api("/tasks/watch-ads", { method: "POST" });
      state.user.balance += reward;
      state.user.totalEarning += reward;
      state.user.dailyAdsWatched += 1;
      state.user.hourlyAdsWatched = (state.user.hourlyAdsWatched || 0) + 1;
      renderHome();
      tg?.showAlert(`+$${reward} added!`);
    })
    .catch((e) => {
      if (e.message === "Ad network not configured") {
        tg?.showAlert("Ad network still being set up, try again later.");
      }
      // otherwise: user skipped the ad / SDK not ready — no reward, no alert
    });
}

async function verifyChannelTask(task, cardEl) {
  try {
    const { reward } = await api(`/tasks/${task.id}/verify-channel`, { method: "POST" });
    state.user.balance += reward;
    state.user.totalEarning += reward;
    renderHome();
    cardEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    tg?.showAlert(`+$${reward} added!`);
  } catch (e) {
    tg?.showAlert(e.message);
  }
}

// ---- Support ----
document.getElementById("contact-support-btn").onclick = () => {
  tg?.openTelegramLink(`https://t.me/${SUPPORT_USERNAME}`);
};

// ---- Withdraw ----
function updateWithdrawRequirements() {
  const { user, settings } = state;
  document.getElementById("req-min-balance").textContent = settings.minWithdrawBalance;
  document.getElementById("req-min-referrals").textContent = settings.minReferrals;
  document.getElementById("req-balance-progress").textContent = `${user.balance.toFixed(3)}/${settings.minWithdrawBalance}`;
  document.getElementById("req-referral-progress").textContent = `${user.referralsCount}/${settings.minReferrals}`;
  document.getElementById("req-balance-fill").style.width = `${Math.min(100, (user.balance / settings.minWithdrawBalance) * 100)}%`;
  document.getElementById("req-referral-fill").style.width = `${Math.min(100, (user.referralsCount / settings.minReferrals) * 100)}%`;

  const eligible = user.balance >= settings.minWithdrawBalance && user.referralsCount >= settings.minReferrals;
  const warn = document.getElementById("req-warning");
  if (!eligible) {
    warn.classList.remove("hidden");
    warn.textContent = `Requires ${settings.minWithdrawBalance} $ & ${settings.minReferrals} Referrals`;
  } else {
    warn.classList.add("hidden");
  }
  document.getElementById("withdraw-submit").disabled = !eligible;
}

document.getElementById("withdraw-submit").onclick = async () => {
  const method = document.getElementById("method-select").value;
  const accountNumber = document.getElementById("account-input").value.trim();
  const amount = Number(document.getElementById("amount-input").value);
  try {
    await api("/withdraw", { method: "POST", body: JSON.stringify({ method, accountNumber, amount }) });
    tg?.showAlert("Withdrawal request submitted!");
    state.user.balance -= amount;
    renderHome();
    updateWithdrawRequirements();
    loadWithdrawHistory();
  } catch (e) {
    tg?.showAlert(e.message);
  }
};

async function loadWithdrawHistory() {
  updateWithdrawRequirements();
  const items = await api("/withdraw/history");
  const box = document.getElementById("withdraw-history");
  box.innerHTML = "";
  if (!items.length) {
    box.innerHTML = `<p style="color:#94a3b8;font-size:13px;">No withdrawals yet.</p>`;
    return;
  }
  items.forEach((w) => {
    const row = document.createElement("div");
    row.className = "wh-item";
    row.innerHTML = `
      <div>
        <div><strong>$${w.amount} - ${w.method}</strong></div>
        <div style="font-size:12px;color:#94a3b8;">${w.accountNumber}</div>
      </div>
      <span class="status-pill status-${w.status}">${w.status[0].toUpperCase() + w.status.slice(1)}</span>`;
    box.appendChild(row);
  });
}

init().catch((e) => console.error(e));
