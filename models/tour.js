const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tourSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    time: {
      type: Number,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
    category: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
      },
    ],
    locationStart: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    location: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
      },
    ],
    discountId: {
      type: Schema.Types.ObjectId,
      ref: 'Discount',
      default: 0,
    },
    adultPrice: {
      type: Number,
      required: true,
    },
    childPrice: {
      type: Number,
      required: true,
    },
    babyPrice: {
      type: Number,
      required: true,
    },
    img1: {
      type: String,
      required: true,
    },
    img2: {
      type: String,
      required: true,
    },
    img3: {
      type: String,
      required: true,
    },
    img4: {
      type: String,
      required: true,
    },
    schedule: {
      type: Array,
      required: true,
    },
    warn: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tour', tourSchema);
