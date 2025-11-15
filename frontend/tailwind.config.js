import designTokens from './design-tokens.json';

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
        secondary: designTokens.colors.secondary,
        neutral: designTokens.colors.neutral,
        success: designTokens.colors.success,
        warning: designTokens.colors.warning,
        error: designTokens.colors.error,
        // Semantic colors
        text: designTokens.colors.semantic.text,
        bg: designTokens.colors.semantic.background,
        border: designTokens.colors.semantic.border,
        surface: designTokens.colors.semantic.surface,
        // Dark mode colors
        dark: designTokens.colors.dark,
      },

      // Typography
      fontFamily: {
        sans: designTokens.typography.fontFamily.sans.split(', '),
        serif: designTokens.typography.fontFamily.serif.split(', '),
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

      // Border width
      borderWidth: designTokens.borderWidth,

      // Box shadows
      boxShadow: designTokens.boxShadow,

      // Transitions
      transitionDuration: designTokens.transitions.duration,
      transitionTimingFunction: designTokens.transitions.easing,

      // Z-index
      zIndex: designTokens.zIndex,

      // Opacity
      opacity: designTokens.opacity,

      // Breakpoints (screens)
      screens: designTokens.breakpoints,
    },
  },
  plugins: [],
}
