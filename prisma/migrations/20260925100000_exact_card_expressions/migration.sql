-- Preserve punctuation and character width: only case and whitespace are ignored.
-- Original text is authoritative; old normalization discarded punctuation.
-- Unicode root case mapping is independent of the database/server locale.
UPDATE messaging_expression
SET normalized = lower(btrim(regexp_replace(text, '[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', 'g')) COLLATE "und-x-icu");
