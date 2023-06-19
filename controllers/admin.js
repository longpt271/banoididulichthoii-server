const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const User = require('../models/user');
const Order = require('../models/order');
const Tour = require('../models/tour');
const Category = require('../models/category');
const Location = require('../models/location');
const Discount = require('../models/discount');
const { generateRandomPassword, sendNewMail } = require('../utils/sendNewMail');

// Xử lý login admin
exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;
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

    // Tìm user có email trùng
    const user = await User.findOne({ email: email });

    // Nếu k có trả về lỗi
    if (!user) {
      const error = new Error('A user with this email could not be found.');
      error.statusCode = 401;
      throw error;
    }

    // chỉ cho phép role admin và chat-staff truy cập
    if (user.role !== 'admin' && user.role !== 'chat-staff') {
      const error = new Error('You are not authorized to login!');
      error.statusCode = 403;
      throw error;
    }

    loadedUser = user;

    // mã hóa và so sánh xem có trùng password
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Wrong password!');
      error.statusCode = 401;
      throw error;
    }

    // trả về res
    const maxAgeMilliseconds = 60 * 60 * 1000; // 60 minutes
    res.cookie('userIdAdmin', loadedUser._id.toString(), {
      maxAge: maxAgeMilliseconds,
      // httpOnly: true,
      path: '/',
      sameSite: 'none',
      secure: true,
    });

    res.status(200).json({
      message: 'Login successfully!',
      user: {
        userId: loadedUser._id.toString(),
        role: loadedUser.role,
        maxAge: maxAgeMilliseconds,
      },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all Dashboard data
exports.getDashboard = async (req, res, next) => {
  try {
    // Count tổng số user/order
    const totalUser = await User.countDocuments();
    const totalOrder = await Order.countDocuments();
    const totalTour = await Tour.countDocuments();

    // Tính tổng doanh thu
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'done', isPay: true } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalMoney' } } },
    ]);

    const totalAllRevenue = totalRevenue[0] ? totalRevenue[0].totalRevenue : 0;

    // Tính tổng doanh thu và số order từng tháng
    const monthlyRevenues = [];
    const printMonthlyRevenue = result => {
      result.forEach(item => {
        const month = new Date(item._id).getMonth() + 1;
        const year = new Date(item._id).getFullYear();
        const totalRevenue = item.totalRevenue;
        const totalOrders = item.totalOrders;
        monthlyRevenues.push({ month, year, totalRevenue, totalOrders });
      });
    };

    await Order.aggregate([
      { $match: { status: 'done', isPay: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          totalRevenue: { $sum: '$totalMoney' },
          totalOrders: { $sum: 1 },
        },
      },
    ]).then(printMonthlyRevenue);

    // sắp xếp theo tháng giảm dần
    monthlyRevenues.sort((a, b) => {
      const monthA = a.month;
      const yearA = a.year;
      const monthB = b.month;
      const yearB = b.year;
      if (yearA === yearB) {
        return monthB - monthA;
      } else {
        return yearB - yearA;
      }
    });

    // trả về res
    res.status(200).json({
      message: 'Dashboard fetched.',
      totalUser: totalUser,
      totalOrder: totalOrder,
      totalTour: totalTour,
      totalEarning: totalAllRevenue,
      monthlyRevenues: monthlyRevenues,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Users///////////////////////////
// sửa role user
exports.updateUserRole = async (req, res, next) => {
  const userId = req.body.userId;
  const newRole = req.body.role;
  try {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra nhận đúng role không
    if (newRole !== 'admin') {
      const error = new Error('Wrong new role.');
      error.statusCode = 403;
      throw error;
    }

    // nếu tài khoản đã là admin
    if (newRole === 'admin' && newRole === user.role) {
      const error = new Error('This account is already admin.');
      error.statusCode = 403;
      throw error;
    }

    user.role = newRole;
    await user.save();
    res.status(200).json({ message: 'User role updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  const userId = req.body.userId;
  const newStatus = req.body.status;
  try {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra nhận đúng status không
    if (newStatus !== 'active' && newStatus !== 'inactive') {
      const error = new Error('Wrong new status.');
      error.statusCode = 403;
      throw error;
    }

    user.status = newStatus;
    await user.save();
    res.status(200).json({ message: 'User status updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Controller để xóa mật khẩu cũ và tạo mật khẩu mới cho người dùng
exports.resetUserPassword = async (req, res, next) => {
  const { userId } = req.params;

  try {
    // Tìm người dùng theo userId
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // Tạo mật khẩu mới ngẫu nhiên
    const newPassword = generateRandomPassword(8); // Độ dài mật khẩu mới

    // Gửi email mật khẩu mới cho người dùng
    const subject = 'Mật khẩu của bạn đã được đặt lại!';
    const html = `<p>Xin chào <b>${user.email.split('@')[0]}</b>,</p>
                  <p>Mật khẩu được đặt lại của bạn là <b>${newPassword}</b></p>
                  <p>Vui lòng đăng nhập và cập nhật lại mật khẩu mới!</p>
                  <p>Trân trọng.</p>`;
    try {
      await sendNewMail(user.email, subject, html);
    } catch (err) {
      // console.err('Error sending email:', err);
      const error = new Error('Failed to send email.');
      error.statusCode = 500;
      throw error;
    }

    // Mã hóa password
    const hashedPw = await bcrypt.hash(newPassword, 12);

    // Lưu mật khẩu mới vào cơ sở dữ liệu cho người dùng
    user.password = hashedPw;
    await user.save();

    res
      .status(200)
      .json({ message: 'Reset password and send email successfully' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa 1 user
exports.deleteUser = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('Could not find user.');
      error.statusCode = 404;
      throw error;
    } else if (user.role === 'admin') {
      const error = new Error('Do not remove the administrator.');
      error.statusCode = 404;
      throw error;
    }

    // nếu userId có trong order và vẫn trong trạng thái 'waiting'
    const userInOrders = await Order.countDocuments({
      userId: userId,
      status: 'waiting',
    });

    if (userInOrders !== 0) {
      await User.updateOne({ _id: userId }, { status: 'inactive' }); // chuyển trạng thái k hoạt động

      if (user.status !== 'inactive') {
        res.status(200).json({
          message: 'This user has a pending oder. Changed status to inactive.',
        });
      } else {
        res.status(403).json({
          message: "This user has a pending oder. Can't delete now!",
        });
      }
    } else {
      await User.findByIdAndRemove(userId); // xóa khỏi db
      res.status(200).json({ message: 'Deleted user.' });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Oders///////////////////////////
// get all orders
exports.getOrders = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Order.countDocuments();

    // Tìm user, Tour theo id kèm sort, page
    const orders = await Order.find()
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

exports.getOrdersWaiting = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Order.countDocuments({ status: 'waiting' });

    // Tìm user, Tour theo id kèm sort, page
    const orders = await Order.find({ status: 'waiting' })
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // trả về res
    res.status(200).json({
      message: 'Orders waiting fetched.',
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

// sửa isPay order
exports.updateOrderIsPay = async (req, res, next) => {
  const orderId = req.body.orderId;
  const newIsPay = req.body.isPay;
  try {
    const order = await Order.findById(orderId);
    // kiểm tra có order k
    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra có phải waiting hoặc done k
    if (newIsPay !== true && newIsPay !== false) {
      const error = new Error('wrong IsPay.');
      error.statusCode = 403;
      throw error;
    }

    if (order.isPay !== newIsPay) {
      if (order.status === 'done') {
        res.status(403).json({ message: 'Tour đã hoàn thành.' });
      } else if (order.status === 'cancelled') {
        res.status(403).json({ message: 'Tour đã hủy.' });
      } else {
        order.isPay = newIsPay;
        await order.save();
        res.status(200).json({ message: 'Order isPay updated.' });
      }
    } else {
      res.status(403).json({ message: 'Same Order isPay.' });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa Status order
exports.updateOrderStatus = async (req, res, next) => {
  const orderId = req.body.orderId;
  const newStatus = req.body.status;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      const error = new Error('Order not found.');
      error.statusCode = 404;
      throw error;
    }

    // Kiểm tra trạng thái hợp lệ
    const validStatus = ['done', 'waiting', 'cancelled'];
    if (!validStatus.includes(newStatus)) {
      const error = new Error('Invalid status.');
      error.statusCode = 403;
      throw error;
    }

    if (order.status !== newStatus) {
      if (newStatus === 'done') {
        if (order.isPay) {
          // Kiểm tra nếu có ít nhất một tour chưa hoàn thành
          const incompleteTours = order.tours.filter(tour => {
            const tourEndDate = new Date(tour.endDate);
            const currentDate = new Date();
            return tourEndDate >= currentDate;
          });

          if (incompleteTours.length > 0) {
            res.status(403).json({ message: 'Chưa hoàn thành tour.' });
          } else {
            order.status = newStatus;
            await order.save();
            res.status(200).json({ message: 'Order đã hoàn thành.' });
          }
        } else {
          res.status(403).json({ message: 'Chưa thanh toán.' });
        }
      } else if (newStatus === 'cancelled') {
        if (!order.isPay) {
          order.status = newStatus;
          await order.save();
          res.status(200).json({ message: 'Order đã hủy.' });
        } else {
          res.status(403).json({ message: 'Tour đã thanh toán.' });
        }
      } else if (newStatus === 'waiting') {
        order.status = newStatus;
        await order.save();
        res.status(200).json({ message: 'Order status updated.' });
      }
    } else {
      res.status(403).json({ message: 'Same Order status.' });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Tours///////////////////////////

// post tạo 1 Tour
exports.postNewTour = async (req, res, next) => {
  const errors = validationResult(req);

  // create tour in db
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

    const tour = new Tour({
      name: req.body.name,
      time: req.body.time,
      count: +req.body.count,
      category: req.body.category,
      locationStart: req.body.locationStart,
      location: req.body.location,
      discountId: req.body.discountId,
      adultPrice: +req.body.adultPrice,
      childPrice: +req.body.childPrice,
      babyPrice: +req.body.babyPrice,
      img1: req.body.img1,
      img2: req.body.img2,
      img3: req.body.img3,
      img4: req.body.img4,
      desc: req.body.desc,
      warn: req.body.warn,
    });

    // Lưu lại db
    await tour.save();

    // trả về res
    res.status(201).json({ message: 'Tour created successfully!' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa thông tin tour
exports.updateTour = async (req, res, next) => {
  const errors = validationResult(req);
  const { tourId } = req.body; // sử dụng destructuring assignment

  try {
    const tour = await Tour.findById(tourId);
    if (!tour) {
      const error = new Error('Tour not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    tour.name = req.body.name;
    tour.time = req.body.time;
    tour.count = +req.body.count;
    tour.category = req.body.category;
    tour.locationStart = req.body.locationStart;
    tour.location = req.body.location;
    tour.discountId = req.body.discountId;
    tour.adultPrice = +req.body.adultPrice;
    tour.childPrice = +req.body.childPrice;
    tour.babyPrice = +req.body.babyPrice;
    tour.img1 = req.body.img1;
    tour.img2 = req.body.img2;
    tour.img3 = req.body.img3;
    tour.img4 = req.body.img4;
    tour.desc = req.body.desc;
    tour.warn = req.body.warn;

    await tour.save();
    res.status(200).json({ message: 'Tour updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa 1 tour
exports.deleteTour = async (req, res, next) => {
  const tourId = req.params.tourId;
  try {
    const tour = await Tour.findById(tourId);

    if (!tour) {
      const error = new Error('Could not find tour.');
      error.statusCode = 404;
      throw error;
    }

    // nếu tourId có trong order và vẫn trong trạng thái 'waiting'
    const tourInOrders = await Order.countDocuments({
      'tours.tour._id': tourId,
      status: 'waiting',
    });
    if (tourInOrders > 0) {
      const error = new Error('This tour has a pending oder.');
      error.statusCode = 403;
      throw error;
    }

    await Tour.findByIdAndRemove(tourId);

    res.status(200).json({ message: 'Deleted tour.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa nhiều tours
exports.deleteTours = async (req, res, next) => {
  const tourIds = req.body.tourIds; // Array of tour _id values to delete

  try {
    const tours = await Tour.find({ _id: { $in: tourIds } });
    if (tours.length === 0) {
      const error = new Error('Could not find any tour in db.');
      error.statusCode = 404;
      throw error;
    } else if (tours.length !== tourIds.length) {
      const error = new Error('Some tour not find in db.');
      error.statusCode = 404;
      throw error;
    }

    // nếu tourId có trong order và vẫn trong trạng thái 'waiting'
    const tourInOrders = await Order.countDocuments({
      'tours.tour._id': { $in: tourIds },
      status: 'waiting',
    });
    if (tourInOrders > 0) {
      const error = new Error('Some tour has a pending oder.');
      error.statusCode = 403;
      throw error;
    }

    await Tour.deleteMany({ _id: { $in: tourIds } });

    res.status(200).json({ message: `Deleted ${tourIds.length} tours.` });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Categories///////////////////////////

// get all categories with Pagination
exports.getCategories = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Category.countDocuments();

    // Tìm category kèm sort, page
    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // Check if any of the categories have been added to tours
    const checkedCategories = await Promise.all(
      categories.map(async cat => {
        const catInTours = await Tour.countDocuments({
          category: { _id: cat._id },
        });

        const isInTour = catInTours > 0;

        return {
          _id: cat._id,
          name: cat.name,
          isInTour,
        };
      })
    );

    // trả về res
    res.status(200).json({
      message: 'Categories fetched.',
      categories: checkedCategories,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().select('_id name');

    // trả về res
    res.status(200).json({
      message: 'Categories fetched.',
      categories: categories,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// post tạo 1 Category
exports.postNewCategory = async (req, res, next) => {
  const errors = validationResult(req);

  // create Category in db
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

    const category = new Category({ name: req.body.name });

    // Lưu lại db
    await category.save();

    // trả về res
    res.status(201).json({ message: 'Category created successfully!' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa thông tin category
exports.updateCategory = async (req, res, next) => {
  const errors = validationResult(req);
  const { categoryId } = req.body; // sử dụng destructuring assignment

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    category.name = req.body.name;

    await category.save();
    res.status(200).json({ message: 'Category updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa 1 category
exports.deleteCategory = async (req, res, next) => {
  const catId = req.params.categoryId;
  try {
    const category = await Category.findById(catId);

    if (!category) {
      const error = new Error('Could not find category.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra xem category này đã được thêm vào tour nào chưa
    const catInTours = await Tour.countDocuments({
      category: { _id: catId },
    });

    if (catInTours > 0) {
      const error = new Error('This category has been added to the tour.');
      error.statusCode = 403;
      throw error;
    }

    await Category.findByIdAndRemove(catId);

    res.status(200).json({ message: 'Deleted category.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa nhiều categories
exports.deleteCategories = async (req, res, next) => {
  const categoryIds = req.body.categoryIds; // Array of category _id values to delete

  try {
    const categories = await Category.find({ _id: { $in: categoryIds } });

    if (categories.length === 0) {
      const error = new Error('Could not find any category in db.');
      error.statusCode = 404;
      throw error;
    } else if (categories.length !== categoryIds.length) {
      const error = new Error('Some category not find in db.');
      error.statusCode = 404;
      throw error;
    }

    // Check if any of the categories have been added to tours
    const catInTours = await Tour.countDocuments({
      category: { $in: categoryIds },
    });

    if (catInTours > 0) {
      const error = new Error('Some category have been added to tours.');
      error.statusCode = 403;
      throw error;
    }

    await Category.deleteMany({ _id: { $in: categoryIds } });

    res
      .status(200)
      .json({ message: `Deleted ${categoryIds.length} categories.` });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Locations///////////////////////////

// get all locations
exports.getLocations = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Location.countDocuments();

    // Tìm Locations kèm sort, page
    const locations = await Location.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // Check if any of the locations have been added to tours
    const checkedLocations = await Promise.all(
      locations.map(async loc => {
        const locInTours = await Tour.countDocuments({
          location: { _id: loc._id },
        });

        const isInTour = locInTours > 0;

        return {
          _id: loc._id,
          name: loc.name,
          img: loc.img,
          country: loc.country,
          isInTour,
        };
      })
    );

    // trả về res
    res.status(200).json({
      message: 'Locations fetched.',
      locations: checkedLocations,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all locations
exports.getAllLocations = async (req, res, next) => {
  try {
    const locations = await Location.find();

    // trả về res
    res.status(200).json({
      message: 'Locations fetched.',
      locations: locations,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// post tạo 1 Location
exports.postNewLocation = async (req, res, next) => {
  const errors = validationResult(req);

  const name = req.body.name;
  const country = req.body.country;
  const img = req.body.img;

  // create Location in db
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

    const location = new Location({ name, img, country });

    // Lưu lại db
    await location.save();

    // trả về res
    res.status(201).json({ message: 'Location created successfully!' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa thông tin location
exports.updateLocation = async (req, res, next) => {
  const errors = validationResult(req);
  const { locationId } = req.body; // sử dụng destructuring assignment

  try {
    const location = await Location.findById(locationId);
    if (!location) {
      const error = new Error('Location not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    location.name = req.body.name;
    location.img = req.body.img;
    location.country = req.body.country;

    await location.save();
    res.status(200).json({ message: 'Location updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa 1 location
exports.deleteLocation = async (req, res, next) => {
  const locId = req.params.locationId;
  try {
    const location = await Location.findById(locId);

    if (!location) {
      const error = new Error('Could not find location.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra xem location này đã được thêm vào tour nào chưa
    const locInTours = await Tour.countDocuments({
      location: { _id: locId },
    });

    if (locInTours > 0) {
      const error = new Error('This location has been added to the tour.');
      error.statusCode = 403;
      throw error;
    }

    await Location.findByIdAndRemove(locId);

    res.status(200).json({ message: 'Deleted location.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa nhiều locations
exports.deleteLocations = async (req, res, next) => {
  const locationIds = req.body.locationIds; // Array of location _id values to delete

  try {
    const locations = await Location.find({ _id: { $in: locationIds } });

    if (locations.length === 0) {
      const error = new Error('Could not find any location in db.');
      error.statusCode = 404;
      throw error;
    } else if (locations.length !== locationIds.length) {
      const error = new Error('Some location not find in db.');
      error.statusCode = 404;
      throw error;
    }

    // Check if any of the locations have been added to tours
    const locInTours = await Tour.countDocuments({
      location: { $in: locationIds },
    });

    if (locInTours > 0) {
      const error = new Error('Some location have been added to tours.');
      error.statusCode = 403;
      throw error;
    }

    await Location.deleteMany({ _id: { $in: locationIds } });

    res
      .status(200)
      .json({ message: `Deleted ${locationIds.length} locations.` });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

///////////////////////////Discounts///////////////////////////

// get all discounts
exports.getDiscounts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 8;

  try {
    // Count tổng số items
    const totalItems = await Discount.countDocuments();

    // Tìm Discounts kèm sort, page
    const discounts = await Discount.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // Check if any of the discounts have been added to tours
    const checkedDiscounts = await Promise.all(
      discounts.map(async dis => {
        const disInTours = await Tour.countDocuments({ discountId: dis._id });

        const isInTour = disInTours > 0;

        return {
          _id: dis._id,
          name: dis.name,
          percentOff: dis.percentOff,
          status: dis.status,
          isInTour,
        };
      })
    );

    // trả về res
    res.status(200).json({
      message: 'Discounts fetched.',
      discounts: checkedDiscounts,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get all discounts
exports.getAllDiscounts = async (req, res, next) => {
  try {
    const discounts = await Discount.find({ status: 1 });

    // trả về res
    res.status(200).json({
      message: 'Discounts fetched.',
      discounts: discounts,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// post tạo 1 Discount
exports.postNewDiscount = async (req, res, next) => {
  const errors = validationResult(req);

  const name = req.body.name;
  const percentOff = req.body.percentOff;
  const status = req.body.status;

  // create Discount in db
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

    const discount = new Discount({ name, percentOff, status });

    // Lưu lại db
    await discount.save();

    // trả về res
    res.status(201).json({ message: 'Discount created successfully!' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// sửa thông tin discount
exports.updateDiscount = async (req, res, next) => {
  const errors = validationResult(req);
  const { discountId } = req.body; // sử dụng destructuring assignment
  const status = req.body.status;

  try {
    const discount = await Discount.findById(discountId);
    if (!discount) {
      const error = new Error('Discount not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() ||
          'Validation failed, entered data is incorrect.'
      );
      error.statusCode = 422;
      throw error;
    }

    // Khi tắt discount sẽ xóa toàn bộ discountId trong các tours
    if (status === 0) {
      const tours = await Tour.find({ discountId: discountId }).select('_id');
      const tourIds = tours.map(tour => tour._id);

      await Tour.updateMany(
        { _id: { $in: tourIds } },
        { $set: { discountId: null } }
      );
    }

    discount.name = req.body.name;
    discount.percentOff = req.body.percentOff;
    discount.status = status;

    await discount.save();
    res.status(200).json({ message: 'Discount updated.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa 1 discount
exports.deleteDiscount = async (req, res, next) => {
  const disId = req.params.discountId;
  try {
    const discount = await Discount.findById(disId);

    if (!discount) {
      const error = new Error('Could not find discount.');
      error.statusCode = 404;
      throw error;
    }

    // kiểm tra xem discount này đã được thêm vào tour nào chưa
    const disInTours = await Tour.countDocuments({ discountId: disId });

    if (disInTours > 0) {
      const error = new Error('This discount has been added to the tour.');
      error.statusCode = 403;
      throw error;
    }

    await Discount.findByIdAndRemove(disId);

    res.status(200).json({ message: 'Deleted discount.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Xóa nhiều discounts
exports.deleteDiscounts = async (req, res, next) => {
  const discountIds = req.body.discountIds; // Array of discount _id values to delete

  try {
    const discounts = await Discount.find({ _id: { $in: discountIds } });

    if (discounts.length === 0) {
      const error = new Error('Could not find any discount in db.');
      error.statusCode = 404;
      throw error;
    } else if (discounts.length !== discountIds.length) {
      const error = new Error('Some discount not find in db.');
      error.statusCode = 404;
      throw error;
    }

    // Check if any of the discounts have been added to tours
    const disInTours = await Tour.countDocuments({
      discountId: { $in: discountIds },
    });

    if (disInTours > 0) {
      const error = new Error('Some discount have been added to tours.');
      error.statusCode = 403;
      throw error;
    }

    await Discount.deleteMany({ _id: { $in: discountIds } });

    res
      .status(200)
      .json({ message: `Deleted ${discountIds.length} discounts.` });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
