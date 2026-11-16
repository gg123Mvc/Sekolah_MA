import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import {
  FiSearch, FiRefreshCw, FiClock, FiCheckCircle, FiAlertCircle,
  FiChevronLeft, FiChevronRight, FiFilter, FiActivity, FiLayers, FiZap
} from 'react-icons/fi';

const ChatbotLogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [page, modeFilter, statusFilter]);

  const fetchLogs = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await adminAPI.getChatbotLogs({
        page,
        limit,
        search,
        dateFrom,
        dateTo,
        mode: modeFilter,
        status: statusFilter
      });

      if (res.data?.success) {
        const d = res.data.data;
        setLogs(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data log chatbot');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setModeFilter('all');
    setStatusFilter('all');
    setPage(1);
    setTimeout(() => {
      adminAPI.getChatbotLogs({ page: 1, limit }).then((res) => {
        if (res.data?.success) {
          const d = res.data.data;
          setLogs(d.data || []);
          setTotal(d.total || 0);
          setTotalPages(d.totalPages || 1);
        }
      });
    }, 50);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-black">
            <FiActivity />
          </div>
          <div>
            <h2 className="text-xl font-black text-emerald-950">Monitoring & Log Aktivitas Chatbot</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Pantau performa respon waktu nyata, provider yang digunakan, mode, dan riwayat pertanyaan pengguna.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700">
            Total Request: <span className="font-black text-emerald-700">{total}</span>
          </div>
          <button
            onClick={() => fetchLogs()}
            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition"
            title="Refresh Log"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={(e) => { setPage(1); fetchLogs(e); }} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Cari pertanyaan / error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Mode Filter */}
          <div>
            <select
              value={modeFilter}
              onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="all">Semua Mode</option>
              <option value="direct">Mode 1 (Direct AI)</option>
              <option value="n8n">Mode 2 (n8n Webhook)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="all">Semua Status</option>
              <option value="success">Berhasil (Success)</option>
              <option value="error">Gagal (Error)</option>
            </select>
          </div>

          {/* Filter Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-xs font-bold transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100 text-xs text-gray-600 font-bold">
          <span className="flex items-center gap-1.5 text-gray-400 uppercase tracking-widest text-[10px]">
            <FiFilter /> Rentang Tanggal:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
            />
            <span className="text-gray-400">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
            />
          </div>
        </div>
      </form>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-4 px-6">Waktu</th>
                <th className="py-4 px-6">Pertanyaan Pengguna</th>
                <th className="py-4 px-6">Provider & Model</th>
                <th className="py-4 px-6">Mode</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Respon Time</th>
                <th className="py-4 px-6">Webhook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400 font-bold">
                    <FiRefreshCw className="animate-spin text-2xl mx-auto mb-2 text-emerald-600" />
                    Memuat data log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400 font-bold">
                    Tidak ada log request yang ditemukan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isSuccess = log.status === 'success';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="hover:bg-gray-50/70 cursor-pointer transition"
                      >
                        {/* Waktu */}
                        <td className="py-4 px-6 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className="block text-[10px] text-gray-400">
                            {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </span>
                        </td>

                        {/* Pertanyaan */}
                        <td className="py-4 px-6 max-w-xs font-bold text-gray-900 truncate">
                          {log.question || '—'}
                        </td>

                        {/* Provider & Model */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-black text-gray-900 uppercase">{log.provider || 'groq'}</span>
                          <span className="block font-mono text-[10px] text-gray-400 truncate max-w-[140px]">
                            {log.model}
                          </span>
                        </td>

                        {/* Mode */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.chatbot_mode === 'n8n'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {log.chatbot_mode === 'n8n' ? 'Mode 2 (n8n)' : 'Mode 1 (Direct)'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {isSuccess ? <FiCheckCircle /> : <FiAlertCircle />}
                            {log.status}
                          </span>
                        </td>

                        {/* Response Time */}
                        <td className="py-4 px-6 whitespace-nowrap font-mono text-xs font-black">
                          <span className={log.response_time_ms > 3000 ? 'text-amber-600' : 'text-emerald-700'}>
                            {log.response_time_ms} ms
                          </span>
                        </td>

                        {/* Webhook Status */}
                        <td className="py-4 px-6 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {log.webhook_status || '—'}
                        </td>
                      </tr>

                      {/* Detail Expand Row (bila ada error atau melihat pertanyaan lengkap) */}
                      {isExpanded && (
                        <tr className="bg-gray-50/90 border-b border-gray-100">
                          <td colSpan="7" className="p-6 space-y-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Pertanyaan Lengkap</p>
                              <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-900 font-medium whitespace-pre-wrap">
                                {log.question}
                              </div>
                            </div>
                            {log.error_message && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Detail Error</p>
                                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs font-mono text-red-700 whitespace-pre-wrap">
                                  {log.error_message}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">
              Halaman <strong className="text-gray-900">{page}</strong> dari <strong className="text-gray-900">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition"
              >
                <FiChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatbotLogsTab;
