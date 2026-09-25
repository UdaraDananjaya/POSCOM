import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { vuetifyThemeConfig } from '../theme.js';

export default createVuetify({
  components,
  directives,
  icons: { defaultSet: 'mdi' },
  theme: vuetifyThemeConfig,
  defaults: {
    VBtn: { rounded: 'lg' },
    VCard: { rounded: 'lg' },
  },
});
