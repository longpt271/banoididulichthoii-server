const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');

const NODEMAILER_API = process.env.NODEMAILER_API;

// Khởi tạo transporter xác thực api để gửi email
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: NODEMAILER_API, // Thay thế bằng API key của SendGrid
    },
  })
);

// Hàm tạo mật khẩu mới ngẫu nhiên
const generateRandomPassword = length => {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};

// Hàm gửi mật khẩu mới cho người dùng
const sendNewMail = (email, subject, html) => {
  const mailOptions = {
    from: {
      name: 'Banoididulichthoii',
      address: 'unirotech@hotmail.com',
    },
    to: email,
    subject: subject,
    html: html,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { generateRandomPassword, sendNewMail };
