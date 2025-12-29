<template>
  <div style="max-width:480px; margin:36px auto;">
    <h2>Login</h2>
    <form @submit.prevent="submit">
      <div style="margin-bottom:8px;">
        <input v-model="username" placeholder="username" />
      </div>
      <div style="margin-bottom:8px;">
        <input type="password" v-model="password" placeholder="password" />
      </div>
      <div>
        <button type="submit">Login</button>
      </div>
      <div v-if="error" style="color:red; margin-top:8px;">{{ error }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../services/authService';

const username = ref('');
const password = ref('');
const error = ref(null);
const router = useRouter();

async function submit() {
  error.value = null;
  try {
    await login(username.value, password.value);
    router.push('/dashboard');
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Login failed';
  }
}
</script>