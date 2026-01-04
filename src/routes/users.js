const express = require('express');
const router = express.Router();

router.get('/me', (req, res) => {
  res.json({ message: 'User profile' });
});

module.exports = router;
