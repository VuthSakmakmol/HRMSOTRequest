// backend/src/modules/auth/controllers/telegramAccount.controller.js

const { successResponse } = require('../../../shared/utils/apiResponse')
const telegramAccountService = require('../services/telegramAccount.service')

async function getStatus(req, res, next) {
  try {
    const item = await telegramAccountService.getTelegramStatus(req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function createConnectLink(req, res, next) {
  try {
    const item = await telegramAccountService.createTelegramConnectLink(req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function disconnect(req, res, next) {
  try {
    const item = await telegramAccountService.disconnectTelegram(req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getStatus,
  createConnectLink,
  disconnect,
}