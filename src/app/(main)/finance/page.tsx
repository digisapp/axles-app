'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  DollarSign,
  Percent,
  Calendar,
  CheckCircle,
  ArrowRight,
  Truck,
  Shield,
  BadgeCheck,
} from 'lucide-react';

export default function FinancePage() {
  const [price, setPrice] = useState(75000);
  const [downPayment, setDownPayment] = useState(7500);
  const [downPaymentPercent, setDownPaymentPercent] = useState(10);
  const [interestRate, setInterestRate] = useState(7.5);
  const [loanTerm, setLoanTerm] = useState(60);

  const amountFinanced = price - downPayment;
  const monthlyRate = interestRate / 100 / 12;

  let monthlyPayment = 0;
  let totalInterest = 0;
  let totalCost = price;

  if (amountFinanced > 0 && monthlyRate > 0) {
    monthlyPayment =
      (amountFinanced * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm))) /
      (Math.pow(1 + monthlyRate, loanTerm) - 1);
    totalInterest = monthlyPayment * loanTerm - amountFinanced;
    totalCost = monthlyPayment * loanTerm + downPayment;
  } else if (amountFinanced > 0) {
    monthlyPayment = amountFinanced / loanTerm;
    totalCost = price;
  }

  const handlePriceChange = (value: number) => {
    setPrice(value);
    setDownPayment(Math.round(value * (downPaymentPercent / 100)));
  };

  const handleDownPaymentPercentChange = (value: number[]) => {
    const percent = value[0];
    setDownPaymentPercent(percent);
    setDownPayment(Math.round(price * (percent / 100)));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 to-background py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Commercial Truck & Trailer Financing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get the equipment you need with flexible financing options.
            Use our calculator to estimate your monthly payments.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Calculator */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Payment Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly Payment Display */}
              <div className="bg-primary/10 rounded-xl p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Estimated Monthly Payment</p>
                <p className="text-5xl font-bold text-primary">
                  {formatCurrency(monthlyPayment)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">/month for {loanTerm} months</p>
              </div>

              {/* Vehicle Price */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Vehicle Price
                </Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  className="text-lg"
                />
              </div>

              {/* Down Payment */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Down Payment
                  </Label>
                  <span className="text-sm font-medium">{downPaymentPercent}%</span>
                </div>
                <Slider
                  value={[downPaymentPercent]}
                  onValueChange={handleDownPaymentPercentChange}
                  min={0}
                  max={50}
                  step={5}
                  className="mb-2"
                />
                <Input
                  type="number"
                  value={downPayment}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDownPayment(val);
                    setDownPaymentPercent(Math.round((val / price) * 100));
                  }}
                  className="text-right"
                />
              </div>

              {/* Interest Rate */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Interest Rate (APR)
                  </Label>
                  <span className="text-sm font-medium">{interestRate}%</span>
                </div>
                <Slider
                  value={[interestRate]}
                  onValueChange={(v) => setInterestRate(v[0])}
                  min={0}
                  max={20}
                  step={0.5}
                />
              </div>

              {/* Loan Term */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Loan Term
                </Label>
                <Select value={loanTerm.toString()} onValueChange={(v) => setLoanTerm(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 months (2 years)</SelectItem>
                    <SelectItem value="36">36 months (3 years)</SelectItem>
                    <SelectItem value="48">48 months (4 years)</SelectItem>
                    <SelectItem value="60">60 months (5 years)</SelectItem>
                    <SelectItem value="72">72 months (6 years)</SelectItem>
                    <SelectItem value="84">84 months (7 years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Price</span>
                  <span className="font-medium">{formatCurrency(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Down Payment</span>
                  <span className="font-medium">-{formatCurrency(downPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Financed</span>
                  <span className="font-medium">{formatCurrency(amountFinanced)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Interest</span>
                  <span className="font-medium text-orange-600">{formatCurrency(totalInterest)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-medium">Total Cost</span>
                  <span className="font-bold">{formatCurrency(totalCost)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                *Estimates only. Actual rates and terms may vary based on credit and lender.
              </p>

              <Button className="w-full" size="lg" asChild>
                <Link href="/search">
                  Browse Equipment
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Info Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Commercial Equipment Financing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Whether you&apos;re buying your first truck or expanding your fleet,
                  financing can help you get the equipment you need while preserving working capital.
                </p>

                <div className="grid gap-4">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Competitive Rates</p>
                      <p className="text-sm text-muted-foreground">
                        Rates from 6-12% APR based on credit profile
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Flexible Terms</p>
                      <p className="text-sm text-muted-foreground">
                        24 to 84 month terms available
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">New & Used Equipment</p>
                      <p className="text-sm text-muted-foreground">
                        Financing available for trucks, trailers, and equipment
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Quick Approvals</p>
                      <p className="text-sm text-muted-foreground">
                        Many lenders offer same-day decisions
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What You&apos;ll Need</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    <span>Valid driver&apos;s license</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    <span>Proof of income or business revenue</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    <span>Down payment (typically 10-20%)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    <span>Business information (for commercial loans)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Need Help Finding Equipment?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Use our AI-powered search to find the perfect truck or trailer.
                      Just describe what you need in plain English.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/">
                        Search with AI
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
