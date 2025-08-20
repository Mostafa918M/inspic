const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { getProfile,
    updateProfile
 } = require('../controllers/user.controller');

const router = express.Router();


router.get('/profile', auth(), getProfile);
router.put('/profile',auth(),updateProfile);

module.exports = router;