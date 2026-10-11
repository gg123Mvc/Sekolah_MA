-- ============================================================
-- Dummy Data untuk Testing SPMB System
-- Import file ini ke database setelah database.sql
-- ============================================================
-- Login Admin  : admin@madrasah.id    / admin123
-- Login Admin2 : verifikator@madrasah.id / verifikator123
-- Login Siswa  : budi.santoso@email.com  / Test1234
-- ============================================================

USE spmb_madrasah;

-- Dummy Admin Users
-- Password: admin123
INSERT IGNORE INTO admin_users (username, email, password, role, created_at) VALUES
('admin', 'admin@madrasah.id', '$2a$10$DHl3XL2kXfSToo85tWPfguZI.VDEdChG6h3lC3tRbvSXaoixcHsPm', 'super_admin', NOW()),
('verifikator', 'verifikator@madrasah.id', '$2a$10$4hsognktNTiF6ej8W0Q3LOMcquaIsc1iF4agvPVhWRVwfCdyWTeL2', 'admin', NOW());

-- Dummy Announcements
INSERT IGNORE INTO announcements (title, content, created_by, created_at) VALUES
(
  'Jadwal SPMB 2026',
  'Berikut jadwal lengkap Penerimaan Murid Baru 2026:\n\n📅 Pendaftaran: 1 - 30 Juni 2026\n📝 Tes Tulis: 15 - 20 Juli 2026\n📢 Pengumuman: 25 Juli 2026\n📋 Daftar Ulang: 1 - 5 Agustus 2026\n\nJangan lewatkan jadwal penting ini!',
  1,
  NOW()
),
(
  'Informasi Biaya Pendaftaran',
  'Biaya Pendaftaran SPMB 2026:\n\n💳 Biaya Pendaftaran: Rp 100.000\n🏢 Biaya Pembangunan: Rp 2.000.000 (bisa cicil)\n📚 SPP: Rp 300.000/bulan\n\nAda program beasiswa untuk siswa berprestasi!\nHubungi kami untuk detail lebih lanjut.',
  1,
  NOW()
),
(
  'Tata Tertib Peserta SPMB',
  'Peserta SPMB wajib memahami dan mematuhi tata tertib berikut:\n\n✓ Hadir tepat waktu\n✓ Berpakaian rapi dan sopan\n✓ Membawa semua dokumen yang diperlukan\n✓ Tidak ada kecurangan dalam ujian\n✓ Mematuhi protokol kesehatan\n\nPelanggaran akan mengakibatkan pembatalan pendaftaran.',
  1,
  NOW()
);

-- Dummy Users (Calon Siswa)
-- Password semua siswa: Test1234
INSERT IGNORE INTO users (registration_number, full_name, email, whatsapp, password, registration_status, created_at) VALUES
('SPMB-2026-001', 'Budi Santoso',    'budi.santoso@email.com',    '081234567890', '$2a$10$qzhPkOR7QUclm/5x.mr5MeoBm16yeYoJG1mXkGPu4nQGXgPcBigde', 'pending',  NOW()),
('SPMB-2026-002', 'Siti Nurhaliza',  'siti.nurhaliza@email.com',  '081234567891', '$2a$10$qzhPkOR7QUclm/5x.mr5MeoBm16yeYoJG1mXkGPu4nQGXgPcBigde', 'pending',  NOW()),
('SPMB-2026-003', 'Ahmad Wijaya',    'ahmad.wijaya@email.com',    '081234567892', '$2a$10$qzhPkOR7QUclm/5x.mr5MeoBm16yeYoJG1mXkGPu4nQGXgPcBigde', 'accepted', NOW());

-- Dummy Personal Data
INSERT IGNORE INTO personal_data (user_id, nisn, nik, full_name, gender, birth_place, birth_date, religion, child_number, siblings_count, full_address, auto_saved, created_at) VALUES
(1, '1234567890', '1234567890123456', 'Budi Santoso',   'laki-laki', 'Jakarta', '2006-01-15', 'Islam', 1, 2, 'Jl. Merdeka No. 123, Jakarta Pusat', true, NOW()),
(2, '1234567891', '1234567891123456', 'Siti Nurhaliza', 'perempuan', 'Bandung', '2006-03-20', 'Islam', 2, 3, 'Jl. Sudirman No. 456, Bandung',     true, NOW()),
(3, '1234567892', '1234567892123456', 'Ahmad Wijaya',   'laki-laki', 'Surabaya','2005-06-10', 'Islam', 1, 1, 'Jl. Ahmad Yani No. 789, Surabaya',  true, NOW());

-- Dummy Parent Data
INSERT IGNORE INTO parent_data (user_id, father_name, father_occupation, father_education, mother_name, mother_occupation, mother_education, guardian_name, guardian_phone, family_income, parent_address, created_at) VALUES
(1, 'Santoso Wijaya', 'PNS',         'S1',  'Siti Rahayu',      'Ibu Rumah Tangga', 'SMA', NULL,           NULL,           'Rp 5 - 10 juta',  'Jl. Merdeka No. 123, Jakarta Pusat', NOW()),
(2, 'Nurdin Ahmad',   'Swasta',      'S1',  'Nuraini Hanifah',  'Guru',             'S1',  'Toto Cahyono', '081234567893', 'Rp 10 - 20 juta', 'Jl. Sudirman No. 456, Bandung',      NOW()),
(3, 'Wijaya Kusuma',  'Wiraswasta',  'SMA', 'Kusuma Dewi',      'Ibu Rumah Tangga', 'SMA', NULL,           NULL,           'Rp 1 - 5 juta',   'Jl. Ahmad Yani No. 789, Surabaya',   NOW());

-- Dummy School Data
INSERT IGNORE INTO school_data (user_id, school_name, npsn, school_address, graduation_year, diploma_number, average_score, major_choice, created_at) VALUES
(1, 'SMP Negeri 1 Jakarta',   '20104001', 'Jl. Pendidikan No. 1, Jakarta',  '2026', 'SKL/2026/001', 8.5, 'IPA',         NOW()),
(2, 'SMP Negeri 5 Bandung',   '20304005', 'Jl. Pendidikan No. 5, Bandung',  '2026', 'SKL/2026/002', 8.8, 'IPS',         NOW()),
(3, 'SMP Negeri 10 Surabaya', '20604010', 'Jl. Pendidikan No. 10, Surabaya','2023', 'SKL/2023/003', 7.9, 'Keagamaan',   NOW());

-- Dummy Chat History
INSERT IGNORE INTO chat_history (user_id, message, response, message_type, created_at) VALUES
(1, 'Apa syarat pendaftaran SPMB?',    'Syarat pendaftaran SPMB adalah lulusan SMP/MTs, memiliki NISN dan NIK, usia maksimal 21 tahun, sehat fisik dan mental.', 'ai_agent', NOW()),
(1, 'Bagaimana cara upload dokumen?', 'Anda dapat upload dokumen di Step 5. Klik atau drag file ke area upload, pilih jenis dokumen, dan tunggu hingga selesai.', 'ai_agent', NOW()),
(2, 'Berapa biaya pendaftaran?',       'Biaya pendaftaran SPMB 2026 adalah Rp 100.000 untuk biaya registrasi.', 'ai_agent', NOW());

-- ============================================================
-- Verifikasi
-- ============================================================
SELECT COUNT(*) as total_admin   FROM admin_users;
SELECT COUNT(*) as total_siswa   FROM users;
SELECT COUNT(*) as total_pengumuman FROM announcements;
SELECT 'Dummy data berhasil diinsert! Semua password siap digunakan.' as STATUS;
