<!-- frontend/src/modules/auth/views/LoginView.vue -->
<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'

import AppLanguageSwitcher from '@/shared/components/AppLanguageSwitcher.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { safeRedirectPath } from '@/app/router/defaultRoute'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const form = reactive({
  loginId: '',
  password: '',
})

const errorMessage = ref('')

const isSubmitDisabled = computed(() => {
  return (
    auth.loading ||
    !String(form.loginId || '').trim() ||
    !String(form.password || '').trim()
  )
})

async function submit() {
  errorMessage.value = ''

  try {
    await auth.login({
      loginId: String(form.loginId || '').trim(),
      password: form.password,
    })

    await router.push(safeRedirectPath(route.query?.redirect, auth))
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      t('auth.error.loginFailed'),
    )
  }
}
</script>

<template>
  <div class="min-h-screen bg-[color:var(--ot-bg)] text-[color:var(--ot-text)]">
    <div class="flex min-h-screen items-center justify-center px-4 py-10">
      <section class="w-full max-w-[34rem] rounded-[28px] border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-6 shadow-[var(--ot-shadow-lg)] sm:p-8">
        <div class="mb-7 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="ot-page-kicker">
              <i class="pi pi-shield" />
              {{ t('common.appName') }}
            </div>

            <h1 class="ot-page-title">
              {{ t('auth.login') }}
            </h1>

            <p class="ot-page-subtitle">
              {{ t('auth.loginSubtitle') }}
            </p>
          </div>

          <AppLanguageSwitcher />
        </div>

        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.loginId') }}
            </label>

            <InputText
              v-model="form.loginId"
              autocomplete="username"
              class="w-full"
              :placeholder="t('auth.loginIdPlaceholder')"
              autofocus
            />
          </div>

          <div class="ot-field">
            <label class="ot-field-label">
              {{ t('auth.password') }}
            </label>

            <Password
              v-model="form.password"
              class="w-full"
              input-class="w-full"
              toggle-mask
              :feedback="false"
              autocomplete="current-password"
              :placeholder="t('auth.passwordPlaceholder')"
            />
          </div>

          <div
            v-if="errorMessage"
            class="ot-inline-error"
          >
            {{ errorMessage }}
          </div>

          <Button
            type="submit"
            :label="auth.loading ? t('auth.signingIn') : t('auth.login')"
            :loading="auth.loading"
            :disabled="isSubmitDisabled"
            class="w-full"
          />
        </form>
      </section>
    </div>
  </div>
</template>