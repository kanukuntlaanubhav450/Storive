const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/', shareController.shareResource);
router.get('/', shareController.getShares);
router.post('/revoke', shareController.unshareResource);

// Public Links
router.post('/links', shareController.createPublicLink);
router.post('/links/revoke', shareController.revokePublicLink);
// Accessing public link does NOT require auth middleware usually? 
// Actually, `shareRoutes` uses `authMiddleware`. 
// We should probably separate `accessPublicLink` to a public route OR allow it to be called without auth.
// For now, let's keep it here but we might need to conditionally apply auth in app.js or separate route file.
// Or we just make a new specific route that is NOT protected.
// Let's create a separate public route file or just put it in `app.js` directly or handle it here with bypass.
// Ideally: `GET /api/public/shares/:token` -> Public.


module.exports = router;
