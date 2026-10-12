-- ================================================================
-- SUPABASE POSTGRESQL SCHEMA
-- Sistem SPMB Madrasah Aliyah - MA Bina Cendekia
-- Jalankan script ini di Supabase SQL Editor
-- ================================================================

-- Tabel Users (Akun Pendaftar)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  registration_number VARCHAR(20) UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  whatsapp VARCHAR(15) NOT NULL,
  password VARCHAR(255) NOT NULL,
  registration_status VARCHAR(20) DEFAULT 'pending' CHECK (registration_status IN ('pending', 'revision', 'accepted', 'rejected')),
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Personal Data (Data Pribadi Calon Siswa)
CREATE TABLE IF NOT EXISTS personal_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nisn VARCHAR(10),
  nik VARCHAR(16),
  full_name VARCHAR(100),
  gender VARCHAR(20) CHECK (gender IN ('laki-laki', 'perempuan')),
  birth_place VARCHAR(100),
  birth_date DATE,
  religion VARCHAR(50),
  child_number INT,
  siblings_count INT,
  full_address TEXT,
  auto_saved BOOLEAN DEFAULT false,
  auto_save_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Parent Data (Data Orang Tua / Wali)
CREATE TABLE IF NOT EXISTS parent_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  father_name VARCHAR(100),
  father_occupation VARCHAR(100),
  father_education VARCHAR(100),
  mother_name VARCHAR(100),
  mother_occupation VARCHAR(100),
  mother_education VARCHAR(100),
  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(15),
  family_income VARCHAR(100),
  parent_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel School Data (Data Sekolah Asal)
CREATE TABLE IF NOT EXISTS school_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  school_name VARCHAR(150),
  npsn VARCHAR(10),
  school_address TEXT,
  graduation_year VARCHAR(4),
  diploma_number VARCHAR(50),
  average_score DECIMAL(5, 2),
  major_choice VARCHAR(20) DEFAULT 'IPA' CHECK (major_choice IN ('IPA', 'IPS', 'Keagamaan')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Documents (Dokumen Upload)
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('photo', 'family_card', 'birth_certificate', 'report_card', 'diploma')),
  file_path VARCHAR(255),
  file_name VARCHAR(255),
  file_size INT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, document_type)
);

-- Tabel Revision Notes (Catatan Revisi)
CREATE TABLE IF NOT EXISTS revision_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_name VARCHAR(100),
  revision_message TEXT,
  fields_to_revise JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Chat History (AI Agent & Support)
-- CATATAN: kolom response_time_ms ditambahkan untuk menyimpan waktu respons AI
CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  response TEXT,
  message_type VARCHAR(20) DEFAULT 'ai_agent' CHECK (message_type IN ('ai_agent', 'support')),
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Announcements (Pengumuman SPMB)
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  thumbnail VARCHAR(500),
  created_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Knowledge Base (AI Agent)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(100),
  title VARCHAR(255),
  content TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Complaints (Pengaduan via AI Agent)
CREATE TABLE IF NOT EXISTS complaints (
  id BIGSERIAL PRIMARY KEY,
  ticket_number VARCHAR(30) UNIQUE NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'Low' CHECK (priority IN ('Low', 'Medium', 'High')),
  complaint TEXT,
  summary VARCHAR(255),
  status VARCHAR(30) DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Diproses', 'Selesai', 'Ditolak')),
  admin_note TEXT,
  handled_by VARCHAR(100),
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Complaint Logs (Log Perubahan Status Pengaduan)
CREATE TABLE IF NOT EXISTS complaint_logs (
  id BIGSERIAL PRIMARY KEY,
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status VARCHAR(30),
  admin_note TEXT,
  handled_by VARCHAR(100),
  handled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_status ON users(registration_status);
CREATE INDEX IF NOT EXISTS idx_user_registration_date ON users(registration_date);
CREATE INDEX IF NOT EXISTS idx_personal_data_user ON personal_data(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_data_user ON parent_data(user_id);
CREATE INDEX IF NOT EXISTS idx_school_data_user ON school_data(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_ticket ON complaints(ticket_number);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_logs_complaint ON complaint_logs(complaint_id);

-- ================================================================
-- SEED DATA: Knowledge Base
-- ================================================================
INSERT INTO knowledge_base (category, title, content) VALUES
('Profil', 'Akreditasi', 'Terakreditasi B'),
('Profil', 'Alamat', 'berlokasi di Jl. KH. Wahid Hasyim, Mertapada Wetan, Kec. Astana Japura, Kabupaten Cirebon, Jawa Barat'),
('Jurusan', 'Pilihan Jurusan', 'IPA, IPS, Keagamaan'),
('Biaya', 'Rincian Biaya', 'Daftar 100rb, Bangunan 2jt (cicil), SPP 300rb/bln'),
('Jadwal', 'Jadwal PMB', 'Daftar Juni, Tes Juli, Pengumuman Juli, Daftar Ulang Agustus'),
('Persyaratan', 'Syarat Pendaftaran', 'Lulus SMP, NISN/NIK valid, maks 21 thn'),
('Dokumen', 'Dokumen yang Dibutuhkan', 'KK, Akta, Rapor 7-9, Ijazah'),
('Kontak', 'Informasi Kontak', 'WA 0812-3456-7890, spmb@binacendekia.sch.id'),
('FAQ', 'Cara Daftar', 'Buat akun -> Isi Biodata (S2) -> Orang Tua (S3) -> Sekolah Asal (S4) -> Upload Dokumen (S5) -> Review (S6)')
ON CONFLICT DO NOTHING;

-- ================================================================
-- ROW LEVEL SECURITY (RLS) - PENTING untuk Supabase
-- Karena backend menggunakan service_role key, RLS tidak
-- menghalangi operasi server-side. Tapi aktifkan untuk keamanan.
-- ================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_logs ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PERMISSIONS & GRANTS
-- Memberikan hak akses penuh ke schema public untuk service_role & backend
-- ================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
