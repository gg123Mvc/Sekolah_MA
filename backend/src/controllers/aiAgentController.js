import supabase from '../config/database.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';
import axios from 'axios';
import { getFormattedKnowledgeBase } from './knowledgeBaseController.js';
import ChatbotSettings from '../models/chatbotSettingsModel.js';
import { decrypt } from '../utils/encryption.js';
import { validateWebhookUrl } from '../utils/ssrfProtection.js';

// Send Message to AI Agent
export const sendMessageToAI = async (req, res) => {
  const startTime = Date.now();
  let currentSettings = null;
  let activeMode = 'direct';
  let activeProvider = 'groq';
  let activeModel = 'openai/gpt-oss-20b';
  let webhookStatus = null;

  try {
    const { message, history } = req.body;
    const user = req.user;

    if (!message || message.trim() === '') {
      return errorResponse(res, 'Pesan tidak boleh kosong', ERROR_CODES.VALIDATION_ERROR);
    }

    // Ambil konfigurasi dinamis dari database (jika ada)
    currentSettings = await ChatbotSettings.getActive();
    activeProvider = currentSettings?.provider || 'groq';
    activeModel = currentSettings?.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    activeMode = currentSettings?.chatbot_mode || 'direct';

    let aiResponse = "";
    
    // Interceptor: Deteksi otomatis nomor registrasi atau tiket untuk mempercepat respon 
    const msgUpper = message.trim().toUpperCase();
    const ticketMatch = msgUpper.match(/(CMP-\d{8}-\d{5})/);
    const gradMatch = msgUpper.match(/(SPMB-\d{4}-\d{3,4}|REG\d+)/);
    
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
      // Jalankan sesuai mode chatbot yang dikonfigurasi admin
      if (activeMode === 'n8n' && currentSettings?.webhook_enabled && currentSettings?.webhook_url) {
        try {
          const webhookResult = await callN8NWebhook(message, history, currentSettings, user);
          aiResponse = webhookResult.response;
          webhookStatus = `HTTP ${webhookResult.httpStatus || 200}`;
        } catch (webhookErr) {
          console.warn('Webhook n8n gagal, beralih otomatis ke AI Provider:', webhookErr.message);
          webhookStatus = `Error: ${webhookErr.message.slice(0, 100)}`;
          // Fallback ke AI Provider langsung agar chatbot tidak berhenti bekerja
          aiResponse = await callAIProvider(message, history, currentSettings);
        }
      } else {
        aiResponse = await callAIProvider(message, history, currentSettings);
      }
    }

    // Check for JSON action from AI
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[0]);
        if (actionData.action === 'create_complaint') {
          try {
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');

            let nextNum = 1;
            if (supabase) {
              // Get last ticket number for today
              const { data: lastTicket } = await supabase
                .from('complaints')
                .select('ticket_number')
                .like('ticket_number', `CMP-${dateStr}-%`)
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (lastTicket) {
                const lastNum = parseInt(lastTicket.ticket_number.split('-')[2]);
                nextNum = lastNum + 1;
              }
            }
            const ticketNumber = `CMP-${dateStr}-${String(nextNum).padStart(5, '0')}`;
            
            const userId = (user && user.userId) ? user.userId : null;
            
            if (supabase) {
              const { error: insertError } = await supabase.from('complaints').insert({
                ticket_number: ticketNumber,
                user_id: userId,
                category: actionData.category || 'Lainnya',
                priority: actionData.priority || 'Low',
                complaint: actionData.complaint || message,
                summary: actionData.summary || 'Pengaduan pengguna',
                status: 'Menunggu'
              });

              if (insertError) throw insertError;
            }
            
            aiResponse = `====================================================\n\nTerima kasih.\n\nPengaduan Anda telah berhasil dicatat.\n\nNomor Tiket:\n${ticketNumber}\n\nKategori:\n${actionData.category || 'Lainnya'}\n\nStatus:\nMenunggu\n\nSilakan simpan nomor tiket tersebut untuk melakukan pengecekan status melalui MAIRA AI.\n\n====================================================`;
          } catch (dbErr) {
            console.error('Failed to create complaint:', dbErr);
            aiResponse = `Mohon maaf.\n\nSaat ini pengaduan belum dapat diproses karena terjadi gangguan sistem.\n\nSilakan mencoba beberapa saat lagi atau menghubungi Admin SPMB.`;
          }
        } else if (actionData.action === 'check_ticket') {
          try {
            let ticket = null;
            if (supabase) {
              const { data, error } = await supabase
                .from('complaints')
                .select('*')
                .eq('ticket_number', actionData.ticket_number)
                .maybeSingle();

              if (error) throw error;
              ticket = data;
            }
            
            if (ticket) {
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
            let rows = null;
            if (supabase) {
              const { data, error } = await supabase
                .from('users')
                .select('registration_number, full_name, registration_status, school_data ( major_choice )')
                .eq('registration_number', actionData.registration_number)
                .maybeSingle();

              if (error) throw error;
              rows = data;
            }
            
            if (rows) {
              let statusText = '';
              let messageText = '';
              
              if (rows.registration_status === 'accepted') {
                statusText = '✅ LULUS';
                messageText = 'Selamat. Silakan melakukan daftar ulang sesuai jadwal yang telah ditentukan.';
              } else if (rows.registration_status === 'rejected') {
                statusText = '❌ TIDAK LULUS';
                messageText = 'Terima kasih telah mengikuti proses seleksi. Semoga sukses pada kesempatan berikutnya.';
              } else if (rows.registration_status === 'revision') {
                statusText = '⚠️ PERLU REVISI';
                messageText = 'Dokumen Anda perlu diperbaiki. Silakan login ke dashboard untuk melihat detail revisi.';
              } else {
                statusText = '⏳ DALAM PROSES / BELUM DIVERIFIKASI';
                messageText = 'Pendaftaran Anda sedang dalam antrean pengecekan oleh panitia. Mohon cek kembali secara berkala.';
              }
              
              aiResponse = `🎓 HASIL SELEKSI PMB\n\nNomor Registrasi\n${rows.registration_number}\n\nNama\n${rows.full_name}\n\nProgram\n${rows.school_data?.major_choice || '-'}\n\nStatus\n${statusText}\n\n${messageText}`;
            } else {
              aiResponse = `Mohon maaf.\n\nNomor Registrasi tidak ditemukan.\n\nSilakan periksa kembali Nomor Registrasi Anda.`;
            }
          } catch (dbErr) {
            console.error('Failed to check graduation:', dbErr);
            aiResponse = `Mohon maaf. Saat ini pengecekan kelulusan belum dapat diproses karena terjadi gangguan sistem. Silakan mencoba beberapa saat lagi.`;
          }
        } else if (actionData.action === 'check_route') {
          aiResponse = "📍 **Cek Jarak ke Sekolah**\n\nUntuk menghitung jarak dari lokasi Anda ke sekolah, silakan gunakan fitur **Cek Jarak** yang tersedia di halaman ini.\n\nFitur tersebut akan meminta izin akses lokasi GPS perangkat Anda untuk menentukan titik awal secara akurat.\n\nJarak dan estimasi waktu perjalanan akan dihitung secara otomatis setelah izin diberikan.";
        }
      } catch(e) {
        // Not a valid JSON or not our action format, just continue with original response
      }
    }

    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    // Simpan ke riwayat chat user yang sedang login
    if (supabase && user && user.userId) {
      const { error: historyError } = await supabase.from('chat_history').insert({
        user_id: user.userId,
        message,
        response: aiResponse,
        message_type: 'ai_agent',
        response_time_ms: responseTimeMs
      });
      if (historyError) console.error('Failed to save chat history:', historyError.message);
    }

    successResponse(res, {
      user_message: message,
      ai_response: aiResponse,
      timestamp: new Date(),
      response_time_ms: responseTimeMs,
      provider: activeProvider,
      model: activeModel,
      mode: activeMode
    }, 'Pesan berhasil diproses');

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('AI Agent Error:', error);
    const status = error?.response?.status || 500;
    const errorMessage = error?.response?.data?.error?.message || error?.response?.data?.message || error.message || 'Gagal memproses pesan';

    errorResponse(res, `Gagal memproses pesan (Status ${status}): ${errorMessage}`, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Panggil Webhook n8n (Mode 2)
 */
const callN8NWebhook = async (message, history = [], settings, user = null) => {
  const webhookUrl = settings.webhook_url;
  if (!webhookUrl) {
    throw new Error('URL Webhook n8n belum dikonfigurasi');
  }

  // Validasi keamanan SSRF
  await validateWebhookUrl(webhookUrl);

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'SPMB-Madrasah-Chatbot/1.0'
  };

  if (settings.webhook_auth_encrypted) {
    const authSecret = decrypt(settings.webhook_auth_encrypted);
    if (authSecret) {
      headers['Authorization'] = authSecret.startsWith('Bearer ') || authSecret.startsWith('Basic ')
        ? authSecret
        : `Bearer ${authSecret}`;
      headers['X-API-KEY'] = authSecret;
    }
  }

  const payload = {
    message,
    history,
    user: user ? { id: user.userId, email: user.email, role: user.role } : null,
    timestamp: new Date().toISOString()
  };

  const response = await axios.post(webhookUrl, payload, {
    headers,
    timeout: 25000 // 25 detik timeout
  });

  // Ekstrak teks respons n8n (bisa berupa { response }, { message }, { output }, atau string langsung)
  let replyText = '';
  if (typeof response.data === 'string') {
    replyText = response.data;
  } else if (response.data && typeof response.data === 'object') {
    replyText = response.data.response || response.data.message || response.data.output || response.data.text || JSON.stringify(response.data);
  }

  if (!replyText || !replyText.trim()) {
    throw new Error('Webhook n8n merespons tanpa konten teks jawaban');
  }

  return {
    response: replyText.trim(),
    httpStatus: response.status
  };
};

