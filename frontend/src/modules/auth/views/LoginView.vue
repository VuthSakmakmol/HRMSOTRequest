<!-- frontend/src/modules/auth/views/LoginView.vue -->
<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
    <div
      class="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="mb-6">
        <p class="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          OT Request v2
        </p>
        <h1 class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
          Sign in
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Use the seeded admin account to enter the system.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Login ID
          </label>
          <input
            v-model="form.loginId"
            type="text"
            autocomplete="username"
            class="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            placeholder="Enter login ID"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Password
          </label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            class="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            placeholder="Enter password"
          />
        </div>

        <div
          v-if="errorMessage"
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="auth.loading"
          class="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ auth.loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <div
        class="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800/70 dark:text-gray-300"
      >
        <div><span class="font-semibold">Login:</span> root_admin</div>
        <div><span class="font-semibold">Password:</span> RootAdmin@123</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/auth.store'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  loginId: 'root_admin',
  password: 'RootAdmin@123',
})

const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''

  try {
    await auth.login({
      loginId: form.loginId,
      password: form.password,
    })
    router.push('/')
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message || 'Login failed. Please try again.'
  }
}
</script>