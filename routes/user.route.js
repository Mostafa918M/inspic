const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { getProfile } = require('../controllers/user.controller');

const router = express.Router();


router.get('/profile', auth(), getProfile);

module.exports = router;