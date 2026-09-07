# Upohars Clone — Telegram Mini App + Bot

Task-earning platform: watch ads, join channel task, referral system, bKash/Nagad/Binance/USDT withdrawal — tomar screenshot অনুযায়ী।

**Stack:** Node.js (Express + grammY bot) + Firebase Firestore (free) + Adsgram (rewarded ads).

---

## ১. BotFather diye bot banano

1. Telegram e **@BotFather** ke message dao.
2. `/newbot` diye ekta naam ar username dao (username `Bot` diye shesh hote hobe, jemon `UpoharsClonebot`).
3. Ekta **token** pabe — eta `.env` e `BOT_TOKEN` e boshao.
4. `/mybots` -> tomar bot select koro -> **Bot Settings -> Menu Button -> Configure Menu Button** -> ekhane deploy korar por webapp URL boshabe.
5. `/setprivacy` -> Disable koro (channel join verify korte hole `getChatMember` lagbe, tai bot ke shei channel/group e admin hisebe add korte hobe).

Nijer Telegram numeric ID pete **@userinfobot** ke message dao — eta `ADMIN_TELEGRAM_ID` e boshabe (withdrawal approve/reject korar jonno).

## ২. Firebase project setup (free)

1. [console.firebase.google.com](https://console.firebase.google.com) e new project banao.
2. **Build -> Firestore Database -> Create database** (production mode, kono region).
3. **Project settings (gear icon) -> Service accounts -> Generate new private key** — ekta JSON file download hobe.
4. Shei JSON file ke base64 e convert koro:
   - Mac/Linux: `base64 -i serviceAccount.json`
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`
5. Result ta `.env` e `FIREBASE_SERVICE_ACCOUNT_BASE64` e boshao. `FIREBASE_PROJECT_ID` e project id dao (JSON file e `project_id` field e ache).

## ৩. Adsgram (rewarded ads) setup

1. [adsgram.ai](https://adsgram.ai) e publisher account banao, tomar mini app add koro.
2. Ekta **Block ID** pabe — `public/app.js` file e `ADSGRAM_BLOCK_ID` variable e boshao.
3. Approval lagte kichu shomoy lagte pare notun app-er jonno.

## ৪. Local e run kora

```bash
npm install
cp .env.example .env
# .env file e shob value bhorо
npm start
```

Local e test korte hole [ngrok](https://ngrok.com) diye tunnel korte hobe, karon Telegram WebApp-er jonno HTTPS URL lagbe:

```bash
ngrok http 3000
```

Shei ngrok URL ta BotFather-er Menu Button e o `.env`-er `WEBAPP_URL` e boshao.

## ৫. Deploy kora (free hosting)

**Render.com** (shohoj, free tier):
1. Github e code push koro.
2. Render e "New Web Service" -> repo connect koro.
3. Build command: `npm install`, Start command: `npm start`.
4. Environment tab e `.env`-er shob variable add koro.
5. Deploy hoye gele URL pabe — eta `WEBAPP_URL` hisebe update koro ar BotFather menu button e o boshao.

(Railway.app o same process diye kora jay.)

## ৬. Kivabe kaj kore (overview)

- **`/start <referrer_id>`** — user notun hole account banay; referrer ke bonus, notun user ke bonus dey.
- **Watch Ads** — Adsgram rewarded video dekhale server balance বাড়ায় (daily limit soho).
- **Join Telegram Channel** — bot `getChatMember` diye check kore user join korse kina; korle reward dey. Bot ke shei channel-e admin banate hobe.
- **Withdraw** — minimum balance + minimum referrals check kore, request Firestore-e save hoy, admin ke Telegram-e notify jay `/approve <id>` ba `/reject <id>` command soho.
- Shob admin-command shudhu `ADMIN_TELEGRAM_ID` diye kaj korbe.

## ৭. Admin Panel (multi-admin support)

Deploy kora URL-er por `/admin` e giye (jemon `https://upohars-clone.onrender.com/admin`) login korte hobe **username + password** diye — `.env`-er `ADMIN_USERNAME` / `ADMIN_PASSWORD` diye pratham "owner" account ta ban6hoy (server first-time start houar shomoy ekhono).

- **Overview** — total users, pending withdrawals, total paid out
- **Withdrawals** — shob request dekha ar ekhan theke shorasori **Approve/Reject** kora jay
- **Users** — shob user-er balance, referral count
- **Tasks** — notun task add/edit/delete kora
- **Settings** — minimum withdrawal balance, referral bonus, daily ad limit, ad reward — kono code change chara change kora jay
- **Admins** (*sudhu owner dekhbe*) — notun admin add/remove kora jay, alada username/password soho. Duita role:
  - **admin** — sob kichu dekhte ar korte parbe (withdraw approve, task/settings edit), kintu notun admin add/remove korte parbe na
  - **owner** — shob kisu, plus admin manage kora

Notun admin add korte: **Admins** tab e giye username, password (6+ character), role select kore **Add Admin** chapo।

Telegram bot-e `/approve` `/reject` command o ekhon **multiple Telegram ID** support kore — `.env`-er `ADMIN_TELEGRAM_IDS` e comma diye jotogula lagbe dao (jemon: `5672570073,1234567890`)।

## ৮. Ad Network (Monetag/Adsgram) — code change chara

Admin panel → **Settings** tab e:
- **"Watch Ads" task network** — Monetag ba Adsgram, ei network diye reward-based ad dekhabe
- **Auto ad network** — onno ekta network dite paro (jemon Watch Ads e Monetag, Auto ad e Adsgram) — duitai alada alada
- **Monetag Zone ID** / **Adsgram Block ID** — respective network-e signup kore paba
- Save korle shathe shathe mini app-e ad active hoye jabe, deploy/code change kono kisu lagbe na

**Ad Limits & Auto Ads** section-eo ekhan theke control hoy:
- Daily ad limit, Hourly ad limit, Ad reward — jekono shomoy change kora jay
- **Auto ad every (minutes)** — eta 0 na thakle, nirdishto shomoy por por (jemon 5 minute) user-ke ekta ad dekhabe **kono reward chara** — sudhu extra ad-impression revenue-r jonno

## ৯. Conditional Referral Bonus (referred user-ke kaj korte hobe)

Ekhon referrer-er bonus **shathe shathe** dey na — notun user join korle sudhu shei user "friend bonus" pay, ar referrer-er bonus **pending** thake।

Admin panel → Settings → **"Withdrawal & Referral"** section-e ei duita control kore:
- **Ads referred user must watch** (default: 3)
- **Tasks referred user must complete** (default: 2)

Referred user jokhoni ei duita condition pura kore (lifetime — daily reset hoy na), tokhon automatically referrer-ke bonus credit hoye jay ar Telegram-e notify pathano hoy। Ekbar paid hoye gele abar dibar test hoy na (double-pay protection ache)।

## ১০. Ek Device-e Ekta Account (multi-accounting protection)

Prottek device-e ekta random ID generate hoye localStorage-e save thake. Shei device diye prothom je Telegram account app open kore, oi device shei account-er sathe "lock" hoye jay — onno kono Telegram account diye shei **same device** theke app khulte gele block kora hobe ("This device already has an account" message dekhabe)।

⚠️ **Shimaboddhota:** eta perfect na — keu jodi Telegram/browser-er storage/cache clear kore ba app reinstall kore, notun device ID generate hobe ar abar notun account khulte parbe. Kintu casual multi-accounting (referral farm korar jonno) onek kome jabe.

## ১১. Render Free Plan — cold start / slow loading somadhan

Render-er **free plan** 15 minute kono request na ashle service ke "spin down" (ghumiye) kore dey — tarpor prothom request-e **30-50 second** shomoy lagte pare (mini app-e "Loading..." dekhabe, eta bug na, eta free hosting-er shimaboddhota)।

Eta shomadhan korte 2ta upay:

**Upay ১ (free, recommended):** [cron-job.org](https://cron-job.org) ba [UptimeRobot](https://uptimerobot.com) diye free account banao, tarpor ekta cron job/monitor setup koro:
- URL: `https://upohars-clone.onrender.com/health`
- Every 10 minutes (10-14 minute er moddhe rakhle valo, 15 minute cross korle spin down hobe)

Eta korle service kokhono ghumabe na, mini app shobshomoy instant load hobe — pura free.

**Upay ২ (paid):** Render-e "Upgrade your instance" diye paid plan ($7/month theke) nile spin-down bondho hoye jay, permanent solution.

## ১২. Notun Engagement Features (Check-in, Spin, Leaderboard, Broadcast, Analytics)

Shob-i Admin panel theke control hoy:

- **Daily Check-in** (Home tab): user-ke ekta ad dekhte hoy (jekono ad — Watch Ads task theke, ba direct check-in button chapleo shathe shathe ad show hoy), tarpor bonus claim korte pare. Consecutive din check-in korle streak bare, bonus-o bare (Settings-e base bonus, streak increment, streak cap control kora jay).
- **Daily Spin** (Home tab): same rule — ad dekhle spin unlock hoy. Prize list (comma separated $ value) Settings-e change kora jay.
- **Leaderboard** (bottom tab, 🏆): Top 20 highest-earning user dekhay (naam + total earning, kono sensitive info na).
- **Admin → Broadcast tab**: shob user-ke ekshathe Telegram message pathano jay (notun offer/announcement janate).
- **Admin → Analytics tab**: gato 7 din-er notun signup ar paid-out amount-er simple bar chart.
- **Bangla/English toggle**: mini app-er topbar-e EN/বাং বাটন — user nijer moto bhasha select korte pare (default Bangla).

## ১৩. Customize korte cha ile
- Task list: `routes/tasks.js`-er `seed` array edit koro (ba Firestore console theke `tasks` collection e direct edit koro).
- Reward amounts, minimum withdrawal, referral bonus: Firestore-er `settings/config` document theke ba `.env`-er default value theke change koro.
- UI colors/style: `public/style.css`.

## Security note

Ei scaffold-e Telegram WebApp `initData` signature verify kora hoy (`lib/telegramAuth.js`) — tai keu fake request pathate parbe na. Production e jete hole:
- Rate-limiting add koro withdrawal/ad-watch endpoint-e.
- Firestore security rules lock kore rakho (client SDK direct use korle) — এখানে shob write server (Admin SDK) diye hocche bole default rules-e problem nai.
