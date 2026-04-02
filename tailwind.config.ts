import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        "mono-ibm": ["IBM Plex Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          2: "hsl(var(--surface2))",
          3: "hsl(var(--surface3))",
        },
        ct: {
          text: "hsl(var(--ct-text))",
          text2: "hsl(var(--ct-text2))",
          text3: "hsl(var(--ct-text3))",
          accent: "hsl(var(--ct-accent))",
          accent2: "hsl(var(--ct-accent2))",
          accent3: "hsl(var(--ct-accent3))",
          good: "hsl(var(--ct-good))",
          warn: "hsl(var(--ct-warn))",
          danger: "hsl(var(--ct-danger))",
          info: "hsl(var(--ct-info))",
          cull: "hsl(var(--ct-cull))",
          tag: "hsl(var(--ct-tag))",
        },
        cond: {
          ba: "hsl(var(--c-ba))",
          b: "hsl(var(--c-b))",
          ds: "hsl(var(--c-ds))",
          hs: "hsl(var(--c-hs))",
          pi: "hsl(var(--c-pi))",
          po: "hsl(var(--c-po))",
          s: "hsl(var(--c-s))",
          th: "hsl(var(--c-th))",
          r: "hsl(var(--c-r))",
          w: "hsl(var(--c-w))",
          bs: "hsl(var(--c-bs))",
          ss: "hsl(var(--c-ss))",
          kh: "hsl(var(--c-kh))",
          ff: "hsl(var(--c-ff))",
          pd: "hsl(var(--c-pd))",
          u: "hsl(var(--c-u))",
          c: "hsl(var(--c-c))",
          tb: "hsl(var(--c-tb))",
          op: "hsl(var(--c-op))",
          mn: "hsl(var(--c-mn))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
