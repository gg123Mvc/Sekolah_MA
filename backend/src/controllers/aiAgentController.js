import pool from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';
import axios from 'axios';
import { getFormattedKnowledgeBase } from './knowledgeBaseController.js';

// Send Message to AI Agent
export const sendMessageToAI = async (req, res) => {
  try {
    const { message, history } = req.body;
    const user = req.user;

    if (!message || message.trim() === '') {
      return errorResponse(res, 'Pesan tidak boleh kosong', ERROR_CODES.VALIDATION_ERROR);
    }

    const startTime = Date.now();
    let aiResponse = "";
    
    // Interceptor: Deteksi otomatis nomor registrasi atau tiket untuk mempercepat respon 
    // dan menghindari kendala koneksi/timeout dari server AI pihak ketiga
    const msgUpper = message.trim().toUpperCase();
    const ticketMatch = msgUpper.match(/(CMP-\d{8}-\d{5})/);
    const gradMatch = msgUpper.match(/(SPMB-\d{4}-\d{3,4}|REG\d+)/);
    
    // Kata kunci tanpa nomor
    const askGrad = msgUpper.match(/(CEK KELULUSAN|HASIL SELEKSI|STATUS KELULUSAN|PENGUMUMAN|LULUS ATAU TIDAK)/);
    const askTicket = msgUpper.match(/(CEK TIKET|STATUS PENGADUAN|CEK PENGADUAN|LACAK PENGADUAN)/);

    if (ticketMatch) {
      aiResponse = JSON.stringify({ action: 'check_ticket', ticket_number: ticketMatch[1] });
    } else if (gradMatch) {
      aiResponse = JSON.stringify({ action: 'check_graduation', registration_number: gradMatch[1] });
    } else if (askTicket) {
      aiResponse = "Silakan masukkan Nomor Tiket Pengaduan Anda.\n\nContoh:\nCMP-20260710-00015";
    } else if (askGrad) {
      aiResponse = "Silakan masukkan Nomor Registrasi Anda.\n\nContoh:\nSPMB-2026-003";
    } else {
      aiResponse = await callNeoXRAI(message, history);
    }

    // Check for JSON action from AI
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[0]);
        if (actionData.action === 'create_complaint') {
          try {
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
            const connection = await pool.getConnection();
            const [rows] = await connection.execute(
              "SELECT ticket_number FROM complaints WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1",
              [`CMP-${dateStr}-%`]
            );
            
            let nextNum = 1;
            if (rows.length > 0) {
              const lastNum = parseInt(rows[0].ticket_number.split('-')[2]);
              nextNum = lastNum + 1;
            }
            const ticketNumber = `CMP-${dateStr}-${String(nextNum).padStart(5, '0')}`;
            
            const userId = (user && user.userId) ? user.userId : null;
            
            await connection.execute(
              "INSERT INTO complaints (ticket_number, user_id, category, priority, complaint, summary, status) VALUES (?, ?, ?, ?, ?, ?, 'Menunggu')",
              [
                ticketNumber,
                userId,
                actionData.category || 'Lainnya',
                actionData.priority || 'Low',
                actionData.complaint || message,
                actionData.summary || 'Pengaduan pengguna'
              ]
            );
            connection.release();
            
            aiResponse = `====================================================\n\nTerima kasih.\n\nPengaduan Anda telah berhasil dicatat.\n\nNomor Tiket:\n${ticketNumber}\n\nKategori:\n${actionData.category || 'Lainnya'}\n\nStatus:\nMenunggu\n\nSilakan simpan nomor tiket tersebut untuk melakukan pengecekan status melalui MAIRA AI.\n\n====================================================`;
          } catch (dbErr) {
            console.error('Failed to create complaint:', dbErr);
            aiResponse = `Mohon maaf.\n\nSaat ini pengaduan belum dapat diproses karena terjadi gangguan sistem.\n\nSilakan mencoba beberapa saat lagi atau menghubungi Admin SPMB.`;
          }
        } else if (actionData.action === 'check_ticket') {
          try {
            const connection = await pool.getConnection();
            const [rows] = await connection.execute(
              "SELECT * FROM complaints WHERE ticket_number = ?",
              [actionData.ticket_number]
            );
            connection.release();
            
            if (rows.length > 0) {
              const ticket = rows[0];
              const dateObj = new Date(ticket.updated_at);
              const pad = (n) => String(n).padStart(2, '0');
              const updatedAt = `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
              
              aiResponse = `🎫 STATUS PENGADUAN\n\nNomor Tiket\n${ticket.ticket_number}\n\nStatus\n${ticket.status}\n\nCatatan Admin\n${ticket.admin_note || '-'}\n\nTerakhir Diperbarui\n${updatedAt}`;
            } else {
              aiResponse = `Mohon maaf.\n\nNomor Tiket tidak ditemukan.\n\nSilakan periksa kembali Nomor Tiket Pengaduan Anda.`;
            }
          } catch (dbErr) {
            console.error('Failed to check ticket:', dbErr);
            aiResponse = `Mohon maaf. Saat ini pengecekan status belum dapat diproses karena terjadi gangguan sistem. Silakan mencoba beberapa saat lagi.`;
          }
        } else if (actionData.action === 'check_graduation') {
          try {
            const connection = await pool.getConnection();
            const [rows] = await connection.execute(
              `SELECT u.registration_number, u.full_name, u.registration_status, s.major_choice 
               FROM users u 
               LEFT JOIN school_data s ON u.id = s.user_id 
               WHERE u.registration_number = ?`,
              [actionData.registration_number]
            );
            connection.release();
            
            if (rows.length > 0) {
              const user = rows[0];
              let statusText = '';
              let messageText = '';
              
              if (user.registration_status === 'accepted') {
                statusText = '✅ LULUS';
                messageText = 'Selamat. Silakan melakukan daftar ulang sesuai jadwal yang telah ditentukan.';
              } else if (user.registration_status === 'rejected') {
                statusText = '❌ TIDAK LULUS';
                messageText = 'Terima kasih telah mengikuti proses seleksi. Semoga sukses pada kesempatan berikutnya.';
              } else if (user.registration_status === 'revision') {
                statusText = '⚠️ PERLU REVISI';
                messageText = 'Dokumen Anda perlu diperbaiki. Silakan login ke dashboard untuk melihat detail revisi.';
              } else {
                statusText = '⏳ DALAM PROSES / BELUM DIVERIFIKASI';
                messageText = 'Pendaftaran Anda sedang dalam antrean pengecekan oleh panitia. Mohon cek kembali secara berkala.';
              }
              
              aiResponse = `🎓 HASIL SELEKSI PMB\n\nNomor Registrasi\n${user.registration_number}\n\nNama\n${user.full_name}\n\nProgram\n${user.major_choice || '-'}\n\nStatus\n${statusText}\n\n${messageText}`;
            } else {
              aiResponse = `Mohon maaf.\n\nNomor Registrasi tidak ditemukan.\n\nSilakan periksa kembali Nomor Registrasi Anda.`;
            }
          } catch (dbErr) {
            console.error('Failed to check graduation:', dbErr);
            aiResponse = `Mohon maaf. Saat ini pengecekan kelulusan belum dapat diproses karena terjadi gangguan sistem. Silakan mencoba beberapa saat lagi.`;
          }
        } else if (actionData.action === 'check_route') {
          // Fitur cek jarak hanya tersedia melalui GPS perangkat.
          // AI diarahkan untuk tidak memproses lokasi manual — pesan ini adalah fallback jika AI salah merespons.
          aiResponse = "📍 **Cek Jarak ke Sekolah**\n\nUntuk menghitung jarak dari lokasi Anda ke sekolah, silakan gunakan fitur **Cek Jarak** yang tersedia di halaman ini.\n\nFitur tersebut akan meminta izin akses lokasi GPS perangkat Anda untuk menentukan titik awal secara akurat.\n\nJarak dan estimasi waktu perjalanan akan dihitung secara otomatis setelah izin diberikan.";
        }
      } catch(e) {
        // Not a valid JSON or not our action format, just continue with original response
      }
    }

    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    // Save to DB only if user is logged in
    if (user && user.userId) {
      const connection = await pool.getConnection();
      await connection.execute(
        'INSERT INTO chat_history (user_id, message, response, message_type, response_time_ms) VALUES (?, ?, ?, ?, ?)',
        [user.userId, message, aiResponse, 'ai_agent', responseTimeMs]
      );
      connection.release();
    }

    successResponse(res, {
      user_message: message,
      ai_response: aiResponse,
      timestamp: new Date(),
      response_time_ms: responseTimeMs
    }, 'Pesan berhasil dikirim');

  } catch (error) {
    console.error('AI Agent Error:', error);
    const status = error?.response?.status || 500;
    const errorMessage = error?.response?.data?.message || error.message || 'Gagal memproses pesan';
    errorResponse(res, `Gagal memproses pesan (Status ${status}): ${errorMessage}`, ERROR_CODES.INTERNAL_ERROR);
  }
};

// Call NeoXR GPT-4 API
const callNeoXRAI = async (message, history = []) => {
  const apiKey = process.env.API_NEOXR;
  if (!apiKey) {
    throw new Error('API_NEOXR tidak ditemukan dalam konfigurasi environment (.env)');
  }
  const url = "https://api.neoxr.eu/api/gpt4";

  let historyText = "";
  if (Array.isArray(history) && history.length > 0) {
    historyText = "\n\nRiwayat Percakapan Sebelumnya:\n" + history.map(h => {
      const aiTruncated = h.ai ? (h.ai.length > 250 ? h.ai.substring(0, 250) + '...' : h.ai) : '';
      return `User: ${h.user}\nMAIRA AI: ${aiTruncated}`;
    }).join("\n");
  }

  // Ambil knowledge base dari database
  const knowledgeBaseText = await getFormattedKnowledgeBase();

  const systemPrompt = `Nama Anda adalah MAIRA AI (Madrasah AI Response Assistant), asisten virtual resmi MA Bina Cendekia.
Tugas utama Anda adalah memberikan layanan informasi dan menerima pengaduan terkait Sistem Penerimaan Murid Baru (SPMB).

=========================================================
ATURAN UMUM
=========================================================
1. Jawab:
${knowledgeBaseText}
2. JANGAN buat info di luar Knowledge Base.
3. Gunakan bahasa sopan & profesional.
4. Jika ada keluhan/error (PENGADUAN), ikuti aturan di bawah.
=========================================================
PRIORITAS PERINTAH (TIDAK BOLEH PAKAI KNOWLEDGE BASE)
=========================================================
1. Cek Kelulusan
2. Cek Status Pengaduan
3. Jarak/Rute
4. Buat Pengaduan

=========================================================
=========================================================
IDENTIFIKASI & PENANGANAN PENGADUAN
=========================================================
Pesan keluhan/error sistem (misal: gagal login/daftar, web error, kritik) = PENGADUAN.
AI menentukan otomatis: Category, Priority (High/Medium/Low), dan Summary.
JANGAN MINTA pengguna mengisi format JSON/kategori. HANYA minta info kurang (misal No. Registrasi).
Jika lengkap, AI merespons HANYA dengan JSON internal (tanpa teks lain):
{
    "action":"create_complaint",
    "category":"Upload Dokumen",
    "priority":"Medium",
    "complaint":"<pesan pengguna>",
    "summary":"<ringkasan singkat>"
}

=========================================================
=========================================================
DETEKSI NOMOR REGISTRASI (CEK KELULUSAN)
=========================================================
Nomor Registrasi format SPMB-XXXX-XXX atau REGXXXX.
Jika pengguna menyebut No. Registrasi ATAU meminta cek kelulusan + nomornya, AI WAJIB merespons HANYA dengan JSON:
{
    "action":"check_graduation",
    "registration_number":"<nomor>"
}
JANGAN jawab dengan Knowledge Base atau teks lain.
Jika minta cek tanpa nomor, minta nomor registrasinya.

=========================================================
PENGECEKAN STATUS PENGADUAN
=========================================================
Nomor Tiket format CMP-XXXX.
Jika ada kata "cek tiket", "status pengaduan" ATAU menyebut Nomor Tiket, AI WAJIB merespons HANYA dengan JSON:
{
   "action":"check_ticket",
   "ticket_number":"<nomor>"
}
Jika minta cek tanpa nomor tiket, minta nomornya.

=========================================================
PENGECEKAN JARAK DAN RUTE KE SEKOLAH
=========================================================
Jika pengguna bertanya tentang jarak, rute, atau lokasi ke sekolah (misal: "berapa jarak ke sekolah?", "cek jarak saya ke sekolah", "rute dari tempat saya ke sekolah"), AI WAJIB merespons dengan teks panduan berikut:

"📍 Untuk mengecek jarak dari lokasi Anda ke sekolah, silakan gunakan fitur **Cek Jarak** yang tersedia di halaman ini. Fitur tersebut menggunakan GPS perangkat Anda untuk menentukan lokasi secara akurat, lalu menghitung jarak dan estimasi waktu perjalanan ke MA Bina Cendekia secara otomatis. Cukup klik tombol **Cek Jarak** dan berikan izin akses lokasi ketika diminta."

AI DILARANG KERAS:
- Meminta pengguna memasukkan nama desa, kecamatan, atau lokasi secara manual.
- Mengaku sudah mengetahui lokasi pengguna sebelum GPS berhasil memperoleh koordinat.
- Memberikan hasil jarak atau estimasi waktu tanpa data koordinat GPS nyata.
- Menawarkan lokasi patokan manual sebagai alternatif.
=========================================================
PRIORITAS ACTION & Knowledge Base
=========================================================
1. No Tiket (CMP-xxxx) → check_ticket
2. No Registrasi (SPMB-xxxx / REGxxxx) → check_graduation
3. Jarak/Rute → Arahkan ke fitur Cek Jarak GPS (teks panduan, BUKAN JSON)
4. Pengaduan → create_complaint
5. Selain itu → Knowledge Base
=========================================================
${historyText}

Tanya: ${message}`;

  try {
    const response = await axios.get(url, {
      params: {
        q: systemPrompt,
        apikey: apiKey
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 30000 
    });

    // NeoXR response parsing
    let text = '';
    if (response.data && response.data.status) {
      if (typeof response.data.data === 'object' && response.data.data.message) {
        text = response.data.data.message;
      } else if (typeof response.data.data === 'string') {
        text = response.data.data;
      }
    }

    if (!text) {
      console.error('NeoXR Invalid Response Format:', JSON.stringify(response.data));
      throw new Error('Format respons AI tidak valid atau kosong');
    }
    
    return String(text);
  } catch (err) {
    console.error('NeoXR API Call Error:', err.message);
    throw err;
  }
};

// Get Chat History
export const getChatHistory = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user || !user.userId) {
      return successResponse(res, [], 'Guest history empty');
    }

    const connection = await pool.getConnection();
    const [chatHistory] = await connection.execute(
      'SELECT user_id, message, response, message_type, created_at, response_time_ms FROM chat_history WHERE user_id = ? ORDER BY created_at ASC LIMIT 50',
      [user.userId]
    );
    connection.release();
    successResponse(res, chatHistory, 'Chat history berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Clear Chat History
export const clearChatHistory = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      return successResponse(res, {}, 'Guest chat history cleared');
    }

    const connection = await pool.getConnection();
    await connection.execute('DELETE FROM chat_history WHERE user_id = ?', [user.userId]);
    connection.release();
    successResponse(res, {}, 'Chat history berhasil dihapus');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Calculate Distance from GPS Coordinates (GPS-only, no manual input)
export const calculateDistanceFromGPS = async (req, res) => {
  try {
    const { userLat, userLon, accuracy } = req.body;

    // Validasi koordinat
    if (userLat === undefined || userLon === undefined) {
      return errorResponse(res, 'Koordinat lokasi pengguna tidak tersedia', ERROR_CODES.VALIDATION_ERROR);
    }

    const lat = parseFloat(userLat);
    const lon = parseFloat(userLon);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return errorResponse(res, 'Koordinat GPS tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    // Koordinat sekolah (dapat dikonfigurasi via environment variable)
    const schoolLat = parseFloat(process.env.SCHOOL_LAT) || -6.8133266;
    const schoolLon = parseFloat(process.env.SCHOOL_LON) || 108.6177609;
    const schoolName = process.env.SCHOOL_NAME || 'MA Bina Cendekia';

    // Hitung jarak garis lurus (Haversine) sebagai referensi
    const R = 6371; // Radius bumi dalam km
    const dLat = (schoolLat - lat) * Math.PI / 180;
    const dLon = (schoolLon - lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(schoolLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const straightLineKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Hitung jarak rute via OSRM
    let routeData = null;
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${schoolLon},${schoolLat}?overview=false`;
      const routeRes = await axios.get(osrmUrl, { timeout: 10000 });

      if (routeRes.data && routeRes.data.code === 'Ok' && routeRes.data.routes.length > 0) {
        const route = routeRes.data.routes[0];
        routeData = {
          distanceKm: parseFloat((route.distance / 1000).toFixed(1)),
          durationMinutes: Math.round(route.duration / 60),
          mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lon}&destination=${schoolLat},${schoolLon}`
        };
      }
    } catch (osrmErr) {
      console.error('OSRM routing error:', osrmErr.message);
      // Routing gagal, kembalikan data garis lurus saja
    }

    successResponse(res, {
      straightLineKm: parseFloat(straightLineKm.toFixed(1)),
      route: routeData,
      school: { name: schoolName, lat: schoolLat, lon: schoolLon },
      accuracy: accuracy || null
    }, 'Jarak berhasil dihitung');

  } catch (error) {
    console.error('Calculate Distance Error:', error);
    errorResponse(res, 'Gagal menghitung jarak', ERROR_CODES.INTERNAL_ERROR);
  }
};
