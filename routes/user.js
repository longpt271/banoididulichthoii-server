const express = require('express');
const { body } = require('express-validator');

const isAuth = require('../middleware/is-auth');
const checkCartQuantity = require('../middleware/check-cart-quantity');

const userController = require('../controllers/user');

const router = express.Router();

router.get('/info', isAuth, userController.getUserInfo);

const UpdateInfoRulesArr = [
  body('fullName').notEmpty().withMessage('Name không được để trống!').trim(),
  body('phone')
    .notEmpty()
    .withMessage('Phone không được để trống!')
    .isMobilePhone()
    .withMessage('Phone phải là một số điện thoại hợp lệ')
    .matches(/^\d{10,11}$/)
    .withMessage('Phone nên có từ 10 đến 11 chữ số'),
  body('address').notEmpty().withMessage('Address không được để trống!').trim(),
];

router.patch(
  '/info',
  UpdateInfoRulesArr,
  isAuth,
  userController.updateUserInfo
);

const changePasswordRulesArr = [
  body('oldPassword', 'Old password needs to be longer than 5 characters.')
    .trim()
    .isLength({ min: 5 }),

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
router.patch(
  '/change-password',
  changePasswordRulesArr,
  isAuth,
  userController.patchChangePassword
);

router.get('/cart', isAuth, userController.getCart);

router.post('/cart/add', isAuth, userController.postAddCart);

router.delete('/cart/:tourId', isAuth, userController.deleteTourFromCart);

router.post(
  '/create-order',
  isAuth,
  checkCartQuantity,
  userController.postOrder
);

router.get('/orders', isAuth, userController.getOrders);

router.get('/orders/:orderId', isAuth, userController.getOrder);

module.exports = router;
