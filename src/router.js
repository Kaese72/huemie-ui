import { createRouter, createWebHistory } from 'vue-router';
import Home from './Home.vue';
import DeviceTable from './DeviceTable.vue';
import GroupTable from './GroupTable.vue'

import NotFound from './NotFound.vue';
import DeviceDetail from './DeviceDetail.vue';
import GroupDetail from './GroupDetail.vue'

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'Home', component: Home },
  {
    path: '/devices',
    name: 'Devices',
    component: DeviceTable,
    children: [
      {
        path: ':id',
        name: 'DeviceDetail',
        component: DeviceDetail
      }
    ]
  },
  {
    path: '/groups',
    name: 'Groups',
    component: GroupTable,
    children: [
      {
        path: ':id',
        name: 'GroupDetail',
        component: GroupDetail
      }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
];

const router = createRouter({
  history: createWebHistory("huemie-ui"),
  routes
});

export default router;
