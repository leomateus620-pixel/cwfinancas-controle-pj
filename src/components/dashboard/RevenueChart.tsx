import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Sample data - will be replaced with real data
const revenueData = [
  { month: "Jan", revenue: 186000, expenses: 142000 },
  { month: "Feb", revenue: 205000, expenses: 148000 },
  { month: "Mar", revenue: 237000, expenses: 156000 },
  { month: "Apr", revenue: 273000, expenses: 165000 },
  { month: "May", revenue: 209000, expenses: 158000 },
  { month: "Jun", revenue: 314000, expenses: 172000 },
  { month: "Jul", revenue: 298000, expenses: 168000 },
  { month: "Aug", revenue: 342000, expenses: 185000 },
  { month: "Sep", revenue: 378000, expenses: 192000 },
  { month: "Oct", revenue: 356000, expenses: 188000 },
  { month: "Nov", revenue: 401000, expenses: 198000 },
  { month: "Dec", revenue: 445000, expenses: 215000 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-premium-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-medium text-foreground">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function RevenueChart() {
  return (
    <Card className="shadow-premium-sm hover:shadow-premium-md transition-premium animate-fade-in border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Revenue Trends</CardTitle>
        <CardDescription>Monthly revenue vs expenses over the past year</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] md:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={revenueData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={formatCurrency}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--chart-5))"
                strokeWidth={2}
                fill="url(#expensesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
