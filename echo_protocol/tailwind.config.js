/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                theme: {
                    DEFAULT: "var(--theme-color)",
                    dim: "var(--theme-color-dim)",
                    glow: "var(--theme-color-glow)",
                },
                warning: {
                    DEFAULT: "var(--warning-color)",
                    dim: "var(--warning-dim)",
                },
                panel: {
                    bg: "var(--panel-bg)",
                    "bg-solid": "var(--panel-bg-solid)",
                }
            }
        },
    },
    plugins: [],
}
