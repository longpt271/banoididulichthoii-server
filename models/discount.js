const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discountSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    percentOff: {
      type: Number,
      required: true,
    },
    status: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Discount', discountSchema);
