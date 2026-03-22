import { createRouter, createWebHistory } from 'vue-router';
import { isMobileDevice } from './composables/useViewMode.js'
import Home from './Home.vue';
import DeviceTable from './DeviceTable.vue';
import GroupTable from './GroupTable.vue'
import AdapterTable from './AdapterTable.vue';
import NotFound from './NotFound.vue';
import DeviceDetail from './DeviceDetail.vue';
import GroupDetail from './GroupDetail.vue'
import AdapterDetail from './AdapterDetail.vue';
import MobileApp from './mobile/MobileApp.vue';
import MobileHome from './mobile/MobileHome.vue';
import MobileGroupList from './mobile/MobileGroupList.vue';
import MobileGroupDetail from './mobile/MobileGroupDetail.vue';
import MobileDeviceList from './mobile/MobileDeviceList.vue';
import MobileDeviceDetail from './mobile/MobileDeviceDetail.vue';

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'Home', component: Home },
  {
    path: '/devices',
    name: 'Devices',
    component: DeviceTable,
    children: [{ path: ':id', name: 'DeviceDetail', component: DeviceDetail }]
  },
  {
    path: '/groups',
    name: 'Groups',
    component: GroupTable,
    children: [{ path: ':id', name: 'GroupDetail', component: GroupDetail }]
  },
  {
    path: '/adapters',
    name: 'Adapters',
    component: AdapterTable,
    children: [{ path: ':id', name: 'AdapterDetail', component: AdapterDetail }]
  },
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

router.beforeEach((to) => {
  if (isMobileDevice && !to.path.startsWith('/mobile')) {
    return { name: 'MobileHome' }
  }
})

export default router;
