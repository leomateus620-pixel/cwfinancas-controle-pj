export function ForecastsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Financial Forecasts
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered predictions for your financial future.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-64 rounded-2xl border border-dashed border-border bg-muted/30">
        <p className="text-muted-foreground">Forecasting features coming soon...</p>
      </div>
    </div>
  );
}

export default ForecastsPage;
