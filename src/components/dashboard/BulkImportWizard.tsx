'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

interface ParsedRow {
  title: string;
  category: string;
  price: string;
  condition: string;
  year?: string;
  make?: string;
  model?: string;
  mileage?: string;
  vin?: string;
  description?: string;
  city?: string;
  state?: string;
  stock_number?: string;
  acquisition_cost?: string;
  [key: string]: string | undefined;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

export function BulkImportWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: ParsedRow = {
        title: '',
        category: '',
        price: '',
        condition: '',
      };

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      rows.push(row);
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  };

  const validateData = (data: ParsedRow[]): ValidationError[] => {
    const validationErrors: ValidationError[] = [];

    data.forEach((row, index) => {
      if (!row.title) {
        validationErrors.push({
          row: index + 2,
          field: 'title',
          message: 'Title is required',
        });
      }
      if (!row.category) {
        validationErrors.push({
          row: index + 2,
          field: 'category',
          message: 'Category is required',
        });
      }
      if (!row.price || isNaN(parseFloat(row.price))) {
        validationErrors.push({
          row: index + 2,
          field: 'price',
          message: 'Valid price is required',
        });
      }
      if (
        !row.condition ||
        !['new', 'used', 'certified', 'salvage'].includes(row.condition.toLowerCase())
      ) {
        validationErrors.push({
          row: index + 2,
          field: 'condition',
          message: 'Condition must be new, used, certified, or salvage',
        });
      }
    });

    return validationErrors;
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const data = parseCSV(text);
        setParsedData(data);

        const validationErrors = validateData(data);
        setErrors(validationErrors);

        setStep('preview');
      };
      reader.readAsText(selectedFile);
    },
    []
  );

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];

      try {
        const response = await fetch('/api/dashboard/bulk/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: row.title,
            category: row.category,
            price: parseFloat(row.price),
            condition: row.condition.toLowerCase(),
            year: row.year ? parseInt(row.year) : null,
            make: row.make || null,
            model: row.model || null,
            mileage: row.mileage ? parseInt(row.mileage) : null,
            vin: row.vin || null,
            description: row.description || null,
            city: row.city || null,
            state: row.state || null,
            stock_number: row.stock_number || null,
            acquisition_cost: row.acquisition_cost
              ? parseFloat(row.acquisition_cost)
              : null,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
      }

      setProgress(((i + 1) / parsedData.length) * 100);
    }

    setImportResult({ success: successCount, failed: failedCount });
    setStep('complete');
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setProgress(0);
    setImportResult(null);
  };

  return (
    <div className="space-y-4">
      {step === 'upload' && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Click to upload CSV</p>
              <p className="text-sm text-muted-foreground">
                or drag and drop your file here
              </p>
            </div>
          </label>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              <span className="font-medium">{file?.name}</span>
              <span className="text-muted-foreground">
                ({parsedData.length} rows)
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Change
            </Button>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Found {errors.length} validation error(s). Please fix before
                importing.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 10).map((row, index) => {
                  const rowErrors = errors.filter((e) => e.row === index + 2);
                  const hasErrors = rowErrors.length > 0;

                  return (
                    <TableRow
                      key={index}
                      className={hasErrors ? 'bg-red-50 dark:bg-red-900/10' : ''}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>
                        {row.price ? `$${parseFloat(row.price).toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell>{row.condition}</TableCell>
                      <TableCell>
                        {hasErrors ? (
                          <span className="text-red-600 text-xs">
                            {rowErrors.map((e) => e.message).join(', ')}
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {parsedData.length > 10 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing 10 of {parsedData.length} rows
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={errors.length > 0}
              className="flex-1"
            >
              Import {parsedData.length} Listings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-4 py-8">
          <div className="text-center">
            <Upload className="w-8 h-8 text-primary mx-auto mb-4 animate-pulse" />
            <p className="font-medium">Importing listings...</p>
            <p className="text-sm text-muted-foreground">
              Please don&apos;t close this page
            </p>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}

      {step === 'complete' && importResult && (
        <div className="space-y-4 py-8">
          <div className="text-center">
            {importResult.failed === 0 ? (
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            ) : (
              <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.success}
                </p>
                <p className="text-muted-foreground">Successful</p>
              </div>
              {importResult.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {importResult.failed}
                  </p>
                  <p className="text-muted-foreground">Failed</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              Import More
            </Button>
            <Button asChild className="flex-1">
              <Link href="/dashboard/listings">View Listings</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
