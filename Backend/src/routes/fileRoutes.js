const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Upload Flow
router.post('/init', fileController.initUpload);
router.post('/complete', fileController.completeUpload);

// Management
router.get('/:id/download', fileController.downloadFile);
router.patch('/:id', fileController.updateFile);
router.delete('/:id', fileController.deleteFile);
router.post('/:id/restore', fileController.restoreFile);

module.exports = router;
