-- ============================================================
-- MIGRATION: CHATBOT SETTINGS & LOGS (SUPABASE POSTGRESQL)
-- ============================================================

-- 1. Tabel Konfigurasi Chatbot Dinamis
CREATE TABLE IF NOT EXISTS chatbot_settings (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'groq', -- 'groq', 'openai', 'gemini', 'openrouter'
  api_key_encrypted TEXT NULL,                  -- Terenkripsi AES-256-GCM
  model VARCHAR(100) NOT NULL DEFAULT 'openai/gpt-oss-20b',
  webhook_url TEXT NULL,                        -- URL Webhook n8n
  webhook_auth_encrypted TEXT NULL,             -- Token / Auth header n8n terenkripsi
  webhook_enabled BOOLEAN NOT NULL DEFAULT false,
  chatbot_mode VARCHAR(20) NOT NULL DEFAULT 'direct', -- 'direct' (Mode 1) atau 'n8n' (Mode 2)
  temperature NUMERIC(3,2) DEFAULT 0.5,
  max_tokens INT DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Logs dan Monitoring Chatbot
CREATE TABLE IF NOT EXISTS chatbot_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NULL,                             -- NULL jika anonymous/guest
  question TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'groq',
  model VARCHAR(100) NOT NULL,
  chatbot_mode VARCHAR(20) NOT NULL DEFAULT 'direct', -- 'direct' atau 'n8n'
  status VARCHAR(20) NOT NULL DEFAULT 'success',      -- 'success', 'error'
  response_time_ms INT NOT NULL DEFAULT 0,
  webhook_status VARCHAR(50) NULL,                    -- status response dari n8n webhook
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Riwayat Perubahan Konfigurasi (Audit Trail)
CREATE TABLE IF NOT EXISTS chatbot_settings_history (
  id SERIAL PRIMARY KEY,
  changed_by VARCHAR(100) NULL,
  provider VARCHAR(50),
  model VARCHAR(100),
  chatbot_mode VARCHAR(20),
  webhook_enabled BOOLEAN,
  changes_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes untuk optimasi query log
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_created_at ON chatbot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_status ON chatbot_logs(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_mode ON chatbot_logs(chatbot_mode);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_user_id ON chatbot_logs(user_id);

-- 5. Seed initial configuration jika tabel kosong
INSERT INTO chatbot_settings (
  provider, 
  model, 
  webhook_enabled, 
  chatbot_mode
) 
SELECT 'groq', 'openai/gpt-oss-20b', false, 'direct'
WHERE NOT EXISTS (SELECT 1 FROM chatbot_settings);
