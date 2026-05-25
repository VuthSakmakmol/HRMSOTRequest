// frontend/src/modules/ot/otRealtimeRefresh.js

import { onBeforeUnmount, onMounted } from 'vue'

function n(value, fallback = 300) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

export function useOTRealtimeRefresh(callback, options = {}) {
  let timer = null

  const debounceMs = n(options.debounceMs, 300)
  const name = String(options.name || 'OTRealtimeRefresh')

  function stopTimer() {
    if (timer) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function run(payload = {}) {
    stopTimer()

    timer = window.setTimeout(async () => {
      try {
        await callback(payload)
      } catch (error) {
        console.warn(`[${name}] refresh failed`, error)
      }
    }, debounceMs)
  }

  function handleOTRequestChanged(event) {
    run(event?.detail || {})
  }

  onMounted(() => {
    window.addEventListener('ot:request-changed', handleOTRequestChanged)
  })

  onBeforeUnmount(() => {
    stopTimer()
    window.removeEventListener('ot:request-changed', handleOTRequestChanged)
  })

  return {
    refreshNow: run,
  }
}