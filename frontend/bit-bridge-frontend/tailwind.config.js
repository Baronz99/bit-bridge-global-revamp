/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2f3b69',
        // alt: "#695d2f",
        alt: ' rgb(255 204 0)',
      },
      width: {
        'app-width': '1500px',
      },
      maxWidth: {
        'app-layout': '1500px',
      },
      gridTemplateColumns: {
        'home-grid': 'auto 400px',
        checkout: '1fr 2fr',
        wallet: ' auto 400px',
      },
    },
  },
  plugins: [],
}
