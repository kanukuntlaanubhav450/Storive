const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const authMiddleware = require('../middlewares/authMiddleware');

// All folder routes require authentication
router.use(authMiddleware);

router.post('/', folderController.createFolder);
router.get('/', (req, res, next) => {
    req.params.id = 'root';
    folderController.getFolder(req, res, next);
});
router.get('/:id/download', folderController.downloadFolder);
router.get('/:id', folderController.getFolder); // Use 'root' as ID for top-level
router.patch('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);
router.post('/:id/restore', folderController.restoreFolder);
router.delete('/:id/permanent', folderController.permanentDeleteFolder);

module.exports = router;
