import pool from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Get All Complaints with Filters and Stats
export const getComplaints = async (req, res) => {
  try {
    const { status, category, date, search } = req.query;

    const connection = await pool.getConnection();

    // 1. Base query for stats
    const [allStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN status = 'Menunggu' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Diproses' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Ditolak' THEN 1 ELSE 0 END) as rejected
      FROM complaints
    `);

    // 2. Query for table list
    let query = `
      SELECT c.*, u.full_name, u.email 
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }
    if (category) {
      query += ` AND c.category = ?`;
      params.push(category);
    }
    if (date) {
      query += ` AND DATE(c.created_at) = ?`;
      params.push(date);
    }
    if (search) {
      query += ` AND (c.ticket_number LIKE ? OR u.full_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.created_at DESC`;

    const [complaints] = await connection.execute(query, params);
    connection.release();

    successResponse(res, {
      stats: {
        total: allStats[0].total || 0,
        today: allStats[0].today || 0,
        pending: allStats[0].pending || 0,
        processing: allStats[0].processing || 0,
        completed: allStats[0].completed || 0,
        rejected: allStats[0].rejected || 0
      },
      complaints
    }, 'Berhasil mengambil data pengaduan');
  } catch (error) {
    console.error('Error fetching complaints:', error);
    errorResponse(res, 'Gagal mengambil data pengaduan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Complaint Detail with Logs
export const getComplaintDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [rows] = await connection.execute(`
      SELECT c.*, u.full_name, u.email 
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [id]);

    if (rows.length === 0) {
      connection.release();
      return errorResponse(res, 'Pengaduan tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    const complaint = rows[0];

    const [logs] = await connection.execute(`
      SELECT * FROM complaint_logs WHERE complaint_id = ? ORDER BY handled_at DESC
    `, [id]);

    connection.release();

    successResponse(res, {
      ...complaint,
      logs
    }, 'Berhasil mengambil detail pengaduan');
  } catch (error) {
    console.error('Error fetching complaint detail:', error);
    errorResponse(res, 'Gagal mengambil detail pengaduan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Update Complaint Status
export const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    const adminName = req.user?.full_name || 'Admin';

    if (!status) {
      return errorResponse(res, 'Status harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();
    
    // Update main table
    await connection.execute(`
      UPDATE complaints 
      SET status = ?, admin_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, admin_note || null, adminName, id]);

    // Insert log
    await connection.execute(`
      INSERT INTO complaint_logs (complaint_id, status, admin_note, handled_by)
      VALUES (?, ?, ?, ?)
    `, [id, status, admin_note || null, adminName]);

    connection.release();

    successResponse(res, null, 'Status pengaduan berhasil diperbarui');
  } catch (error) {
    console.error('Error updating complaint status:', error);
    errorResponse(res, 'Gagal mengupdate status pengaduan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Delete Complaint
export const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    await connection.execute('DELETE FROM complaints WHERE id = ?', [id]);
    // complaint_logs will cascade delete

    connection.release();
    successResponse(res, null, 'Pengaduan berhasil dihapus');
  } catch (error) {
    console.error('Error deleting complaint:', error);
    errorResponse(res, 'Gagal menghapus pengaduan', ERROR_CODES.INTERNAL_ERROR);
  }
};
