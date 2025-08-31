import { createRouter, createWebHistory } from 'vue-router';
import Home from './Home.vue';
import DeviceTable from './DeviceTable.vue';


import NotFound from './NotFound.vue';
import DeviceDetail from './DeviceDetail.vue';

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
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
