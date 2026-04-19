const DEFAULT_ROLE = "superadmin";

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "superadmin" || value === "reviewer" || value === "auditor") {
    return value;
  }
  return DEFAULT_ROLE;
}

function buildAdminUsers({ adminUsers, fallbackAdminKey }) {
  const list = [];

  if (Array.isArray(adminUsers)) {
    adminUsers.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return;
      const key = String(entry.key || "").trim();
      if (!key) return;
      list.push({
        id: String(entry.id || `admin-${idx + 1}`),
        name: String(entry.name || `Admin ${idx + 1}`),
        role: normalizeRole(entry.role),
        key,
      });
    });
  }

  if (!list.length && fallbackAdminKey) {
    list.push({
      id: "default-admin",
      name: "Default Admin",
      role: DEFAULT_ROLE,
      key: String(fallbackAdminKey),
    });
  }

  return list;
}

function resolveAdminFromKey(adminUsers, key) {
  const incoming = String(key || "").trim();
  if (!incoming) return null;
  const match = adminUsers.find((user) => user.key === incoming);
  if (!match) return null;
  return {
    id: match.id,
    name: match.name,
    role: match.role,
  };
}

function hasRequiredRole(admin, allowedRoles) {
  if (!admin) return false;
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [DEFAULT_ROLE];
  return allowed.includes(admin.role) || admin.role === DEFAULT_ROLE;
}

module.exports = {
  buildAdminUsers,
  resolveAdminFromKey,
  hasRequiredRole,
};
