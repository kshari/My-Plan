# My Plan

A comprehensive financial planning application built with Next.js and Supabase. My Plan combines multiple financial analysis tools into a unified platform, helping you manage your investments and real estate portfolio.

## Applications

My Plan currently includes three main modules:

### 1. Portfolio Analyzer
Track your stock and options positions, analyze portfolio performance, and calculate key risk metrics.

### 2. Property Investment Analyzer
Analyze real estate investment opportunities, model financial scenarios, and evaluate property performance metrics.

### 3. Retirement Planner
Comprehensive retirement planning tool with scenario modeling, withdrawal strategy analysis, and detailed projections.

---

## Portfolio Analyzer Features

### Portfolio Management
- Create and manage multiple portfolios
- Add individual positions (stocks and options)
- Upload positions via CSV file with flexible field mapping
- Support for both stock and options positions

### Analysis Capabilities
- **Portfolio-Level Metrics:**
  - Total portfolio value and cost basis
  - Total gain/loss and percentage
  - Portfolio beta (weighted average)
  - Portfolio delta (aggregate exposure)
  - Portfolio CAGR (Compound Annual Growth Rate)
  - Overall risk score

- **Position-Level Metrics:**
  - Beta (market sensitivity)
  - Delta (price sensitivity, especially for options)
  - CAGR (position-specific growth rate)
  - Risk factor (combination of beta and volatility)
  - Current market value

### Options Support
- Track call and put options
- Strike price and expiration date tracking
- Delta calculation for options positions
- Contract quantity management

---

## Retirement Planner Features

### Retirement Plan Management
- Create and manage multiple retirement plans
- Store personal information (birth year, filing status, life expectancy)
- Support for spouse planning (include spouse, spouse birth year, spouse life expectancy)
- Organize retirement data with expandable cards and summaries

### Account Management
- Track multiple retirement accounts (401k, IRA, Roth IRA, HSA, Taxable, Other)
- Set account balances and annual contributions
- View account balances over time in projections

### Expense Planning
- Define monthly expenses (before and after age 65)
- Categorize expenses as essential or discretionary
- Track expense growth with inflation adjustments
- View total expenses in projections

### Income Sources
- Social Security (SSA) income for planner and spouse
- Configurable SSA start age (typically 62-70)
- Other recurring income sources with start/end years
- Inflation-adjusted income options

### Scenario Modeling
- **Create Multiple Scenarios:** Model different retirement strategies
- **Scenario Variables:**
  - Retirement age
  - Growth rates (before and during retirement)
  - Tax rates (capital gains and income tax)
  - Inflation rate
  - SSA income inclusion flags
  - Borrowing options for negative cashflow
- **Scenario Comparison:** Compare different scenarios side-by-side
- **Default Scenarios:** Set default scenario for quick access

### Withdrawal Strategy Modeling
- **Dynamic Withdrawal Strategies:** Model different withdrawal approaches
- **Available Strategies:**
  - **Default (Tax-Efficient):** Balanced tax-efficient strategy
  - **Longevity:** Preserve assets for long retirement
  - **Legacy Value:** Maximize inheritance for heirs
  - **Tax Optimization:** Minimize taxes over retirement
  - **Stable Income:** Maintain consistent income levels
  - **Sequence Risk Mitigation:** Protect against early market downturns
  - **Liquidity:** Keep funds easily accessible
- **Year-by-Year Evaluation:** Strategy adapts dynamically based on current situation
- **Modeling Tool:** Test different strategies without saving (illustration only)
- **Strategy Metrics:** View Legacy Value, Longevity, Total Tax, Tax Efficiency, and more

### Projections & Analysis
- **Detailed Projections:**
  - Year-by-year projections from current age to life expectancy
  - Account balances over time
  - Income sources (SSA, distributions, other income)
  - Tax calculations
  - Expenses and gap/excess analysis
  - Net worth tracking
- **View Modes:**
  - **Table View:** Detailed year-by-year data with column visibility controls
  - **Graph View:** Visual charts (Line, Area, Bar) for trends
