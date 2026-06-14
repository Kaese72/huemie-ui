import { createRouter, createWebHistory } from 'vue-router';
import { isMobileDevice } from './composables/useViewMode.js'
import { useAuth } from './composables/useAuth.js'
import Home from './Home.vue';
import DeviceTable from './DeviceTable.vue';
import GroupTable from './GroupTable.vue'
import AdapterTable from './AdapterTable.vue';
import NotFound from './NotFound.vue';
import DeviceDetail from './DeviceDetail.vue';
import GroupDetail from './GroupDetail.vue'
import AdapterDetail from './AdapterDetail.vue';
import RuleTable from './RuleTable.vue';
import RuleDetail from './RuleDetail.vue';
import UserTable from './UserTable.vue';
import MobileApp from './mobile/MobileApp.vue';
import MobileHome from './mobile/MobileHome.vue';
import MobileGroupList from './mobile/MobileGroupList.vue';
import MobileGroupDetail from './mobile/MobileGroupDetail.vue';
import MobileDeviceList from './mobile/MobileDeviceList.vue';
import MobileDeviceDetail from './mobile/MobileDeviceDetail.vue';
import Login from './Login.vue';
import Setup from './Setup.vue';

const routes = [
  { path: '/login', name: 'Login', component: Login, meta: { public: true } },
  { path: '/setup', name: 'Setup', component: Setup, meta: { public: true } },
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'Home', component: Home },
  {
    path: '/devices',
    name: 'Devices',
    component: DeviceTable,
    children: [
      { path: ':id', redirect: to => ({ name: 'DeviceDetail', params: { id: to.params.id, tab: 'state' } }) },
      { path: ':id/:tab', name: 'DeviceDetail', component: DeviceDetail },
    ]
  },
  {
    path: '/groups',
    name: 'Groups',
    component: GroupTable,
    children: [
      { path: ':id', redirect: to => ({ name: 'GroupDetail', params: { id: to.params.id, tab: 'state' } }) },
      { path: ':id/:tab', name: 'GroupDetail', component: GroupDetail },
    ]
  },
  {
    path: '/adapters',
    name: 'Adapters',
    component: AdapterTable,
    children: [{ path: ':id', name: 'AdapterDetail', component: AdapterDetail }]
  },
  {
    path: '/rules',
    name: 'Rules',
    component: RuleTable,
    children: [{ path: ':id', name: 'RuleDetail', component: RuleDetail }]
  },
  { path: '/users', name: 'Users', component: UserTable },
  {
    path: '/mobile',
    component: MobileApp,
    children: [
      { path: '', name: 'MobileHome', component: MobileHome },
      { path: 'groups', name: 'MobileGroups', component: MobileGroupList },
      { path: 'groups/:id', name: 'MobileGroupDetail', component: MobileGroupDetail },
      { path: 'devices', name: 'MobileDevices', component: MobileDeviceList },
      { path: 'devices/:id', name: 'MobileDeviceDetail', component: MobileDeviceDetail },
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const { isAuthenticated, isInitialized, init } = useAuth()

  // Attempt cookie-based token refresh on first navigation
  if (!isInitialized.value) {
    await init()
  }

  // Public routes are always accessible
  if (to.meta.public) return

  // Require authentication for all other routes
  if (!isAuthenticated.value) {
    return { name: 'Login' }
  }

  // Redirect mobile devices to mobile views
  if (isMobileDevice && !to.path.startsWith('/mobile')) {
    return { name: 'MobileHome' }
  }
})

export default router;
