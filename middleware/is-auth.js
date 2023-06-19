const User = require('../models/user');

module.exports = async (req, res, next) => {
  const userId = req.cookies.userId || req.cookies.userIdAdmin;

  try {
    if (!userId) {
      const error = new Error('Not authenticated.');
      error.statusCode = 401;
      throw error;
    }

    const userFromDb = await User.findOne({ _id: userId });

    if (!userFromDb) {
      const error = new Error('User not exist!.');
      error.statusCode = 401;
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
