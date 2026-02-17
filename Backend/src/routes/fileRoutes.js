const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Upload Flow
router.post('/upload/init', fileController.initUpload);
router.post('/upload/complete', fileController.completeUpload);
router.post('/upload/abort', fileController.abortUpload);

// Management
router.get('/:id/download', fileController.downloadFile);
router.patch('/:id', fileController.updateFile);
router.delete('/:id', fileController.deleteFile);
router.post('/:id/restore', fileController.restoreFile);
router.delete('/:id/permanent', fileController.permanentDeleteFile);

module.exports = router;
