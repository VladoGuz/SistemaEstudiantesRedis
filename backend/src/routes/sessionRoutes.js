const express = require('express');
const router = express.Router();
const { login, logout, checkSession } = require('../controllers/sessionController');

router.post('/login', login);
router.post('/logout', logout);
router.get('/check', checkSession);

module.exports = router;
