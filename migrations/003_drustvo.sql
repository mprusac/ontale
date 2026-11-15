-- Verzija 2.3: privatne poruke, putokazi, obavijesti, e-mail podsjetnici, izazovi među prijateljima,
-- tjedne i mjesečne nagrade lige, zvučni zapisi. Migracija samo DODAJE tablice — postojeći podaci ostaju netaknuti.

-- ---------- Postavke korisnika ----------
CREATE TABLE user_prefs (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dm_policy        TEXT NOT NULL DEFAULT 'lige' CHECK (dm_policy IN ('lige','svi','nitko')),
  notif_inapp      INTEGER NOT NULL DEFAULT 1,
  notif_messages   INTEGER NOT NULL DEFAULT 1,
  notif_league     INTEGER NOT NULL DEFAULT 1,
  notif_overtake   INTEGER NOT NULL DEFAULT 1,
  notif_challenges INTEGER NOT NULL DEFAULT 1,
  notif_awards     INTEGER NOT NULL DEFAULT 1,
  notif_daily      INTEGER NOT NULL DEFAULT 1,
  email_reminders  INTEGER NOT NULL DEFAULT 0,      -- izričita privola (zadano isključeno)
  email_messages   INTEGER NOT NULL DEFAULT 0,
  email_consent_at TEXT,                            -- kad je korisnik uključio e-mail
  sound_on         INTEGER,                         -- NULL = nije postavljeno (vrijedi lokalna/zadana vrijednost)
  sound_volume     REAL,
  sound_game       INTEGER,
  sound_notif      INTEGER,
  map_mode         TEXT,
  unsub_token      TEXT UNIQUE,
  updated_at       TEXT
);

CREATE TABLE user_blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

-- ---------- Privatne poruke (razgovor uvijek između dvoje; user_a < user_b) ----------
CREATE TABLE conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL,
  last_message_id INTEGER,
  last_message_at TEXT,
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX idx_conv_a ON conversations(user_a, last_message_at DESC);
CREATE INDEX idx_conv_b ON conversations(user_b, last_message_at DESC);

CREATE TABLE conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id    INTEGER NOT NULL DEFAULT 0,
  hidden_before_id INTEGER NOT NULL DEFAULT 0,      -- „obriši razgovor kod sebe“: starije poruke se ne prikazuju
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

CREATE TABLE private_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  removed_at      TEXT,                              -- uklonio administrator
  removed_by      INTEGER
);
CREATE INDEX idx_pm_conv ON private_messages(conversation_id, id);
CREATE INDEX idx_pm_sender ON private_messages(sender_id, created_at);

CREATE TABLE message_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER NOT NULL REFERENCES private_messages(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','rijeseno','odbaceno')),
  action      TEXT,
  created_at  TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by INTEGER,
  UNIQUE (message_id, reporter_id)
);
CREATE INDEX idx_mreports_status ON message_reports(status, id);

-- ---------- Putokazi (poruka igrača na ruti, jedna po službenoj partiji) ----------
CREATE TABLE route_sign_messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id     INTEGER NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  date           TEXT NOT NULL,
  map_id         INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  km             REAL NOT NULL,
  text           TEXT NOT NULL,
  shape          TEXT NOT NULL DEFAULT 'zeleni' CHECK (shape IN ('zeleni','zuti','plavi','smedi')),
  status         TEXT NOT NULL DEFAULT 'aktivan' CHECK (status IN ('aktivan','uklonjen')),
  edits          INTEGER NOT NULL DEFAULT 0,
  removed_by     INTEGER,
  removed_reason TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_signs_date ON route_sign_messages(date, map_id, status);
CREATE INDEX idx_signs_user ON route_sign_messages(user_id, date);

CREATE TABLE sign_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sign_id     INTEGER NOT NULL REFERENCES route_sign_messages(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','rijeseno','odbaceno')),
  created_at  TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (sign_id, reporter_id)
);

CREATE TABLE sign_hidden (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sign_id INTEGER NOT NULL REFERENCES route_sign_messages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, sign_id)
);

-- ---------- Obavijesti ----------
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,          -- pretek | vodstvo | izgubio-vodstvo | svi-odigrali | poruka | izazov | nagrada | podsjetnik | sustav
  emoji      TEXT,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  data       TEXT,                   -- JSON
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notif_user ON notifications(user_id, id DESC);
CREATE INDEX idx_notif_unread ON notifications(user_id, read_at);

-- Isporuka izvan aplikacije (e-mail). Jedinstveni ključ sprječava dvostruko slanje i nakon ponovnog pokretanja.
CREATE TABLE notification_delivery_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  channel    TEXT NOT NULL DEFAULT 'email',
  kind       TEXT NOT NULL,          -- podsjetnik | poruke | test
  dedupe_key TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL CHECK (status IN ('slanje','poslano','greska','preskoceno')),
  attempts   INTEGER NOT NULL DEFAULT 1,
  detail     TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_delivery_user ON notification_delivery_log(user_id, kind, created_at);

-- Zakazani poslovi: jedinstveni zapis po (posao, ključ) — posao se ne izvodi dvaput ni nakon restarta.
CREATE TABLE job_runs (
  name        TEXT NOT NULL,
  run_key     TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  result      TEXT,
  PRIMARY KEY (name, run_key)
);

-- ---------- Izazovi među prijateljima (uspoređuju se SLUŽBENE partije; ništa ne dodaje kilometre) ----------
CREATE TABLE player_challenges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  map_id        INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'ceka' CHECK (status IN ('ceka','prihvacen','odbijen','istekao','zavrsen','otkazan')),
  winner_id     INTEGER,
  outcome       TEXT,                -- pobjeda | nerijeseno | predaja | nitko
  result        TEXT,                -- JSON: službeni rezultati obje strane (samo za prikaz)
  created_at    TEXT NOT NULL,
  responded_at  TEXT,
  completed_at  TEXT,
  CHECK (challenger_id != opponent_id)
);
CREATE INDEX idx_pc_challenger ON player_challenges(challenger_id, status, date);
CREATE INDEX idx_pc_opponent ON player_challenges(opponent_id, status, date);
CREATE INDEX idx_pc_date ON player_challenges(date, status);

CREATE TABLE challenge_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES player_challenges(id) ON DELETE CASCADE,
  user_id      INTEGER,
  event        TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_ce_challenge ON challenge_events(challenge_id);

-- ---------- Tjedne i mjesečne nagrade lige (zaključene, povijesne) ----------
CREATE TABLE league_awards (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id    INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  period       TEXT NOT NULL CHECK (period IN ('tjedan','mjesec')),
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  category     TEXT NOT NULL,
  rank         INTEGER NOT NULL DEFAULT 1,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nickname     TEXT NOT NULL,        -- ime u trenutku dodjele (povijest ostaje čitljiva)
  value        REAL,
  value_text   TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (league_id, period, period_start, category, rank, user_id)
);
CREATE INDEX idx_awards_league ON league_awards(league_id, period, period_start DESC);
CREATE INDEX idx_awards_user ON league_awards(user_id);

CREATE TABLE award_finalizations (
  league_id    INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,
  period_start TEXT NOT NULL,
  finalized_at TEXT NOT NULL,
  PRIMARY KEY (league_id, period, period_start)
);

-- ---------- Zvučni zapisi koje je dodao administrator (ugrađeni su u kodu) ----------
CREATE TABLE audio_assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  file        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  license     TEXT NOT NULL,
  source      TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);
