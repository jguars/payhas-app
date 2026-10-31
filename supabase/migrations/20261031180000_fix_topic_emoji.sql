-- The Nature and Space topic emojis were stored mis-encoded (UTF-8 read as
-- Mac Roman: "üåø", "üöÄ"), so a parent's "Latest" list showed
-- "Dudu watched üåø Nature". Written as code points so this file can't be
-- mangled the same way.
update public.interests set emoji = chr(127807) where slug = 'nature'; -- 🌿
update public.interests set emoji = chr(128640) where slug = 'space';  -- 🚀
