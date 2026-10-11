import React, { useState, useCallback } from 'react';
import { FiX, FiMapPin, FiNavigation, FiRefreshCw, FiExternalLink, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { aiAgentAPI } from '../../utils/api';

// Status enum untuk state machine
const STATUS = {
  IDLE: 'idle',              // Belum mulai - tampilkan tombol Izinkan Lokasi
  LOCATING: 'locating',     // GPS aktif, mencari koordinat
  CALCULATING: 'calculating', // Mengirim ke backend, menghitung rute
  SUCCESS: 'success',       // Hasil berhasil diperoleh
  ERROR: 'error',           // Gagal (GPS error atau routing error)
};

// Terjemahkan kode error GeolocationPositionError ke pesan ramah pengguna
const getGPSErrorMessage = (error) => {
  if (!error) return 'GPS tidak dapat memperoleh koordinat. Silakan coba lagi.';
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'Anda belum memberikan izin akses lokasi. Fitur cek jarak memerlukan akses lokasi perangkat untuk menentukan jarak dari lokasi Anda ke sekolah. Silakan berikan izin lokasi jika ingin melanjutkan.';
    case 2: // POSITION_UNAVAILABLE
      return 'Layanan lokasi perangkat tidak tersedia atau dinonaktifkan. Pastikan GPS perangkat Anda aktif lalu coba lagi.';
    case 3: // TIMEOUT
      return 'Waktu pencarian lokasi habis. Sinyal GPS mungkin lemah di lokasi Anda. Silakan coba lagi di area terbuka.';
    default:
      return 'Browser tidak dapat memperoleh koordinat GPS. Pastikan perangkat dan browser mendukung fitur lokasi.';
  }
};

