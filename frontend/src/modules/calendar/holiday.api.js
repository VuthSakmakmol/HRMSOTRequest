// frontend/src/modules/calendar/holiday.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

export function getHolidayLookupOptions(params = {}) {
  return api.get('/calendar/holidays/lookup', { params })
}

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

export function resolveHolidayDayType(date) {
  return api.get('/calendar/holidays/resolve-day-type', {
    params: {
      date,
    },
  })
}

export function exportHolidaysExcel(params = {}) {
  return api.get('/calendar/holidays/export', {
    params,
    responseType: 'blob',
  })
}

export function downloadHolidayImportSample() {
  return api.get('/calendar/holidays/import-sample', {
    responseType: 'blob',
  })
}

export function importHolidaysExcel(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/calendar/holidays/import', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}