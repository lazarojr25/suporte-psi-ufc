import express from 'express';
import TranscriptionService from '../services/transcriptionService.js';
import { getAdminDb } from '../firebaseAdmin.js';
import ReportsService from '../services/reportsService.js';

const router = express.Router();

let db = null;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin em reports:', error);
}

const transcriptionService = new TranscriptionService();
const reportsService = new ReportsService(db, transcriptionService);

const sendPdfBuffer = (res, fileName, buffer) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};

const sendTextFile = (res, fileName, content) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(content);
};

router.get('/overview', async (req, res) => {
  try {
    const data = await reportsService.getOverviewData();
    res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('Erro no overview de relatórios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar overview de relatórios',
      error: error.message,
    });
  }
});

router.get('/overview/export', async (req, res) => {
  try {
    const { fileName, content } = await reportsService.getOverviewExportText();
    sendTextFile(res, fileName, content);
  } catch (error) {
    console.error('Erro ao exportar análise geral:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar análise geral',
      error: error.message,
    });
  }
});

router.get('/overview/export-pdf', async (req, res) => {
  try {
    const { fileName, content } = await reportsService.getOverviewExportPdf();
    sendPdfBuffer(res, fileName, content);
  } catch (error) {
    console.error('Erro ao exportar análise geral em PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar análise geral em PDF',
      error: error.message,
    });
  }
});

router.get('/by-course-details', async (req, res) => {
  try {
    const { course: courseFilter } = req.query;
    const data = await reportsService.getByCourseDetails({ courseFilter });
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro em /reports/by-course-details:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar detalhes por curso',
      error: error.message,
    });
  }
});

router.get('/by-discente/:discenteId', async (req, res) => {
  try {
    const { discenteId } = req.params;
    const data = await reportsService.getByDiscenteData(discenteId);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro em relatório por discente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro em relatório por discente',
      error: error.message,
    });
  }
});

router.get('/by-discente/:discenteId/export', async (req, res) => {
  try {
    const { discenteId } = req.params;
    const { fileName, content } = await reportsService.getByDiscenteExportText(
      discenteId,
    );
    sendTextFile(res, fileName, content);
  } catch (error) {
    console.error('Erro ao exportar relatório do discente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar relatório do discente',
      error: error.message,
    });
  }
});

router.get('/by-discente/:discenteId/export-pdf', async (req, res) => {
  try {
    const { discenteId } = req.params;
    const { fileName, content } = await reportsService.getByDiscenteExportPdf(
      discenteId,
    );
    sendPdfBuffer(res, fileName, content);
  } catch (error) {
    console.error('Erro ao exportar relatório do discente em PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar relatório do discente em PDF',
      error: error.message,
    });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const data = await reportsService.getAnalytics();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao gerar analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar analytics',
      error: error.message,
    });
  }
});

router.get('/export-json', async (req, res) => {
  try {
    const data = await reportsService.getExportJsonData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcriptions_export_${Date.now()}.json"`,
    );
    res.json(data);
  } catch (error) {
    console.error('Erro ao exportar dados (JSON):', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar dados (JSON)',
      error: error.message,
    });
  }
});

router.get('/export-text', async (req, res) => {
  try {
    const { fileName, content } = await reportsService.getExportText();
    sendTextFile(res, fileName, content);
  } catch (error) {
    console.error('Erro ao exportar dados (Texto):', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar dados (Texto)',
      error: error.message,
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { solicitante, curso, dataInicio, dataFim, palavra } = req.query;
    const transcriptions = await reportsService.searchTranscriptions({
      solicitante,
      curso,
      dataInicio,
      dataFim,
      palavra,
    });
    res.json({
      success: true,
      data: transcriptions,
    });
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar relatórios',
      error: error.message,
    });
  }
});

export default router;
