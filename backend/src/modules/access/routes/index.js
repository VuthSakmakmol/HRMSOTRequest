// backend/src/modules/access/routes/index.js

const express = require('express')

const permissionRoutes = require('./permission.routes')
const systemRoleRoutes = require('./systemRole.routes')

const router = express.Router()

router.use('/permissions', permissionRoutes)
router.use('/roles', systemRoleRoutes)

module.exports = router