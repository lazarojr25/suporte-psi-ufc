import express from 'express';
import { getAttendanceConfig, updateAttendanceConfig } from '../controllers/attendanceConfig.js';

const router = express.Router();

// GET /api/attendance-config
router.get('/', async (req, res) => {
  try {
    const config = await getAttendanceConfig();
    res.json({ success: true, data: config });
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
    const partial = req.body || {};
    const updated = await updateAttendanceConfig(partial);
    res.json({ success: true, data: updated });
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
