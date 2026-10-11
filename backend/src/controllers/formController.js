import pool from '../config/database.js';
import { isValidNISN, isValidNIK } from '../utils/validators.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// Save Personal Data (Step 2)
export const savePersonalData = async (req, res) => {
  try {
    const { nisn, nik, full_name, gender, birth_place, birth_date, religion, child_number, siblings_count, full_address } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!nisn || !nik || !full_name || !gender || !birth_place || !birth_date) {
      return errorResponse(res, 'Data required harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isValidNISN(nisn)) {
      return errorResponse(res, 'NISN harus 10 digit', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!isValidNIK(nik)) {
      return errorResponse(res, 'NIK harus 16 digit', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    // Check if record exists
    const [existing] = await connection.execute('SELECT id FROM personal_data WHERE user_id = ?', [userId]);

    if (existing.length > 0) {
      // Update
      await connection.execute(
        'UPDATE personal_data SET nisn = ?, nik = ?, full_name = ?, gender = ?, birth_place = ?, birth_date = ?, religion = ?, child_number = ?, siblings_count = ?, full_address = ?, auto_saved = ?, auto_save_time = NOW() WHERE user_id = ?',
        [nisn, nik, full_name, gender, birth_place, birth_date, religion, child_number, siblings_count, full_address, true, userId]
      );
    } else {
      // Insert
      await connection.execute(
        'INSERT INTO personal_data (user_id, nisn, nik, full_name, gender, birth_place, birth_date, religion, child_number, siblings_count, full_address, auto_saved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, nisn, nik, full_name, gender, birth_place, birth_date, religion, child_number, siblings_count, full_address, true]
      );
    }

    connection.release();

    successResponse(res, { auto_saved: true, timestamp: new Date() }, 'Data pribadi tersimpan');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Personal Data
export const getPersonalData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [data] = await connection.execute(
      'SELECT * FROM personal_data WHERE user_id = ?',
      [userId]
    );

    connection.release();

    if (data.length === 0) {
      return successResponse(res, {}, 'Data tidak ditemukan');
    }

    successResponse(res, data[0], 'Data pribadi berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Save Parent Data (Step 3)
export const saveParentData = async (req, res) => {
  try {
    const { father_name, father_occupation, father_education, mother_name, mother_occupation, mother_education, guardian_name, guardian_phone, family_income, parent_address } = req.body;
    const userId = req.user.userId;

    const connection = await pool.getConnection();

    // Check if record exists
    const [existing] = await connection.execute('SELECT id FROM parent_data WHERE user_id = ?', [userId]);

    if (existing.length > 0) {
      // Update
      await connection.execute(
        'UPDATE parent_data SET father_name = ?, father_occupation = ?, father_education = ?, mother_name = ?, mother_occupation = ?, mother_education = ?, guardian_name = ?, guardian_phone = ?, family_income = ?, parent_address = ? WHERE user_id = ?',
        [father_name, father_occupation, father_education, mother_name, mother_occupation, mother_education, guardian_name, guardian_phone, family_income, parent_address, userId]
      );
    } else {
      // Insert
      await connection.execute(
        'INSERT INTO parent_data (user_id, father_name, father_occupation, father_education, mother_name, mother_occupation, mother_education, guardian_name, guardian_phone, family_income, parent_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, father_name, father_occupation, father_education, mother_name, mother_occupation, mother_education, guardian_name, guardian_phone, family_income, parent_address]
      );
    }

    connection.release();

    successResponse(res, {}, 'Data orang tua tersimpan');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get Parent Data
export const getParentData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [data] = await connection.execute(
      'SELECT * FROM parent_data WHERE user_id = ?',
      [userId]
    );

    connection.release();

    if (data.length === 0) {
      return successResponse(res, {}, 'Data tidak ditemukan');
    }

    successResponse(res, data[0], 'Data orang tua berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Save School Data (Step 4)
export const saveSchoolData = async (req, res) => {
  try {
    const { school_name, npsn, school_address, graduation_year, diploma_number, average_score, major_choice } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!school_name || !npsn || !school_address || !graduation_year) {
      return errorResponse(res, 'Data required harus diisi', ERROR_CODES.VALIDATION_ERROR);
    }

    const connection = await pool.getConnection();

    // Check if record exists
    const [existing] = await connection.execute('SELECT id FROM school_data WHERE user_id = ?', [userId]);

    if (existing.length > 0) {
      // Update
      await connection.execute(
        'UPDATE school_data SET school_name = ?, npsn = ?, school_address = ?, graduation_year = ?, diploma_number = ?, average_score = ?, major_choice = ? WHERE user_id = ?',
        [school_name, npsn, school_address, graduation_year, diploma_number, average_score, major_choice, userId]
      );
    } else {
      // Insert
      await connection.execute(
        'INSERT INTO school_data (user_id, school_name, npsn, school_address, graduation_year, diploma_number, average_score, major_choice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, school_name, npsn, school_address, graduation_year, diploma_number, average_score, major_choice]
      );
    }

    connection.release();

    successResponse(res, {}, 'Data sekolah tersimpan');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get School Data
export const getSchoolData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    const [data] = await connection.execute(
      'SELECT * FROM school_data WHERE user_id = ?',
      [userId]
    );

    connection.release();

    if (data.length === 0) {
      return successResponse(res, {}, 'Data tidak ditemukan');
    }

    successResponse(res, data[0], 'Data sekolah berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Get All Registration Data
export const getAllRegistrationData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const connection = await pool.getConnection();

    // Get user data
    const [userData] = await connection.execute(
      'SELECT full_name, email, whatsapp, registration_status, registration_date FROM users WHERE id = ?',
      [userId]
    );

    // Get personal data
    const [personalData] = await connection.execute(
      'SELECT * FROM personal_data WHERE user_id = ?',
      [userId]
    );

    // Get parent data
    const [parentData] = await connection.execute(
      'SELECT * FROM parent_data WHERE user_id = ?',
      [userId]
    );

    // Get school data
    const [schoolData] = await connection.execute(
      'SELECT * FROM school_data WHERE user_id = ?',
      [userId]
    );

    // Get documents
    const [documents] = await connection.execute(
      'SELECT * FROM documents WHERE user_id = ?',
      [userId]
    );

    connection.release();

    successResponse(res, {
      user: userData[0] || {},
      personal_data: personalData[0] || {},
      parent_data: parentData[0] || {},
      school_data: schoolData[0] || {},
      documents: documents || []
    }, 'Data pendaftaran berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};
