import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skyascent.cyberhand3d',
  appName: 'Sky Ascent 3D',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#070B14',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
