# Relay (Sound Sync) — Deploy & Monetize with Ads

This package includes Google AdSense integration, Privacy & Terms pages, and a home-page ad slot.

---

## 1. Deploy

### Prerequisites
- Node.js 18+
- A PostgreSQL database (free: [Neon](https://neon.tech), [Supabase](https://supabase.com))
- A GitHub account + [Vercel](https://vercel.com) account (recommended)

### Local setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL
npx drizzle-kit push
npm run dev
```

### Production (Vercel)

1. Push this project to a GitHub repo.
2. In Vercel → **Add New Project** → import the repo.
3. Add environment variables:
   - `DATABASE_URL` = your production Postgres URL
   - `NEXT_PUBLIC_ADSENSE_CLIENT` = your AdSense publisher ID (after approval)
4. Deploy.
5. Run schema against production DB if needed:
   ```bash
   DATABASE_URL="your-prod-url" npx drizzle-kit push
   ```

HTTPS is automatic on Vercel (required for microphone / system audio).

---

## 2. Add Google AdSense

### Apply
1. Go to [adsense.google.com](https://adsense.google.com).
2. Add your live site URL (Vercel or custom domain).
3. Wait for approval (days to weeks). Having Privacy + Terms pages (already included) helps.

### Configure this app

1. In Vercel (or `.env.local`), set:
   ```
   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-YOUR_REAL_ID
   ```
2. In AdSense, create an **ad unit** (Display ads → Responsive).
3. Copy the **slot ID** (numeric string).
4. Open `src/components/HomeClient.tsx` and replace the placeholder slot:
   ```tsx
   <AdBanner slot="YOUR_SLOT_ID" format="auto" className="mx-auto max-w-2xl" />
   ```
5. Redeploy.

Until you set a real `NEXT_PUBLIC_ADSENSE_CLIENT`, the app shows a dashed “Ad placeholder” box so layout stays correct while developing.

### Where ads are placed
- **Home page** — banner between the Join section and the “How it works” steps.
- Ads are **not** injected into the live room UI while audio is playing (keeps the experience clean).

You can add more `<AdBanner slot="..." />` instances anywhere (e.g. room gate screen) using the same component.

---

## 3. Optional: donation / support link

The footer “Support” link points to Buy Me a Coffee. Change the URL in `HomeClient.tsx` to your own page (Ko-fi, PayPal, etc.).

---

## 4. Checklist

- [ ] `DATABASE_URL` set in production
- [ ] Schema pushed (`drizzle-kit push`)
- [ ] Site loads; create + join room works
- [ ] Privacy (`/privacy`) and Terms (`/terms`) accessible
- [ ] AdSense approved
- [ ] `NEXT_PUBLIC_ADSENSE_CLIENT` set
- [ ] Real ad slot ID in `HomeClient.tsx`
- [ ] Redeployed

---

## Files added/changed for monetization

| File | Purpose |
|------|---------|
| `src/components/AdBanner.tsx` | Reusable AdSense banner component |
| `src/app/layout.tsx` | Loads AdSense script when client ID is set |
| `src/components/HomeClient.tsx` | Ad slot + footer with Privacy / Terms / Support |
| `src/app/privacy/page.tsx` | Privacy Policy (helps AdSense approval) |
| `src/app/terms/page.tsx` | Terms of Service |
| `.env.example` | Documents `DATABASE_URL` and `NEXT_PUBLIC_ADSENSE_CLIENT` |
| `DEPLOY_AND_ADS.md` | This guide |
