let ADMIN_TOKEN = sessionStorage.getItem("admin_token") || "";
let ADMIN_ROLE = sessionStorage.getItem("admin_role") || "";

async function adminApi(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("admin-app").classList.remove("hidden");
  document.getElementById("admins-tab-btn").classList.toggle("hidden", ADMIN_ROLE !== "owner");
  loadOverview();
}

document.getElementById("login-btn").onclick = async () => {
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  try {
    const data = await adminApi("/login", { method: "POST", body: JSON.stringify({ username, password }) });
    ADMIN_TOKEN = data.token;
    ADMIN_ROLE = data.role;
    sessionStorage.setItem("admin_token", ADMIN_TOKEN);
    sessionStorage.setItem("admin_role", ADMIN_ROLE);
    showApp();
  } catch (e) {
    document.getElementById("login-error").textContent = e.message;
  }
};

// Auto-login if a valid token is already cached for this session
if (ADMIN_TOKEN) {
  adminApi("/me")
    .then(showApp)
    .catch(() => {
      sessionStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_role");
    });
}

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`admin-${tab.dataset.view}`).classList.add("active");
    if (tab.dataset.view === "overview") loadOverview();
    if (tab.dataset.view === "withdrawals") loadWithdrawals();
    if (tab.dataset.view === "users") loadUsers();
    if (tab.dataset.view === "tasks") loadTasks();
    if (tab.dataset.view === "settings") loadSettings();
    if (tab.dataset.view === "admins") loadAdmins();
    if (tab.dataset.view === "analytics") loadAnalytics();
  };
});

async function loadOverview() {
  const stats = await adminApi("/stats");
  document.getElementById("stat-users").textContent = stats.totalUsers;
  document.getElementById("stat-pending").textContent = stats.pendingWithdrawals;
  document.getElementById("stat-paid").textContent = `$${stats.totalPaidOut.toFixed(3)}`;
}

async function loadWithdrawals() {
  const items = await adminApi("/withdrawals");
  const tbody = document.getElementById("withdrawals-table");
  tbody.innerHTML = "";
  items.forEach((w) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.userId}</td>
      <td>$${w.amount}</td>
      <td>${w.method}</td>
      <td>${w.accountNumber}</td>
      <td>${w.status}</td>
      <td class="row-actions">${
        w.status === "pending"
          ? `<button class="approve-btn" data-id="${w.id}" data-decision="approved">Approve</button>
             <button class="reject-btn" data-id="${w.id}" data-decision="rejected">Reject</button>`
          : "-"
      }</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button").forEach((btn) => {
    btn.onclick = async () => {
      try {
        await adminApi(`/withdrawals/${btn.dataset.id}/${btn.dataset.decision}`, { method: "POST" });
        loadWithdrawals();
        loadOverview();
      } catch (e) {
        alert(e.message);
      }
    };
  });
}

async function loadUsers() {
  const items = await adminApi("/users");
  const tbody = document.getElementById("users-table");
  tbody.innerHTML = "";
  items.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${u.telegramId}</td><td>${u.firstName || "-"}</td><td>$${(u.balance || 0).toFixed(3)}</td><td>${u.referralsCount || 0}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadTasks() {
  const items = await adminApi("/tasks");
  const tbody = document.getElementById("tasks-table");
  tbody.innerHTML = "";
  items.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.id}</td><td>${t.title}</td><td>$${t.reward}</td><td><button class="reject-btn" data-id="${t.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete this task?")) return;
      await adminApi(`/tasks/${btn.dataset.id}`, { method: "DELETE" });
      loadTasks();
    };
  });
}

document.getElementById("task-save-btn").onclick = async () => {
  const task = {
    id: document.getElementById("task-id").value.trim(),
    type: document.getElementById("task-type").value,
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-desc").value.trim(),
    channelUsername: document.getElementById("task-channel").value.trim(),
    reward: document.getElementById("task-reward").value,
  };
  try {
    await adminApi("/tasks", { method: "POST", body: JSON.stringify(task) });
    loadTasks();
    alert("Task saved!");
  } catch (e) {
    alert(e.message);
  }
};

async function loadSettings() {
  const s = await adminApi("/settings");
  document.getElementById("s-rewardedAdNetwork").value = s.rewardedAdNetwork;
  document.getElementById("s-autoAdNetwork").value = s.autoAdNetwork;
  document.getElementById("s-monetagZoneId").value = s.monetagZoneId;
  document.getElementById("s-adsgramBlockId").value = s.adsgramBlockId;
  document.getElementById("s-minWithdrawBalance").value = s.minWithdrawBalance;
  document.getElementById("s-minReferrals").value = s.minReferrals;
  document.getElementById("s-referralBonus").value = s.referralBonus;
  document.getElementById("s-friendBonus").value = s.friendBonus;
  document.getElementById("s-referralRequiredAds").value = s.referralRequiredAds;
  document.getElementById("s-referralRequiredTasks").value = s.referralRequiredTasks;
  document.getElementById("s-checkInBaseBonus").value = s.checkInBaseBonus;
  document.getElementById("s-checkInStreakIncrement").value = s.checkInStreakIncrement;
  document.getElementById("s-checkInStreakCapDays").value = s.checkInStreakCapDays;
  document.getElementById("s-spinPrizesCsv").value = s.spinPrizesCsv;
  document.getElementById("s-dailyAdLimit").value = s.dailyAdLimit;
  document.getElementById("s-hourlyAdLimit").value = s.hourlyAdLimit;
  document.getElementById("s-adReward").value = s.adReward;
  document.getElementById("s-autoAdIntervalMinutes").value = s.autoAdIntervalMinutes;
}

