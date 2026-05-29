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

    // Optional primary / legacy department.
    // null = this line is open to all departments.
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },

    // Optional department restrictions.
    // Empty = all departments are allowed.
    departmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        index: true,
      },
    ],

    // Optional position restrictions.
    // Empty = all positions are allowed.
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

productionLineSchema.index({ departmentId: 1, isActive: 1 })
productionLineSchema.index({ departmentIds: 1, isActive: 1 })
productionLineSchema.index({ departmentId: 1, code: 1 })
productionLineSchema.index({ departmentIds: 1, code: 1 })
productionLineSchema.index({ positionIds: 1 })
productionLineSchema.index({ name: 'text', code: 'text', description: 'text' })

productionLineSchema.pre('validate', function normalize(next) {
  this.code = s(this.code).toUpperCase()
  this.name = s(this.name)
  this.description = s(this.description)

  this.departmentIds = uniqueObjectIdStrings(this.departmentIds)
  this.positionIds = uniqueObjectIdStrings(this.positionIds)

  // Backward compatibility:
  // old client may still send departmentId only.
  // If departmentId exists, include it in departmentIds.
  if (this.departmentId) {
    const primaryDepartmentId = s(this.departmentId)

    if (primaryDepartmentId && !this.departmentIds.includes(primaryDepartmentId)) {
      this.departmentIds = [primaryDepartmentId, ...this.departmentIds]
    }
  }

  this.departmentIds = uniqueObjectIdStrings(this.departmentIds)

  // New rule:
  // no departmentIds = all departments
  // departmentId should stay null when line is open to all departments.
  if (this.departmentIds.length) {
    this.departmentId = this.departmentIds[0]
  } else {
    this.departmentId = null
  }

  if (!this.createdBy) {
    this.createdBy = null
  }

  if (!this.updatedBy) {
    this.updatedBy = null
  }

  next()
})

module.exports = mongoose.model('ProductionLine', productionLineSchema)