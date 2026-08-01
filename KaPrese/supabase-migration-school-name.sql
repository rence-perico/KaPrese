-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- Safe to run even if you already ran an earlier version of this file --
-- every statement below is "add if not exists".

-- 1) Adds the three ISY-related columns so they can actually be saved.
alter table members add column if not exists school_name text;
alter table members add column if not exists grade_level text;
alter table members add column if not exists program text;

-- 2) Your get_member_card(...) function needs to also SELECT and return
--    classification, school_name, grade_level, and program -- otherwise the
--    digital ID card will keep showing them blank even though they're
--    saved correctly in the table.
--
--    Open Database -> Functions -> get_member_card in the Supabase
--    dashboard, copy its current body, and add these lines to the
--    RETURNS TABLE(...) list:
--
--      classification text[],
--      school_name text,
--      grade_level text,
--      program text,
--
--    ...and to the final SELECT:
--
--      m.classification,
--      m.school_name,
--      m.grade_level,
--      m.program,
--
--    If you're not sure how to merge this into your existing function,
--    paste me the current function definition (Database -> Functions ->
--    get_member_card -> copy) and I'll write the exact replacement for you.
