// frontend/src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './app/router'
import { useThemeStore } from './app/store/theme.store'
import i18n, { initAppLanguage } from './shared/i18n'
import './shared/styles.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
  ripple: true,
})

app.use(ToastService)

const theme = useThemeStore(pinia)
theme.init()
initAppLanguage()

app.mount('#app')