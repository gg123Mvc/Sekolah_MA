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
}
