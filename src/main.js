import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './theme.css';
import './ui.css';
import './appliance.css';

const app = createApp(App);
app.use(router);
// Mount once the first route has resolved (auth check included), so the
// right layout renders from the start instead of flashing the app shell.
router.isReady().then(() => app.mount('#app'));
