import { Upload, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Upload Data
        </h1>
        <p className="text-muted-foreground mt-1">
          Import your financial data from Excel files.
        </p>
      </div>
      
      <Card className="border-border/50 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Excel Upload
          </CardTitle>
          <CardDescription>
            Drag and drop your .xlsx files or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/50 hover:bg-accent/30 transition-premium cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Drop your Excel file here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports .xlsx and .xls files up to 10MB
                </p>
              </div>
              <Button variant="outline" className="mt-2">
                Browse Files
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UploadPage;
