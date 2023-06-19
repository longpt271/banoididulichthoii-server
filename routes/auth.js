const express = require('express');
const { body } = require('express-validator');

const User = require('../models/user');
const authController = require('../controllers/auth');

const router = express.Router();

const signupRulesArr = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email.')
    .custom((value, { req }) => {
      return User.findOne({ email: value }).then(userDoc => {
        if (userDoc) {
          return Promise.reject('E-Mail address already exists!');
        }
      });
    })
    .normalizeEmail(),
  body('fullName').notEmpty().withMessage('Name không được để trống!').trim(),
  body('phone')
    .notEmpty()
    .withMessage('Phone không được để trống!')
    .isMobilePhone()
    .withMessage('Phone phải là một số điện thoại hợp lệ')
    .matches(/^\d{10,11}$/)
    .withMessage('Phone nên có từ 10 đến 11 chữ số'),
];

router.put('/signup', signupRulesArr, authController.signup);

const loginRulesArr = [
  body('email').isEmail().withMessage('Please enter a valid email.'),
  body('password')
    .notEmpty()
    .withMessage('Password không được để trống!')
    .trim(),
];

router.post('/login', loginRulesArr, authController.login);

router.post('/verify-code', authController.postVerifyCode);

const changePasswordRulesArr = [
  body('newPassword', 'New password needs to be longer than 5 characters.')
    .trim()
    .isLength({ min: 5 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage(
      'New password must contain at least one lowercase letter, one uppercase letter, and one digit.'
    )
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error(
          'New password must be different from the old password.'
        );
      }
      return true;
    }),

  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Confirm password don't match.");
    }
    return true;
  }),
];

router.post(
  '/forgot-password',
  changePasswordRulesArr,
  authController.postForgotPassword
);

module.exports = router;
