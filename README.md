This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Automatic booking reminders (cron)

Schedule a request every **5-15 minutes** to `GET` or `POST` `/api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`.

Example (PowerShell):

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/reminders" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

Example (curl):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-deployment.example/api/cron/reminders"
```

Server-only environment variables (never `NEXT_PUBLIC_`):

- `CRON_SECRET` - required for the cron route to run
- `SUPABASE_SERVICE_ROLE_KEY` - required to process bookings across businesses
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (already used by the app)

Optional providers for real delivery: `RESEND_API_KEY`, `RESEND_FROM`, Twilio variables as implemented in `src/lib/notifications/`. Use `APP_ORIGIN` or `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) so confirmation links in e-mail/SMS are absolute.
