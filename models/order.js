const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema(
  {
    userOrder: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    }, // userOrder là id của user order hóa đơn này
    userInfo: {
      email: { type: String, required: true },
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
    }, // info liên hệ ng dùng nhập khi đặt hóa đơn
    tours: [
      {
        tour: {
          _id: { type: Schema.Types.ObjectId, required: true, ref: 'Tour' },
          name: { type: String, required: true },
          locationStart: { type: String, required: true },
          adultPrice: { type: Number, required: true }, // lưu giá tại thời điểm đặt
          childPrice: { type: Number, required: true },
          babyPrice: { type: Number, required: true },
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        adultQuantity: { type: Number, required: true },
        childQuantity: { type: Number, required: true },
        babyQuantity: { type: Number, required: true },
      },
    ],
    totalMoney: {
      type: Number,
      required: true,
    },
    isPay: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: 'waiting',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
