import pool from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Upload Document (Step 5)
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'File harus diupload', ERROR_CODES.VALIDATION_ERROR);
    }

    const { document_type } = req.body;
    const userId = req.user.userId;

    if (!document_type || !['photo', 'family_card', 'birth_certificate', 'report_card', 'diploma'].includes(document_type)) {
      return errorResponse(res, 'Tipe dokumen tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    // Check if document type already exists
    const [existing] = await connection.execute(
      'SELECT id FROM documents WHERE user_id = ? AND document_type = ?',
      [userId, document_type]
    );

    const filePath = `uploads/${req.file.filename}`;

    if (existing.length > 0) {
      // Update
      await connection.execute(
        'UPDATE documents SET file_path = ?, file_name = ?, file_size = ?, upload_date = NOW() WHERE user_id = ? AND document_type = ?',
        [filePath, req.file.filename, req.file.size, userId, document_type]
      );
    } else {
      // Insert
      await connection.execute(
        'INSERT INTO documents (user_id, document_type, file_path, file_name, file_size) VALUES (?, ?, ?, ?, ?)',
        [userId, document_type, filePath, req.file.filename, req.file.size]
      );
    }

    connection.release();

    successResponse(res, {
      document_type,
      file_name: req.file.filename,
      file_size: req.file.size,
      file_path: filePath
    }, 'Dokumen berhasil diupload', 201);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan saat upload', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Uploaded Documents
export const getUploadedDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [documents] = await connection.execute(
      'SELECT id, document_type, file_name, file_size, file_path, upload_date FROM documents WHERE user_id = ?',
      [userId]
    );

    connection.release();

    successResponse(res, documents, 'Dokumen berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Delete Document
export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId;

    const connection = await pool.getConnection();

    // Verify ownership
    const [doc] = await connection.execute(
      'SELECT user_id FROM documents WHERE id = ?',
      [documentId]
    );

    if (doc.length === 0 || doc[0].user_id !== userId) {
      connection.release();
      return errorResponse(res, 'Dokumen tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    await connection.execute('DELETE FROM documents WHERE id = ?', [documentId]);

    connection.release();

    successResponse(res, {}, 'Dokumen berhasil dihapus');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Submit Registration (Step 6)
export const submitRegistration = async (req, res) => {
  try {
    const { confirmation_agreed } = req.body;
    const userId = req.user.userId;

    if (!confirmation_agreed) {
      return errorResponse(res, 'Anda harus menyetujui pernyataan', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    // Check if all required data is filled
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
      'SELECT id FROM documents WHERE user_id = ?',
      [userId]
    );

    if (personalData.length === 0 || parentData.length === 0 || schoolData.length === 0 || documents.length === 0) {
      connection.release();
      return errorResponse(res, 'Semua data dan dokumen harus dilengkapi', ERROR_CODES.VALIDATION_ERROR);
    }

    // Update status menjadi pending verification
    await connection.execute(
      'UPDATE users SET registration_status = "pending" WHERE id = ?',
      [userId]
    );

    connection.release();

    successResponse(res, {
      status: 'pending',
      message: 'Pendaftaran berhasil disubmit menunggu verifikasi admin'
    }, 'Pendaftaran berhasil disubmit');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan saat submit', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Registration Status
export const getRegistrationStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [user] = await connection.execute(
      'SELECT registration_number, registration_status, registration_date FROM users WHERE id = ?',
      [userId]
    );

    if (user.length === 0) {
      connection.release();
      return errorResponse(res, 'User tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    // Get revision notes if status is revision
    let revisionNotes = null;
    if (user[0].registration_status === 'revision') {
      const [notes] = await connection.execute(
        'SELECT * FROM revision_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      revisionNotes = notes[0] || null;
    }

    connection.release();

    successResponse(res, {
      ...user[0],
      revision_notes: revisionNotes
    }, 'Status pendaftaran berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};
