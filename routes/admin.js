const express = require('express');
const { body } = require('express-validator');

// middleware
const isAdmin = require('../middleware/is-admin');
const isAuth = require('../middleware/is-auth');
const isStaff = require('../middleware/is-staff');

const adminController = require('../controllers/admin');
const userSearchController = require('../controllers/userSearch');

const router = express.Router();

const loginRulesArr = [
  body('email').isEmail().withMessage('Please enter a valid email.'),
  body('password')
    .notEmpty()
    .withMessage('Password không được để trống!')
    .trim(),
];

router.post('/auth/login', loginRulesArr, adminController.login);

router.get('/dashboard', isAuth, isStaff, adminController.getDashboard);

///////////////////////////users///////////////////////////
router.get('/users', isAuth, isAdmin, userSearchController.getSearchUsers);

router.patch('/users/role', isAuth, isAdmin, adminController.updateUserRole);

router.patch(
  '/users/status',
  isAuth,
  isAdmin,
  adminController.updateUserStatus
);

router.patch(
  '/users/reset-password/:userId',
  isAuth,
  isAdmin,
  adminController.resetUserPassword
);

router.delete(
  '/users/delete/:userId',
  isAuth,
  isAdmin,
  adminController.deleteUser
);

///////////////////////////orders///////////////////////////
router.get('/orders', isAuth, isStaff, adminController.getOrders);
router.get(
  '/orders-waiting',
  isAuth,
  isStaff,
  adminController.getOrdersWaiting
);

router.patch(
  '/orders/is-pay',
  isAuth,
  isStaff,
  adminController.updateOrderIsPay
);

router.patch(
  '/orders/status',
  isAuth,
  isStaff,
  adminController.updateOrderStatus
);

///////////////////////////tours///////////////////////////
// validate rule of tour
const tourValidationRulesArr = [
  body('name')
    .notEmpty()
    .withMessage('Name không được để trống!')
    .isLength({ max: 100 })
    .withMessage('Name không được vượt quá 100 ký tự.'),
  body('time')
    .notEmpty()
    .withMessage('Time không được để trống')
    .isLength({ max: 50 })
    .withMessage('Name không được vượt quá 50 ký tự.'),
  body('count')
    .notEmpty()
    .withMessage('Count không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Giá trị Count không được âm'),

  body('category').custom((value, { req }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Category không được để trống!');
    }
    return true;
  }),
  body('location').custom((value, { req }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Location không được để trống!');
    }
    return true;
  }),

  body('adultPrice')
    .notEmpty()
    .withMessage('Adult Price không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Adult Price phải là số dương')
    .custom((value, { req }) => {
      if (parseInt(value) < 1000) {
        throw new Error('Adult Price nên >= 1.000đ');
      }
      return true;
    }),
  body('childPrice')
    .notEmpty()
    .withMessage('Child Price không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Child Price phải là số dương')
    .custom((value, { req }) => {
      if (parseInt(value) < 1000) {
        throw new Error('Child Price nên >= 1.000đ');
      }
      return true;
    }),
  body('babyPrice')
    .notEmpty()
    .withMessage('Baby Price không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Baby Price phải là số dương'),

  body('img1')
    .notEmpty()
    .withMessage('Img1 không được để trống!')
    .isURL()
    .withMessage('Img1 phải là một URL hợp lệ'),
  body('img2')
    .notEmpty()
    .withMessage('Img2 không được để trống!')
    .isURL()
    .withMessage('Img2 phải là một URL hợp lệ'),
  body('img3')
    .notEmpty()
    .withMessage('Img3 không được để trống!')
    .isURL()
    .withMessage('Img3 phải là một URL hợp lệ'),
  body('img4')
    .notEmpty()
    .withMessage('Img4 không được để trống!')
    .isURL()
    .withMessage('Img4 phải là một URL hợp lệ'),

  // Kiểm tra trường "schedule" là một mảng
  body('schedule').isArray().withMessage('Schedule must be an array'),
  // Kiểm tra trường "schedule" chứa ít nhất một phần tử
  body('schedule').custom((value, { req }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Schedule must contain at least one item');
    }
    return true;
  }),

  // Kiểm tra các trường bên trong mảng "schedule"
  body('schedule.*.title').notEmpty().withMessage('Schedule title is required'),
  body('schedule.*.desc')
    .notEmpty()
    .withMessage('Schedule description is required'),

  body('warn')
    .notEmpty()
    .withMessage('Warn không được để trống!')
    .isLength({ max: 200 })
    .withMessage('Name không được vượt quá 200 ký tự.'),
];

