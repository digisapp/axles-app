'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, Calculator, Truck, Container } from 'lucide-react';
import { cn } from '@/lib/utils';

// Federal weight limits
const WEIGHT_LIMITS = {
  steerAxle: 12000,
  singleAxle: 20000,
  tandemAxle: 34000,
  tridemAxle: 42000,
  grossWeight: 80000,
};

interface CalculationResult {
  steerAxleWeight: number;
  driveAxleWeight: number;
  trailerAxleWeight: number;
  totalWeight: number;
  violations: string[];
  isLegal: boolean;
}

const PRESET_TRUCKS = [
  { name: 'Day Cab (Tandem)', emptyWeight: 16000, steerWeight: 10000, driveWeight: 6000, wheelbase: 180 },
  { name: 'Sleeper (Tandem)', emptyWeight: 19000, steerWeight: 11000, driveWeight: 8000, wheelbase: 245 },
  { name: 'Heavy Haul (Tandem)', emptyWeight: 21000, steerWeight: 12000, driveWeight: 9000, wheelbase: 280 },
];

const PRESET_TRAILERS = [
  { name: '53ft Dry Van', emptyWeight: 15000, length: 53, axleSpread: 49 },
  { name: '53ft Reefer', emptyWeight: 16500, length: 53, axleSpread: 49 },
  { name: '48ft Flatbed', emptyWeight: 10500, length: 48, axleSpread: 48 },
  { name: '53ft Flatbed', emptyWeight: 11000, length: 53, axleSpread: 50 },
  { name: '40ft Container Chassis', emptyWeight: 6500, length: 40, axleSpread: 36 },
];

