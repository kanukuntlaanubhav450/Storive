const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const authMiddleware = require('../middlewares/authMiddleware');

// All folder routes require authentication
router.use(authMiddleware);

router.post('/', folderController.createFolder);
router.get('/:id', folderController.getFolder); // Use 'root' as ID for top-level
router.patch('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);

module.exports = router;
