const User = require('../models/user');

// middleware function kiểm tra số lượng sản phẩm trong giỏ hàng
module.exports = async (req, res, next) => {
  const userId = req.cookies.userId;

  try {
    const user = await User.findById(userId).populate('cart.tourId');
    const tours = user.cart;

    // Kiểm tra số lượng sản phẩm trong giỏ hàng
    for (let i = 0; i < tours.length; i++) {
      const tour = tours[i];

      const totalQuantity =
        tour.adultQuantity + tour.childQuantity + tour.babyQuantity;

      if (totalQuantity > tour.tourId.count) {
        const error = new Error(
          `${tour.tourId.name} không đủ số lượng trong kho`
        );
        error.statusCode = 403;
        throw error;
      }
    }

    next();
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
