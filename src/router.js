import { createRouter, createWebHistory } from 'vue-router';
import Home from './Home.vue';
import DeviceTable from './DeviceTable.vue';
import GroupTable from './GroupTable.vue'
import AdapterTable from './AdapterTable.vue';

import NotFound from './NotFound.vue';
import DeviceDetail from './DeviceDetail.vue';
import GroupDetail from './GroupDetail.vue'
import AdapterDetail from './AdapterDetail.vue';

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
  {
    path: '/adapters',
    name: 'Adapters',
    component: AdapterTable,
    children: [
      {
        path: ':id',
        name: 'AdapterDetail',
        component: AdapterDetail
      }
    ]
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
