-- Sequence and foreign key for bbdo_users.
-- Run AFTER 0003 and after the data migration — both statements depend on the rows existing.

-- Rows arrived from SQL Server with explicit ids, so the table was created without an
-- identity. Attach a sequence now and set it past the highest migrated id, so the next
-- user created by scripts/otp-create-user.mjs gets a fresh id rather than colliding.
create sequence if not exists bbdo_users_id_seq owned by bbdo_users.id;
select setval('bbdo_users_id_seq', (select coalesce(max(id), 0) from bbdo_users));
alter table bbdo_users alter column id set default nextval('bbdo_users_id_seq');

-- The integrity that was impossible while users lived in a different database.
--
-- briefs.user_id has been an unenforced integer pointing at bbdo_users.id since it was
-- created (see the note in 0001_briefs.sql). Now that both tables are in one database,
-- a bad user_id becomes impossible rather than merely unlikely.
--
-- No ON DELETE CASCADE on purpose: the default blocks deleting a user who still has
-- briefs, which is what we want. Access is revoked by setting is_active = false, never
-- by deleting the row — so this should never fire in normal operation.
alter table briefs
  add constraint briefs_user_id_fkey
  foreign key (user_id) references bbdo_users (id);
