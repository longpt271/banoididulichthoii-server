const Tour = require('../models/tour');

// get tất cả tour
exports.getTours = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;
  try {
    const totalItems = await Tour.countDocuments();

    // Tìm tất cả tour
    const tours = await Tour.find()
      .populate({ path: 'locationStart', select: 'name' })
      .populate({ path: 'location', select: 'name' })
      .populate({ path: 'discountId', select: 'percentOff' })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // trả về res
    res.status(200).json({
      message: 'Fetched tours successfully.',
      tours: tours,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get 1 tour
exports.getTour = async (req, res, next) => {
  const tourId = req.params.tourId;
  try {
    // Tìm tour theo id
    const tour = await Tour.findById(tourId)
      .populate({ path: 'category', select: 'name' })
      .populate({ path: 'locationStart', select: 'name' })
      .populate({ path: 'location', select: 'name' })
      .populate({ path: 'discountId', select: 'name percentOff' });

    if (!tour) {
      const error = new Error('Could not find tour.');
      error.statusCode = 404;
      throw error;
    }

    // trả về res
    res.status(200).json({ message: 'Tour fetched.', tour: tour });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get tour liên quan với category của 1 tour
exports.postRelatedTours = async (req, res, next) => {
  const tourId = req.body._id;
  const categoryIds = req.body.categoryIds;

  const currentPage = req.query.page || 1;
  const perPage = 4;
  try {
    // Tìm tất cả tour
    const tours = await Tour.find({
      _id: { $ne: tourId },
      category: { $in: categoryIds },
    })
      .populate({ path: 'locationStart', select: 'name' })
      .populate({ path: 'discountId', select: 'percentOff' })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // trả về res
    res.status(200).json({
      message: 'Fetched related tours successfully.',
      tours: tours,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
