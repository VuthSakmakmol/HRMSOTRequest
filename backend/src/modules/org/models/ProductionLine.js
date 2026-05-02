// backend/src/modules/org/models/ProductionLine.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

const productionLineSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },

    // Optional: restrict this line to some positions, example: Sewer.
    // If empty, it means this line can be used by any position under the department.
    positionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
      },
    ],

    description: {
      type: String,
      trim: true,
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

productionLineSchema.index({ code: 1 }, { unique: true })
productionLineSchema.index({ name: 1 })
productionLineSchema.index({ departmentId: 1, isActive: 1 })
productionLineSchema.index({ positionIds: 1 })

productionLineSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)

  if (!Array.isArray(this.positionIds)) {
    this.positionIds = []
  }

  next()
})

module.exports = mongoose.model('ProductionLine', productionLineSchema)