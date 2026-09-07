const mongoose = require('mongoose')

const { Schema } = mongoose

const paymentReportSettingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'GLOBAL',
      trim: true,
      uppercase: true,
    },

    // Positions selected here are calculated normally, but exported into a
    // dedicated payment workbook instead of the main payment workbook.
    separatePositionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Position',
      },
    ],

    updatedBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)


module.exports = mongoose.model('PaymentReportSettings', paymentReportSettingsSchema)
