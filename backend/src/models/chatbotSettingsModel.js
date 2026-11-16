import supabase from '../config/database.js';

export default class ChatbotSettings {
  /**
   * Mengambil konfigurasi aktif saat ini
   */
  static async getActive() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('chatbot_settings')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('ChatbotSettings.getActive warning:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('ChatbotSettings.getActive exception:', err.message);
      return null;
    }
  }

  /**
   * Simpan atau perbarui konfigurasi aktif
   */
  static async upsert(settings) {
    if (!supabase) {
      throw new Error('Koneksi database Supabase tidak tersedia');
    }

    const existing = await this.getActive();
    const payload = {
      ...settings,
      updated_at: new Date().toISOString()
    };

    if (existing && existing.id) {
      const { data, error } = await supabase
        .from('chatbot_settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('chatbot_settings')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Catat riwayat perubahan konfigurasi (audit trail)
   */
  static async addHistory(historyEntry) {
    if (!supabase) return;
    try {
      await supabase
        .from('chatbot_settings_history')
        .insert({
          changed_by: historyEntry.changed_by || 'admin',
          provider: historyEntry.provider,
          model: historyEntry.model,
          chatbot_mode: historyEntry.chatbot_mode,
          webhook_enabled: historyEntry.webhook_enabled,
          changes_summary: historyEntry.changes_summary,
          created_at: new Date().toISOString()
        });
    } catch (err) {
      console.warn('Failed to insert settings history:', err.message);
    }
  }

  /**
   * Tambahkan log percakapan chatbot
   */
  static async addLog(logEntry) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('chatbot_logs')
        .insert({
          user_id: logEntry.user_id || null,
          question: logEntry.question || '',
          provider: logEntry.provider || 'groq',
          model: logEntry.model || 'unknown',
          chatbot_mode: logEntry.chatbot_mode || 'direct',
          status: logEntry.status || 'success',
          response_time_ms: Math.round(logEntry.response_time_ms || 0),
          webhook_status: logEntry.webhook_status || null,
          error_message: logEntry.error_message || null,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('ChatbotSettings.addLog warning:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('ChatbotSettings.addLog exception:', err.message);
      return null;
    }
  }

  /**
   * Ambil daftar logs dengan filtering dan pagination
   */
  static async getLogs({ page = 1, limit = 15, search = '', dateFrom = '', dateTo = '', mode = '', status = '' }) {
    if (!supabase) {
      return { data: [], total: 0, page: Number(page), limit: Number(limit), totalPages: 0 };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 15));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('chatbot_logs')
      .select('*', { count: 'exact' });

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`question.ilike.%${s}%,error_message.ilike.%${s}%`);
    }

    if (dateFrom && dateFrom.trim()) {
      query = query.gte('created_at', `${dateFrom.trim()}T00:00:00.000Z`);
    }

    if (dateTo && dateTo.trim()) {
      query = query.lte('created_at', `${dateTo.trim()}T23:59:59.999Z`);
    }

    if (mode && mode !== 'all') {
      query = query.eq('chatbot_mode', mode);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    };
  }
}
