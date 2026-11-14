import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.immortalhand.otherworld3d',
  appName: 'Immortal Hand 3D',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0B0914',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