// POST /api/tours/new
router.post(
  '/tours/new',
  tourValidationRulesArr,
  isAuth,
  isAdmin,
  adminController.postNewTour
);
router.put(
  '/tours/edit',
  tourValidationRulesArr,
  isAuth,
  isAdmin,
  adminController.updateTour
);
router.delete(
  '/tours/delete/:tourId',
  isAuth,
  isAdmin,
  adminController.deleteTour
);
router.post(
  '/tours/delete/multi',
  isAuth,
  isAdmin,
  adminController.deleteTours
);

///////////////////////////categories///////////////////////////
const categoryRulesArr = [
  body('name').notEmpty().withMessage('Name không được để trống!').trim(),
];
router.get('/categories', isAuth, isStaff, adminController.getCategories);
router.get('/categories/all', adminController.getAllCategories);
router.post(
  '/categories/new',
  categoryRulesArr,
  isAuth,
  isAdmin,
  adminController.postNewCategory
);
router.put(
  '/categories/edit',
  categoryRulesArr,
  isAuth,
  isAdmin,
  adminController.updateCategory
);
router.delete(
  '/categories/delete/:categoryId',
  isAuth,
  isAdmin,
  adminController.deleteCategory
);
router.post(
  '/categories/delete/multi',
  isAuth,
  isAdmin,
  adminController.deleteCategories
);

///////////////////////////locations///////////////////////////
const locationRulesArr = [
  body('name').notEmpty().withMessage('Name không được để trống!').trim(),
  body('img')
    .notEmpty()
    .withMessage('Img không được để trống!')
    .isURL()
    .withMessage('Img phải là một URL hợp lệ'),
  body('country')
    .notEmpty()
    .withMessage('Quốc gia không được để trống!')
    .trim(),
];
router.get('/locations', isAuth, isStaff, adminController.getLocations);
router.get('/locations/all', adminController.getAllLocations);
router.post(
  '/locations/new',
  locationRulesArr,
  isAuth,
  isAdmin,
  adminController.postNewLocation
);
router.put(
  '/locations/edit',
  locationRulesArr,
  isAuth,
  isAdmin,
  adminController.updateLocation
);
router.delete(
  '/locations/delete/:locationId',
  isAuth,
  isAdmin,
  adminController.deleteLocation
);
router.post(
  '/locations/delete/multi',
  isAuth,
  isAdmin,
  adminController.deleteLocations
);

///////////////////////////discounts///////////////////////////
const discountRulesArr = [
  body('name').notEmpty().withMessage('Name không được để trống!').trim(),
  body('percentOff')
    .notEmpty()
    .withMessage('Phần trăm khuyến mãi không được để trống')
    .isNumeric()
    .withMessage('Phần trăm khuyến mãi phải là một số'),
  body('status').notEmpty().withMessage('Trạng thái không được để trống'),
];
router.get('/discounts', isAuth, isStaff, adminController.getDiscounts);
router.get('/discounts/all', isAuth, isStaff, adminController.getAllDiscounts);
router.post(
  '/discounts/new',
  discountRulesArr,
  isAuth,
  isAdmin,
  adminController.postNewDiscount
);
router.put(
  '/discounts/edit',
  discountRulesArr,
  isAuth,
  isAdmin,
  adminController.updateDiscount
);
router.delete(
  '/discounts/delete/:discountId',
  isAuth,
  isAdmin,
  adminController.deleteDiscount
);
router.post(
  '/discounts/delete/multi',
  isAuth,
  isAdmin,
  adminController.deleteDiscounts
);

module.exports = router;
