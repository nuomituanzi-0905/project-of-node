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

(async function initAuth() {
  try {
    await silentRefresh();
  } catch (e) {
    // Silent refresh may fail; proceed
  } finally {
    authReady = true;
    const app = createApp(App);
    app.use(router);
    app.mount('#app');
  }
})();

router.beforeEach((to, from, next) => {
  if (!authReady) {
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
    return next('/login');
  }
});