const express = require('express');


const {signup,signin,verifyEmail , callback} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.post("/callback", callback);
router.post("/verify-email", verifyEmail);
// router.post("/set-password", authMiddleware, setPassword);


module.exports = router;