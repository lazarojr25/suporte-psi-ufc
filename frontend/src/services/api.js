import { auth } from './firebase';
// Serviço para comunicação com o backend Node.js
const API_BASE_URL = 'http://localhost:5001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getAuthToken() {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (e) {
      console.warn('Falha ao obter ID token:', e?.message);
      return null;
    }
  }

  // Método genérico para fazer requisições
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    // Detecta se o body é FormData
    const isFormData = options?.body instanceof FormData;

    // Monta headers sem aplicar Content-Type para FormData
    const headers = {
      ...(options.headers || {})
    };
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Anexa token de auth, exceto se explicitamente ignorado
    const token = options.skipAuth ? null : await this.getAuthToken();
    if (!options.skipAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Tenta decidir automaticamente como parsear
      const contentType = response.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        // fallback para blob (ex.: exportações)
        data = await response.blob();
      }

      if (!response.ok) {
        const message = typeof data === 'object' && data?.message
          ? data.message
          : `HTTP error! status: ${response.status}`;
        throw new Error(message);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // ------------------ Solicitações de Atendimento ------------------
  async getSolicitacoesByDiscente(discenteId) {
    const query = discenteId
      ? `?discenteId=${encodeURIComponent(discenteId)}`
      : '';
    return this.request(`/solicitacoes${query}`);
  }

  // ------------------ Reuniões ------------------
  async getMeetings(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = `/meetings${queryParams ? `?${queryParams}` : ''}`;
    return this.request(endpoint);
  }

  async createMeeting(meetingData) {
    return this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }

  async getMeeting(id) {
    return this.request(`/meetings/${id}`);
  }

  async updateMeeting(id, updateData) {
    return this.request(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async deleteMeeting(id) {
    return this.request(`/meetings/${id}`, {
      method: 'DELETE',
    });
  }

  async completeMeeting(id, completionData) {
    return this.request(`/meetings/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(completionData),
    });
  }

  async getAvailableSlots(date) {
    return this.request(`/meetings/available-slots/${date}`);
  }

  // ------------------ Transcrição ------------------

  // Novo método genérico: aceita áudio e vídeo
  async uploadMedia(file, extraMeta = {}) {
    const formData = new FormData();
    formData.append('audio', file);

    Object.entries(extraMeta).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    return this.request('/transcription/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadTranscriptText(file, extraMeta = {}) {
    const formData = new FormData();
    formData.append('transcript', file);
    Object.entries(extraMeta).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    return this.request('/transcription/upload-text', {
      method: 'POST',
      body: formData,
    });
  }

  // --- Transcrições por discente ---
  async getTranscriptionsByDiscente(discenteId) {
    return this.request(`/transcription/by-discente/${discenteId}`);
  }

  // --- Relatórios por discente ---
  async getReportsByDiscente(discenteId) {
    return this.request(`/reports/by-discente/${discenteId}`);
  }

  // Mantido para compatibilidade: sem metadados
  async uploadAudio(audioFile) {
    return this.uploadMedia(audioFile);
  }

  async getTranscriptions() {
    return this.request('/transcription/list');
  }

  async getTranscription(fileName) {
    return this.request(`/transcription/${encodeURIComponent(fileName)}`);
  }

  async analyzeText(text) {
    return this.request('/transcription/analyze', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // ------------------ Relatórios ------------------
  async getReportsOverview() {
    return this.request('/reports/overview');
  }

  async getReportsAnalytics() {
    return this.request('/reports/analytics');
  }

  async exportReports() {
    // Aqui queremos sempre blob para download
    const res = await fetch(`${this.baseURL}/reports/export`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.blob();
  }

  async exportReportsOverview() {
    const res = await fetch(`${this.baseURL}/reports/overview/export`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const contentDisposition = res.headers.get('content-disposition') || '';
    let fileName = null;
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      fileName = match[1];
    }
    const blob = await res.blob();
    return { blob, fileName };
  }

  async exportReportsOverviewPdf() {
    const res = await fetch(`${this.baseURL}/reports/overview/export-pdf`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const contentDisposition = res.headers.get('content-disposition') || '';
    let fileName = null;
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      fileName = match[1];
    }
    const blob = await res.blob();
    return { blob, fileName };
  }

  // ------------------ Saúde ------------------
  async healthCheck() {
    return this.request('/health');
  }
  
  // ------------------ Usuários (Admin SDK) ------------------
  async createUserAdmin(payload) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async reprocessAllTranscriptions(discenteId, { force = true } = {}) {
    return this.request('/transcription/reprocess-all', {
      method: 'POST',
      body: JSON.stringify({ discenteId, force }),
    });
  }

  async deleteTranscription(fileName) {
    return this.request(`/transcription/${fileName}`, {
      method: 'DELETE',
    });
  }

  // ------------------ Limite de sessões ------------------

  async canScheduleForDiscente(discenteId) {
    return this.request(`/meetings/can-schedule/${discenteId}`);
  }

  // ------------------ Config de atendimentos (opcional tela futura) ------------------

  async getAttendanceConfig() {
    return this.request('/attendance-config');
  }

  async updateAttendanceConfig(payload) {
    return this.request('/attendance-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  
  
}

// Instância singleton do serviço
const apiService = new ApiService();
export default apiService;
