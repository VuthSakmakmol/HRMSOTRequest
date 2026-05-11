// backend/src/modules/org/models/ProductionLine.js

const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function uniqueObjectIdStrings(values = []) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

const productionLineSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },

    // Optional restriction.
    // Empty = all positions under selected department are allowed.
    // Not empty = only these positions are allowed to use this line.
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
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
    versionKey: false,
  },
)

productionLineSchema.index({ departmentId: 1, isActive: 1 })
productionLineSchema.index({ departmentId: 1, code: 1 })
productionLineSchema.index({ positionIds: 1 })
productionLineSchema.index({ name: 'text', code: 'text', description: 'text' })

productionLineSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)
  this.positionIds = uniqueObjectIdStrings(this.positionIds)

  next()
})

module.exports = mongoose.model('ProductionLine', productionLineSchema)