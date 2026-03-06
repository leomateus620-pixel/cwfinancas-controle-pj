

## Plan: Add ASAAS Logo (Horizontal)

### Steps

1. **Copy the uploaded logo** to `src/assets/bank-asaas.png`

2. **Update `src/components/home/CaixaAtualCard.tsx`:**
   - Import the new asset: `import bankAsaasImg from "@/assets/bank-asaas.png"`
   - In `getBankLogo()` (~line 35): add `if (n.includes("asaas")) return bankAsaasImg;`
   - Change the logo `<img>` className from `w-12 h-12 rounded-xl` (square) to a **horizontal rectangle**: `h-10 w-auto max-w-[120px] rounded-lg` so the wide ASAAS logo renders properly
   - Apply the same horizontal styling in the drawer section (~line 270) for consistency

The existing Sicredi/Caixinha logos (which are square) will also work fine with `h-10 w-auto` since they'll just render as ~40px squares. The ASAAS logo will stretch horizontally as intended.

