'use client'; 

import { useState, ChangeEvent, useRef } from 'react';

// ==========================================
// FUNGSI AUDIO KE WAV
// ==========================================
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let sample, offset = 0, pos = 0;

  const setUint16 = (data: number) => { view.setUint16(offset, data, true); offset += 2; };
  const setUint32 = (data: number) => { view.setUint32(offset, data, true); offset += 4; };

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16);
  setUint32(0x61746164); setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }
  return new Blob([bufferArr], { type: "audio/wav" });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); 
  const [isHovering, setIsHovering] = useState<boolean>(false); 
  
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // PERBAIKAN 1: Label disamakan persis dengan output Hugging Face
  const labelMap: Record<string, string> = {
    "Normal": "Normal",
    "Kerusakan Ringan": "Kerusakan Ringan",
    "Kerusakan Parah": "Kerusakan Parah",
  };

  // PERBAIKAN 2: Kata kuncinya disamakan jadi "Kerusakan Ringan" & "Kerusakan Parah"
  const deskripsiMap: Record<string, string> = {
    "Normal": "Sinyal suara stabil didominasi dengungan dasar perputaran mesin tanpa frekuensi liar. V-belt, roller, dan komponen CVT berfungsi wajar.",
    "Kerusakan Ringan": "Terdeteksi anomali (bunyi berdecit/getaran ringan) pada pita frekuensi menengah. Terdapat indikasi keausan awal, komponen kotor, atau kering. Disarankan servis ringan.",
    "Kerusakan Parah": "Peringatan Kritis! Terdeteksi kekacauan energi suara (suara ngorok/benturan keras) menembus frekuensi tinggi. Indikasi kerusakan fatal (roller hancur/bearing aus). Segera bawa ke bengkel!"
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
    setHasil(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        setIsProcessing(true); 
        stream.getTracks().forEach(track => track.stop()); 
        
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(await webmBlob.arrayBuffer());

        setFile(new File([audioBufferToWav(audioBuffer)], "rekaman-mekanis.wav", { type: 'audio/wav' }));
        setIsProcessing(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setHasil(null); setFile(null);
    } catch (error) { alert("Akses mikrofon ditolak."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analisisSuara = async () => {
    if (!file) return;
    setLoading(true); setHasil(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/wav" },
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
        
        <div className="text-center mb-8">
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
            {isRecording && <p className="text-red-500 text-sm font-bold tracking-widest animate-pulse">● MEREKAM...</p>}
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
              <span>Memproses Matriks...</span>
            </div>
          ) : (
            'Analisis AI Sekarang'
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
                    {/* PERBAIKAN 3: Logika warna disesuaikan dengan "Kerusakan Ringan" & "Kerusakan Parah" */}
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

            {/* PERBAIKAN 4: Warna kotak kesimpulan disesuaikan dengan "Kerusakan Ringan" & "Kerusakan Parah" */}
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