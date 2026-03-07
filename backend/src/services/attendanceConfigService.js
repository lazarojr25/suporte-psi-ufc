import {
  getAttendanceConfig,
  updateAttendanceConfig,
} from '../controllers/attendanceConfig.js';

export default class AttendanceConfigService {
  async getConfig() {
    try {
      const data = await getAttendanceConfig();
      return {
        success: true,
        message: 'Configuração de atendimento carregada com sucesso.',
        data,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Erro ao carregar configuração de atendimentos.',
        error: error.message,
      };
    }
  }

  async updateConfig(partial = {}) {
    try {
      const data = await updateAttendanceConfig(partial || {});
      return {
        success: true,
        message: 'Configuração de atendimento atualizada com sucesso.',
        data,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        message: 'Erro ao atualizar configuração de atendimentos.',
        error: error.message,
      };
    }
  }
}
