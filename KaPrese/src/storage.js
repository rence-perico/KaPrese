// Drop-in replacement for the Claude-Artifact `window.storage` API,
// backed by a single Postgres table in Supabase (see supabase-schema.sql).
//
// Original API (artifact):
//   await window.storage.get(key, shared)    -> { key, value, shared } | null
//   await window.storage.set(key, value, shared) -> { key, value, shared } | null
//   await window.storage.delete(key, shared) -> { key, deleted, shared } | null
//   await window.storage.list(prefix, shared) -> { keys, prefix?, shared } | null
//
// This app only ever used shared=true (one shared dataset for the whole
// municipality), so the `shared` argument is accepted for compatibility
// but ignored — everything lives in one `kv_store` table that all visitors
// can read/write, matching the original behavior.
//
// IMPORTANT: get() also returns `updatedAt`, the row's last-write timestamp.
// Callers that read-modify-write a shared value (e.g. the members/officials
// arrays) should pass that timestamp back in as `ifUnchangedSince` when they
// set() the new value. This turns the write into a conditional update: it
// only succeeds if nobody else has written to that key since we read it.
// If someone else DID write in the meantime, set() returns { conflict: true }
// instead of silently overwriting their change — the caller can then refetch
// the latest value, reapply just its own change on top of it, and retry.
// See mutateList() in App.jsx for the retry loop that uses this.

import { supabase } from "./supabaseClient.js";

const TABLE = "kv_store";

export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("value, updated_at")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Tolerate the `value` column being either:
    //  - jsonb (Supabase auto-parses it into a JS object/array), or
    //  - text (it comes back already as a JSON string).
    // Only re-stringify if it ISN'T already a string, otherwise we'd double-encode
    // it (wrapping an already-JSON string in an extra layer of quotes/escaping,
    // which then only partially unwraps on JSON.parse and leaves callers holding
    // a string instead of the object they expect).
    const valueStr = typeof data.value === "string" ? data.value : JSON.stringify(data.value);

    return { key, value: valueStr, updatedAt: data.updated_at };
  },

  async set(key, value, options = {}) {
    const { ifUnchangedSince } = options;

    let parsed;
    try {
      parsed = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      parsed = value;
    }

    const nowIso = new Date().toISOString();

    if (ifUnchangedSince) {
      // Conditional update: only writes if the row's updated_at still matches
      // what we read. If another save landed in between, this matches zero
      // rows and we report a conflict instead of clobbering that other save.
      const { data, error } = await supabase
        .from(TABLE)
        .update({ value: parsed, updated_at: nowIso })
        .eq("key", key)
        .eq("updated_at", ifUnchangedSince)
        .select("key");

      if (error) throw error;
      if (!data || data.length === 0) {
        return { conflict: true };
      }
      return { key, value, updatedAt: nowIso };
    }

    // No prior version to check against (first-ever write of this key, or the
    // caller explicitly opted out of the conflict check) — plain upsert.
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value: parsed, updated_at: nowIso });

    if (error) throw error;
    return { key, value, updatedAt: nowIso };
  },

  async delete(key) {
    const { error } = await supabase.from(TABLE).delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true };
  },

  async list(prefix) {
    let query = supabase.from(TABLE).select("key");
    if (prefix) query = query.like("key", `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map((row) => row.key) };
  },
};

// Expose on window too, in case any code still calls window.storage directly.
if (typeof window !== "undefined") {
  window.storage = storage;
}
