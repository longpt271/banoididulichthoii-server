const User = require('../models/user');

module.exports = async (req, res, next) => {
  const userId = req.cookies.userIdAdmin;

  try {
    const userFromDb = await User.findOne({ _id: userId });

    if (userFromDb?.role !== 'admin') {
      const error = new Error('You are not Admin!.');
      error.statusCode = 403;
      throw error;
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }

  next();
};
