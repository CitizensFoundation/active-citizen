CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  audio_data TEXT NOT NULL,
  chat_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);