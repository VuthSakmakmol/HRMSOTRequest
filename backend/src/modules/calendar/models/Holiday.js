// backend/src/modules/calendar/models/Holiday.js
const mongoose = require('mongoose')

const { Schema } = mongoose

function s(v) {
  return String(v ?? '').trim()
}

const holidaySchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    code: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    isPaidHoliday: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

holidaySchema.pre('validate', function onValidate(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)

  if (this.date instanceof Date && !Number.isNaN(this.date.getTime())) {
    this.date = new Date(
      Date.UTC(
        this.date.getUTCFullYear(),
        this.date.getUTCMonth(),
        this.date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    )
  }

  next()
})

holidaySchema.index({ date: 1 }, { unique: true })
holidaySchema.index({ isActive: 1, date: -1 })
holidaySchema.index({ name: 1 })

module.exports = mongoose.model('Holiday', holidaySchema)