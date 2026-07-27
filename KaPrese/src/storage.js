// Auth: real Supabase Auth accounts (one per officer, plus the admin)
// instead of shared passcodes. Data access: direct table queries —
// security now lives in the database's row-level security policies
// (see supabase-accounts-schema.sql), not in this file. An officer's
// queries can only ever return their own barangay's rows; that's
// enforced by Postgres itself, not by anything the client sends.

import { supabase } from "./supabaseClient.js";

export const auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  async getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, barangay, full_name")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  },
  async changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};

export const storage = {
  // PII-free counts for the public front page — no login needed.
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

  // Uploads a photo (used by both the officer form and public
  // self-registration) and returns its public URL. Filenames are random,
  // so a URL can't be guessed — but note this bucket is public-read, so
  // anyone who does have the exact URL can view that one photo.
  async uploadMemberPhoto(barangay, file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${barangay}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("member-photos").getPublicUrl(path);
    return data.publicUrl;
  },

  // Public digital-ID card lookup — no login needed, but only returns
  // one record at a time and only if you already have its exact ID.
  async getMemberCard(memberId) {
    const { data, error } = await supabase.rpc("get_member_card", { p_member_id: memberId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      memberId: row.member_id || "",
      lastName: row.last_name,
      firstName: row.first_name,
      middleName: row.middle_name || "",
      barangay: row.barangay,
      age: row.age,
      sex: row.sex || "",
      photoUrl: row.photo_url || "",
      verified: row.verified,
    };
  },

  // Public self-registration: RLS only allows this exact shape (see
  // "public self registration" policy) — verified/archived/source are
  // forced here as well as a first line of defense.
  async submitSelfRegistration(record) {
    const { error } = await supabase
      .from("members")
      .insert({ ...toDbMember(record), verified: false, archived: false, source: "self" });
    if (error) throw error;
  },

  async getMembers() {
    const { data, error } = await supabase.from("members").select("*").order("last_name");
    if (error) throw error;
    return data.map(fromDbMember);
  },
  async addMember(record) {
    const { data, error } = await supabase.from("members").insert(toDbMember(record)).select().single();
    if (error) throw error;
    return fromDbMember(data);
  },
  async updateMember(id, record) {
    const { data, error } = await supabase.from("members").update(toDbMember(record)).eq("id", id).select().single();
    if (error) throw error;
    return fromDbMember(data);
  },
  async deleteMember(id) {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) throw error;
  },

  async getOfficials() {
    const { data, error } = await supabase.from("officials").select("*").order("barangay");
    if (error) throw error;
    return data.map(fromDbOfficial);
  },
  async addOfficial(record) {
    const { data, error } = await supabase.from("officials").insert(toDbOfficial(record)).select().single();
    if (error) throw error;
    return fromDbOfficial(data);
  },
  async updateOfficial(id, record) {
    const { data, error } = await supabase.from("officials").update(toDbOfficial(record)).eq("id", id).select().single();
    if (error) throw error;
    return fromDbOfficial(data);
  },
  async deleteOfficial(id) {
    const { error } = await supabase.from("officials").delete().eq("id", id);
    if (error) throw error;
  },
};

// The rest of the app uses camelCase field names (lastName, firstName, ...);
// the database uses snake_case columns. These convert between the two so
// nothing else in the app needs to know the difference.
function toDbMember(m) {
  return {
    barangay: m.barangay,
    last_name: m.lastName,
    first_name: m.firstName,
    middle_name: m.middleName || null,
    suffix: m.suffix || null,
    birthdate: m.birthdate || null,
    age: m.age ?? null,
    sex: m.sex || null,
    civil_status: m.civilStatus || null,
    classification: m.classification || [],
    pwd: !!m.pwd,
    ip: !!m.ip,
    age_group: m.ageGroup || null,
    email: m.email || null,
    contact: m.contact || null,
    address: m.address || null,
    education: m.education || null,
    work_status: m.workStatus || null,
    registered_sk_voter: m.registeredSKVoter || null,
    registered_national_voter: m.registeredNationalVoter || null,
    attended_assembly: m.attendedAssembly || null,
    archived: !!m.archived,
    verified: m.verified !== false,
    source: m.source || "staff",
    photo_url: m.photoUrl || null,
  };
}
function fromDbMember(r) {
  return {
    id: r.id,
    memberId: r.member_id || "",
    photoUrl: r.photo_url || "",
    barangay: r.barangay,
    lastName: r.last_name,
    firstName: r.first_name,
    middleName: r.middle_name || "",
    suffix: r.suffix || "",
    birthdate: r.birthdate || "",
    age: r.age,
    sex: r.sex || "",
    civilStatus: r.civil_status || "",
    classification: r.classification || [],
    pwd: r.pwd,
    ip: r.ip,
    ageGroup: r.age_group || "",
    email: r.email || "",
    contact: r.contact || "",
    address: r.address || "",
    education: r.education || "",
    workStatus: r.work_status || "",
    registeredSKVoter: r.registered_sk_voter || "",
    registeredNationalVoter: r.registered_national_voter || "",
    attendedAssembly: r.attended_assembly || "",
    archived: r.archived,
    verified: r.verified,
    source: r.source,
  };
}
function toDbOfficial(o) {
  return {
    barangay: o.barangay,
    position: o.position,
    last_name: o.lastName,
    first_name: o.firstName,
    middle_name: o.middleName || null,
    term_start: o.termStart || null,
    term_end: o.termEnd || null,
    contact: o.contact || null,
    email: o.email || null,
  };
}
function fromDbOfficial(r) {
  return {
    id: r.id,
    barangay: r.barangay,
    position: r.position,
    lastName: r.last_name,
    firstName: r.first_name,
    middleName: r.middle_name || "",
    termStart: r.term_start || "",
    termEnd: r.term_end || "",
    contact: r.contact || "",
    email: r.email || "",
  };
}
