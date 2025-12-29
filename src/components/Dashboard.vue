<template>
  <div>
    <h2>Dashboard</h2>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color:red">{{ error }}</div>
    <div v-else-if="info">
      <p>Welcome {{ info.user.name }} ({{ info.user.username }})</p>
      <p>Roles: {{ info.roles.join(', ') }}</p>
      <p>Menus:
        <span v-for="m in info.menus" :key="m.id" style="margin-right:8px;">{{ m.title }}</span>
      </p>
    </div>
    <div style="margin-top:16px;">
      <button @click="refreshInfo">Refresh</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getUserInfo } from '../services/authService';

const info = ref(null);
const loading = ref(false);
const error = ref(null);

async function refreshInfo() {
  loading.value = true;
  error.value = null;
  try {
    info.value = await getUserInfo();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load user info';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refreshInfo();
});
</script>