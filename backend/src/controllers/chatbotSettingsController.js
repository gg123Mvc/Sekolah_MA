import axios from 'axios';
import ChatbotSettings from '../models/chatbotSettingsModel.js';
import { encrypt, decrypt, maskApiKey } from '../utils/encryption.js';
import { validateWebhookUrl } from '../utils/ssrfProtection.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/errors.js';

// In-memory rate limiting map untuk test endpoints (cooldown per IP / admin)
const rateLimitMap = new Map();
const RATE_LIMIT_COOLDOWN_MS = 3000; // 3 detik antar test

function checkRateLimit(key) {
  const now = Date.now();
  const lastTime = rateLimitMap.get(key) || 0;
  if (now - lastTime < RATE_LIMIT_COOLDOWN_MS) {
    const remainingSec = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastTime)) / 1000);
    throw new Error(`Harap tunggu ${remainingSec} detik sebelum melakukan pengujian kembali.`);
  }
  rateLimitMap.set(key, now);
}

/**
 * 1. Ambil Pengaturan Chatbot Aktif
 * API Key dan Webhook Auth TIDAK dikirim secara utuh, hanya di-mask
 */
export const getSettings = async (req, res) => {
  try {
    const settings = await ChatbotSettings.getActive();

    // Default fallback jika belum pernah disimpan di DB
    const responseData = {
      provider: settings?.provider || 'groq',
      model: settings?.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      hasApiKey: !!(settings?.api_key_encrypted || process.env.GROQ_API_KEY),
      apiKeyMasked: settings?.api_key_encrypted 
        ? maskApiKey(decrypt(settings.api_key_encrypted)) 
        : (process.env.GROQ_API_KEY ? maskApiKey(process.env.GROQ_API_KEY) : ''),
      webhook_url: settings?.webhook_url || '',
      hasWebhookAuth: !!settings?.webhook_auth_encrypted,
      webhookAuthMasked: settings?.webhook_auth_encrypted ? '••••••••••••' : '',
      webhook_enabled: !!settings?.webhook_enabled,
      chatbot_mode: settings?.chatbot_mode || 'direct', // 'direct' atau 'n8n'
      temperature: settings?.temperature ?? 0.5,
      max_tokens: settings?.max_tokens ?? 1000,
      updated_at: settings?.updated_at || null,
      created_at: settings?.created_at || null
    };

    return successResponse(res, responseData, 'Konfigurasi chatbot berhasil diambil');
  } catch (error) {
    console.error('getSettings error:', error);
    return errorResponse(res, `Gagal mengambil konfigurasi: ${error.message}`, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * 2. Simpan / Perbarui Pengaturan Chatbot
 */
export const updateSettings = async (req, res) => {
  try {
    const {
      provider,
      apiKey,
      model,
      webhook_url,
      webhook_auth,
      webhook_enabled,
      chatbot_mode,
      temperature,
      max_tokens
    } = req.body;

    const allowedProviders = ['groq', 'openai', 'gemini', 'openrouter'];
    if (provider && !allowedProviders.includes(provider.toLowerCase())) {
      return errorResponse(res, `Provider tidak didukung. Pilih salah satu dari: ${allowedProviders.join(', ')}`, ERROR_CODES.VALIDATION_ERROR);
    }

    const allowedModes = ['direct', 'n8n'];
    if (chatbot_mode && !allowedModes.includes(chatbot_mode.toLowerCase())) {
      return errorResponse(res, 'Mode chatbot harus "direct" atau "n8n"', ERROR_CODES.VALIDATION_ERROR);
    }

    // Validasi SSRF jika webhook_url disediakan
    if (webhook_url && webhook_url.trim()) {
      try {
        await validateWebhookUrl(webhook_url.trim());
      } catch (urlErr) {
        return errorResponse(res, `Validasi Webhook URL gagal: ${urlErr.message}`, ERROR_CODES.VALIDATION_ERROR);
      }
    }

    const currentSettings = await ChatbotSettings.getActive();
    const payload = {};

    if (provider) payload.provider = provider.toLowerCase();
    if (model) payload.model = model.trim();
    if (chatbot_mode) payload.chatbot_mode = chatbot_mode.toLowerCase();
    if (typeof webhook_enabled === 'boolean') payload.webhook_enabled = webhook_enabled;
    if (webhook_url !== undefined) payload.webhook_url = webhook_url ? webhook_url.trim() : null;
    if (temperature !== undefined) payload.temperature = parseFloat(temperature);
    if (max_tokens !== undefined) payload.max_tokens = parseInt(max_tokens, 10);

    // Enkripsi API Key jika pengguna mengirimkan key baru
    if (apiKey && apiKey.trim() && !apiKey.includes('••••')) {
      payload.api_key_encrypted = encrypt(apiKey.trim());
    } else if (currentSettings?.api_key_encrypted) {
      // Pertahankan key yang sudah ada jika tidak diubah
      payload.api_key_encrypted = currentSettings.api_key_encrypted;
    }

    // Enkripsi Webhook Auth jika dikirim
    if (webhook_auth && webhook_auth.trim() && !webhook_auth.includes('••••')) {
      payload.webhook_auth_encrypted = encrypt(webhook_auth.trim());
    } else if (currentSettings?.webhook_auth_encrypted) {
      payload.webhook_auth_encrypted = currentSettings.webhook_auth_encrypted;
    }

    const updated = await ChatbotSettings.upsert(payload);

    // Catat riwayat audit
    await ChatbotSettings.addHistory({
      changed_by: req.user?.username || req.user?.email || 'admin',
      provider: updated.provider,
      model: updated.model,
      chatbot_mode: updated.chatbot_mode,
      webhook_enabled: updated.webhook_enabled,
      changes_summary: `Perubahan konfigurasi: provider=${updated.provider}, model=${updated.model}, mode=${updated.chatbot_mode}, n8n=${updated.webhook_enabled}`
    });

    const safeResponse = {
      provider: updated.provider,
      model: updated.model,
      hasApiKey: !!updated.api_key_encrypted,
      apiKeyMasked: updated.api_key_encrypted ? maskApiKey(decrypt(updated.api_key_encrypted)) : '',
      webhook_url: updated.webhook_url || '',
      hasWebhookAuth: !!updated.webhook_auth_encrypted,
      webhookAuthMasked: updated.webhook_auth_encrypted ? '••••••••••••' : '',
      webhook_enabled: updated.webhook_enabled,
      chatbot_mode: updated.chatbot_mode,
      updated_at: updated.updated_at
    };

    return successResponse(res, safeResponse, 'Konfigurasi chatbot berhasil diperbarui');
  } catch (error) {
    console.error('updateSettings error:', error);
    return errorResponse(res, `Gagal menyimpan konfigurasi: ${error.message}`, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * 3. Test Koneksi AI Provider
 * Mengirim request minimal untuk memverifikasi validitas API Key & model
 */
export const testAIConnection = async (req, res) => {
  const startTime = Date.now();
  try {
    const rateLimitKey = `ai_test_${req.ip || 'admin'}`;
    checkRateLimit(rateLimitKey);

    const { provider, apiKey, model } = req.body;

    const currentSettings = await ChatbotSettings.getActive();

    // Dapatkan API key yang akan diuji
    let effectiveKey = apiKey && apiKey.trim() && !apiKey.includes('••••') ? apiKey.trim() : null;
    if (!effectiveKey && currentSettings?.api_key_encrypted) {
      effectiveKey = decrypt(currentSettings.api_key_encrypted);
    }
    if (!effectiveKey) {
      effectiveKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
    }

    if (!effectiveKey) {
      return errorResponse(res, 'API Key belum diisi. Masukkan API Key terlebih dahulu untuk menguji.', ERROR_CODES.VALIDATION_ERROR);
    }

    const targetProvider = (provider || currentSettings?.provider || 'groq').toLowerCase();
    const targetModel = (model || currentSettings?.model || 'openai/gpt-oss-20b').trim();

    let isSuccess = false;
    let sampleReply = '';

    if (targetProvider === 'gemini') {
      // Google Gemini API Test
      // Normalize model name (remove 'models/' prefix if present)
      const cleanModel = targetModel.replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${effectiveKey}`;
      
      const response = await axios.post(
        geminiUrl,
        {
          contents: [{ parts: [{ text: 'Ping test. Jawab "OK" satu kata saja.' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      sampleReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      isSuccess = true;

    } else {
      // OpenAI-compatible endpoints: Groq, OpenAI, OpenRouter
      let endpoint = '';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`
      };

      if (targetProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      } else if (targetProvider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
      } else if (targetProvider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        headers['HTTP-Referer'] = 'https://madrasah.id';
        headers['X-Title'] = 'SPMB MA Chatbot';
      } else {
        throw new Error(`Provider '${targetProvider}' tidak dikenali.`);
      }

      const response = await axios.post(
        endpoint,
        {
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping test. Jawab "OK" satu kata saja.' }],
          max_tokens: 10,
          temperature: 0.1
        },
        { headers, timeout: 15000 }
      );

      sampleReply = response.data?.choices?.[0]?.message?.content?.trim() || 'OK';
      isSuccess = true;
    }

    const responseTimeMs = Date.now() - startTime;

    return successResponse(res, {
      status: 'success',
      provider: targetProvider,
      model: targetModel,
      responseTimeMs,
      sampleReply
    }, `Koneksi ke ${targetProvider.toUpperCase()} (${targetModel}) berhasil! Respons dalam ${responseTimeMs}ms.`);

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('testAIConnection error:', error.message);

    let detail = error.response?.data?.error?.message || error.response?.data?.message || error.message;
    const statusCode = error.response?.status || 500;

    if (statusCode === 401 || statusCode === 403) {
      detail = 'API Key tidak valid atau otentikasi ditolak oleh provider.';
    } else if (statusCode === 404) {
      detail = `Model AI tidak ditemukan pada provider ini. Periksa kembali nama model.`;
    }

    return errorResponse(res, `Uji koneksi AI gagal (${statusCode}): ${detail}`, ERROR_CODES.VALIDATION_ERROR, {
      responseTimeMs,
      errorDetail: detail
    });
  }
};

/**
 * 4. Test Koneksi Webhook n8n
 * Mengirim ping test dengan perlindungan SSRF dan timeout
 */
export const testWebhook = async (req, res) => {
  const startTime = Date.now();
  try {
    const rateLimitKey = `webhook_test_${req.ip || 'admin'}`;
    checkRateLimit(rateLimitKey);

    const { webhook_url, webhook_auth } = req.body;

    const currentSettings = await ChatbotSettings.getActive();
    const targetUrl = (webhook_url && webhook_url.trim()) || currentSettings?.webhook_url;

    if (!targetUrl) {
      return errorResponse(res, 'URL Webhook belum diisi.', ERROR_CODES.VALIDATION_ERROR);
    }

    // SSRF Validation
    await validateWebhookUrl(targetUrl);

    // Kredensial auth
    let effectiveAuth = webhook_auth && webhook_auth.trim() && !webhook_auth.includes('••••') ? webhook_auth.trim() : null;
    if (!effectiveAuth && currentSettings?.webhook_auth_encrypted) {
      effectiveAuth = decrypt(currentSettings.webhook_auth_encrypted);
    }

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SPMB-Madrasah-Chatbot-Test/1.0'
    };

    if (effectiveAuth) {
      headers['Authorization'] = effectiveAuth.startsWith('Bearer ') || effectiveAuth.startsWith('Basic ')
        ? effectiveAuth
        : `Bearer ${effectiveAuth}`;
      headers['X-API-KEY'] = effectiveAuth;
    }

    const testPayload = {
      // Untuk n8n Chat Trigger ("When chat message received")
      action: 'sendMessage',
      chatInput: 'Halo, ini uji koneksi dari Dashboard Admin SPMB',
      sessionId: 'admin_test_session',

      // Untuk Webhook biasa
      event: 'ping_test',
      message: 'Test ping koneksi dari Dashboard Admin SPMB',
      query: 'Halo, ini uji koneksi dari Dashboard Admin SPMB',
      input: 'Halo, ini uji koneksi dari Dashboard Admin SPMB',
      timestamp: new Date().toISOString(),
      is_test: true
    };

    let response;
    try {
      response = await axios.post(targetUrl, testPayload, {
        headers,
        timeout: 10000 // 10 detik timeout
      });
    } catch (err) {
      // Coba retry dengan /chat jika 404 (khas node "When chat message received")
      if (err.response?.status === 404 && !targetUrl.endsWith('/chat')) {
        const altUrl = `${targetUrl.replace(/\/+$/, '')}/chat`;
        try {
          response = await axios.post(altUrl, testPayload, { headers, timeout: 10000 });
        } catch (retryErr) {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const responseTimeMs = Date.now() - startTime;

    return successResponse(res, {
      status: 'success',
      httpStatus: response.status,
      responseTimeMs,
      responseData: typeof response.data === 'string' ? response.data.slice(0, 200) : response.data
    }, `Webhook n8n berhasil merespons (Status ${response.status}) dalam ${responseTimeMs}ms!`);

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('testWebhook error:', error.message);

    let detail = error.message;
    const httpStatus = error.response?.status || 'N/A';

    if (error.code === 'ECONNABORTED') {
      detail = 'Request timeout: Webhook n8n tidak merespons dalam 10 detik.';
    } else if (error.response?.data) {
      detail = typeof error.response.data === 'string' 
        ? error.response.data.slice(0, 200) 
        : (error.response.data.message || JSON.stringify(error.response.data));
    }

    return errorResponse(res, `Uji koneksi Webhook n8n gagal (Status ${httpStatus}): ${detail}`, ERROR_CODES.VALIDATION_ERROR, {
      httpStatus,
      responseTimeMs,
      errorDetail: detail
    });
  }
};
