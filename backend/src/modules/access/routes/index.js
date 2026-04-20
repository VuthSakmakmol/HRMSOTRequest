// backend/src/modules/access/routes/index.js
const express = require('express')

const permissionRoutes = require('./permission.routes')
const roleRoutes = require('./systemRole.routes')

const router = express.Router()

router.use('/permissions', permissionRoutes)
router.use('/roles', roleRoutes)

module.exports = router