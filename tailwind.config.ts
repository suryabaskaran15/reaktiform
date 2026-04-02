import type { Config } from 'tailwindcss'

// ── reaktiform Tailwind preset
// Consumers add this to their tailwind.config.ts:
//   import reaktiformPreset from 'reaktiform/tailwind-preset'
//   export default { presets: [reaktiformPreset], ... }

export const reaktiformPreset = {
  theme: {
    extend: {
      colors: {
        // Map to CSS variables so consumers can override
        'rf-bg':          'var(--rf-bg)',
        'rf-surface':     'var(--rf-surface)',
        'rf-border':      'var(--rf-border)',
        'rf-border-strong':'var(--rf-border-strong)',
        'rf-text-1':      'var(--rf-text-1)',
        'rf-text-2':      'var(--rf-text-2)',
        'rf-text-3':      'var(--rf-text-3)',
        'rf-accent':      'var(--rf-accent)',
        'rf-accent-bg':   'var(--rf-accent-bg)',
        'rf-accent-br':   'var(--rf-accent-br)',
        'rf-ok':          'var(--rf-ok)',
        'rf-ok-bg':       'var(--rf-ok-bg)',
        'rf-warn':        'var(--rf-warn)',
        'rf-warn-bg':     'var(--rf-warn-bg)',
        'rf-err':         'var(--rf-err)',
        'rf-err-bg':      'var(--rf-err-bg)',
        'rf-row-hover':   'var(--rf-row-hover)',
        'rf-row-dirty':   'var(--rf-row-dirty)',
        'rf-header':      'var(--rf-header)',
      },
      fontFamily: {
        'rf-sans': 'var(--rf-font-sans)',
        'rf-mono': 'var(--rf-font-mono)',
      },
      borderRadius: {
        'rf-xs': 'var(--rf-radius-xs)',
        'rf-sm': 'var(--rf-radius-sm)',
        'rf-md': 'var(--rf-radius-md)',
        'rf-lg': 'var(--rf-radius-lg)',
        'rf-xl': 'var(--rf-radius-xl)',
      },
      boxShadow: {
        'rf-sm': 'var(--rf-shadow-sm)',
        'rf-md': 'var(--rf-shadow-md)',
        'rf-lg': 'var(--rf-shadow-lg)',
      },
    },
  },
} satisfies Partial<Config>

// ── Dev config (used only when developing the package itself)
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './stories/**/*.{ts,tsx}',
  ],
  presets: [reaktiformPreset],
  darkMode: 'class',
}

export default config