const DistanceChecker = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [gpsError, setGpsError] = useState(null);
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setErrorMessage('');
    setGpsError(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleRequestGPS = useCallback(() => {
    // Pastikan browser mendukung Geolocation API
    if (!navigator.geolocation) {
      setErrorMessage('Browser Anda tidak mendukung fitur lokasi GPS. Gunakan browser modern seperti Chrome, Firefox, atau Safari terbaru.');
      setStatus(STATUS.ERROR);
      return;
    }

    setStatus(STATUS.LOCATING);
    setErrorMessage('');
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      // Sukses: koordinat GPS diperoleh
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setStatus(STATUS.CALCULATING);

        try {
          const response = await aiAgentAPI.calculateDistance(latitude, longitude, accuracy);
          if (response.data.success) {
            setResult(response.data.data);
            setStatus(STATUS.SUCCESS);
          } else {
            setErrorMessage('Terjadi kesalahan saat menghitung jarak. Silakan coba lagi.');
            setStatus(STATUS.ERROR);
          }
        } catch (apiErr) {
          console.error('Distance API error:', apiErr);
          if (apiErr.response?.data?.message) {
            setErrorMessage(apiErr.response.data.message);
          } else {
            setErrorMessage('Layanan penghitungan rute sedang tidak tersedia. Silakan coba beberapa saat lagi.');
          }
          setStatus(STATUS.ERROR);
        }
      },
      // Gagal: izin ditolak atau GPS error
      (error) => {
        setGpsError(error);
        setErrorMessage(getGPSErrorMessage(error));
        setStatus(STATUS.ERROR);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,      // 15 detik timeout
        maximumAge: 0        // Selalu ambil posisi terbaru
      }
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="distance-checker-title"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <FiNavigation size={20} />
            </div>
            <div>
              <h2 id="distance-checker-title" className="font-bold text-lg leading-tight">Cek Jarak ke Sekolah</h2>
              <p className="text-emerald-200 text-xs mt-0.5">Menggunakan GPS perangkat Anda</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
            aria-label="Tutup"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">

          {/* IDLE: Tampilkan informasi dan tombol izin */}
          {status === STATUS.IDLE && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <FiMapPin size={36} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Izinkan Akses Lokasi</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Untuk menghitung jarak dari lokasi Anda ke sekolah, sistem memerlukan akses lokasi GPS perangkat Anda. Lokasi Anda hanya digunakan untuk menghitung jarak dan tidak akan disimpan.
              </p>
              <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-emerald-800 text-xs font-semibold mb-2">Tujuan:</p>
                <div className="flex items-start gap-2">
                  <FiMapPin size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-emerald-900 text-sm font-bold">MA Bina Cendekia</p>
                    <p className="text-emerald-700 text-xs">Jl. Raya Madrasah No. 123, Jawa Barat</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  id="distance-checker-cancel-btn"
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleRequestGPS}
                  id="distance-checker-allow-btn"
                  className="flex-1 py-3 bg-emerald-700 text-white font-bold rounded-2xl hover:bg-emerald-800 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                >
                  <FiNavigation size={16} />
                  Izinkan Lokasi
                </button>
              </div>
            </div>
          )}

          {/* LOCATING / CALCULATING: Loading spinner */}
          {(status === STATUS.LOCATING || status === STATUS.CALCULATING) && (
            <div className="text-center py-8">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 border-4 border-emerald-100 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FiNavigation size={22} className="text-emerald-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {status === STATUS.LOCATING ? 'Mendapatkan Lokasi...' : 'Menghitung Jarak...'}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {status === STATUS.LOCATING
                  ? 'GPS sedang mencari koordinat Anda. Pastikan perangkat berada di area dengan sinyal GPS yang baik.'
                  : 'Koordinat berhasil diperoleh. Sedang menghitung rute perjalanan ke sekolah...'
                }
              </p>
            </div>
          )}

          {/* SUCCESS: Tampilkan hasil jarak */}
          {status === STATUS.SUCCESS && result && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                  <FiCheckCircle size={22} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Jarak Berhasil Dihitung</h3>
                  <p className="text-gray-400 text-xs">Koordinat GPS perangkat Anda</p>
                </div>
              </div>

              {/* Tujuan */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tujuan</p>
                <div className="flex items-center gap-2">
                  <FiMapPin size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-gray-800 font-bold text-sm">{result.school?.name || 'MA Bina Cendekia'}</p>
                </div>
              </div>

              {/* Jarak rute OSRM (data utama) */}
              {result.route ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-emerald-700 mb-1">
                      {result.route.distanceKm} <span className="text-base font-bold">km</span>
                    </div>
                    <p className="text-emerald-600 text-xs font-semibold">Jarak Rute</p>
                    <p className="text-emerald-500 text-[10px]">melalui jalan</p>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-blue-700 mb-1">
                      {result.route.durationMinutes} <span className="text-base font-bold">mnt</span>
                    </div>
                    <p className="text-blue-600 text-xs font-semibold">Estimasi Waktu</p>
                    <p className="text-blue-500 text-[10px]">kendaraan bermotor</p>
                  </div>
                </div>
              ) : (
                // OSRM tidak tersedia, tampilkan jarak garis lurus dengan catatan
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <FiAlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-amber-700 text-xs">Layanan routing tidak tersedia saat ini. Menampilkan perkiraan jarak garis lurus.</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-amber-700 mb-1">
                      {result.straightLineKm} <span className="text-base font-bold">km</span>
                    </div>
                    <p className="text-amber-600 text-xs font-semibold">Jarak Garis Lurus (estimasi)</p>
                    <p className="text-amber-500 text-[10px]">jarak aktual melalui jalan bisa lebih jauh</p>
                  </div>
                </div>
              )}

              {/* Jarak garis lurus sebagai referensi tambahan */}
              {result.route && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 mb-3">
                  <span className="text-gray-500 text-xs">Jarak garis lurus</span>
                  <span className="text-gray-700 text-sm font-bold">{result.straightLineKm} km</span>
                </div>
              )}

              {/* Akurasi GPS */}
              {result.accuracy && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 mb-4">
                  <span className="text-gray-500 text-xs">Akurasi GPS</span>
                  <span className="text-gray-700 text-sm font-bold">±{Math.round(result.accuracy)} meter</span>
                </div>
              )}

              {/* Tombol aksi */}
              <div className="flex gap-3 mt-4">
                {result.route?.mapsUrl && (
                  <a
                    href={result.route.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="distance-checker-maps-btn"
                    className="flex-1 py-3 bg-emerald-700 text-white font-bold rounded-2xl hover:bg-emerald-800 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                  >
                    <FiExternalLink size={15} />
                    Lihat di Maps
                  </a>
                )}
                <button
                  onClick={reset}
                  id="distance-checker-retry-success-btn"
                  className={`${
                    result.route?.mapsUrl ? 'px-4' : 'flex-1'
                  } py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2`}
                >
                  <FiRefreshCw size={14} />
                  {!result.route?.mapsUrl && 'Cek Ulang'}
                </button>
              </div>
            </div>
          )}

          {/* ERROR: Gagal mendapatkan GPS atau routing */}
          {status === STATUS.ERROR && (
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <FiAlertTriangle size={36} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {gpsError?.code === 1 ? 'Izin Lokasi Ditolak' : 'Lokasi Tidak Dapat Diperoleh'}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {errorMessage}
              </p>

              {/* Panduan khusus jika izin ditolak */}
              {gpsError?.code === 1 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 text-left">
                  <p className="text-amber-800 text-xs font-bold mb-2">Cara mengaktifkan izin lokasi:</p>
                  <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                    <li>Klik ikon kunci/gembok di address bar browser</li>
                    <li>Pilih &quot;Izinkan&quot; pada pengaturan Lokasi</li>
                    <li>Muat ulang halaman lalu klik Coba Lagi</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  id="distance-checker-cancel-error-btn"
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={reset}
                  id="distance-checker-retry-btn"
                  className="flex-1 py-3 bg-emerald-700 text-white font-bold rounded-2xl hover:bg-emerald-800 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                >
                  <FiRefreshCw size={15} />
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DistanceChecker;
