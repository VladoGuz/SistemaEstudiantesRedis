const express = require('express');
const router = express.Router();
const { submitScore, getLeaderboard } = require('../controllers/leaderboardController');

router.post('/submit', submitScore);
router.get('/', getLeaderboard);

module.exports = router;
