// Client-side wrapper around a small set of Postgres functions (see
// supabase-security.sql) instead of talking to the `kv_store` table
// directly. The table itself is locked down (no direct anon access) —
// every read and write goes through one of these functions, which check
// a passcode server-side before doing anything. This means:
//   - Nobody can read or write the database directly with just the site's
//     public key; they'd also need a valid admin/barangay passcode.
//   - The actual stored passcodes are never sent to the browser — logging
//     in calls verifyLogin(), which only returns true/false.
//   - The public front page's stats use a dedicated function that returns
//     counts only, never the full list of members' personal details.
//   - Public self-registration uses a dedicated function that can only
//     append one new (unverified) record — it can't read, edit, or delete
//     anything.

import { supabase } from "./supabaseClient.js";

export const storage = {
  // Never returns the real passcode — only whether it matched.
  async verifyLogin(role, barangay, passcode) {
    const { data, error } = await supabase.rpc("verify_login", {
      p_role: role,
      p_barangay: barangay || null,
      p_passcode: passcode,
    });
    if (error) throw error;
    return Boolean(data);
  },

  // Aggregate counts only — safe to call without logging in.
  async getPublicStats() {
    const { data, error } = await supabase.rpc("get_public_stats");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      members: (row && row.total_members) || 0,
      barangaysActive: (row && row.barangays_active) || 0,
      officials: (row && row.total_officials) || 0,
    };
  },

  // Appends one new, unverified self-registration record. Can't touch
  // anything else — no passcode needed or accepted.
  async submitSelfRegistration(record) {
    const { error } = await supabase.rpc("submit_self_registration", { p_record: record });
    if (error) throw error;
  },

  // Requires a valid admin or barangay passcode. Returns the same shape as
  // before ({ key, value, updatedAt }) so the rest of the app doesn't need
  // to change how it reads the result.
  async get(key, passcode) {
    const { data, error } = await supabase.rpc("get_kv", { p_key: key, p_passcode: passcode });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.value === null || row.value === undefined) return null;
    return { key, value: JSON.stringify(row.value), updatedAt: row.updated_at };
  },

  // Requires a valid admin or barangay passcode. Same optimistic-concurrency
  // shape as before: pass ifUnchangedSince to make the write conditional on
  // nobody else having saved in the meantime.
  async set(key, value, passcode, options = {}) {
    const { ifUnchangedSince } = options;
    let parsed;
    try {
      parsed = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      parsed = value;
    }
    const { data, error } = await supabase.rpc("save_kv", {
      p_key: key,
      p_value: parsed,
      p_expected_updated_at: ifUnchangedSince || null,
      p_passcode: passcode,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.conflict) return { conflict: true };
    return { key, value, updatedAt: row ? row.updated_at : new Date().toISOString() };
  },
};