- **Pre-Retirement Years:** Toggle to show/hide pre-retirement projections
- **Event Tracking:** Shows important events (retirement, SSA eligibility, etc.)

### Strategy Metrics Summary
- **Legacy Value:** Final net worth at end of projection
- **Longevity:** Years beyond life expectancy (positive if assets last longer)
- **Total Tax:** Lifetime taxes paid during retirement
- **Average Annual Tax:** Average tax per year
- **Tax Efficiency:** Tax as percentage of total income
- **Negative Years:** Count and percentage of years with shortfalls
- **Withdrawal Breakdown:** Total withdrawals by account type (401k, IRA, Roth, Taxable, HSA)

### Retirement Analysis
- **Retirement Score (0-100):** Comprehensive evaluation across multiple dimensions
  - **Longevity (60% weight):** Asset preservation over time
  - **Tax Efficiency (15% weight):** Tax minimization
  - **Cashflow (5% weight):** Income consistency
  - **Inflation (10% weight):** Income keeps up with expenses
  - **Medical (10% weight):** Healthcare expense risk
- **Risk Assessment:** Identifies potential risks (longevity, tax, inflation, medical, sequence of returns)
- **Recommendations:** Actionable suggestions to improve retirement plan
- **RMD Analysis:** Required Minimum Distribution analysis
- **Tax Efficiency Analysis:** Detailed tax optimization insights
- **Monte Carlo Simulation:** Run simulations to assess plan robustness
- **Sequence of Returns Risk:** Analyze impact of market timing

### Advanced Features
- **Compounding Analysis:** View how accounts grow with contributions
- **Defaults Management:** Set default values for new scenarios
- **Scenario Selector:** Easy switching between scenarios in projections and analysis tabs
- **Export Capabilities:** View and analyze detailed projections

---

## Property Investment Analyzer Features

### Property Management
- Create and manage multiple properties
- Store property details (address, asking price, income, expenses)
- Track property-specific financial scenarios

### Financial Scenario Modeling
- **Create Custom Scenarios:**
  - Adjust purchase price, income, and expenses
  - Model different loan terms and interest rates
  - Calculate down payment and closing costs
  - Track annual growth rates for income, expenses, and property value

- **Model Scenarios (AI-Powered):**
  - Generate hundreds of scenarios automatically
  - Test different combinations of variables
  - Filter by positive cash flow
  - Sort and compare scenarios by key metrics

- **Break-Even Threshold Analysis:**
  - Find minimum/maximum values for each variable that result in positive cash flow
  - Understand sensitivity to changes in purchase price, income, expenses, interest rates, and down payment
  - Save threshold scenarios for further analysis

### Financial Metrics
- **Key Performance Indicators:**
  - Cap Rate (Capitalization Rate)
  - Cash on Cash Return (CoCR)
  - Debt Service Coverage Ratio (DSCR)
  - Gross Rent Multiplier (GRM)
  - Loan-to-Value (LTV) ratio

- **First Year Financials:**
  - Net Operating Income (NOI)
  - First year interest and principal payments
  - First year cash flow
  - Total cash invested
  - First year cash on cash return

### Loan Management
- Add and manage loans for each scenario
- Calculate monthly and annual mortgage payments
- View detailed amortization schedules
- Track interest and principal payments over time

### Profit & Loss Analysis
- View multi-year profit and loss projections
- Track income and expense growth over time
- Analyze long-term cash flow trends

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Authentication, Row Level Security)
- **Utilities:** PapaParse (CSV parsing), Recharts (charts), date-fns (date utilities)
- **Market Data:** Yahoo Finance API, Alpha Vantage API (optional)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kshari/My-Plan.git
cd My-Plan
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
The `.env.local` file has been created with your Supabase credentials. The values are:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

The database schema has been automatically created in your Supabase project. Tables are prefixed by module:

**Portfolio Analyzer Tables (pa_ prefix):**
- **pa_portfolios** - User portfolios
- **pa_tickers** - Stock symbols and metadata
- **pa_positions** - Stock and options positions
- **pa_options_positions** - Options-specific data
- **pa_position_metrics** - Calculated metrics per position
- **pa_portfolio_metrics** - Portfolio-level metrics

