<template>
  <div>
    <h2>Active Sessions</h2>
    <div v-if="loading">Loading sessions...</div>
    <div v-else-if="error" style="color:red">{{ error }}</div>
    <div v-else>
      <div v-if="sessions.length === 0">No active sessions.</div>
      <ul>
        <li v-for="s in sessions" :key="s.jti" style="margin-bottom:10px;">
          <strong v-if="s.isCurrent">(This session)</strong>
          <div>JTI: {{ s.jti }}</div>
          <div>Created: {{ formatDate(s.createdAt) }}</div>
          <div>Expires: {{ formatDate(s.expiresAt) }}</div>
          <div v-if="s.ip">IP: {{ s.ip }}</div>
          <div v-if="s.userAgent">Agent: {{ s.userAgent }}</div>
          <button @click="revoke(s.jti)" :disabled="revoking[s.jti]">
            {{ revoking[s.jti] ? 'Revoking...' : 'Revoke' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { listSessions, revokeSession } from '../services/authService';
import { clearAccessToken } from '../tokenStore';
import { useRouter } from 'vue-router';

const sessions = ref([]);
const loading = ref(false);
const error = ref(null);
const revoking = ref({});
const router = useRouter();

let evtSource = null;

function formatDate(ms) {
  try {
    return new Date(ms).toLocaleString();
  } catch (e) {
    return String(ms);
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    sessions.value = await listSessions();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load sessions';
  } finally {
    loading.value = false;
  }
}

async function revoke(jti) {
  revoking.value = { ...revoking.value, [jti]: true };
  try {
    const resp = await revokeSession(jti);
    if (resp && resp.isCurrent) {
      // current session revoked — redirect to login
      clearAccessToken();
      router.push('/login');
      return;
    }
    await load();
  } catch (e) {
    console.error('Revoke error', e);
    alert('Failed to revoke session');
  } finally {
    revoking.value = { ...revoking.value, [jti]: false };
  }
}

// handle incoming SSE messages
function handleEvent(e) {
  try {
    const payload = JSON.parse(e.data);
    if (!payload || !payload.type) return;

    if (payload.type === 'session_revoked') {
      if (payload.isCurrent) {
        // current session was revoked elsewhere
        alert('Your session was revoked or logged out from another device. You will be redirected to login.');
        clearAccessToken();
        router.push('/login');
        return;
      } else {
        // another session revoked — refresh list and notify
        load();
        // optional: show a subtle notification
        console.info('A session was revoked:', payload.jti);
      }
    } else if (payload.type === 'all_revoked') {
      if (payload.isCurrent) {
        alert('All your sessions were revoked (including this one). Redirecting to login.');
        clearAccessToken();
        router.push('/login');
        return;
      } else {
        // other sessions revoked: refresh
        load();
      }
    } else {
      // other event types
      console.debug('SSE payload', payload);
    }
  } catch (err) {
    console.warn('Failed to parse SSE event', err);
  }
}

onMounted(async () => {
  await load();

  // open EventSource to listen to server events. EventSource sends cookies for same-origin.
  // If your client and server are cross-origin, ensure cookies are allowed & EventSource supports credentials.
  const url = '/api/auth/events';
  evtSource = new EventSource(url, { withCredentials: true }); // note: some browsers ignore withCredentials; same-origin recommended
  evtSource.onmessage = handleEvent;
  evtSource.onerror = (err) => {
    console.warn('SSE error', err);
    // optionally try to reconnect after a delay
  };
});

onBeforeUnmount(() => {
  if (evtSource) {
    try { evtSource.close(); } catch (e) {}
    evtSource = null;
  }
});
</script>