import pool from '../config/database.js';

class KnowledgeBase {
  // Ambil semua data (untuk admin dashboard)
  static async getAll() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM knowledge_base ORDER BY category ASC, created_at DESC'
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  // Ambil hanya data aktif (untuk AI Agent)
  static async getActive() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM knowledge_base WHERE status = 'active' ORDER BY category ASC"
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  // Ambil data berdasarkan ID
  static async getById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM knowledge_base WHERE id = ?',
        [id]
      );
      return rows[0];
    } finally {
      connection.release();
    }
  }

  // Tambah data baru
  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const { category, title, content, status } = data;
      const [result] = await connection.execute(
        'INSERT INTO knowledge_base (category, title, content, status) VALUES (?, ?, ?, ?)',
        [category, title, content, status || 'active']
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  // Update data
  static async update(id, data) {
    const connection = await pool.getConnection();
    try {
      const { category, title, content, status } = data;
      const [result] = await connection.execute(
        'UPDATE knowledge_base SET category = ?, title = ?, content = ?, status = ? WHERE id = ?',
        [category, title, content, status, id]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  // Hapus data
  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM knowledge_base WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  // Ubah status (active/inactive)
  static async toggleStatus(id, status) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE knowledge_base SET status = ? WHERE id = ?',
        [status, id]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }
}

export default KnowledgeBase;
