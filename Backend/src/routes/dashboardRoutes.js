const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/recent', dashboardController.getRecent);
router.get('/starred', dashboardController.getStarred);
router.get('/trash', dashboardController.getTrash);
router.get('/shared', dashboardController.getShared);
router.get('/storage', dashboardController.getStorage);

router.post('/star', dashboardController.toggleStar);
router.delete('/trash/empty', dashboardController.emptyTrash);

module.exports = router;
