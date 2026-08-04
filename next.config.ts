// @ts-ignore
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public', // Menyimpan file Service Worker di folder public
  disable: process.env.NODE_ENV === 'development', // PWA dimatikan saat proses coding (dev), nyala saat production
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Konfigurasi tambahan Next.js bisa ditaruh di sini
};

export default withPWA(nextConfig);