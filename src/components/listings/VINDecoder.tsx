'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface VINDecodeResult {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim?: string | null;
  bodyClass?: string | null;
  vehicleType?: string | null;
  driveType?: string | null;
  fuelType?: string | null;
  engineCylinders?: string | null;
  engineDisplacement?: string | null;
  engineHP?: string | null;
  transmissionStyle?: string | null;
  gvwr?: string | null;
  country?: string | null;
  isValid: boolean;
  error?: string;
}

interface VINDecoderProps {
  onDecode: (data: Partial<VINDecodeResult>) => void;
  defaultValue?: string;
}

export function VINDecoder({ onDecode, defaultValue = '' }: VINDecoderProps) {
  const [vin, setVin] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VINDecodeResult | null>(null);

  const handleDecode = async () => {
    if (!vin || vin.length < 17) {
      toast.error('Please enter a valid 17-character VIN');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/vin/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        onDecode(data.data);
        toast.success('VIN decoded successfully!', {
          description: `${data.data.year || ''} ${data.data.make || ''} ${data.data.model || ''}`.trim(),
        });
      } else {
        toast.error(data.error || 'Failed to decode VIN');
      }
    } catch (error) {
      toast.error('Failed to decode VIN');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 17) {
      setVin(value);
      setResult(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vin">VIN (Vehicle Identification Number)</Label>
        <div className="flex gap-2">
          <Input
            id="vin"
            value={vin}
            onChange={handleVINChange}
            placeholder="Enter 17-character VIN"
            className="font-mono tracking-wider"
            maxLength={17}
          />
          <Button
            type="button"
            onClick={handleDecode}
            disabled={vin.length !== 17 || isLoading}
            className="gap-2 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Decode
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {vin.length}/17 characters
          {vin.length === 17 && (
            <span className="ml-2 text-green-600">Ready to decode</span>
          )}
        </p>
      </div>

      {result && (
        <Card className={result.isValid ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              {result.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">
                  {result.isValid ? 'Valid VIN' : 'VIN Warning'}
                </p>
                {result.error && (
                  <p className="text-sm text-muted-foreground">{result.error}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto gap-1">
                <Sparkles className="w-3 h-3" />
                Auto-filled
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {result.year && (
                <div>
                  <p className="text-muted-foreground">Year</p>
                  <p className="font-medium">{result.year}</p>
                </div>
              )}
              {result.make && (
                <div>
                  <p className="text-muted-foreground">Make</p>
                  <p className="font-medium">{result.make}</p>
                </div>
              )}
              {result.model && (
                <div>
                  <p className="text-muted-foreground">Model</p>
                  <p className="font-medium">{result.model}</p>
                </div>
              )}
              {result.trim && (
                <div>
                  <p className="text-muted-foreground">Trim</p>
                  <p className="font-medium">{result.trim}</p>
                </div>
              )}
              {result.bodyClass && (
                <div>
                  <p className="text-muted-foreground">Body Type</p>
                  <p className="font-medium">{result.bodyClass}</p>
                </div>
              )}
              {result.engineHP && (
                <div>
                  <p className="text-muted-foreground">Engine HP</p>
                  <p className="font-medium">{result.engineHP} HP</p>
                </div>
              )}
              {result.fuelType && (
                <div>
                  <p className="text-muted-foreground">Fuel Type</p>
                  <p className="font-medium">{result.fuelType}</p>
                </div>
              )}
              {result.transmissionStyle && (
                <div>
                  <p className="text-muted-foreground">Transmission</p>
                  <p className="font-medium">{result.transmissionStyle}</p>
                </div>
              )}
              {result.country && (
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium">{result.country}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