/**
 * Panggil AI Provider secara Dinamis (Mode 1: Groq, OpenAI, Google Gemini, OpenRouter)
 */
const callAIProvider = async (message, history = [], settings = null) => {
  const provider = (settings?.provider || 'groq').toLowerCase();
  const model = settings?.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  // Dapatkan API Key (dari database terenkripsi, atau fallback ke .env)
  let apiKey = null;
  if (settings?.api_key_encrypted) {
    apiKey = decrypt(settings.api_key_encrypted);
  }
  if (!apiKey) {
    apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
  }

  if (!apiKey) {
    throw new Error(`API Key untuk ${provider.toUpperCase()} belum disetel. Silakan atur API Key di Pengaturan AI Dashboard Admin atau di file .env.`);
  }

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
=========================================================`;

  // 1. PROVIDER GOOGLE GEMINI
  if (provider === 'gemini') {
    const cleanModel = model.replace(/^models\//, '');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    const contents = [];
    
    // History
    if (Array.isArray(history) && history.length > 0) {
      history.forEach((h) => {
        const u = (h.user || h.userMessage || '').trim();
        const a = (h.ai || h.aiResponse || h.response || '').trim();
        if (u) contents.push({ role: 'user', parts: [{ text: u }] });
        if (a) contents.push({ role: 'model', parts: [{ text: a }] });
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    try {
      const response = await axios.post(
        geminiUrl,
        {
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: settings?.temperature ?? 0.5,
            maxOutputTokens: settings?.max_tokens ?? 1000
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000
        }
      );

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text.includes('<think>')) {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }

      if (text && text.trim().length > 0) {
        return text.trim();
      }
      throw new Error('Respons dari Gemini kosong');
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.error(`Gemini API error (status ${status}):`, errorMsg);
      throw new Error(`Gemini AI Error (${status || 500}): ${errorMsg}`);
    }
  }

  // 2. OPENAI-COMPATIBLE PROVIDERS (Groq, OpenAI, OpenRouter)
  let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    headers['HTTP-Referer'] = 'https://madrasah.id';
    headers['X-Title'] = 'SPMB MA Chatbot';
  } else {
    // Default Groq
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  }

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (Array.isArray(history) && history.length > 0) {
    history.forEach((h) => {
      const userText = (h.user || h.userMessage || '').trim();
      const aiText = (h.ai || h.aiResponse || h.response || '').trim();
      if (userText) messages.push({ role: 'user', content: userText });
      if (aiText) messages.push({ role: 'assistant', content: aiText });
    });
  }

  messages.push({
    role: 'user',
    content: String(message).trim()
  });

  try {
    const response = await axios.post(
      endpoint,
      {
        model,
        messages,
        temperature: settings?.temperature ?? 0.5,
        max_tokens: settings?.max_tokens ?? 1000
      },
      {
        headers,
        timeout: 25000
      }
    );

    let text = response.data?.choices?.[0]?.message?.content || '';

    // Bersihkan tag reasoning jika ada
    if (text.includes('<think>')) {
      const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (cleaned) text = cleaned;
    }

    if (text && text.trim().length > 0) {
      return text.trim();
    }

    throw new Error(`Respons dari ${provider.toUpperCase()} kosong`);
  } catch (err) {
    const status = err.response?.status;
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`${provider.toUpperCase()} API error with model ${model} (status ${status}):`, errorMsg);
    throw new Error(`${provider.toUpperCase()} Error (${status || 500}): ${errorMsg}`);
  }
};

// Fallback Groq API function untuk kompatibilitas
export const callGroqAI = async (message, history = []) => {
  return callAIProvider(message, history, { provider: 'groq' });
};

// Get Chat History
export const getChatHistory = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user || !user.userId || !supabase) {
      return successResponse(res, [], 'Guest history empty');
    }

    const { data, error } = await supabase
      .from('chat_history')
      .select('user_id, message, response, message_type, created_at, response_time_ms')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    successResponse(res, data || [], 'Chat history berhasil diambil');
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Terjadi kesalahan', ERROR_CODES.INTERNAL_ERROR);
  }
};

// Clear Chat History
export const clearChatHistory = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.userId || !supabase) {
      return successResponse(res, {}, 'Guest chat history cleared');
    }

    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', user.userId);

    if (error) throw error;

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

    if (userLat === undefined || userLat === null || userLon === undefined || userLon === null) {
      return errorResponse(res, 'Koordinat lokasi pengguna tidak tersedia', ERROR_CODES.VALIDATION_ERROR);
    }

    const lat = parseFloat(userLat);
    const lon = parseFloat(userLon);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return errorResponse(res, 'Koordinat GPS tidak valid', ERROR_CODES.VALIDATION_ERROR);
    }

    const schoolLat = parseFloat(process.env.SCHOOL_LAT) || -6.8133266;
    const schoolLon = parseFloat(process.env.SCHOOL_LON) || 108.6177609;
    const schoolName = process.env.SCHOOL_NAME || 'MA Bina Cendekia';
    const schoolAddress = process.env.SCHOOL_ADDRESS || 'Jl. Raya Madrasah No. 123, Jawa Barat';

    const R = 6371; // km
    const dLat = (schoolLat - lat) * Math.PI / 180;
    const dLon = (schoolLon - lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(schoolLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const straightLineKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));

    const osrmEndpoints = [
      `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${schoolLon},${schoolLat}?overview=full&geometries=geojson&alternatives=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${lon},${lat};${schoolLon},${schoolLat}?overview=full&geometries=geojson&alternatives=true`
    ];

    let routeData = null;

    for (const endpoint of osrmEndpoints) {
      try {
        const routeRes = await axios.get(endpoint, {
          headers: {
            'User-Agent': 'SPMB-MABinaCendekia/1.0 (contact: info@mabinacendekia.sch.id)'
          },
          timeout: 8000
        });

        if (routeRes.data && routeRes.data.code === 'Ok' && Array.isArray(routeRes.data.routes) && routeRes.data.routes.length > 0) {
          const sortedRoutes = [...routeRes.data.routes].sort((r1, r2) => r1.duration - r2.duration);
          const fastestRoute = sortedRoutes[0];

          const totalMinutes = Math.round(fastestRoute.duration / 60);
          let durationFormatted = `${totalMinutes} menit`;
          if (totalMinutes >= 60) {
            const hours = Math.floor(totalMinutes / 60);
            const remainingMins = totalMinutes % 60;
            durationFormatted = remainingMins > 0 ? `${hours} jam ${remainingMins} menit` : `${hours} jam`;
          }

          const alternatives = sortedRoutes.slice(1).map((alt) => ({
            distanceKm: parseFloat((alt.distance / 1000).toFixed(1)),
            durationMinutes: Math.round(alt.duration / 60),
            durationFormatted: Math.round(alt.duration / 60) >= 60
              ? `${Math.floor(Math.round(alt.duration / 60) / 60)} jam ${Math.round(alt.duration / 60) % 60} mnt`
              : `${Math.round(alt.duration / 60)} menit`
          }));

          routeData = {
            type: 'Rute Tercepat',
            profile: 'driving',
            distanceKm: parseFloat((fastestRoute.distance / 1000).toFixed(1)),
            distanceMeters: Math.round(fastestRoute.distance),
            durationMinutes: totalMinutes,
            durationFormatted,
            geometry: fastestRoute.geometry || null,
            mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lon}&destination=${schoolLat},${schoolLon}`,
            alternatives
          };
          break;
        }
      } catch (err) {
        console.warn(`Routing endpoint failed (${endpoint.split('//')[1].split('/')[0]}):`, err.message);
      }
    }

    successResponse(res, {
      route: routeData,
      straightLineKm,
      school: {
        name: schoolName,
        address: schoolAddress,
        lat: schoolLat,
        lon: schoolLon
      },
      accuracy: accuracy ? parseFloat(accuracy) : null
    }, routeData ? 'Rute perjalanan berhasil dihitung' : 'Layanan rute jalan tidak tersedia, menampilkan estimasi garis lurus');

  } catch (error) {
    console.error('Calculate Distance Error:', error);
    errorResponse(res, 'Gagal memproses perhitungan rute', ERROR_CODES.INTERNAL_ERROR);
  }
};
