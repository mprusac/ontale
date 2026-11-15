-- ONTALE.eu — početna shema baze (SQLite, WAL)
-- Sva vremena su ISO-8601 UTC; datumi izazova su lokalni datumi Europe/Zagreb (YYYY-MM-DD).

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT COLLATE NOCASE UNIQUE,
  password_hash TEXT,
  google_sub    TEXT UNIQUE,
  is_guest      INTEGER NOT NULL DEFAULT 0 CHECK (is_guest IN (0,1)),
  is_blocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0,1)),
  block_reason  TEXT,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT
);

CREATE TABLE profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname      TEXT NOT NULL,
  nickname_norm TEXT NOT NULL UNIQUE,
  avatar        TEXT,
  is_public     INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1))
);

CREATE TABLE admin_users (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- ---------- Sadržaj ----------
CREATE TABLE question_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  emoji      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE question_types (
  id   INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,          -- 'open' | 'numeric'
  name TEXT NOT NULL
);

CREATE TABLE questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER NOT NULL REFERENCES question_categories(id),
  type_id        INTEGER NOT NULL REFERENCES question_types(id),
  text           TEXT NOT NULL,
  hint           TEXT,                 -- pojašnjenje opsega, prikazuje se igraču
  answer_kind    TEXT NOT NULL DEFAULT 'other' CHECK (answer_kind IN ('person','team','country','other')),
  sport_tag      TEXT,                 -- za procjene: iz kojeg je sporta
  difficulty     INTEGER NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  prior_strength REAL,                 -- K: težina početne procjene (NULL = globalna postavka)
  verification   TEXT,                 -- napomena o razini provjere sadržaja
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_questions_category ON questions(category_id);

CREATE TABLE accepted_answers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id      INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  canonical        TEXT NOT NULL,
  norm             TEXT NOT NULL,
  explanation      TEXT,
  prior_popularity REAL NOT NULL DEFAULT 10 CHECK (prior_popularity > 0),
  manual_rarity    REAL CHECK (manual_rarity IS NULL OR (manual_rarity BETWEEN 0 AND 100)),
  checked_at       TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  UNIQUE (question_id, norm)
);
CREATE INDEX idx_answers_question ON accepted_answers(question_id);

CREATE TABLE answer_aliases (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  answer_id INTEGER NOT NULL REFERENCES accepted_answers(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  norm      TEXT NOT NULL,
  UNIQUE (answer_id, norm)
);
CREATE INDEX idx_aliases_answer ON answer_aliases(answer_id);

CREATE TABLE answer_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id   INTEGER REFERENCES accepted_answers(id) ON DELETE CASCADE,  -- NULL = izvor za cijelo pitanje
  title       TEXT NOT NULL,
  url         TEXT,
  note        TEXT
);
CREATE INDEX idx_sources_question ON answer_sources(question_id);

CREATE TABLE numeric_targets (
  question_id     INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  value           REAL NOT NULL,
  unit            TEXT NOT NULL,
  ref_date        TEXT NOT NULL,
  tolerance_pct   REAL NOT NULL DEFAULT 1,
  scoring_mode    TEXT NOT NULL DEFAULT 'pragovi' CHECK (scoring_mode IN ('pragovi','pragovi+najblizi')),
  thresholds_json TEXT,                -- NULL = globalni pragovi
  tie_rule        TEXT NOT NULL DEFAULT 'dijele' CHECK (tie_rule IN ('dijele','raniji')),
  is_estimate     INTEGER NOT NULL DEFAULT 0,  -- 1 = vrijednost nije službena statistika
  note            TEXT
);

-- ---------- Karte ----------
CREATE TABLE maps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  flag       TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cities (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id   INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  nickname TEXT,                       -- humoristični naziv
  label    TEXT,                       -- oznaka na karti (emoji/kratica)
  lat      REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng      REAL NOT NULL CHECK (lng BETWEEN -180 AND 180)
);

CREATE TABLE routes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id   INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  total_km REAL NOT NULL CHECK (total_km > 0),
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE route_checkpoints (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  city_id  INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  is_stop  INTEGER NOT NULL DEFAULT 1, -- 0 = samo točka koja oblikuje putanju
  message  TEXT,                       -- poruka pri prolasku
  UNIQUE (route_id, position)
);

CREATE TABLE transport_sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transport_modes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES transport_sets(id) ON DELETE CASCADE,
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 7),
  name        TEXT NOT NULL,
  emoji       TEXT,
  image       TEXT,
  km          REAL NOT NULL CHECK (km >= 0),
  min_rarity  REAL NOT NULL CHECK (min_rarity BETWEEN 0 AND 100),
  description TEXT,
  UNIQUE (set_id, level)
);

-- ---------- Dnevni izazovi ----------
CREATE TABLE daily_challenges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT 'sve',  -- 'sve' ili slug karte (poseban set za kartu)
  title        TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  finalized_at TEXT,
  UNIQUE (date, scope)
);

