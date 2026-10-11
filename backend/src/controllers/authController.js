import pool from '../config/database.js';
import { hashPassword, comparePassword, isValidEmail, isValidWhatsApp, isStrongPassword, generateRegistrationNumber } from '../utils/validators.js';
import { generateToken } from '../utils/jwt.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Register User
export const register = async (req, res) => {
  try {
    const { full_name, email, whatsapp, password, confirmPassword } = req.body;

    // Validation
    if (!full_name || !email || !whatsapp || !password || !confirmPassword) {
      return errorResponse(res, 'Semua field harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isValidEmail(email)) {
      return errorResponse(res, 'Format email tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isValidWhatsApp(whatsapp)) {
      return errorResponse(res, 'Nomor WhatsApp tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isStrongPassword(password)) {
      return errorResponse(res, 'Password minimal 8 karakter', ERROR_CODES.VALIDATION_ERROR);
    }

    if (password !== confirmPassword) {
      return errorResponse(res, 'Password dan konfirmasi password tidak sama', ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if email already exists
    const connection = await pool.getConnection();
    const [existingUser] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
    
    if (existingUser.length > 0) {
      connection.release();
      return errorResponse(res, 'Email sudah terdaftar', ERROR_CODES.CONFLICT);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    const registrationNumber = generateRegistrationNumber();

    // Insert user
    const [result] = await connection.execute(
      'INSERT INTO users (registration_number, full_name, email, whatsapp, password) VALUES (?, ?, ?, ?, ?)',
      [registrationNumber, full_name, email, whatsapp, hashedPassword]
    );

    connection.release();

    const userId = result.insertId;
    const token = generateToken(userId, email, 'user');

    successResponse(res, {
      userId,
      registration_number: registrationNumber,
      email,
      token,
      role: 'user'
    }, 'Registrasi berhasil', 201);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan saat registrasi', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Login User
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return errorResponse(res, 'Email dan password harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    // Get user
    const connection = await pool.getConnection();
    const [users] = await connection.execute(
      'SELECT id, email, password, full_name, registration_number FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      connection.release();
      return errorResponse(res, 'Email atau password salah', ERROR_CODES.UNAUTHORIZED);
    }

    const user = users[0];

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      connection.release();
      return errorResponse(res, 'Email atau password salah', ERROR_CODES.UNAUTHORIZED);
    }

    connection.release();

    const token = generateToken(user.id, user.email, 'user');

    successResponse(res, {
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      registration_number: user.registration_number,
      token,
      role: 'user'
    }, 'Login berhasil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan saat login', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Admin Login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email dan password harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();
    const [admins] = await connection.execute(
      'SELECT id, email, password, username, role FROM admin_users WHERE email = ?',
      [email]
    );

    if (admins.length === 0) {
      connection.release();
      return errorResponse(res, 'Email atau password salah', ERROR_CODES.UNAUTHORIZED);
    }

    const admin = admins[0];
    const isPasswordValid = await comparePassword(password, admin.password);
    
    if (!isPasswordValid) {
      connection.release();
      return errorResponse(res, 'Email atau password salah', ERROR_CODES.UNAUTHORIZED);
    }

    connection.release();

    const token = generateToken(admin.id, admin.email, admin.role);

    successResponse(res, {
      userId: admin.id,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      token
    }, 'Admin login berhasil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan saat login admin', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Current User
export const getCurrentUser = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const connection = await pool.getConnection();
    let user = null;

    if (role === 'admin' || role === 'super_admin') {
      const [admins] = await connection.execute(
        'SELECT id, email, username, role FROM admin_users WHERE id = ?',
        [userId]
      );
      if (admins.length > 0) {
        user = { ...admins[0], full_name: admins[0].username }; // Map username to full_name for UI consistency
      }
    } else {
      const [users] = await connection.execute(
        'SELECT id, email, full_name, registration_number, registration_status, registration_date FROM users WHERE id = ?',
        [userId]
      );
      if (users.length > 0) {
        user = users[0];
      }
    }

    connection.release();

    if (!user) {
      return errorResponse(res, 'User tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    successResponse(res, user, 'Data user berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return errorResponse(res, 'Semua field harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    if (newPassword !== confirmNewPassword) {
      return errorResponse(res, 'Password baru dan konfirmasi tidak sama', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isStrongPassword(newPassword)) {
      return errorResponse(res, 'Password minimal 8 karakter', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();
    const [users] = await connection.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      connection.release();
      return errorResponse(res, 'User tidak ditemukan', ERROR_CODES.NOT_FOUND);
    }

    const isPasswordValid = await comparePassword(oldPassword, users[0].password);
    if (!isPasswordValid) {
      connection.release();
      return errorResponse(res, 'Password lama tidak sesuai', ERROR_CODES.UNAUTHORIZED);
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await connection.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, req.user.userId]
    );

    connection.release();

    successResponse(res, {}, 'Password berhasil diubah');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};
