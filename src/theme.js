export const myShopLightTheme = {
  dark: false,
  colors: {
    background: '#F7F7F8',
    surface: '#FFFFFF',
    primary: '#1E5B4F',
    'primary-darken-1': '#153F37',
    secondary: '#D98E2B',
    error: '#C0392B',
    info: '#2E6FA7',
    success: '#2E8B57',
    warning: '#D98E2B',
  },
};

export const myShopDarkTheme = {
  dark: true,
  colors: {
    background: '#121212',
    surface: '#1E1E1E',
    primary: '#3E8C7E',
    secondary: '#E0A94A',
    error: '#E57373',
    info: '#64B5F6',
    success: '#81C784',
    warning: '#E0A94A',
  },
};

export const vuetifyThemeConfig = {
  defaultTheme: 'myShopLightTheme',
  themes: {
    myShopLightTheme,
    myShopDarkTheme,
  },
};
