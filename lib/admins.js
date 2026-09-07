const bcrypt = require("bcryptjs");
const { db } = require("./firebase");

const adminsCol = () => db.collection("admins");

/**
 * On first server start, if no admin accounts exist yet, create one from
 * ADMIN_USERNAME / ADMIN_PASSWORD in .env with the "owner" role (the only
 * role allowed to add/remove other admins).
 */
async function ensureBootstrapAdmin() {
  const snap = await adminsCol().limit(1).get();
  if (!snap.empty) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn(
      "No admins exist yet and ADMIN_USERNAME/ADMIN_PASSWORD are not set — set them in .env to bootstrap the first owner account."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await adminsCol().doc(username).set({
    username,
    passwordHash,
    role: "owner",
    createdAt: new Date(),
  });
  console.log(`Bootstrap admin created: ${username} (owner)`);
}

async function findAdmin(username) {
  const doc = await adminsCol().doc(username).get();
  return doc.exists ? doc.data() : null;
}

async function verifyLogin(username, password) {
  const admin = await findAdmin(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? admin : null;
}

async function listAdmins() {
  const snap = await adminsCol().get();
  return snap.docs.map((d) => {
    const { passwordHash, ...rest } = d.data();
    return rest;
  });
}

async function createAdmin(username, password, role, createdBy) {
  const existing = await findAdmin(username);
  if (existing) throw new Error("Username already exists");
  const passwordHash = await bcrypt.hash(password, 10);
  await adminsCol().doc(username).set({
    username,
    passwordHash,
    role: role === "owner" ? "owner" : "admin",
    createdBy,
    createdAt: new Date(),
  });
}

async function deleteAdmin(username, requestedBy) {
  const target = await findAdmin(username);
  if (!target) throw new Error("Admin not found");
  if (target.role === "owner") throw new Error("Cannot delete an owner account");
  if (username === requestedBy) throw new Error("Cannot delete your own account");
  await adminsCol().doc(username).delete();
}

module.exports = { ensureBootstrapAdmin, findAdmin, verifyLogin, listAdmins, createAdmin, deleteAdmin };
