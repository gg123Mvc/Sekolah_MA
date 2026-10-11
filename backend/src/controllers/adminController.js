import pool from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Get Dashboard Stats for Admin
export const getAdminStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [totalUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [pendingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE registration_status = "pending"');
    const [acceptedUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE registration_status = "accepted"');
    const [rejectedUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE registration_status = "rejected"');
    const [revisionUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE registration_status = "revision"');

    // Get major distribution
    const [majors] = await connection.execute(
      'SELECT major_choice, COUNT(*) as count FROM school_data GROUP BY major_choice'
    );

    connection.release();

    successResponse(res, {
      total: totalUsers[0].count,
      pending: pendingUsers[0].count,
      accepted: acceptedUsers[0].count,
      rejected: rejectedUsers[0].count,
      revision: revisionUsers[0].count,
      majors: majors
    }, 'Admin stats berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get All Applicants
export const getAllApplicants = async (req, res) => {
  try {
    const { status, search, limit = 10, offset = 0 } = req.query;
    const connection = await pool.getConnection();

    let query = `
      SELECT u.id, u.registration_number, u.full_name, u.email, u.registration_status, u.registration_date,
             sd.major_choice, sd.school_name
      FROM users u
      LEFT JOIN school_data sd ON u.id = sd.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND u.registration_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.registration_number LIKE ? OR u.email LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY u.registration_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [applicants] = await connection.execute(query, params);
    const [totalCount] = await connection.execute('SELECT COUNT(*) as count FROM users');

    connection.release();

    successResponse(res, {
      applicants,
      total: totalCount[0].count
    }, 'Daftar pendaftar berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Applicant Detail
export const getApplicantDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    // User core info
    const [user] = await connection.execute(
      'SELECT id, registration_number, full_name, email, whatsapp, registration_status, registration_date FROM users WHERE id = ?',
      [id]
    );

    if (user.length === 0) {
      connection.release();
      return errorResponse(res, 'Pendaftar tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    // Personal Data
    const [personalData] = await connection.execute(
      'SELECT * FROM personal_data WHERE user_id = ?',
      [id]
    );

    // Parent Data
    const [parentData] = await connection.execute(
      'SELECT * FROM parent_data WHERE user_id = ?',
      [id]
    );

    // School Data
    const [schoolData] = await connection.execute(
      'SELECT * FROM school_data WHERE user_id = ?',
      [id]
    );

    // Documents
    const [documents] = await connection.execute(
      'SELECT * FROM documents WHERE user_id = ?',
      [id]
    );

    // Revision Notes
    const [revisionNotes] = await connection.execute(
      'SELECT * FROM revision_notes WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );

    connection.release();

    successResponse(res, {
      user: user[0],
      personalData: personalData[0] || null,
      parentData: parentData[0] || null,
      schoolData: schoolData[0] || null,
      documents: documents,
      revisionNotes: revisionNotes
    }, 'Detail pendaftar berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Update Applicant Status
export const updateApplicantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body;

    if (!['pending', 'accepted', 'rejected', 'revision'].includes(status)) {
      return errorResponse(res, 'Status tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    await connection.execute(
      'UPDATE users SET registration_status = ? WHERE id = ?',
      [status, id]
    );

    // If status is revision, add a note
    if (status === 'revision' && message) {
      await connection.execute(
        'INSERT INTO revision_notes (user_id, admin_name, revision_message) VALUES (?, ?, ?)',
        [id, req.user.username || 'Admin', message]
      );
    }

    connection.release();

    successResponse(res, {}, `Status pendaftar berhasil diubah menjadi ${status}`);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Manage Announcements
export const getAnnouncements = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [announcements] = await connection.execute(
      'SELECT a.*, au.username as creator_name FROM announcements a LEFT JOIN admin_users au ON a.created_by = au.id ORDER BY a.created_at DESC'
    );
    connection.release();
    successResponse(res, announcements, 'Daftar pengumuman berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, thumbnail } = req.body;
    const adminId = req.user.userId;

    if (!title || !content) {
      return errorResponse(res, 'Judul dan konten harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();
    await connection.execute(
      'INSERT INTO announcements (title, content, thumbnail, created_by) VALUES (?, ?, ?, ?)',
      [title, content, thumbnail || null, adminId]
    );
    connection.release();

    successResponse(res, {}, 'Pengumuman berhasil dibuat', 201);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

export const uploadAnnouncementImage = async (req, res) => {
  try {
    console.log('--- Uploading Announcement Image ---');
    if (!req.file) {
      console.log('No file received');
      return errorResponse(res, 'File gambar harus diupload', ERROR_CODES.VALIDATION_ERROR);
    }
    console.log('File received:', req.file.filename);
    const filePath = `uploads/${req.file.filename}`;
    successResponse(res, { filePath }, 'Gambar berhasil diupload', 201);
  } catch (error) {
    console.error('Upload Error:', error);
    errorResponse(res, 'Terjadi kesalahan saat upload gambar', ERROR_CODES.INTERNAL_ERROR);
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, thumbnail } = req.body;

    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE announcements SET title = ?, content = ?, thumbnail = ? WHERE id = ?',
      [title, content, thumbnail || null, id]
    );
    connection.release();

    successResponse(res, {}, 'Pengumuman berhasil diperbarui');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    await connection.execute('DELETE FROM announcements WHERE id = ?', [id]);
    connection.release();

    successResponse(res, {}, 'Pengumuman berhasil dihapus');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};
