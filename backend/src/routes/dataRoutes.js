const express = require('express');
const router = express.Router();
const { getProfile } = require('../controllers/dataController');

router.get('/student/:id', getProfile);

module.exports = router;