**Property Investment Tables (pi_ prefix):**
- **pi_properties** - Property listings and details
- **pi_financial_scenarios** - Financial scenarios for properties
- **pi_loans** - Loan details associated with scenarios

**Retirement Planner Tables (rp_ prefix):**
- **rp_retirement_plans** - User retirement plans
- **rp_accounts** - Retirement accounts (401k, IRA, Roth, HSA, Taxable, Other)
- **rp_expenses** - Monthly expenses (before/after 65)
- **rp_other_income** - Other recurring income sources
- **rp_scenarios** - Retirement scenarios
- **rp_calculator_settings** - Scenario-specific calculator settings
- **rp_projection_details** - Year-by-year projection data
- **rp_default_settings** - Default values for new scenarios

Row Level Security (RLS) policies ensure users can only access their own data.

## CSV Upload Format

When uploading positions via CSV, use the following column names:

### Required Columns:
- `symbol` or `ticker` - Stock symbol (e.g., AAPL)
- `quantity` - Number of shares/contracts
- `cost_basis` or `cost` - Total cost of the position
- `purchase_date` or `date` - Purchase date (YYYY-MM-DD)

### Optional Columns:
- `position_type` or `type` - "stock" or "option" (defaults to "stock")

### Option-Specific Columns (if position_type = "option"):
- `strike_price` - Option strike price
- `expiration_date` - Option expiration date (YYYY-MM-DD)
- `option_type` - "call" or "put"
- `premium` - Option premium paid
- `contracts` - Number of contracts (defaults to 1)

### Example CSV:
```csv
symbol,quantity,cost_basis,purchase_date,position_type
AAPL,100,15000,2024-01-15,stock
TSLA,50,12000,2024-02-01,stock
AAPL,10,5000,2024-03-01,option
```

**Note:** The CSV upload feature includes intelligent field mapping. You can click on column headers in the preview table to map CSV columns to database fields, making it easy to work with different CSV formats.

## Property Investment Analyzer Details

### Key Features

#### Scenario Modeling
- **Custom Scenarios:** Create scenarios with specific values for purchase price, income, expenses, loan terms, and more
- **Model Scenarios:** Generate hundreds of scenarios automatically by defining ranges for:
  - Purchase price changes (-50% to +50%)
  - Income changes (-20% to +20%)
  - Expense changes (-20% to +20%)
  - Interest rates (0% to 15%)
  - Down payment percentages (0% to 50%)
  - Loan terms (15, 20, or 30 years)
- **Threshold Analysis:** Automatically calculate break-even thresholds for each variable to achieve positive cash flow

#### Financial Calculations
- **Net Operating Income (NOI):** Gross income minus operating expenses
- **Cash on Cash Return (CoCR):** First year cash flow divided by total cash invested
- **Cap Rate:** NOI divided by purchase price
- **Debt Service Coverage Ratio (DSCR):** NOI divided by annual mortgage payment
- **Gross Rent Multiplier (GRM):** Purchase price divided by gross income
- **Loan-to-Value (LTV):** Loan amount divided by purchase price

#### Loan Analysis
- Calculate monthly mortgage payments using standard amortization formulas
- View detailed amortization schedules showing principal and interest breakdown
- Track annual interest and principal payments
- Model different loan terms and interest rates

#### Scenario Comparison
- Sort scenarios by any metric (cash flow, CoCR, DSCR, etc.)
- Filter scenarios by positive cash flow
- Compare multiple scenarios side-by-side
- Save scenarios for future reference

## Usage

### Portfolio Analyzer

1. **Navigate to Portfolio Analyzer:** Click on "Portfolio Analyzer" from the home page
2. **Sign Up/Login:** Create an account or sign in
3. **Create Portfolio:** Click "Create Portfolio" and give it a name
4. **Add Positions:** 
   - Use "Add Position" to manually enter positions
   - Or use "CSV Upload" to bulk import positions with flexible field mapping