document.getElementById("settings-save-btn").onclick = async () => {
  const body = {
    rewardedAdNetwork: document.getElementById("s-rewardedAdNetwork").value,
    autoAdNetwork: document.getElementById("s-autoAdNetwork").value,
    monetagZoneId: document.getElementById("s-monetagZoneId").value,
    adsgramBlockId: document.getElementById("s-adsgramBlockId").value,
    minWithdrawBalance: document.getElementById("s-minWithdrawBalance").value,
    minReferrals: document.getElementById("s-minReferrals").value,
    referralBonus: document.getElementById("s-referralBonus").value,
    friendBonus: document.getElementById("s-friendBonus").value,
    referralRequiredAds: document.getElementById("s-referralRequiredAds").value,
    referralRequiredTasks: document.getElementById("s-referralRequiredTasks").value,
    checkInBaseBonus: document.getElementById("s-checkInBaseBonus").value,
    checkInStreakIncrement: document.getElementById("s-checkInStreakIncrement").value,
    checkInStreakCapDays: document.getElementById("s-checkInStreakCapDays").value,
    spinPrizesCsv: document.getElementById("s-spinPrizesCsv").value,
    dailyAdLimit: document.getElementById("s-dailyAdLimit").value,
    hourlyAdLimit: document.getElementById("s-hourlyAdLimit").value,
    adReward: document.getElementById("s-adReward").value,
    autoAdIntervalMinutes: document.getElementById("s-autoAdIntervalMinutes").value,
  };
  try {
    await adminApi("/settings", { method: "PUT", body: JSON.stringify(body) });
    alert("Settings saved!");
  } catch (e) {
    alert(e.message);
  }
};

// ---- Admin account management (owner only) ----
async function loadAdmins() {
  const items = await adminApi("/admins");
  const tbody = document.getElementById("admins-table");
  tbody.innerHTML = "";
  items.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.username}</td><td>${a.role}</td><td>${
      a.role !== "owner" ? `<button class="reject-btn" data-username="${a.username}">Remove</button>` : "-"
    }</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm(`Remove admin "${btn.dataset.username}"?`)) return;
      try {
        await adminApi(`/admins/${btn.dataset.username}`, { method: "DELETE" });
        loadAdmins();
      } catch (e) {
        alert(e.message);
      }
    };
  });
}

document.getElementById("add-admin-btn").onclick = async () => {
  const username = document.getElementById("new-admin-username").value.trim();
  const password = document.getElementById("new-admin-password").value;
  const role = document.getElementById("new-admin-role").value;
  try {
    await adminApi("/admins", { method: "POST", body: JSON.stringify({ username, password, role }) });
    document.getElementById("new-admin-username").value = "";
    document.getElementById("new-admin-password").value = "";
    loadAdmins();
    alert("Admin added!");
  } catch (e) {
    alert(e.message);
  }
};

// ---- Broadcast ----
document.getElementById("broadcast-send-btn").onclick = async () => {
  const message = document.getElementById("broadcast-message").value.trim();
  if (!message) return;
  if (!confirm("Send this message to ALL users?")) return;
  try {
    const { targeting } = await adminApi("/broadcast", { method: "POST", body: JSON.stringify({ message }) });
    document.getElementById("broadcast-status").textContent = `Sending to ${targeting} users... (runs in background, may take a few minutes for large lists)`;
    document.getElementById("broadcast-message").value = "";
  } catch (e) {
    alert(e.message);
  }
};

// ---- Analytics ----
function renderBarChart(containerId, data, formatValue) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="bar-chart">${data
    .map(
      (d) => `
      <div class="bar-col">
        <div class="bar-value">${formatValue(d.value)}</div>
        <div class="bar-fill" style="height:${Math.max(2, (d.value / max) * 100)}%;"></div>
        <div class="bar-label">${d.date.slice(5)}</div>
      </div>`
    )
    .join("")}</div>`;
}

async function loadAnalytics() {
  const data = await adminApi("/analytics");
  renderBarChart(
    "chart-signups",
    data.signups.map((d) => ({ date: d.date, value: d.count })),
    (v) => v
  );
  renderBarChart(
    "chart-paidout",
    data.paidOut.map((d) => ({ date: d.date, value: d.amount })),
    (v) => `$${v.toFixed(3)}`
  );
}
