const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const User = require('../models/user');
const Tour = require('../models/tour');
const Order = require('../models/order');

// lấy thông tin của user qua id
exports.getUserInfo = async (req, res, next) => {
  const userId = req.cookies.userId || req.cookies.userIdAdmin; // thông tin user trả về từ cookie req
  try {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    const { fullName, phone, email, address, role } = user;

    res.status(200).json({ fullName, phone, email, address, role });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa thông tin user
exports.updateUserInfo = async (req, res, next) => {
  const errors = validationResult(req);

  // nếu có userId từ body nhận userId từ body, ko sẽ lấy từ cookie
  const userId = req.body.userId
    ? req.body.userId
    : req.cookies.userId || req.cookies.userIdAdmin;
  const newFullName = req.body.fullName;
  const newPhone = req.body.phone;
  const newAddress = req.body.address;
  try {
    // nếu req.body empty trả về lỗi (errors tồn tại)
    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    user.fullName = newFullName;
    user.phone = newPhone;
    user.address = newAddress;
    await user.save();
    res.status(200).json({ message: 'User updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// đổi password
exports.patchChangePassword = async (req, res, next) => {
  const errors = validationResult(req);

  const userId = req.cookies.userId || req.cookies.userIdAdmin; // userId từ cookie
  const { oldPassword, newPassword } = req.body;

  try {
    // nếu req.body empty trả về lỗi (errors tồn tại)
    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // mã hóa và so sánh xem có trùng password
    const isEqual = await bcrypt.compare(oldPassword, user.password);
    if (!isEqual) {
      const error = new Error('Wrong old password!');
      error.statusCode = 401;
      throw error;
    }

    // Mã hóa password
    const hashedPw = await bcrypt.hash(newPassword, 12);

    user.password = hashedPw;
    await user.save();
    res.status(200).json({ message: 'Updated password successful.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all cart
exports.getCart = async (req, res, next) => {
  const userId = req.cookies.userId; // thông tin user trả về từ cookie req
  try {
    // Tìm tour theo id
    const user = await User.findById(userId).populate({
      path: 'cart.tourId',
      populate: [
        { path: 'locationStart', model: 'Location', select: 'name' },
        { path: 'discountId', model: 'Discount', select: 'percentOff' },
      ],
    });
    const cart = user.cart;

    // trả về res
    res.status(200).json({ message: 'Cart fetched.', cart: cart });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// post add tour vào cart
exports.postAddCart = async (req, res, next) => {
  const userId = req.cookies.userId; // thông tin user trả về từ cookie req
  const tourId = req.body.tourId;
  const { startDate, adultQuantity, childQuantity, babyQuantity } = req.body;

  try {
    // Tìm user, tour theo id
    const user = await User.findById(userId);
    const tour = await Tour.findById(tourId).select('_id count');

    // Nếu k có tour trả về lỗi
    if (!tour) {
      const error = new Error('Could not find tour.');
      error.statusCode = 404;
      throw error;
    }

    // Nếu k có ng lớn nào
    if (adultQuantity === 0) {
      const error = new Error('Vui lòng chọn ít nhất 1 người lớn');
      error.statusCode = 404;
      throw error;
    }

    const newData = {
      startDate,
      adultQuantity,
      childQuantity,
      babyQuantity,
    };

    // sử dụng method add to cart
    await user.addToCart(tour, newData);

    // trả về res
    res.status(200).json({ message: 'Added to Cart.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// xóa 1 tour khỏi cart dựa vào id
exports.deleteTourFromCart = async (req, res, next) => {
  const userId = req.cookies.userId; // thông tin user trả về từ cookie req
  const tourId = req.params.tourId;

  try {
    // Tìm user, tour theo id
    const user = await User.findById(userId);

    // sử dụng method remove From Cart
    await user.removeFromCart(tourId);

    // trả về res
    res.status(200).json({ message: 'Deleted from Cart.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Tạo order từ thông tin cart đã qua pass được middleware kiểm tra số lượng sản phẩm trong giỏ hàng
exports.postOrder = async (req, res, next) => {
  const userId = req.cookies.userId; // thông tin user trả về từ cookie req

  try {
    // Tìm user, tour theo id
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    const tours = req.body.tours;

    const orderData = {
      userOrder: userId,
      userInfo: req.body.userInfo,
      tours: tours,
      totalMoney: req.body.totalMoney,
    };

    const order = new Order(orderData);
    const savedOrder = await order.save(); // Lưu thông tin order và nhận về đối tượng order đã được lưu

    // cập nhật số lượng sản phẩm trong kho
    for (let i = 0; i < tours.length; i++) {
      const tour = tours[i];
      await Tour.findByIdAndUpdate(tour.tour._id, {
        $inc: {
          count: -(tour.adultQuantity + tour.childQuantity + tour.babyQuantity),
        },
        // $inc được sử dụng để tăng hoặc giảm một giá trị số trong một trường cụ thể
      });
    }

    // sử dụng method clear Cart
    await user.clearCart();

    // trả về res
    res
      .status(200)
      .json({ message: 'Order successful.', orderId: savedOrder._id });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all orders by id
exports.getOrders = async (req, res, next) => {
  const userId = req.cookies.userId || req.cookies.userIdAdmin; // thông tin user trả về từ cookie req
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Order.countDocuments({ userOrder: userId });

    // Tìm user, tour theo id kèm sort, page
    const orders = await Order.find({ userOrder: userId })
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // trả về res
    res.status(200).json({
      message: 'Orders fetched.',
      orders: orders,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get 1 order
exports.getOrder = async (req, res, next) => {
  const orderId = req.params.orderId;
  try {
    // Tìm order theo id
    const order = await Order.findById(orderId).populate(
      'tours.tour._id',
      'img1'
    );
    if (!order) {
      const error = new Error('Could not find order.');
      error.statusCode = 404;
      throw error;
    }

    // trả về res
    res.status(200).json({ message: 'order fetched.', order: order });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