5. **View Analysis:** Navigate to the "Analysis" tab to see portfolio and position-level metrics

### Property Investment Analyzer

1. **Navigate to Property Investment:** Click on "Property Investment" from the home page
2. **Sign Up/Login:** Create an account or sign in (separate from Portfolio Analyzer)
3. **Create Property:** Click "Add Property" and enter property details
4. **Create Scenarios:**
   - **Manual:** Click "Add Scenario" to create custom financial scenarios
   - **Model Scenarios:** Use the "Model Scenarios" feature to generate multiple scenarios automatically
   - **Threshold Analysis:** View break-even thresholds for each variable
5. **View Details:** Click on any property or scenario to see detailed financial metrics, loan information, and amortization schedules
6. **Manage Loans:** Add loan details to scenarios to calculate mortgage payments and DSCR

### Retirement Planner

1. **Navigate to Retirement Planner:** Click on "Retirement Planner" from the home page
2. **Sign Up/Login:** Create an account or sign in (separate from other apps)
3. **Create Retirement Plan:** Click "Create Plan" and enter your personal information
4. **Set Up Plan Basis:**
   - Enter birth year, filing status, and life expectancy
   - Include spouse information if applicable
   - Configure SSA income settings
5. **Add Accounts:** Add all your retirement accounts (401k, IRA, Roth, HSA, Taxable, etc.) with current balances
6. **Define Expenses:** Enter monthly expenses (separate amounts for before/after age 65)
7. **Add Income Sources:** Configure Social Security and other recurring income
8. **Create Scenarios:**
   - Set retirement age, growth rates, tax rates, and inflation
   - Create multiple scenarios to compare different strategies
   - Use "Add Scenario" to create new scenarios
9. **View Projections:**
   - Navigate to "Projections" tab to see year-by-year projections
   - Use "Withdrawal Strategy Modeling" to test different withdrawal approaches
   - View strategy metrics (Legacy Value, Longevity, Total Tax, etc.)
   - Switch between table and graph views
10. **Analyze Plan:**
    - Navigate to "Analysis" tab for comprehensive retirement score
    - Review risks and recommendations
    - Run Monte Carlo simulations
    - Analyze tax efficiency and RMD requirements

## Market Data Integration

The application integrates with free market data APIs to fetch real-time stock prices and market information:

### Supported Providers

1. **Yahoo Finance** (Default, no API key required)
   - Free, no registration needed
   - Provides current prices, company names, and basic market data
   - Used as the primary data source

