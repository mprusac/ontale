-- Faza 2: tajmeri po pitanju, ponovni pokušaji, produžene rute.
-- Migracija je inkrementalna: ne briše korisnike, partije ni pitanja.

-- Tajmer trenutnog pitanja (ms od epohe; autoritativno na poslužitelju).
ALTER TABLE game_sessions ADD COLUMN q_started_at INTEGER;
ALTER TABLE game_sessions ADD COLUMN q_prep_end INTEGER;
ALTER TABLE game_sessions ADD COLUMN q_deadline INTEGER;
ALTER TABLE game_sessions ADD COLUMN q_draft TEXT;          -- zadnja spremljena procjena (brojčana pitanja)

-- Ishod pitanja: 'tocno' | 'netocno' | 'isteklo'
ALTER TABLE player_answers ADD COLUMN status TEXT NOT NULL DEFAULT 'tocno';
UPDATE player_answers SET status = CASE WHEN is_correct = 1 THEN 'tocno' ELSE 'netocno' END;
ALTER TABLE player_answers ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE player_answers ADD COLUMN answer_ms INTEGER;    -- vrijeme od kraja pripreme do konačnog odgovora

-- Neprepoznati pokušaji: ne troše pitanje, ne ulaze u učestalost, služe prijavama i uredništvu.
CREATE TABLE answer_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  raw         TEXT NOT NULL,
  norm        TEXT NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,   -- 1 = odgovor je naknadno dodan u bazu
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_attempts_session ON answer_attempts(session_id, position);
CREATE INDEX idx_attempts_question ON answer_attempts(question_id, norm);

-- Dosadašnji netočni odgovori postaju pokušaji, da ih uredništvo vidi na istom mjestu.
INSERT INTO answer_attempts (session_id, question_id, position, raw, norm, created_at)
SELECT session_id, question_id, position, raw, norm, created_at
FROM player_answers WHERE is_correct = 0 AND numeric_value IS NULL AND raw != '';

ALTER TABLE answer_reports ADD COLUMN session_id INTEGER;
ALTER TABLE answer_reports ADD COLUMN position INTEGER;
UPDATE answer_reports SET session_id = (SELECT session_id FROM player_answers pa WHERE pa.id = answer_reports.player_answer_id),
                          position   = (SELECT position FROM player_answers pa WHERE pa.id = answer_reports.player_answer_id)
WHERE player_answer_id IS NOT NULL;

-- Rute: glavno odredište (cilj) više nije kraj karte; točke iza cilja su nastavak u susjednu državu.
ALTER TABLE cities ADD COLUMN country TEXT;                               -- oznaka države, npr. 'hr', 'ba', 'me'
ALTER TABLE route_checkpoints ADD COLUMN is_goal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routes ADD COLUMN ext_km REAL NOT NULL DEFAULT 0;            -- virtualni kilometri nastavka iza cilja
ALTER TABLE routes ADD COLUMN real_km REAL;                               -- stvarna cestovna udaljenost (samo informativno)
UPDATE route_checkpoints SET is_goal = 1
WHERE position = (SELECT MAX(x.position) FROM route_checkpoints x WHERE x.route_id = route_checkpoints.route_id);
UPDATE cities SET country = (SELECT m.slug FROM maps m WHERE m.id = cities.map_id) WHERE country IS NULL;
