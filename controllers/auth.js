const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const User = require('../models/user');
const { sendNewMail, generateRandomPassword } = require('../utils/sendNewMail');

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  const { email } = req.body;

  try {
    // nếu req.body empty trả về lỗi
    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() || 'Validation failed.'
      );
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    // Tạo mật khẩu mới ngẫu nhiên
    const newPassword = generateRandomPassword(8); // Độ dài mật khẩu mới

    // Gửi email cho người dùng
    const subject = 'Đăng ký tài khoản thành công!';
    const html = `<p>Xin chào <b>${email.split('@')[0]}</b>,</p>
                      <p>Chúc mừng bạn đã đăng ký thành công tài khoản tại hệ thống banoididulichthoii</p>
                      <p>Mật khẩu được tạo tự động của bạn là <b>${newPassword}</b></p>
                      <p>Chúc bạn có được những trải nghiệm du lịch thú vị!</p>
                      <p>Trân trọng.</p>`;
    try {
      await sendNewMail(email, subject, html);
    } catch (err) {
      const error = new Error('Failed to send email.');
      error.statusCode = 500;
      throw error;
    }

    // Mã hóa password
    const hashedPw = await bcrypt.hash(newPassword, 12);
    // data user mới
    const user = new User({
      password: hashedPw,
      email: req.body.email,
      fullName: req.body.fullName,
      phone: req.body.phone,
      address: req.body.address,
    });

    // Lưu lại db
    const result = await user.save();

    // trả về res
    res.status(201).json({ message: 'User created!', userId: result._id });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;
  try {
    // nếu req.body empty trả về lỗi
    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() || 'Validation failed.'
      );
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    // Tìm user có email trùng
    const user = await User.findOne({ email: email });

    // Nếu k có trả về lỗi
    if (!user) {
      const error = new Error('The user with this email could not be found.');
      error.statusCode = 401;
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

    // trả về res cookie để xác định user nào đăng nhập cho api
    const maxAgeMilliseconds = 60 * 60 * 1000; // 60 minutes = 3.600.000 milliseconds
    res.cookie('userId', loadedUser._id.toString(), {
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
        fullName: loadedUser.fullName,
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

// Tạo mã xác minh khi quên mật khẩu cho người dùng
exports.postVerifyCode = async (req, res, next) => {
  const { email } = req.body;

  try {
    // Tìm người dùng theo userId
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // Tạo mã xác minh mới ngẫu nhiên
    const newVerifyCode = generateRandomPassword(4); // Độ dài mã xác minh mới

    // Gửi email mã xác minh mới cho người dùng
    const subject = 'Mã xác minh!';
    const html = `<p>Xin chào <b>${user.email.split('@')[0]}</b>,</p>
                  <p>Mật xác minh của bạn là <b>${newVerifyCode}</b></p>
                  <p>Trân trọng.</p>`;
    try {
      await sendNewMail(user.email, subject, html);
    } catch (err) {
      const error = new Error('Failed to send email.');
      error.statusCode = 500;
      throw error;
    }

    // Lưu mã xác minh mới vào cơ sở dữ liệu cho người dùng
    user.verifyCode = newVerifyCode;
    await user.save();

    res.status(200).json({ message: 'Sent to email verifyCode successfully' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Kiểm tra verify code và tạo mật khẩu mới cho người dùng
exports.postForgotPassword = async (req, res, next) => {
  const errors = validationResult(req);
  const { email, verifyCode, newPassword } = req.body;

  try {
    // nếu req.body empty trả về lỗi
    if (!errors.isEmpty()) {
      const error = new Error(
        errors.errors[0].msg.toString() || 'Validation failed.'
      );
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // Tìm người dùng theo email
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    if (user.verifyCode !== verifyCode) {
      const error = new Error('Wrong verify Code.');
      error.statusCode = 404;
      throw error;
    }

    // Mã hóa password
    const hashedPw = await bcrypt.hash(newPassword, 12);

    user.password = hashedPw; // Lưu mật khẩu mới
    user.verifyCode = ''; // xóa mã xác minh cũ
    await user.save();

    res.status(200).json({ message: 'Reset password successfully' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
