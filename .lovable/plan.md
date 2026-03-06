

## Plan: Change Empty State Button to Generate Forecast

### Change
In `src/pages/ForecastsPage.tsx`, line 153: replace the "Ir para Google Sheets" button (which navigates to `/google-sheets`) with a "Gerar Previsão" button that calls `generate(horizon)` to trigger forecast generation directly.

```tsx
// Before
<Button onClick={() => navigate("/google-sheets")} className="mt-2">
  Ir para Google Sheets
</Button>

// After
<Button onClick={() => generate(horizon)} disabled={isGenerating} className="mt-2 gap-2">
  <RefreshCw className="w-4 h-4" />
  Gerar Previsão
</Button>
```

Single file, single line change.

