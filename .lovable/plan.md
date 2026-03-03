

## Plan: Login/Register Redesign + Profile Data Flow

### What needs to change

**1. Login Page — Liquid Glass Premium Redesign**
- Replace plain white background with textured gradient mesh background (using logo's blue/teal palette from CSS vars)
- Card becomes `liquid-glass` with `backdrop-blur(24px)` and subtle noise texture
- Add logo image (`logo-full.png`) above the title
- Change "FinSight" → "CW Finanças" + subtitle "Controle PJ"
- Inputs get glass-style borders with subtle inner glow
- Button gets gradient primary style

**2. Register Page — Same Liquid Glass + Empty Placeholders**
- Same visual treatment as Login (logo, branding, glass card, mesh bg)
- Change "FinSight" → "CW Finanças / Controle PJ"
- Remove pre-filled placeholder text from inputs (Nome, Empresa, Email, Senha fields show empty, only label above)
- Keep validation working

**3. DashboardHeader — Show Real Profile Data**
- Import `useProfile` and `useAuth` hooks
- Replace hardcoded "João Silva" / "joao@empresa.com" with `profile.full_name` and `user.email`
- User avatar circle shows initials from `full_name`
- "Sair" button calls `signOut()`
- "Configurações" link navigates to `/settings`

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/LoginPage.tsx` | Full redesign: liquid glass bg, logo import, branding update |
| `src/pages/RegisterPage.tsx` | Same visual treatment, empty placeholders |
| `src/components/layout/DashboardHeader.tsx` | Use real profile/auth data instead of hardcoded values |

### Data flow (already working, no DB changes needed)
- Signup sends `full_name` + `company_name` as user metadata
- DB trigger `handle_new_user` copies these into `profiles` table
- Settings page reads/updates via `useProfile` hook
- Header will now also read from `useProfile`

### Technical details
- No database migrations needed — trigger and profiles table already exist
- No new dependencies
- Login/Register pages use existing CSS classes: `liquid-glass`, `home-glass-bg`, `gradient-mesh`, `glass-premium`
- Logo imported from `@/assets/logo-full.png` (already used in sidebar)

