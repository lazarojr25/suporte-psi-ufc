export default function MeetingDetalheTranscricao({
  selectedFile,
  onAudioFileChange,
  onUpload,
  uploading,
  uploadMsg,
  uploadErr,
  selectedTxt,
  onTxtFileChange,
  onTxtUpload,
  txtUploading,
  txtMsg,
  txtErr,
  isConcluida,
  containerClassName = '',
}) {
  return (
    <div className={`bg-white rounded-xl shadow p-4 space-y-3 ${containerClassName}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-gray-500">Transcrição</p>
        {uploadMsg && <span className="text-[11px] text-green-600">{uploadMsg}</span>}
        {uploadErr && <span className="text-[11px] text-red-600">{uploadErr}</span>}
        {txtMsg && <span className="text-[11px] text-green-600">{txtMsg}</span>}
        {txtErr && <span className="text-[11px] text-red-600">{txtErr}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600 uppercase">Áudio/Vídeo</p>
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => onAudioFileChange(e.target.files[0] || null)}
            className="text-sm"
          />
          <p className="text-[11px] text-gray-500">
            Formatos: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV, AVI. Limite: 500MB.
          </p>
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading || !selectedFile}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading ? 'Enviando...' : 'Enviar e transcrever'}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-gray-600 uppercase">Transcrição pronta (.txt)</p>
          <input
            id="txtTranscriptionFile"
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => onTxtFileChange(e.target.files[0] || null)}
            className="text-sm"
          />
          <p className="text-[11px] text-gray-500">
            Envie o .txt exportado pelo Meet; faremos apenas a análise e vínculo.
          </p>
          <button
            type="button"
            onClick={onTxtUpload}
            disabled={txtUploading || !selectedTxt}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {txtUploading ? 'Processando...' : 'Enviar TXT e analisar'}
          </button>
        </div>
      </div>
      {isConcluida && (
        <p className="text-[11px] text-gray-500">Esta sessão está marcada como concluída.</p>
      )}
    </div>
  );
}
