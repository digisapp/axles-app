'use client';

import { useState, useEffect } from 'react';
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
import { Calculator, DollarSign, Percent, Calendar } from 'lucide-react';

interface FinancingCalculatorProps {
  listingPrice: number;
  className?: string;
}

export function FinancingCalculator({ listingPrice, className }: FinancingCalculatorProps) {
  const [downPayment, setDownPayment] = useState(Math.round(listingPrice * 0.1)); // 10% default
  const [downPaymentPercent, setDownPaymentPercent] = useState(10);
  const [interestRate, setInterestRate] = useState(7.5);
  const [loanTerm, setLoanTerm] = useState(60); // months
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    calculatePayment();
  }, [downPayment, interestRate, loanTerm, listingPrice]);

  const calculatePayment = () => {
    const principal = listingPrice - downPayment;

    if (principal <= 0) {
      setMonthlyPayment(0);
      setTotalInterest(0);
      setTotalCost(downPayment);
      return;
    }

    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm;

    if (monthlyRate === 0) {
      setMonthlyPayment(principal / numPayments);
      setTotalInterest(0);
      setTotalCost(listingPrice);
      return;
    }

    // Monthly payment formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const payment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalPaid = payment * numPayments;
    const interest = totalPaid - principal;

    setMonthlyPayment(payment);
    setTotalInterest(interest);
    setTotalCost(totalPaid + downPayment);
  };

  const handleDownPaymentChange = (value: number) => {
    setDownPayment(value);
    setDownPaymentPercent(Math.round((value / listingPrice) * 100));
  };

  const handleDownPaymentPercentChange = (value: number[]) => {
    const percent = value[0];
    setDownPaymentPercent(percent);
    setDownPayment(Math.round(listingPrice * (percent / 100)));
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
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" />
          Financing Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monthly Payment Display */}
        <div className="bg-primary/10 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Estimated Monthly Payment</p>
          <p className="text-4xl font-bold text-primary">
            {formatCurrency(monthlyPayment)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">/month for {loanTerm} months</p>
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
            onChange={(e) => handleDownPaymentChange(Number(e.target.value))}
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
            <span className="font-medium">{formatCurrency(listingPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Down Payment</span>
            <span className="font-medium">-{formatCurrency(downPayment)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Financed</span>
            <span className="font-medium">{formatCurrency(listingPrice - downPayment)}</span>
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
      </CardContent>
    </Card>
  );
}