CREATE TABLE daily_challenge_questions (
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  question_id  INTEGER NOT NULL REFERENCES questions(id),
  PRIMARY KEY (challenge_id, position)
);
CREATE INDEX idx_dcq_question ON daily_challenge_questions(question_id);

-- ---------- Igra ----------
CREATE TABLE game_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id     INTEGER NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  map_id           INTEGER NOT NULL REFERENCES maps(id),
  official         INTEGER NOT NULL CHECK (official IN (0,1)),
  mode             TEXT NOT NULL CHECK (mode IN ('dnevna','arhiva','ponovno')),
  next_position    INTEGER NOT NULL DEFAULT 1,
  question_count   INTEGER NOT NULL,
  total_km         REAL NOT NULL DEFAULT 0,
  route_km         REAL NOT NULL,
  reached_goal     INTEGER NOT NULL DEFAULT 0,
  transport_set_id INTEGER,
  ip_hash          TEXT,
  started_at       TEXT NOT NULL,
  finished_at      TEXT
);
CREATE UNIQUE INDEX uq_one_official ON game_sessions(user_id, challenge_id, map_id) WHERE official = 1;
CREATE INDEX idx_sessions_board ON game_sessions(challenge_id, map_id, official, total_km DESC);
CREATE INDEX idx_sessions_user ON game_sessions(user_id, official, finished_at);

CREATE TABLE player_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions(id),
  position      INTEGER NOT NULL,
  raw           TEXT NOT NULL,
  norm          TEXT NOT NULL,
  answer_id     INTEGER REFERENCES accepted_answers(id) ON DELETE SET NULL,
  numeric_value REAL,
  error_pct     REAL,
  is_correct    INTEGER NOT NULL DEFAULT 0,
  rarity        REAL,                  -- 0..100
  level         INTEGER NOT NULL DEFAULT 0,
  km            REAL NOT NULL DEFAULT 0,
  counted       INTEGER NOT NULL DEFAULT 0,  -- ulazi li u statistiku rijetkosti
  bonus         INTEGER NOT NULL DEFAULT 0,  -- 1 = najbliža procjena dana
  created_at    TEXT NOT NULL,
  UNIQUE (session_id, position)
);
CREATE INDEX idx_pa_question ON player_answers(question_id, answer_id);
CREATE INDEX idx_pa_norm ON player_answers(question_id, norm);

CREATE TABLE answer_frequency (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id   INTEGER NOT NULL REFERENCES accepted_answers(id) ON DELETE CASCADE,
  players     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (question_id, answer_id)
);

-- jedan igrač = jedan glas po pitanju (sprječava višestruko brojanje preko dviju karata)
CREATE TABLE frequency_voters (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_id   INTEGER,
  ip_hash     TEXT,
  PRIMARY KEY (question_id, user_id)
);
CREATE INDEX idx_voters_ip ON frequency_voters(question_id, ip_hash);

CREATE TABLE daily_streaks (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak    INTEGER NOT NULL DEFAULT 0,
  last_date      TEXT,
  days_played    INTEGER NOT NULL DEFAULT 0
);

-- ---------- Društveno ----------
CREATE TABLE leagues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_hidden  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE league_members (
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (league_id, user_id)
);
CREATE INDEX idx_league_members_user ON league_members(user_id);

CREATE TABLE reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (session_id, user_id)
);

CREATE TABLE answer_reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  player_answer_id INTEGER REFERENCES player_answers(id) ON DELETE SET NULL,
  question_id      INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  raw              TEXT NOT NULL,
  norm             TEXT NOT NULL,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','odobreno','odbijeno')),
  resolution_note  TEXT,
  created_at       TEXT NOT NULL,
  resolved_at      TEXT,
  resolved_by      INTEGER
);
CREATE INDEX idx_reports_status ON answer_reports(status, question_id, norm);

CREATE TABLE content_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('korisnik','liga')),
  target_id   INTEGER NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','rijeseno')),
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE admin_audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at DESC);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,           -- JSON
  updated_at TEXT NOT NULL
);

-- ---------- Pogledi (ljestvice i statistika se uvijek računaju iz službenih partija) ----------
CREATE VIEW leaderboards AS
SELECT s.id AS session_id, c.date, m.slug AS map, s.user_id, p.nickname, p.avatar,
       s.total_km, s.reached_goal, s.finished_at, u.is_guest
FROM game_sessions s
JOIN daily_challenges c ON c.id = s.challenge_id
JOIN maps m ON m.id = s.map_id
JOIN users u ON u.id = s.user_id
JOIN profiles p ON p.user_id = s.user_id
WHERE s.official = 1 AND s.finished_at IS NOT NULL AND u.is_blocked = 0;

CREATE VIEW user_statistics AS
SELECT s.user_id,
       COUNT(*)                       AS games,
       COALESCE(SUM(s.total_km), 0)   AS total_km,
       COALESCE(AVG(s.total_km), 0)   AS avg_km,
       COALESCE(MAX(s.total_km), 0)   AS best_km,
       COALESCE(SUM(s.reached_goal),0) AS goals_reached
FROM game_sessions s
WHERE s.official = 1 AND s.finished_at IS NOT NULL
GROUP BY s.user_id;
