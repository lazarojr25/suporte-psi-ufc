import express from 'express';
import { getAdminDb } from '../firebaseAdmin.js';
import MeetingsService from '../services/meetingsService.js';

const router = express.Router();

let db = null;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin:', error);
}

const meetingsService = new MeetingsService(db);

const withStatus = (res, result) => {
  const statusCode = result?.statusCode || 200;
  if (result?.success === false) {
    return res.status(statusCode).json(result);
  }
  return res.status(statusCode).json(result);
};

router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;
    const result = await meetingsService.listMeetings({ status, date });
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao listar reuniões:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar reuniões',
      error: error.message,
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await meetingsService.createMeeting(req.body || {}, req.user || null);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao agendar reunião:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao agendar reunião',
      error: error.message,
    });
  }
});

router.get('/available-slots/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const result = await meetingsService.getAvailableSlots(date);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao obter horários disponíveis:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter horários disponíveis',
      error: error.message,
    });
  }
});

router.get('/can-schedule/:discenteId', async (req, res) => {
  try {
    const { discenteId } = req.params;
    const result = await meetingsService.canSchedule(discenteId);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao verificar limite de sessões:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar limite de sessões',
      error: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await meetingsService.getById(id);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao obter reunião:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter reunião',
      error: error.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await meetingsService.updateMeeting(id, req.body || {}, req.user || null);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao atualizar reunião:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar reunião',
      error: error.message,
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await meetingsService.cancelMeeting(id);
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao cancelar reunião:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao cancelar reunião',
      error: error.message,
    });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await meetingsService.completeMeeting(id, req.body || {});
    return withStatus(res, result);
  } catch (error) {
    console.error('Erro ao concluir reunião:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao concluir reunião',
      error: error.message,
    });
  }
});

export default router;
