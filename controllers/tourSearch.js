const Tour = require('../models/tour');
const Order = require('../models/order');

exports.getSearchTours = async (req, res, next) => {
  // page query
  const currentPage = req.query.page || 1;
  const perPage = 8;

  const name = req.query.name;
  const categoryId = req.query.categoryId || '';
  const locationStartId = req.query.locationStartId || '';
  const locationId = req.query.locationId || '';
  const priceRange = req.query.priceRange || '';
  const time = req.query.time || '';
  const countNumber = req.query.count || '';
  const discountId = req.query.discountId || '';
  const isDiscount = req.query.isDiscount || '';

  // Tạo arr lưu price [min,max] của price để tìm kiếm
  const rangeArr = priceRange ? priceRange.split('-').map(Number) : [];
  const minPrice = rangeArr[0] ? rangeArr[0] : 0;
  const maxPrice = rangeArr[1] ? rangeArr[1] : minPrice + 100000000;

  // sort query
  const nameOrder = req.query.nameOrder;
  const priceOrder = req.query.priceOrder;
  let sortQuery = {};

  if (nameOrder) {
    sortQuery.name = nameOrder === 'desc' ? -1 : 1;
  } else if (priceOrder) {
    // Sắp xếp lần 1 theo giá gốc của adultPrice
    sortQuery.adultPrice = priceOrder === 'desc' ? -1 : 1;
  } else {
    sortQuery.createdAt = -1; // Sắp xếp theo trường "createdAt" từ mới nhất đến cũ nhất nếu không có giá trị sắp xếp được chỉ định
  }

  try {
    const searchQuery = [
      name ? { name: { $regex: name, $options: 'i' } } : {},
      categoryId ? { category: { _id: categoryId } } : {}, // tìm categoryId có trong mảng category
      locationStartId ? { locationStart: locationStartId } : {},
      locationId ? { location: { _id: locationId } } : {}, // tìm locationId có trong mảng location
      priceRange ? { adultPrice: { $gte: minPrice, $lte: maxPrice } } : {},
      time === '1-3' ? { time: { $gte: 1, $lte: 3 } } : {},
      time === '4-7' ? { time: { $gte: 4, $lte: 7 } } : {},
      time === '8-14' ? { time: { $gte: 8, $lte: 14 } } : {},
      time === '15-30' ? { time: { $gte: 15 } } : {},
      countNumber ? { count: { $gte: countNumber } } : {}, // tìm count >= countNumber
      discountId ? { discountId: discountId } : {},
      isDiscount ? { discountId: { $ne: null } } : {}, // lọc các discountId !== null
    ];

    // Count tổng số items
    const totalItems = await Tour.countDocuments({ $and: searchQuery });

    // Tìm tất cả tour thỏa mãn điều kiện kèm sort & page
    const tours = await Tour.find({ $and: searchQuery })
      .populate({ path: 'locationStart', select: 'name' })
      .populate({ path: 'location', select: 'name' })
      .populate({ path: 'discountId', select: 'percentOff' })
      .sort(sortQuery)
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    //---start--- Sắp xếp lần 2 theo giá gốc đã được giảm giá với discount
    // Lưu lại mảng Ids đã được sắp xếp
    const sortedArrIds = priceOrder
      ? tours
          .map(tour => ({
            ...tour,
            price: !tour.discountId
              ? tour.adultPrice
              : tour.adultPrice -
                (tour.adultPrice * tour.discountId.percentOff) / 100,
          })) // Tính lại giá tour cho mỗi tour

          .sort((a, b) =>
            priceOrder === 'desc' ? b.price - a.price : a.price - b.price
          ) // Sắp xếp tours theo giá mới
          .map(tour => tour._doc._id.toString())
      : tours.map(tour => tour._doc._id.toString());

    // Sắp xếp data theo thứ tự Ids có trong mảng sortedArrIds
    const sortedTours = sortedArrIds.map(tourId => {
      const tour = tours.find(tour => tour._id.toString() === tourId);
      return tour._doc;
    });
    //---end--- Sắp xếp lần 2 theo giá gốc đã được giảm giá với discount

    // Check if any of the tour have been added to orders
    const checkedTours = await Promise.all(
      sortedTours.map(async tour => {
        // nếu tourId có trong order và vẫn trong trạng thái 'waiting'
        const tourInOrders = await Order.countDocuments({
          'tours.tour._id': tour._id.toString(),
          status: 'waiting',
        });

        const isInOrder = tourInOrders > 0;

        return {
          ...tour,
          isInOrder,
        };
      })
    );

    // trả về res
    res.status(200).json({
      message: 'Fetched tours successfully.',
      tours: checkedTours,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
