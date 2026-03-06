'use client'

import { useEffect } from 'react'

interface PropertyPrintViewProps {
  property: any
  scenario: any | null
  loan: any | null
  sections: string[]
}

export default function PropertyPrintView({ property, scenario, loan, sections }: PropertyPrintViewProps) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 500)
    return () => clearTimeout(timer)
  }, [])

  const showSection = (id: string) => sections.includes(id)

  const purchasePrice = parseFloat(scenario?.['Purchase Price']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario?.['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario?.['Operating Expenses']?.toString() || '0') || 0
  const noi = grossIncome - operatingExpenses
  const hasLoan = scenario?.['Has Loan'] || false
  const downPaymentAmount = parseFloat(scenario?.['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario?.['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario?.['Purchase Closing Costs']?.toString() || '0') || 0
  const interestRate = parseFloat(scenario?.['Interest Rate']?.toString() || '0') || 0
  const loanTerm = parseInt(scenario?.['Loan Term']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount

  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
  const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0

  let annualMortgage = 0
  let firstYearInterest = 0
  let firstYearPrincipal = 0
  let monthlyPayment = 0

  if (hasLoan && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
    const mr = interestRate / 100 / 12
    const np = loanTerm * 12
    monthlyPayment = loanPrincipal * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
    annualMortgage = monthlyPayment * 12
    let balance = loanPrincipal
    for (let m = 1; m <= 12; m++) {
      const ip = balance * mr
      const pp = monthlyPayment - ip
      firstYearInterest += ip
      firstYearPrincipal += pp > balance ? balance : pp
      balance = Math.max(0, balance - pp)
    }
  } else if (loan) {
    annualMortgage = parseFloat(loan['Annual Mortgage']?.toString() || '0') || 0
    firstYearInterest = parseFloat(loan['Annual Interest']?.toString() || '0') || 0
    firstYearPrincipal = parseFloat(loan['Annual Principal']?.toString() || '0') || 0
    monthlyPayment = parseFloat(loan['Monthly Mortgage']?.toString() || '0') || 0
  }

  const firstYearCashFlow = hasLoan ? noi - firstYearInterest - firstYearPrincipal : noi
  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0
  const dscr = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtShort = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  // P&L data
  const incomeIncrease = parseFloat(scenario?.['Income Increase']?.toString() || '0') || 0
  const expensesIncrease = parseFloat(scenario?.['Expenses Increase']?.toString() || '0') || 0
  const propertyValueIncrease = parseFloat(scenario?.['Property Value Increase']?.toString() || '0') || 0
  const displayYears = hasLoan && loanTerm > 0 ? Math.min(loanTerm, 10) : 10

  const plData: any[] = []
  if (showSection('pl-table') && scenario) {
    let remainingBalance = hasLoan ? loanPrincipal : 0
    const amortSchedule: { interest: number; principal: number; balance: number }[] = []

    if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0 && monthlyPayment > 0) {
      const mr = interestRate / 100 / 12
      const np = loanTerm * 12
      let balance = loanPrincipal
      for (let year = 1; year <= displayYears; year++) {
        let yi = 0, yp = 0
        for (let m = 1; m <= 12; m++) {
          const pn = (year - 1) * 12 + m
          if (pn <= np && balance > 0.01) {
            const ip = balance * mr
            const pp = monthlyPayment - ip
            yi += ip
            yp += pp > balance ? balance : pp
            balance = Math.max(0, balance - pp)
          }
        }
        amortSchedule.push({ interest: yi, principal: yp, balance })
      }
    }

    for (let year = 1; year <= displayYears; year++) {
      const im = year === 1 ? 1 : Math.pow(1 + incomeIncrease / 100, year - 1)
      const em = year === 1 ? 1 : Math.pow(1 + expensesIncrease / 100, year - 1)
      const vm = year === 1 ? 1 : Math.pow(1 + propertyValueIncrease / 100, year - 1)

      const gi = grossIncome * im
      const oe = operatingExpenses * em
      const yearNoi = gi - oe
      const pv = purchasePrice * vm

      let interest = 0, principal = 0
      if (hasLoan && amortSchedule[year - 1]) {
        interest = amortSchedule[year - 1].interest
        principal = amortSchedule[year - 1].principal
        remainingBalance = amortSchedule[year - 1].balance
      }

      const netIncome = yearNoi - interest
      const cashFlow = netIncome - principal
      const cocr = totalCashInvested > 0 ? (cashFlow / totalCashInvested) * 100 : 0
      const equity = hasLoan ? pv - remainingBalance : pv

      plData.push({ year, gi, oe, noi: yearNoi, interest, principal, netIncome, cashFlow, cocr, equity })
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-12 print:p-0 print:max-w-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}} />

      <div className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">{property.address || 'Property Summary'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generated on {new Date().toLocaleDateString()}
          {scenario && ` · Scenario: ${scenario['Scenario Name'] || 'Default'}`}
        </p>
      </div>

      {showSection('property-info') && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Property Information</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Address:</span> {property.address || 'N/A'}</div>
            <div><span className="text-muted-foreground">Type:</span> {property.type || 'N/A'}</div>
            {property['Number of Units'] && <div><span className="text-muted-foreground">Units:</span> {property['Number of Units']}</div>}
            <div><span className="text-muted-foreground">HOA:</span> {property['Has HOA'] === null ? 'N/A' : property['Has HOA'] ? 'Yes' : 'No'}</div>
            {property['Asking Price'] && <div><span className="text-muted-foreground">Asking Price:</span> {fmtShort(property['Asking Price'])}</div>}
            {property['Gross Income'] && <div><span className="text-muted-foreground">Gross Income:</span> {fmtShort(property['Gross Income'])}/yr</div>}
            {property['Operating Expenses'] && <div><span className="text-muted-foreground">Operating Expenses:</span> {fmtShort(property['Operating Expenses'])}/yr</div>}
          </div>
        </section>
      )}

      {showSection('scenario-details') && scenario && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Scenario Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Purchase Price:</span> {fmt(purchasePrice)}</div>
            <div><span className="text-muted-foreground">Gross Income:</span> {fmt(grossIncome)}</div>
            <div><span className="text-muted-foreground">Operating Expenses:</span> {fmt(operatingExpenses)}</div>
            <div><span className="text-muted-foreground">NOI:</span> <strong>{fmt(noi)}</strong></div>
            <div><span className="text-muted-foreground">Has Loan:</span> {hasLoan ? 'Yes' : 'No'}</div>
            {purchaseClosingCosts > 0 && <div><span className="text-muted-foreground">Purchase Closing Costs:</span> {fmt(purchaseClosingCosts)}</div>}
          </div>
        </section>
      )}

      {showSection('financial-metrics') && scenario && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Financial Metrics</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="border rounded-md p-3">
              <div className="text-muted-foreground text-xs">Cap Rate</div>
              <div className="font-bold text-lg">{capRate.toFixed(2)}%</div>
            </div>
            {dscr !== null && (
              <div className="border rounded-md p-3">
                <div className="text-muted-foreground text-xs">DSCR</div>
                <div className="font-bold text-lg">{dscr.toFixed(2)}x</div>
              </div>
            )}
            <div className="border rounded-md p-3">
              <div className="text-muted-foreground text-xs">GRM</div>
              <div className="font-bold text-lg">{grm.toFixed(2)}x</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-muted-foreground text-xs">Total Cash Invested</div>
              <div className="font-bold text-lg">{fmtShort(totalCashInvested)}</div>
            </div>
            {hasLoan && (
              <div className="border rounded-md p-3">
                <div className="text-muted-foreground text-xs">Loan-to-Value</div>
                <div className="font-bold text-lg">{(purchasePrice > 0 ? ((loanPrincipal / purchasePrice) * 100) : 0).toFixed(1)}%</div>
              </div>
            )}
          </div>
        </section>
      )}

      {showSection('first-year') && scenario && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">First Year Financials</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">NOI:</span> <strong>{fmt(noi)}</strong></div>
            {hasLoan && <div><span className="text-muted-foreground">Year 1 Interest:</span> {fmt(firstYearInterest)}</div>}
            {hasLoan && <div><span className="text-muted-foreground">Year 1 Principal:</span> {fmt(firstYearPrincipal)}</div>}
            <div><span className="text-muted-foreground">Cash Flow:</span> <strong style={{ color: firstYearCashFlow >= 0 ? '#059669' : '#dc2626' }}>{fmt(firstYearCashFlow)}</strong></div>
            <div><span className="text-muted-foreground">CoCR:</span> <strong style={{ color: firstYearCoCR >= 0 ? '#059669' : '#dc2626' }}>{firstYearCoCR.toFixed(2)}%</strong></div>
            <div><span className="text-muted-foreground">Total Cash Invested:</span> {fmt(totalCashInvested)}</div>
          </div>
        </section>
      )}

      {showSection('loan-info') && hasLoan && (loan || scenario) && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Loan Information</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Loan Term:</span> {loanTerm} years</div>
            <div><span className="text-muted-foreground">Interest Rate:</span> {interestRate}%</div>
            <div><span className="text-muted-foreground">Down Payment:</span> {fmt(downPaymentAmount)} ({scenario['Down Payment Percentage'] || 0}%)</div>
            {monthlyPayment > 0 && <div><span className="text-muted-foreground">Monthly Payment:</span> {fmt(monthlyPayment)}</div>}
            {loanClosingCosts > 0 && <div><span className="text-muted-foreground">Loan Closing Costs:</span> {fmt(loanClosingCosts)}</div>}
          </div>
        </section>
      )}

      {showSection('pl-table') && plData.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Year-by-Year P&L</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-1">Year</th>
                <th className="text-right py-2 px-1">Income</th>
                <th className="text-right py-2 px-1">Expenses</th>
                <th className="text-right py-2 px-1">NOI</th>
                {hasLoan && <th className="text-right py-2 px-1">Interest</th>}
                {hasLoan && <th className="text-right py-2 px-1">Principal</th>}
                <th className="text-right py-2 px-1">Cash Flow</th>
                <th className="text-right py-2 px-1">CoCR</th>
                <th className="text-right py-2 px-1">Equity</th>
              </tr>
            </thead>
            <tbody>
              {plData.map(row => (
                <tr key={row.year} className="border-b border-border/50">
                  <td className="py-1.5 px-1 font-medium">{row.year}</td>
                  <td className="py-1.5 px-1 text-right">{fmtShort(row.gi)}</td>
                  <td className="py-1.5 px-1 text-right">{fmtShort(row.oe)}</td>
                  <td className="py-1.5 px-1 text-right font-medium">{fmtShort(row.noi)}</td>
                  {hasLoan && <td className="py-1.5 px-1 text-right">{fmtShort(row.interest)}</td>}
                  {hasLoan && <td className="py-1.5 px-1 text-right">{fmtShort(row.principal)}</td>}
                  <td className="py-1.5 px-1 text-right font-semibold" style={{ color: row.cashFlow >= 0 ? '#059669' : '#dc2626' }}>
                    {fmtShort(row.cashFlow)}
                  </td>
                  <td className="py-1.5 px-1 text-right">{row.cocr.toFixed(2)}%</td>
                  <td className="py-1.5 px-1 text-right">{fmtShort(row.equity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="no-print mt-8 flex justify-center gap-4">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-border px-6 py-2 text-sm font-medium hover:bg-muted/50"
        >
          Close
        </button>
      </div>
    </div>
  )
}
