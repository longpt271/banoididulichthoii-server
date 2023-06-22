const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: '',
    },
    cart: [
      {
        tourId: {
          type: Schema.Types.ObjectId,
          ref: 'Tour',
          required: true,
        },
        startDate: { type: Date, required: true },
        adultQuantity: { type: Number, required: true },
        childQuantity: { type: Number, required: true },
        babyQuantity: { type: Number, required: true },
      },
    ],
    role: {
      type: String,
      default: 'user',
    },
    status: {
      type: String,
      default: 'active',
    },
    verifyCode: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Hàm add, thêm bớt tour vào cart
userSchema.methods.addToCart = function (tour, newData) {
  if (tour.count <= 0) {
    const error = new Error(`Tour này đã được bán hết.`);
    error.statusCode = 403;
    throw error;
  }

  const startDate = newData.startDate;
  const adultQuantity = newData.adultQuantity;
  const childQuantity = newData.childQuantity;
  const babyQuantity = newData.babyQuantity;

  const cartTourIndex = this.cart.findIndex(cp => {
    return cp.tourId.toString() === tour._id.toString();
  });

  const updatedCartItems = [...this.cart];

  // nếu đã tồn tại trong giỏ hàng
  if (cartTourIndex >= 0) {
    const oldAdultQuantity = this.cart[cartTourIndex].adultQuantity;
    const newAdultQuantity = oldAdultQuantity + adultQuantity;
    const oldChildQuantity = this.cart[cartTourIndex].childQuantity;
    const newChildQuantity = oldChildQuantity + childQuantity;
    const oldBabyQuantity = this.cart[cartTourIndex].babyQuantity;
    const newBabyQuantity = oldBabyQuantity + babyQuantity;

    const oldTotalQuantity =
      oldAdultQuantity + oldChildQuantity + oldBabyQuantity;
    const newTotalQuantity =
      newAdultQuantity + newChildQuantity + newBabyQuantity;

    if (newTotalQuantity > tour.count) {
      const error = new Error(
        `Tour này bạn đã thêm vào giỏ hàng ${oldTotalQuantity}/${tour.count} người.`
      );
      error.statusCode = 403;
      throw error;
    }

    if (newTotalQuantity <= 0) {
      updatedCartItems.splice(cartTourIndex, 1); // remove item khi quantity = 0
    } else {
      updatedCartItems[cartTourIndex].startDate = startDate;
      updatedCartItems[cartTourIndex].adultQuantity = newAdultQuantity;
      updatedCartItems[cartTourIndex].childQuantity = newChildQuantity;
      updatedCartItems[cartTourIndex].babyQuantity = newBabyQuantity;
    }
  } else {
    // nếu chưa tồn tại trong giỏ hàng
    updatedCartItems.push({
      tourId: tour._id,
      startDate: startDate,
      adultQuantity: adultQuantity,
      childQuantity: childQuantity,
      babyQuantity: babyQuantity,
    });
  }

  this.cart = updatedCartItems;
  return this.save();
};

// Hàm xóa 1 tour khỏi cart
userSchema.methods.removeFromCart = function (tourId) {
  const updatedCartItems = this.cart.filter(item => {
    return item.tourId.toString() !== tourId.toString();
  });
  this.cart = updatedCartItems;
  return this.save();
};

userSchema.methods.clearCart = function () {
  this.cart = [];
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
