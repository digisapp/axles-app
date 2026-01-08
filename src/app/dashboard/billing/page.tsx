import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Star,
  Zap,
  Building2,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Upgrade Your Plan</h1>
        <p className="text-muted-foreground mt-1">
          Get more visibility and features for your listings
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>You are currently on the free plan</CardDescription>
            </div>
            <Badge variant="secondary">Free</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Up to 10 active listings
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Basic analytics
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Lead management
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pro Plan */}
        <Card className="border-primary/50 relative">
          <div className="absolute -top-3 left-4">
            <Badge className="bg-primary">Most Popular</Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <CardTitle>Pro</CardTitle>
            </div>
            <CardDescription>For growing dealers</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">$99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Unlimited listings
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Featured listing badges
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Priority search placement
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Advanced analytics & trends
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                AI-powered chatbot for leads
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Custom storefront page
              </li>
            </ul>
            <Button className="w-full" asChild>
              <Link href="/contact?plan=pro">
                <Zap className="w-4 h-4 mr-2" />
                Contact Sales
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Enterprise Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Enterprise</CardTitle>
            </div>
            <CardDescription>For large dealerships</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">Custom</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Everything in Pro
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Multi-location support
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                API access
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Dedicated account manager
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Custom integrations
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Priority support
              </li>
            </ul>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/contact?plan=enterprise">
                Contact Sales
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contact */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Have questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is here to help you choose the right plan
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="outline" asChild>
                <a href="mailto:sales@axles.ai">
                  <Mail className="w-4 h-4 mr-2" />
                  sales@axles.ai
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="tel:+1234567890">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Us
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
