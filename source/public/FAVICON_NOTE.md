# Favicon

The favicon.ico isn't included in this source bundle because the chat-based
delivery channel can only carry text files reliably.

Drop your own `favicon.ico` into this `public/` folder before building. Vite
will pick it up automatically — `index.html` already references `/favicon.ico`.

If you don't add one, the app will still build and run; browsers will just
show their default tab icon.

A square 32×32 or 48×48 PNG converted to ICO works fine. The CareCompetencies
brand uses a four-pointed star (sparkle) in the primary color, which you can
re-create in any vector tool — see the `Sparkles` icon usage in
`src/components/layout/Sidebar.tsx` and `src/pages/login.tsx` for the
in-app visual reference.