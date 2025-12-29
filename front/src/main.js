import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Login from './components/Login.vue';
import Dashboard from './components/Dashboard.vue';
import Sessions from './components/Sessions.vue';
import { getAccessToken } from './tokenStore';
import { silentRefresh } from './services/authService';

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/sessions', component: Sessions, meta: { requiresAuth: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

let authReady = false;

// Try silent refresh before mounting the app so the initial navigation guard has correct auth state
(async function initAuth() {
  try {
    await silentRefresh(); // tries to obtain access token using refresh cookie
  } catch (e) {
    // silent refresh failed - user not authenticated, that's fine
    // console.warn('Silent refresh failed', e);
  } finally {
    authReady = true;
    // mount app after auth attempt so router guards can rely on current token state
    const app = createApp(App);
    app.use(router);
    app.mount('#app');
  }
})();

// navigation guard
router.beforeEach((to, from, next) => {
  if (!authReady) {
    // if auth not ready yet (shouldn't happen because we mount after init), wait a tiny bit
    const unwatch = setInterval(() => {
      if (authReady) {
        clearInterval(unwatch);
        proceed();
      }
    }, 10);
  } else {
    proceed();
  }

  function proceed() {
    const requiresAuth = to.meta?.requiresAuth;
    if (!requiresAuth) return next();
    if (getAccessToken()) return next();
    // no token -> redirect to login
    return next('/login');
  }
});