2. **Alpha Vantage** (Optional, requires API key)
   - Free tier available at [alphavantage.co](https://www.alphavantage.co/support/#api-key)
   - Provides additional data when API key is configured
   - Set `NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY` in your `.env.local` file

### Configuration

Create a `.env.local` file in the root directory:

```env
# Optional: Alpha Vantage API Key (get free key from https://www.alphavantage.co/support/#api-key)
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_api_key_here
```

**Note:** The application works without an API key using Yahoo Finance. The Alpha Vantage key is optional and provides enhanced features.

### Features

- **Real-time stock prices** fetched from market data APIs
- **Automatic ticker name resolution** when adding positions
- **Caching** (5 minutes) to optimize API usage and avoid rate limits
- **Batch fetching** for multiple symbols to improve performance
- **Graceful fallbacks** if market data is unavailable

### Rate Limits

- Yahoo Finance: No official rate limits, but be respectful with request frequency
- Alpha Vantage Free Tier: 5 API calls per minute, 500 calls per day

The application includes built-in rate limiting and caching to stay within these limits.

4. Use Black-Scholes or similar models for accurate options pricing

### Security

- Row Level Security (RLS) is enabled on all tables
- Users can only access their own portfolios and positions
- Authentication is handled by Supabase Auth

## Project Structure

```
my-plan/
├── app/
│   ├── apps/
│   │   ├── portfolio/          # Portfolio Analyzer module
│   │   │   └── page.tsx        # Portfolio Analyzer home
│   │   ├── property/           # Property Investment module
│   │   │   ├── dashboard/      # Property dashboard
│   │   │   ├── properties/     # Property management pages
│   │   │   ├── login/          # Property app login
│   │   │   ├── signup/         # Property app signup
│   │   │   └── profile/       # User profile management
│   │   └── retirement/         # Retirement Planner module
│   │       ├── dashboard/      # Retirement dashboard
│   │       ├── plans/          # Retirement plan management pages
│   │       ├── login/          # Retirement app login
│   │       ├── signup/         # Retirement app signup
│   │       └── profile/       # User profile management
│   ├── auth/
│   │   ├── callback/           # OAuth callback handler
│   │   └── signout/           # Sign out handler
│   ├── login/                  # Main login page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page (My Plan dashboard)
│   └── globals.css            # Global styles
├── components/
│   ├── PortfolioDashboard.tsx  # Portfolio main dashboard
│   ├── PortfolioList.tsx      # Portfolio list view
│   ├── PortfolioView.tsx      # Portfolio detail view
│   ├── PositionManager.tsx    # Position CRUD
│   ├── CSVUpload.tsx          # CSV import with field mapping
│   ├── PortfolioAnalysis.tsx # Portfolio analysis display
│   ├── property/              # Property Investment components
│   │   ├── property-list.tsx
│   │   ├── property-form.tsx
│   │   ├── property-details.tsx
│   │   ├── scenario-form.tsx
│   │   ├── financial-scenarios-list.tsx
│   │   ├── recommended-scenarios-list.tsx
│   │   ├── financial-metrics.tsx
│   │   ├── loan-form.tsx
│   │   ├── loan-details.tsx
│   │   └── amortization-table.tsx
│   └── retirement/            # Retirement Planner components
│       ├── retirement-plan-list.tsx
│       ├── retirement-plan-form.tsx
│       ├── retirement-plan-tabs.tsx
│       ├── scenarios-table.tsx
│       ├── scenario-context.tsx
│       ├── defaults-popup.tsx
│       └── tabs/              # Retirement planner tabs
│           ├── plan-details-tab.tsx
│           ├── accounts-tab.tsx
│           ├── expenses-tab.tsx
│           ├── other-income-tab.tsx
│           ├── details-tab.tsx
│           ├── analysis-tab.tsx
│           ├── compounding-tab.tsx
│           └── defaults-tab.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   ├── server.ts          # Server Supabase client
│   │   └── middleware.ts      # Auth middleware
│   └── utils/
│       ├── portfolio-analysis.ts  # Portfolio calculation utilities
│       ├── market-data.ts        # Market data API integration
│       ├── retirement-projections.ts  # Retirement projection calculations
│       └── monte-carlo.ts        # Monte Carlo simulation utilities
├── middleware.ts              # Next.js middleware
└── .env.local                # Environment variables
```

## Development

### Building for Production

```bash
npm run build
npm start
```

### Database Migrations

Database migrations are managed through Supabase. To create new migrations:

1. Use the Supabase dashboard SQL editor, or
2. Use the MCP Supabase tools to apply migrations

## Future Enhancements

### Portfolio Analyzer
- Historical performance charts
- Risk-adjusted returns (Sharpe ratio, Sortino ratio, etc.)
- Sector and industry diversification analysis
- Dividend tracking
- Tax loss harvesting suggestions
- Alert system for price movements
- Export analysis reports (PDF/CSV)

### Property Investment Analyzer
- Multi-property portfolio analysis
- Property comparison tools
- Market trend analysis
- Rental yield comparisons
- Property value appreciation tracking
- Tax implications calculator
- 1031 exchange analysis
- Export scenario reports (PDF/CSV)

### Retirement Planner
- Social Security optimization strategies
- Tax bracket management and optimization
- Healthcare cost modeling
- Long-term care planning
- Estate planning integration
- Multiple retirement date scenarios
- What-if analysis tools
- Export projection reports (PDF/CSV)
- Integration with tax planning tools

### General
- Additional financial planning modules
- Cross-module analytics
- Mobile app support
- Advanced reporting and visualization
- Unified dashboard across all modules

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
