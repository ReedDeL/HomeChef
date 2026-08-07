-- ---------------------------------------------------------------------------
-- Security hardening: display_name length constraint.
--
-- profiles.display_name is populated from raw_user_meta_data in the signup
-- trigger and editable by the user via their own profile. Without a length
-- cap, a malicious signup could store an arbitrarily long string. 100 chars
-- is generous for a display name and matches typical UI text-field limits.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR length(display_name) <= 100);
