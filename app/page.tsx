'use client'; 

import { useState, ChangeEvent, useRef } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); 
  const [isHovering, setIsHovering] = useState<boolean>(false); 
  
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const labelMap: Record<string, string> = {
    "Normal": "Normal",
    "Kerusakan Ringan": "Kerusakan Ringan",
    "Kerusakan Parah": "Kerusakan Parah",
  };

  // PEMBARUAN: Deskripsi disesuaikan untuk memberikan kesimpulan komponen spesifik (Saran Penguji)
const deskripsiMap: Record<string, string> = {
  "Normal": "Status: Aman. Pola akustik transmisi CVT berada dalam ambang batas normal. Tidak terdeteksi gesekan atau getaran berlebih. Tetap lakukan perawatan berkala sesuai jadwal buku panduan.",
  
  "Kerusakan Ringan": "Status: Perlu Perhatian (Indikasi Keausan Awal). Pola suara mendeteksi getaran tidak wajar atau bunyi decit. \n\nKesimpulan Komponen: Terdapat potensi penumpukan kotoran/debu pada area CVT, pelumas (grease) yang mulai mengering, atau keausan ringan pada V-Belt dan Roller yang mulai tidak presisi (peyang). \n\nTindakan: Lakukan servis CVT (pembersihan, penyetelan, dan pelumasan ulang) di bengkel untuk mencegah keausan merambat.",

  "Kerusakan Parah": "Status: Kritis (Peringatan Kerusakan Mekanis). Pola suara mendeteksi kebisingan tingkat tinggi (kasar/berderak). \n\nKesimpulan Komponen: Terdapat indikasi kerusakan fisik pada komponen utama penggerak. Kemungkinan besar disebabkan oleh V-Belt yang retak/aus parah, Kampas Ganda yang habis, kerusakan pada Rumah Roller (Pulley), atau keausan Bearing CVT. \n\nTindakan: Segera bawa kendaraan ke bengkel untuk inspeksi visual dan penggantian komponen (parts) guna mencegah transmisi macet atau putus di jalan."
};

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
    setHasil(null);
  };

  const stopRecordingAction = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1, 
        } 
      });
      
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { 
        if (e.data.size > 0) audioChunksRef.current.push(e.data); 
      };
      
      mediaRecorder.onstop = () => {
        setIsProcessing(true); 
        stream.getTracks().forEach(track => track.stop()); 
        
        try {
          const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          
          const extension = actualMimeType.includes('mp4') ? 'mp4' : 'webm';
          const audioFile = new File([audioBlob], `rekaman-mekanis.${extension}`, { type: actualMimeType });

          setFile(audioFile);
        } catch (error) {
          console.error("Gagal memproses rekaman:", error);
          alert("Gagal menyimpan rekaman lokal.");
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setHasil(null); setFile(null);

      // PEMBARUAN: Waktu otomatis berhenti diubah menjadi 10 detik (10000 ms)
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecordingAction();
      }, 10000);

    } catch (error) { alert("Akses mikrofon ditolak."); }
  };

  const stopRecording = () => {
    stopRecordingAction();
  };

  const analisisSuara = async () => {
    if (!file) return;
    setLoading(true); setHasil(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/webm" },
        body: await file.arrayBuffer(),
      });
      const result = await response.json();

      if (response.status === 503 && result.estimated_time) {
        alert(`Model dipanaskan. Tunggu ${Math.round(result.estimated_time)} detik.`);
        setLoading(false); return;
      }
      if (!response.ok) throw new Error(result.error);
      
      setTimeout(() => setHasil(result), 500); 
    } catch (error: any) { alert(`Gagal menganalisis: ${error.message}`); }
    finally { setTimeout(() => setLoading(false), 500); }
  };

  let topPredictionLabel = "";
  if (hasil && !hasil.error && hasil.length > 0) {
    const sortedHasil = [...hasil].sort((a: any, b: any) => b.score - a.score);
    topPredictionLabel = labelMap[sortedHasil[0].label] || sortedHasil[0].label;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-100 to-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      
      <div className="w-full max-w-[28rem] bg-white/70 backdrop-blur-xl border border-white rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] p-8 transition-all duration-500">
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-800 to-blue-500 bg-clip-text text-transparent">
            CVT Smart Analyzer
          </h1>
          <p className="text-gray-500 text-sm mt-2">Sistem Deteksi Anomali Akustik Motor Matik</p>
        </div>

       {/* PEMBARUAN: Kotak Panduan Perekaman (SOP) dengan Titik Perekaman Presisi */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Panduan Perekaman Akurat
          </h3>
          <ol className="text-xs text-blue-700 space-y-1.5 ml-1 list-decimal list-inside">
            <li>Posisikan mikrofon ponsel pada jarak <strong>15 - 20 cm</strong> menghadap tegak lurus ke sisi kiri motor.</li>
          
            <li>Arahkan titik rekam presisi di <strong>bagian tengah penutup/blok CVT</strong> (berada di antara puli depan dan puli belakang).</li>
          
            <li>Kondisi motor dapat <strong>stasioner (idle)</strong> atau lakukan <strong>tarikan gas ringan</strong> untuk memancing suara decit/getaran.</li>
          
            <li>Tekan tombol rekam dan tahan posisi selama maksimal 10 detik.</li>
          </ol>
        </div>

        <div className="flex flex-col items-center justify-center mb-8 relative">
          {isRecording && <div className="absolute inset-0 m-auto w-32 h-32 bg-red-400 rounded-full blur-xl animate-pulse opacity-50"></div>}
          
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
              isRecording 
                ? 'bg-gradient-to-tr from-red-600 to-pink-500' 
                : isProcessing ? 'bg-gray-400' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
            }`}
          >
            <span className="text-3xl drop-shadow-md">
              {isRecording ? '⏹' : isProcessing ? '⏳' : '🎙️'}
            </span>
          </button>
          
          <div className="h-6 mt-4 text-center">
            {/* PEMBARUAN: Teks indikator diubah ke 10 detik */}
            {isRecording && <p className="text-red-500 text-sm font-bold animate-pulse">● MEREKAM (Maksimal 10 Detik)...</p>}
            {isProcessing && <p className="text-indigo-500 text-sm font-semibold animate-pulse">Menyelaraskan Frekuensi...</p>}
          </div>
        </div>

        <div className="flex items-center w-full mb-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          <span className="px-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">atau unggah audio</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        </div>

        <div 
          className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl transition-all duration-300 mb-6 ${
            isHovering || file ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 bg-gray-50 hover:bg-slate-100'
          }`}
          onDragOver={() => setIsHovering(true)}
          onDragLeave={() => setIsHovering(false)}
          onDrop={() => setIsHovering(false)}
        >
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {file ? (
            <div className="text-center p-4">
              <div className="text-blue-600 mb-1">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <p className="text-sm font-semibold text-blue-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-blue-500">Ketuk untuk mengganti</p>
            </div>
          ) : (
            <div className="text-center p-4">
              <p className="text-sm font-medium text-gray-600">Tarik berkas ke sini, atau</p>
              <p className="text-sm font-bold text-blue-600 mt-1">Jelajahi Berkas</p>
              {/* PEMBARUAN: Teks panduan upload disesuaikan */}
              <p className="text-[10px] text-gray-400 mt-1">(Batas Maksimal: 10 Detik)</p>
            </div>
          )}
        </div>

        <button 
          onClick={analisisSuara}
          disabled={loading || !file || isRecording || isProcessing}
          className={`relative w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center ${
            loading || !file || isRecording || isProcessing 
              ? 'bg-slate-300 cursor-not-allowed shadow-none' 
              : 'bg-gradient-to-r from-gray-900 to-slate-800 hover:shadow-xl hover:-translate-y-0.5'
          }`}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Memproses Suara...</span>
            </div>
          ) : (
            'Analisis Suara Sekarang'
          )}
        </button>

        {hasil && !hasil.error && (
          <div className="mt-8 animate-fade-in-up border-t border-gray-100 pt-6">
            
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
              <h3 className="font-extrabold text-lg text-slate-800">Laporan Diagnostik</h3>
            </div>
            
            <div className="space-y-4">
              {(hasil as any[]).map((item: any, index: number) => {
                const isTop = index === 0; 
                const percentage = Math.round(item.score * 100);
                return (
                  <div key={index} className="relative">
                    <div className="flex justify-between text-sm font-medium mb-1.5">
                      <span className={isTop ? "text-slate-900 font-bold" : "text-slate-500"}>
                        {labelMap[item.label] || item.label}
                      </span>
                      <span className={isTop ? "text-blue-600 font-black" : "text-slate-400"}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isTop 
                            ? topPredictionLabel === 'Kerusakan Parah' ? 'bg-red-500' : topPredictionLabel === 'Kerusakan Ringan' ? 'bg-amber-500' : 'bg-green-500'
                            : 'bg-slate-300'
                        }`} 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`mt-6 p-4 rounded-xl border border-l-4 shadow-sm ${
                topPredictionLabel === 'Kerusakan Parah' ? 'bg-red-50 border-red-200 border-l-red-500' : 
                topPredictionLabel === 'Kerusakan Ringan' ? 'bg-amber-50 border-amber-200 border-l-amber-500' : 
                'bg-green-50 border-green-200 border-l-green-500'
              }`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-xl mt-0.5">
                  {topPredictionLabel === 'Kerusakan Parah' ? '🚨' : topPredictionLabel === 'Kerusakan Ringan' ? '🔧' : '✅'}
                </span>
                <div>
                  <strong className={`block text-sm mb-1 ${
                    topPredictionLabel === 'Kerusakan Parah' ? 'text-red-800' : topPredictionLabel === 'Kerusakan Ringan' ? 'text-amber-800' : 'text-green-800'
                  }`}>
                    Kesimpulan Sistem
                  </strong>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {deskripsiMap[topPredictionLabel] || "Menunggu hasil..."}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
