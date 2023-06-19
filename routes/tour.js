const express = require('express');

const tourController = require('../controllers/tour');
const tourSearchController = require('../controllers/tourSearch');

const router = express.Router();

// GET /api/tours
router.get('/', tourController.getTours);

router.get('/find/:tourId', tourController.getTour);

router.post('/related', tourController.postRelatedTours);

router.get('/search', tourSearchController.getSearchTours);

module.exports = router;
