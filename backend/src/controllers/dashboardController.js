import pool from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Get Dashboard Data untuk Calon Siswa
export const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    // Get user info
    const [userInfo] = await connection.execute(
      'SELECT full_name, email, registration_number, registration_status, registration_date FROM users WHERE id = ?',
      [userId]
    );

    // Get completion status
    const [personalData] = await connection.execute(
      'SELECT id FROM personal_data WHERE user_id = ?',
      [userId]
    );

    const [parentData] = await connection.execute(
      'SELECT id FROM parent_data WHERE user_id = ?',
      [userId]
    );

    const [schoolData] = await connection.execute(
      'SELECT id FROM school_data WHERE user_id = ?',
      [userId]
    );

    const [documents] = await connection.execute(
      'SELECT COUNT(*) as count FROM documents WHERE user_id = ?',
      [userId]
    );

    // Get announcements
    const [announcements] = await connection.execute(
      'SELECT id, title, content, created_at FROM announcements ORDER BY created_at DESC LIMIT 5'
    );

    connection.release();

    const completionStatus = {
      personal_data: personalData.length > 0,
      parent_data: parentData.length > 0,
      school_data: schoolData.length > 0,
      documents: documents[0].count >= 5, // Minimal 5 dokumen
      completion_percentage: Math.round(
        ((personalData.length > 0 ? 1 : 0) +
         (parentData.length > 0 ? 1 : 0) +
         (schoolData.length > 0 ? 1 : 0) +
         (documents[0].count >= 5 ? 1 : 0)) / 4 * 100
      )
    };

    successResponse(res, {
      user: userInfo[0] || {},
      completion: completionStatus,
      announcements: announcements || []
    }, 'Dashboard data berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Announcements
export const getAnnouncements = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [announcements] = await connection.execute(
      'SELECT id, title, content, thumbnail, created_at FROM announcements ORDER BY created_at DESC'
    );

    connection.release();

    successResponse(res, announcements, 'Pengumuman berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Announcement Detail
export const getAnnouncementDetail = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const connection = await pool.getConnection();

    const [announcement] = await connection.execute(
      'SELECT * FROM announcements WHERE id = ?',
      [announcementId]
    );

    connection.release();

    if (announcement.length === 0) {
      return errorResponse(res, 'Pengumuman tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    successResponse(res, announcement[0], 'Pengumuman berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Edit Registration Data
export const editRegistrationData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { step, data } = req.body;

    if (!step || !data) {
      return errorResponse(res, 'Step dan data harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    if (step === 2) {
      // Edit personal data
      await connection.execute(
        'UPDATE personal_data SET nisn = ?, nik = ?, full_name = ?, gender = ?, birth_place = ?, birth_date = ?, religion = ?, child_number = ?, siblings_count = ?, full_address = ? WHERE user_id = ?',
        [data.nisn, data.nik, data.full_name, data.gender, data.birth_place, data.birth_date, data.religion, data.child_number, data.siblings_count, data.full_address, userId]
      );
    } else if (step === 3) {
      // Edit parent data
      await connection.execute(
        'UPDATE parent_data SET father_name = ?, father_occupation = ?, father_education = ?, mother_name = ?, mother_occupation = ?, mother_education = ?, guardian_name = ?, guardian_phone = ?, family_income = ?, parent_address = ? WHERE user_id = ?',
        [data.father_name, data.father_occupation, data.father_education, data.mother_name, data.mother_occupation, data.mother_education, data.guardian_name, data.guardian_phone, data.family_income, data.parent_address, userId]
      );
    } else if (step === 4) {
      // Edit school data
      await connection.execute(
        'UPDATE school_data SET school_name = ?, npsn = ?, school_address = ?, graduation_year = ?, diploma_number = ?, average_score = ?, major_choice = ? WHERE user_id = ?',
        [data.school_name, data.npsn, data.school_address, data.graduation_year, data.diploma_number, data.average_score, data.major_choice, userId]
      );
    }

    // Change status back to pending if was revision
    await connection.execute(
      'UPDATE users SET registration_status = "pending" WHERE id = ? AND registration_status = "revision"',
      [userId]
    );

    connection.release();

    successResponse(res, {}, 'Data berhasil diperbarui');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Download Registration Certificate
export const downloadRegistrationCertificate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [user] = await connection.execute(
      'SELECT registration_number, full_name, registration_date FROM users WHERE id = ?',
      [userId]
    );

    connection.release();

    if (user.length === 0) {
      return errorResponse(res, 'User tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    // Generate PDF atau berikan data untuk download
    const certificateData = {
      registration_number: user[0].registration_number,
      full_name: user[0].full_name,
      registration_date: user[0].registration_date,
      download_url: `/api/certificates/${user[0].registration_number}.pdf`
    };

    successResponse(res, certificateData, 'Sertifikat siap diunduh');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};
