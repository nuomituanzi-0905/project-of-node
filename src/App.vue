<template>
  <div>
    <nav style="display:flex; gap:12px; align-items:center; padding:12px; background:#f5f5f5;">
      <router-link to="/dashboard">Dashboard</router-link>
      <router-link to="/sessions">Sessions</router-link>
      <router-link to="/login">Login</router-link>
      <div style="margin-left:auto;">
        <button v-if="isAuth" @click="doLogout">Logout</button>
      </div>
    </nav>
    <main style="padding:16px;">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getAccessToken, clearAccessToken } from './tokenStore';
import { logout } from './services/authService';

const router = useRouter();
const isAuth = computed(() => !!getAccessToken());

async function doLogout() {
  try {
    await logout();
  } catch (e) {
    console.warn('Logout failed', e);
  } finally {
    clearAccessToken();
    router.push('/login');
  }
}
</script>