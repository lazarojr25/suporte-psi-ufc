import express from 'express';
import AttendanceConfigService from '../services/attendanceConfigService.js';

const router = express.Router();

const service = new AttendanceConfigService();

const withStatus = (res, result) => {
  const statusCode = result?.statusCode || 200;
  if (result?.success === false) {
    return res.status(statusCode).json(result);
  }
  return res.status(statusCode).json(result);
};

// GET /api/attendance-config
router.get('/', async (req, res) => {
  try {
    const result = await service.getConfig();
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao obter attendance-config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter configuração de atendimentos',
      error: error.message
    });
  }
});

// PUT /api/attendance-config
// body: { periodStart, periodEnd, maxSessionsPerDiscente }
router.put('/', async (req, res) => {
  try {
    const result = await service.updateConfig(req.body || {});
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao atualizar attendance-config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração de atendimentos',
      error: error.message
    });
  }
});

export default router;
