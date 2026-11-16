import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import {
  FiCpu, FiZap, FiCheckCircle, FiAlertCircle, FiEye, FiEyeOff,
  FiSave, FiRefreshCw, FiLink, FiLayers, FiSliders, FiClock,
  FiShield, FiActivity
} from 'react-icons/fi';

const PROVIDER_MODELS = {
  groq: [
    { value: 'openai/gpt-oss-20b', label: 'openai/gpt-oss-20b (Rekomendasi)' },
    { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
    { value: 'llama3-70b-8192', label: 'llama3-70b-8192' },
    { value: 'mixtral-8x7b-32768', label: 'mixtral-8x7b-32768' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (Cepat & Hemat)' },
    { value: 'gpt-4o', label: 'gpt-4o (Kemampuan Tertinggi)' },
    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
  ],
  gemini: [
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash (Direkomendasikan)' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  ],
  openrouter: [
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'meta-llama/llama-3.3-70b-instruct' },
    { value: 'google/gemini-flash-1.5', label: 'google/gemini-flash-1.5' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet' },
  ],
};

const ChatbotSettingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testAILoading, setTestAILoading] = useState(false);
  const [testWebhookLoading, setTestWebhookLoading] = useState(false);

  // Form State
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('openai/gpt-oss-20b');
  const [customModel, setCustomModel] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  const [chatbotMode, setChatbotMode] = useState('direct'); // 'direct' | 'n8n'
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookAuth, setWebhookAuth] = useState('');
  const [webhookAuthMasked, setWebhookAuthMasked] = useState('');
  const [showWebhookAuth, setShowWebhookAuth] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  const [updatedAt, setUpdatedAt] = useState(null);

  // Status & Test Results
  const [aiTestResult, setAiTestResult] = useState(null);
  const [webhookTestResult, setWebhookTestResult] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getChatbotSettings();
      if (res.data?.success) {
        const d = res.data.data;
        setProvider(d.provider || 'groq');
        setModel(d.model || 'openai/gpt-oss-20b');
        setApiKeyMasked(d.apiKeyMasked || '');
        setApiKey(d.apiKeyMasked || '');
        setWebhookUrl(d.webhook_url || '');
        setWebhookAuthMasked(d.webhookAuthMasked || '');
        setWebhookAuth(d.webhookAuthMasked || '');
        setWebhookEnabled(!!d.webhook_enabled);
        setChatbotMode(d.chatbot_mode || 'direct');
        setUpdatedAt(d.updated_at);

        // Cek apakah model termasuk salah satu preset
        const currentPresets = (PROVIDER_MODELS[d.provider] || []).map(m => m.value);
        if (d.model && !currentPresets.includes(d.model)) {
          setUseCustomModel(true);
          setCustomModel(d.model);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat pengaturan chatbot dari server');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setAiTestResult(null);
    const presets = PROVIDER_MODELS[newProvider];
    if (presets && presets.length > 0) {
      setModel(presets[0].value);
      setUseCustomModel(false);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const targetModel = useCustomModel ? customModel.trim() : model;
      if (!targetModel) {
        toast.error('Model AI wajib diisi');
        setSaving(false);
        return;
      }

      const payload = {
        provider,
        model: targetModel,
        chatbot_mode: chatbotMode,
        webhook_enabled: webhookEnabled,
        webhook_url: webhookUrl,
      };

      // Hanya kirim API key jika diubah pengguna (bukan masked placeholder)
      if (apiKey && !apiKey.includes('••••')) {
        payload.apiKey = apiKey.trim();
      }

      // Hanya kirim Webhook Auth jika diubah
      if (webhookAuth && !webhookAuth.includes('••••')) {
        payload.webhook_auth = webhookAuth.trim();
      }

      const res = await adminAPI.updateChatbotSettings(payload);
      if (res.data?.success) {
        toast.success('Pengaturan chatbot berhasil disimpan ke database!');
        const d = res.data.data;
        setUpdatedAt(d.updated_at);
        if (d.apiKeyMasked) {
          setApiKeyMasked(d.apiKeyMasked);
          setApiKey(d.apiKeyMasked);
        }
        if (d.webhookAuthMasked) {
          setWebhookAuthMasked(d.webhookAuthMasked);
          setWebhookAuth(d.webhookAuthMasked);
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Gagal menyimpan konfigurasi';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    setTestAILoading(true);
    setAiTestResult(null);
    try {
      const targetModel = useCustomModel ? customModel.trim() : model;
      const payload = {
        provider,
        model: targetModel,
      };
      if (apiKey && !apiKey.includes('••••')) {
        payload.apiKey = apiKey.trim();
      }

      const res = await adminAPI.testAIConnection(payload);
      if (res.data?.success) {
        setAiTestResult({
          success: true,
          message: res.data.message,
          responseTimeMs: res.data.data.responseTimeMs,
          sampleReply: res.data.data.sampleReply
        });
        toast.success(`Koneksi ${provider.toUpperCase()} Berhasil! (${res.data.data.responseTimeMs}ms)`);
      }
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.message || err.message;
      setAiTestResult({
        success: false,
        message: detail,
        responseTimeMs: err.response?.data?.data?.responseTimeMs || null
      });
      toast.error(detail);
    } finally {
      setTestAILoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Masukkan URL Webhook n8n terlebih dahulu');
      return;
    }
    setTestWebhookLoading(true);
    setWebhookTestResult(null);
    try {
      const payload = {
        webhook_url: webhookUrl
      };
      if (webhookAuth && !webhookAuth.includes('••••')) {
        payload.webhook_auth = webhookAuth.trim();
      }

      const res = await adminAPI.testWebhookConnection(payload);
      if (res.data?.success) {
        setWebhookTestResult({
          success: true,
          message: res.data.message,
          httpStatus: res.data.data.httpStatus,
          responseTimeMs: res.data.data.responseTimeMs
        });
        toast.success(`Webhook n8n Berhasil Terhubung! (${res.data.data.responseTimeMs}ms)`);
      }
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.message || err.message;
      setWebhookTestResult({
        success: false,
        message: detail,
        responseTimeMs: err.response?.data?.data?.responseTimeMs || null
      });
      toast.error(detail);
    } finally {
      setTestWebhookLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
        <FiRefreshCw className="animate-spin text-4xl text-emerald-600 mx-auto mb-4" />
        <p className="text-sm font-bold text-gray-500">Memuat konfigurasi chatbot...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">
              <FiShield className="text-emerald-400" /> Admin Chatbot Configuration
            </div>
            <h2 className="text-2xl md:text-3xl font-black">Pengaturan AI & Integrasi n8n</h2>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-2xl font-medium">
              Konfigurasi AI Provider, API Key terenkripsi (AES-256-GCM), URL Webhook n8n, dan pemilihan mode percakapan secara dinamis tanpa perlu deploy ulang.
            </p>
          </div>
          {updatedAt && (
            <div className="bg-emerald-800/40 border border-emerald-700/50 rounded-2xl p-4 text-xs font-bold text-emerald-200 flex items-center gap-3 flex-shrink-0">
              <FiClock size={18} className="text-emerald-400" />
              <div>
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest">Terakhir Diperbarui</p>
                <p className="font-mono text-sm text-white mt-0.5">
                  {new Date(updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: PEMILIHAN MODE CHATBOT */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-black">
            <FiLayers />
          </div>
          <div>
            <h3 className="text-lg font-black text-emerald-950">1. Mode Percakapan Chatbot</h3>
            <p className="text-xs text-gray-500 font-medium">Pilih bagaimana pertanyaan pengguna diproses oleh sistem backend</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MODE 1: DIRECT */}
          <div
            onClick={() => setChatbotMode('direct')}
            className={`cursor-pointer rounded-2xl p-6 border-2 transition-all relative ${
              chatbotMode === 'direct'
                ? 'border-emerald-600 bg-emerald-50/40 shadow-md shadow-emerald-900/5'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                Mode 1
              </span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${chatbotMode === 'direct' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                {chatbotMode === 'direct' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <h4 className="text-base font-black text-gray-900">Direct AI Provider (Tanpa n8n)</h4>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Pengguna → Backend → Knowledge Base Context → AI Provider (Groq/OpenAI/Gemini/OpenRouter) → Jawaban.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <FiCheckCircle /> Respons sangat cepat & hemat kuota webhook
            </div>
          </div>

          {/* MODE 2: N8N */}
          <div
            onClick={() => setChatbotMode('n8n')}
            className={`cursor-pointer rounded-2xl p-6 border-2 transition-all relative ${
              chatbotMode === 'n8n'
                ? 'border-emerald-600 bg-emerald-50/40 shadow-md shadow-emerald-900/5'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-teal-800 bg-teal-100 px-3 py-1 rounded-full">
                Mode 2
              </span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${chatbotMode === 'n8n' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                {chatbotMode === 'n8n' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <h4 className="text-base font-black text-gray-900">Workflow Automation (Dengan n8n)</h4>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Pengguna → Backend → n8n Webhook Workflow (RAG / AI Agent / Multi-tools) → Jawaban.
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] font-bold text-teal-700 flex items-center gap-1.5">
              <FiZap /> Mendukung workflow cerdas, tools, dan integrasi lanjutan
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PENGATURAN AI PROVIDER */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-black">
              <FiCpu />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-950">2. Konfigurasi AI Provider & Model</h3>
              <p className="text-xs text-gray-500 font-medium">Digunakan untuk Mode 1 atau sebagai fallback otomatis jika Webhook n8n offline</p>
            </div>
          </div>
          <span className="text-xs font-mono bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl font-bold">
            Provider Aktif: <strong className="text-emerald-700 uppercase">{provider}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dropdown Provider */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Pilih AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            >
              <option value="groq">Groq (Cepat & Efisien)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="gemini">Google Gemini (Gemini 1.5 Pro / Flash)</option>
              <option value="openrouter">OpenRouter (Multi-model Aggregator)</option>
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                Model AI
              </label>
              <button
                type="button"
                onClick={() => setUseCustomModel(!useCustomModel)}
                className="text-[11px] font-bold text-emerald-700 hover:underline"
              >
                {useCustomModel ? 'Gunakan Pilihan Preset' : 'Ketik Model Kustom'}
              </button>
            </div>

            {useCustomModel ? (
              <input
                type="text"
                placeholder="Contoh: openai/gpt-oss-20b atau gpt-4o"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              >
                {(PROVIDER_MODELS[provider] || []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* API Key Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              API Key ({provider.toUpperCase()})
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={apiKeyMasked ? `Tersimpan: ${apiKeyMasked}` : 'Masukkan API Key baru'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 pr-24 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  title={showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showApiKey ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1 font-medium">
              <FiShield className="text-emerald-600" />
              API Key dienkripsi secara aman dengan algoritma AES-256-GCM sebelum disimpan ke database dan tidak pernah ditampilkan utuh ke browser.
            </p>
          </div>
        </div>

        {/* Action Button & Test AI */}
        <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={testAILoading}
              onClick={handleTestAI}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition disabled:opacity-50"
            >
              {testAILoading ? <FiRefreshCw className="animate-spin" /> : <FiActivity />}
              {testAILoading ? 'Menguji API...' : 'Test Connection AI'}
            </button>
          </div>

          {aiTestResult && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
              aiTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {aiTestResult.success ? <FiCheckCircle /> : <FiAlertCircle />}
              <span>{aiTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: PENGATURAN WEBHOOK N8N */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-lg font-black">
              <FiLink />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-950">3. Integrasi Webhook n8n</h3>
              <p className="text-xs text-gray-500 font-medium">Koneksikan backend chatbot dengan workflow n8n secara otomatis</p>
            </div>
          </div>

          {/* Toggle Enable/Disable n8n */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-4 py-2 rounded-2xl">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700">
              Integrasi n8n:
            </span>
            <button
              type="button"
              onClick={() => setWebhookEnabled(!webhookEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                webhookEnabled ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  webhookEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-black uppercase ${webhookEnabled ? 'text-emerald-700' : 'text-gray-400'}`}>
              {webhookEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Webhook URL Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Webhook URL n8n (HTTP POST)
            </label>
            <input
              type="url"
              placeholder="https://n8n.yourdomain.com/webhook/spmb-ai-agent"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            <p className="text-[11px] text-gray-500 mt-2">
              Proteksi SSRF aktif: URL menuju localhost (127.0.0.1) atau private IP rentang 10.x, 192.168.x, 172.16.x diblokir demi keamanan.
            </p>
          </div>

          {/* Webhook Secret / Auth Header (Optional) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Webhook Auth / Bearer Token (Opsional)
            </label>
            <div className="relative">
              <input
                type={showWebhookAuth ? 'text' : 'password'}
                placeholder={webhookAuthMasked ? `Tersimpan: ${webhookAuthMasked}` : 'Token otentikasi header (jika n8n webhook terproteksi)'}
                value={webhookAuth}
                onChange={(e) => setWebhookAuth(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowWebhookAuth(!showWebhookAuth)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                {showWebhookAuth ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Button & Test Webhook */}
        <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            disabled={testWebhookLoading || !webhookUrl}
            onClick={handleTestWebhook}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition disabled:opacity-50"
          >
            {testWebhookLoading ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
            {testWebhookLoading ? 'Menguji Webhook...' : 'Test Webhook n8n'}
          </button>

          {webhookTestResult && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
              webhookTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {webhookTestResult.success ? <FiCheckCircle /> : <FiAlertCircle />}
              <span>{webhookTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* SAVE BUTTON BAR */}
      <div className="bg-emerald-950 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-black text-base">Simpan Semua Perubahan Konfigurasi</h4>
          <p className="text-xs text-emerald-300 font-medium mt-0.5">
            Perubahan akan langsung aktif untuk pesan chatbot berikutnya secara real-time.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveSettings}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 text-sm uppercase tracking-wider"
        >
          {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave size={18} />}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </div>
    </div>
  );
};

export default ChatbotSettingsTab;
