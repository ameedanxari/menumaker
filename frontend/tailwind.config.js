import designTokens from './src/design-tokens.json';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      // Colors from design tokens
      colors: {
        primary: designTokens.colors.primary,
        neutral: designTokens.colors.neutral,
        success: designTokens.colors.success,
        warning: designTokens.colors.warning,
        error: designTokens.colors.error,
        info: designTokens.colors.info,
      },

      // Typography
      fontFamily: {
        sans: designTokens.typography.fontFamily.sans.split(', '),
        mono: designTokens.typography.fontFamily.mono.split(', '),
      },
      fontSize: designTokens.typography.fontSize,
      fontWeight: designTokens.typography.fontWeight,
      lineHeight: designTokens.typography.lineHeight,
      letterSpacing: designTokens.typography.letterSpacing,

      // Spacing
      spacing: designTokens.spacing,

      // Border radius
      borderRadius: designTokens.borderRadius,

      // Box shadows
      boxShadow: designTokens.shadows,

      // Transitions
      transitionDuration: designTokens.transitions.duration,
      transitionTimingFunction: designTokens.transitions.timing,

      // Z-index
      zIndex: designTokens.zIndex,

      // Breakpoints (screens)
      screens: designTokens.breakpoints,
    },
  },
  plugins: [],
}
