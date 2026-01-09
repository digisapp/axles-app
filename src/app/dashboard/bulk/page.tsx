import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { BulkImportWizard } from '@/components/dashboard/BulkImportWizard';
import { BulkExport } from '@/components/dashboard/BulkExport';

export default async function BulkPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard/bulk');
  }

  // Check if user is a dealer
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dealer')
    .eq('id', user.id)
    .single();

  if (!profile?.is_dealer) {
    redirect('/become-a-dealer');
  }

  // Get user's listings count for export
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground mt-1">
          Import, export, and manage listings in bulk
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Import Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Import Listings</CardTitle>
                <CardDescription>
                  Upload a CSV file to create multiple listings at once
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <BulkImportWizard />
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Export Listings</CardTitle>
                <CardDescription>
                  Download your listings as a CSV file
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <BulkExport listingsCount={listingsCount || 0} />
          </CardContent>
        </Card>
      </div>

      {/* CSV Format Guide */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">CSV Format Guide</CardTitle>
              <CardDescription>
                Required and optional columns for bulk import
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Required Fields */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Required Fields
              </h4>
              <div className="space-y-2">
                {[
                  { field: 'title', desc: 'Listing title (e.g., "2020 Peterbilt 579")' },
                  { field: 'category', desc: 'Category slug (e.g., "heavy-duty-trucks")' },
                  { field: 'price', desc: 'Price in USD (numbers only)' },
                  { field: 'condition', desc: 'new, used, certified, or salvage' },
                ].map((item) => (
                  <div
                    key={item.field}
                    className="flex items-start gap-2 text-sm"
                  >
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {item.field}
                    </code>
                    <span className="text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Fields */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                Optional Fields
              </h4>
              <div className="space-y-2">
                {[
                  { field: 'year', desc: 'Year (e.g., 2020)' },
                  { field: 'make', desc: 'Manufacturer (e.g., "Peterbilt")' },
                  { field: 'model', desc: 'Model name (e.g., "579")' },
                  { field: 'mileage', desc: 'Mileage in miles' },
                  { field: 'vin', desc: 'Vehicle Identification Number' },
                  { field: 'description', desc: 'Full description' },
                  { field: 'city', desc: 'City location' },
                  { field: 'state', desc: 'State (2-letter code)' },
                  { field: 'stock_number', desc: 'Your internal stock #' },
                  { field: 'acquisition_cost', desc: 'Cost for margin tracking' },
                ].map((item) => (
                  <div
                    key={item.field}
                    className="flex items-start gap-2 text-sm"
                  >
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {item.field}
                    </code>
                    <span className="text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sample CSV */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-semibold text-sm mb-3">Sample CSV</h4>
            <div className="bg-muted rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">
{`title,category,price,condition,year,make,model,mileage,city,state
2020 Peterbilt 579 Sleeper,heavy-duty-trucks,95000,used,2020,Peterbilt,579,450000,Dallas,TX
2019 Freightliner Cascadia,heavy-duty-trucks,85000,used,2019,Freightliner,Cascadia,520000,Houston,TX
2021 Great Dane Reefer,trailers,45000,used,2021,Great Dane,Reefer,,,CA`}
              </pre>
            </div>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href="/templates/listings-template.csv" download>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
