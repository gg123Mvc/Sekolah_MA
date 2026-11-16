-- ============================================================
-- MIGRATION: CHATBOT SETTINGS (SUPABASE POSTGRESQL)
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

-- 2. Tabel Riwayat Perubahan Konfigurasi (Audit Trail)
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

-- 3. Seed initial configuration jika tabel kosong
INSERT INTO chatbot_settings (
  provider, 
  model, 
  webhook_enabled, 
  chatbot_mode
) 
SELECT 'groq', 'openai/gpt-oss-20b', false, 'direct'
WHERE NOT EXISTS (SELECT 1 FROM chatbot_settings);
