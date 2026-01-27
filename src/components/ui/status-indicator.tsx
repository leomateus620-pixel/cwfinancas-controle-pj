import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "success" | "warning" | "danger" | "info" | "neutral";
  label?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  size = "md",
  pulse = true,
  className,
}: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "bg-success";
      case "warning":
        return "bg-warning";
      case "danger":
        return "bg-destructive";
      case "info":
        return "bg-primary";
      default:
        return "bg-muted-foreground";
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "w-2 h-2";
      case "lg":
        return "w-4 h-4";
      default:
        return "w-3 h-3";
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm":
        return "text-xs";
      case "lg":
        return "text-base";
      default:
        return "text-sm";
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex">
        <span
          className={cn(
            "rounded-full",
            getSizeClass(),
            getStatusColor()
          )}
        />
        {pulse && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-75",
              getStatusColor()
            )}
            style={{ animationDuration: "2s" }}
          />
        )}
      </span>
      {label && (
        <span className={cn("font-medium text-foreground", getTextSize())}>
          {label}
        </span>
      )}
    </div>
  );
}
