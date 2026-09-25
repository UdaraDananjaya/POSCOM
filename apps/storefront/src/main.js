import { createApp } from 'vue';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify.js';
import router from './router/index.js';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app');
