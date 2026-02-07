import { AxleWeightCalculator } from '@/components/tools/AxleWeightCalculator';
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';

export const metadata = {
  title: 'Axle Weight Calculator | AxlonAI',
  description: 'Calculate axle weight distribution for your truck and trailer combination. Ensure compliance with federal weight limits and avoid overweight fines.',
};

export default function AxleWeightCalculatorPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Axle Weight Calculator</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Calculate weight distribution across your truck and trailer axles.
            Verify your load is legal before hitting the road and avoid costly overweight fines.
          </p>
        </div>

        <AxleWeightCalculator />

        <div className="mt-12 p-6 bg-background rounded-xl border">
          <h2 className="font-semibold mb-4">Understanding Weight Limits</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-medium text-foreground mb-2">Federal Bridge Formula</h3>
              <p>
                The federal bridge formula limits the weight based on the number of axles
                and the distance between them. This protects bridges and roads from excessive
                stress caused by concentrated heavy loads.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">State Variations</h3>
              <p>
                Many states have weight limits that differ from federal standards. Some states
                allow higher weights with permits, while others have stricter limits on certain
                roads. Always check local regulations for your route.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Sliding Tandems</h3>
              <p>
                Adjusting your trailer tandems (sliding them forward or back) shifts weight
                between the drive axles and trailer axles. This is the primary method drivers
                use to balance loads and stay legal.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Fifth Wheel Position</h3>
              <p>
                On some tractors, the fifth wheel can be adjusted to shift weight between
                the steer axle and drive axles. Moving it forward puts more weight on the
                steer axle; moving it back shifts weight to the drives.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            This calculator provides estimates based on simplified physics models.
            Always verify weights using certified scales before operating on public roads.
          </p>
        </div>
      </div>
    </div>
  );
}
