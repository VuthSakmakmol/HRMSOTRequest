// frontend/src/modules/calendar/holiday.api.js
import api from '@/shared/services/api'

export function getHolidays(params = {}) {
  return api.get('/calendar/holidays', { params })
}

export function getHolidayById(id) {
  return api.get(`/calendar/holidays/${id}`)
}

export function createHoliday(payload) {
  return api.post('/calendar/holidays', payload)
}

export function updateHoliday(id, payload) {
  return api.patch(`/calendar/holidays/${id}`, payload)
}