import type { Preview } from '@storybook/react'
import '../src/styles/reaktiform.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F4F6FA' },
        { name: 'dark',  value: '#0F172A' },
        { name: 'white', value: '#FFFFFF' },
      ],
    },
  },
  // Enable dark mode class on root for dark background
  decorators: [
    (Story, context) => {
      const isDark = context.globals['backgrounds']?.value === '#0F172A'
      document.documentElement.classList.toggle('dark', isDark)
      return <Story />
    },
  ],
}

export default preview
