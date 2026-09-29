# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## 2026 dashboard additions

This version includes:

- **Website Reservations**: review public reservation requests and approve/deny them.
- **Website Inquiries**: realtime public-site chat, separate from owner-app messages.
- **App Messages**: existing boarding/owner-app conversations kept separate.
- **Room Management**: add rooms, edit room details, capacity and availability status.
- **Camera Management**: register cameras and assign them to rooms; stream URL integration remains reserved for a future update.

If the public website tables already exist, run:

`supabase/DASHBOARD_PUBLIC_MANAGEMENT_PATCH.sql`

This only adds/refreshes staff/admin RLS access for website reservations and inquiries. It does not replace your existing bookings, rooms, devices, pets, or feeding tables.
