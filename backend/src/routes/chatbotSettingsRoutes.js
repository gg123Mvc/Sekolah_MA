import express from 'express';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import * as chatbotSettingsController from '../controllers/chatbotSettingsController.js';

const router = express.Router();

// Lindungi seluruh endpoint admin pengaturan chatbot dengan autentikasi & otorisasi admin
router.use(authenticateToken);
router.use(authorizeAdmin);

// Pengaturan Chatbot
router.get('/', chatbotSettingsController.getSettings);
router.put('/', chatbotSettingsController.updateSettings);

// Testing Koneksi
router.post('/test-ai', chatbotSettingsController.testAIConnection);
router.post('/test-webhook', chatbotSettingsController.testWebhook);

export default router;
