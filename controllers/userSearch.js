const User = require('../models/user');

exports.getSearchUsers = async (req, res, next) => {
  // page query
  const currentPage = req.query.page || 1;
  const perPage = 8;

  const name = req.query.name;
  const email = req.query.email;
  const phone = req.query.phone;
  const role = req.query.role || '';

  // sort query
  const nameOrder = req.query.nameOrder;
  const emailOrder = req.query.emailOrder;
  let sortQuery = {};

  if (nameOrder) {
    sortQuery.fullName = nameOrder === 'desc' ? -1 : 1;
  } else if (emailOrder) {
    sortQuery.email = emailOrder === 'desc' ? -1 : 1;
  } else {
    sortQuery.createdAt = -1; // Sắp xếp theo trường "createdAt" từ mới nhất đến cũ nhất nếu không có giá trị sắp xếp được chỉ định
  }

  try {
    const searchQuery = [
      name ? { fullName: { $regex: name, $options: 'i' } } : {},
      email ? { email: { $regex: email, $options: 'i' } } : {},
      phone ? { phone: { $regex: phone, $options: 'i' } } : {},
      role ? { role: role } : {},
    ];

    // Count tổng số items
    const totalItems = await User.countDocuments({ $and: searchQuery });

    // Tìm tất cả user thỏa mãn điều kiện kèm sort & page
    const users = await User.find({ $and: searchQuery })
      .sort(sortQuery)
      .select({ password: 0, cart: 0 }) // loại password ra khỏi kq find()
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    // trả về res
    res.status(200).json({
      message: 'Fetched users successfully.',
      users: users,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