export function AxleWeightCalculator() {
  // Truck inputs
  const [truckPreset, setTruckPreset] = useState<string>('');
  const [truckEmptyWeight, setTruckEmptyWeight] = useState(19000);
  const [steerAxleEmpty, setSteerAxleEmpty] = useState(11000);
  const [driveAxleEmpty, setDriveAxleEmpty] = useState(8000);
  const [wheelbase, setWheelbase] = useState(245);

  // Trailer inputs
  const [trailerPreset, setTrailerPreset] = useState<string>('');
  const [trailerEmptyWeight, setTrailerEmptyWeight] = useState(15000);
  const [trailerLength, setTrailerLength] = useState(53);
  const [axleSpread, setAxleSpread] = useState(49);

  // Load inputs
  const [cargoWeight, setCargoWeight] = useState(40000);
  const [cargoPosition, setCargoPosition] = useState(50); // percentage from front

  // Results
  const [result, setResult] = useState<CalculationResult | null>(null);

  // Handle truck preset selection
  const handleTruckPresetChange = (presetName: string) => {
    setTruckPreset(presetName);
    const preset = PRESET_TRUCKS.find(p => p.name === presetName);
    if (preset) {
      setTruckEmptyWeight(preset.emptyWeight);
      setSteerAxleEmpty(preset.steerWeight);
      setDriveAxleEmpty(preset.driveWeight);
      setWheelbase(preset.wheelbase);
    }
  };

  // Handle trailer preset selection
  const handleTrailerPresetChange = (presetName: string) => {
    setTrailerPreset(presetName);
    const preset = PRESET_TRAILERS.find(p => p.name === presetName);
    if (preset) {
      setTrailerEmptyWeight(preset.emptyWeight);
      setTrailerLength(preset.length);
      setAxleSpread(preset.axleSpread);
    }
  };

  const calculateWeights = () => {
    // Simplified bridge formula calculation
    // This is an approximation - real calculations would need more precise measurements

    // Fifth wheel is typically 36-48 inches behind steer axle
    const fifthWheelOffset = wheelbase - 36; // inches from steer axle

    // Trailer kingpin to trailer axle center
    const kingpinToTrailerAxle = (trailerLength * 12) - (axleSpread * 12 / 2) - 36; // converting feet to inches

    // Calculate where cargo center of gravity is
    const cargoFromKingpin = (trailerLength * 12 - 48) * (cargoPosition / 100); // 48" assumed kingpin location from front

    // Cargo weight distribution between fifth wheel and trailer axles
    const cargoOnFifthWheel = cargoWeight * (1 - cargoFromKingpin / kingpinToTrailerAxle);
    const cargoOnTrailerAxle = cargoWeight - cargoOnFifthWheel;

    // Trailer empty weight distribution (typically 30% on kingpin, 70% on axles for van)
    const trailerEmptyOnKingpin = trailerEmptyWeight * 0.3;
    const trailerEmptyOnAxles = trailerEmptyWeight * 0.7;

    // Total kingpin weight
    const totalKingpinWeight = cargoOnFifthWheel + trailerEmptyOnKingpin;

    // Calculate how kingpin weight affects tractor axles
    // Using lever arm principle
    const fifthWheelToSteer = fifthWheelOffset;
    const fifthWheelToDrive = wheelbase - fifthWheelOffset;

    // Weight distribution on tractor
    const kingpinOnDrive = totalKingpinWeight * (fifthWheelToSteer / wheelbase);
    const kingpinOnSteer = totalKingpinWeight * (fifthWheelToDrive / wheelbase);

    // Final axle weights
    const steerAxleWeight = Math.round(steerAxleEmpty + kingpinOnSteer);
    const driveAxleWeight = Math.round(driveAxleEmpty + kingpinOnDrive);
    const trailerAxleWeight = Math.round(trailerEmptyOnAxles + cargoOnTrailerAxle);
    const totalWeight = steerAxleWeight + driveAxleWeight + trailerAxleWeight;

    // Check violations
    const violations: string[] = [];

    if (steerAxleWeight > WEIGHT_LIMITS.steerAxle) {
      violations.push(`Steer axle ${steerAxleWeight.toLocaleString()} lbs exceeds ${WEIGHT_LIMITS.steerAxle.toLocaleString()} lb limit`);
    }
    if (driveAxleWeight > WEIGHT_LIMITS.tandemAxle) {
      violations.push(`Drive axles ${driveAxleWeight.toLocaleString()} lbs exceed ${WEIGHT_LIMITS.tandemAxle.toLocaleString()} lb tandem limit`);
    }
    if (trailerAxleWeight > WEIGHT_LIMITS.tandemAxle) {
      violations.push(`Trailer axles ${trailerAxleWeight.toLocaleString()} lbs exceed ${WEIGHT_LIMITS.tandemAxle.toLocaleString()} lb tandem limit`);
    }
    if (totalWeight > WEIGHT_LIMITS.grossWeight) {
      violations.push(`Gross weight ${totalWeight.toLocaleString()} lbs exceeds ${WEIGHT_LIMITS.grossWeight.toLocaleString()} lb federal limit`);
    }

    setResult({
      steerAxleWeight,
      driveAxleWeight,
      trailerAxleWeight,
      totalWeight,
      violations,
      isLegal: violations.length === 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Federal Weight Limits (Interstate)</p>
              <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
                <li>Steer Axle: 12,000 lbs | Single Axle: 20,000 lbs</li>
                <li>Tandem Axles: 34,000 lbs | Gross Weight: 80,000 lbs</li>
              </ul>
              <p className="mt-2 text-xs opacity-75">State limits may vary. Always verify local regulations.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Truck Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5" />
              Truck / Tractor
            </CardTitle>
            <CardDescription>Enter your tractor specifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Preset Configuration</Label>
              <Select value={truckPreset} onValueChange={handleTruckPresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or enter custom" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TRUCKS.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tractor Empty Weight (lbs)</Label>
                <Input
                  type="number"
                  value={truckEmptyWeight}
                  onChange={(e) => setTruckEmptyWeight(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Wheelbase (inches)</Label>
                <Input
                  type="number"
                  value={wheelbase}
                  onChange={(e) => setWheelbase(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Steer Axle Empty (lbs)</Label>
                <Input
                  type="number"
                  value={steerAxleEmpty}
                  onChange={(e) => setSteerAxleEmpty(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Drive Axles Empty (lbs)</Label>
                <Input
                  type="number"
                  value={driveAxleEmpty}
                  onChange={(e) => setDriveAxleEmpty(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trailer Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Container className="w-5 h-5" />
              Trailer
            </CardTitle>
            <CardDescription>Enter your trailer specifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Preset Configuration</Label>
              <Select value={trailerPreset} onValueChange={handleTrailerPresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or enter custom" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TRAILERS.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trailer Empty Weight (lbs)</Label>
                <Input
                  type="number"
                  value={trailerEmptyWeight}
                  onChange={(e) => setTrailerEmptyWeight(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Trailer Length (ft)</Label>
                <Input
                  type="number"
                  value={trailerLength}
                  onChange={(e) => setTrailerLength(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Axle Spread (ft from kingpin)</Label>
              <Input
                type="number"
                value={axleSpread}
                onChange={(e) => setAxleSpread(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cargo Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Cargo Load</CardTitle>
          <CardDescription>Enter your cargo weight and position</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Cargo Weight (lbs)</Label>
              <Input
                type="number"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(Number(e.target.value))}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total weight of cargo being hauled
              </p>
            </div>

            <div>
              <Label>Cargo Position: {cargoPosition}% from front</Label>
              <Slider
                value={[cargoPosition]}
                onValueChange={([value]) => setCargoPosition(value)}
                min={10}
                max={90}
                step={5}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Front (heavy on drives)</span>
                <span>Rear (heavy on trailer)</span>
              </div>
            </div>
          </div>

          {/* Visual Trailer Representation */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Cargo Position Visualization</p>
            <div className="relative h-16 bg-muted rounded flex items-center">
              {/* Kingpin */}
              <div className="absolute left-4 top-0 bottom-0 w-1 bg-foreground/30" />

              {/* Cargo indicator */}
              <div
                className="absolute top-2 bottom-2 w-8 bg-primary/50 rounded transition-all"
                style={{ left: `calc(${cargoPosition}% - 16px)` }}
              />

              {/* Trailer axles */}
              <div className="absolute right-8 top-0 bottom-0 w-2 flex flex-col justify-center gap-1">
                <div className="h-2 w-full bg-foreground/50 rounded" />
                <div className="h-2 w-full bg-foreground/50 rounded" />
              </div>
            </div>
          </div>

          <Button onClick={calculateWeights} size="lg" className="w-full">
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Weight Distribution
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className={cn(
          "border-2",
          result.isLegal ? "border-green-500/50" : "border-red-500/50"
        )}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              {result.isLegal ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700 dark:text-green-400">Legal Weight Distribution</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-red-700 dark:text-red-400">Weight Limit Violations</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Violations */}
            {result.violations.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <ul className="space-y-1">
                  {result.violations.map((violation, i) => (
                    <li key={i} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {violation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weight Bars */}
            <div className="space-y-4">
              <WeightBar
                label="Steer Axle"
                weight={result.steerAxleWeight}
                limit={WEIGHT_LIMITS.steerAxle}
              />
              <WeightBar
                label="Drive Axles (Tandem)"
                weight={result.driveAxleWeight}
                limit={WEIGHT_LIMITS.tandemAxle}
              />
              <WeightBar
                label="Trailer Axles (Tandem)"
                weight={result.trailerAxleWeight}
                limit={WEIGHT_LIMITS.tandemAxle}
              />
              <WeightBar
                label="Gross Vehicle Weight"
                weight={result.totalWeight}
                limit={WEIGHT_LIMITS.grossWeight}
              />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">{result.steerAxleWeight.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Steer (lbs)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{result.driveAxleWeight.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Drives (lbs)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{result.trailerAxleWeight.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Trailer (lbs)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{result.totalWeight.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total (lbs)</p>
              </div>
            </div>

            {/* Recommendations */}
            {!result.isLegal && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium mb-2">Suggestions to Fix:</p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {result.driveAxleWeight > WEIGHT_LIMITS.tandemAxle && (
                    <li>Move cargo rearward (increase cargo position %) to shift weight to trailer axles</li>
                  )}
                  {result.trailerAxleWeight > WEIGHT_LIMITS.tandemAxle && (
                    <li>Move cargo forward (decrease cargo position %) to shift weight to drive axles</li>
                  )}
                  {result.totalWeight > WEIGHT_LIMITS.grossWeight && (
                    <li>Reduce cargo weight by {(result.totalWeight - WEIGHT_LIMITS.grossWeight).toLocaleString()} lbs</li>
                  )}
                  {result.steerAxleWeight > WEIGHT_LIMITS.steerAxle && (
                    <li>Move cargo rearward or slide fifth wheel back to reduce steer axle weight</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WeightBar({ label, weight, limit }: { label: string; weight: number; limit: number }) {
  const percentage = Math.min((weight / limit) * 100, 100);
  const isOver = weight > limit;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className={cn(
          isOver ? "text-red-600 dark:text-red-400 font-bold" : "text-muted-foreground"
        )}>
          {weight.toLocaleString()} / {limit.toLocaleString()} lbs
          {isOver && <span className="ml-1">(+{(weight - limit).toLocaleString()})</span>}
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all rounded-full",
            isOver ? "bg-red-500" : percentage > 90 ? "bg-yellow-500" : "bg-green-500"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
