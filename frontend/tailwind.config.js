/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ff6b6b',
        'primary-dark': '#ff5252',
      },
    },
  },
  plugins: [],
  // 避免与 Ant Design 冲突
  corePlugins: {
    preflight: false,
  },
}
