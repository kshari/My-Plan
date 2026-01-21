# Portfolio Analyzer

A comprehensive stock portfolio analysis application built with Next.js and Supabase. Track your stock and options positions, analyze portfolio performance, and calculate key risk metrics.

## Features

### Portfolio Management
- Create and manage multiple portfolios
- Add individual positions (stocks and options)
- Upload positions via CSV file
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

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Authentication)
- **Utilities:** PapaParse (CSV parsing), Recharts (charts), date-fns (date utilities)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)

### Installation

1. Clone the repository:
```bash
cd portfolio-analyzer
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

The database schema has been automatically created in your Supabase project. It includes:

- **portfolios** - User portfolios
- **tickers** - Stock symbols and metadata
- **positions** - Stock and options positions
- **options_positions** - Options-specific data
- **position_metrics** - Calculated metrics per position
- **portfolio_metrics** - Portfolio-level metrics

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

## Usage

1. **Sign Up/Login:** Create an account or sign in
2. **Create Portfolio:** Click "Create Portfolio" and give it a name
3. **Add Positions:** 
   - Use "Add Position" to manually enter positions
   - Or use "CSV Upload" to bulk import positions
4. **View Analysis:** Navigate to the "Analysis" tab to see portfolio and position-level metrics

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
portfolio-analyzer/
├── app/
│   ├── auth/
│   │   └── callback/      # OAuth callback handler
│   ├── login/             # Login/signup page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard home
│   └── globals.css        # Global styles
├── components/
│   ├── PortfolioDashboard.tsx  # Main dashboard
│   ├── PortfolioList.tsx       # Portfolio list view
│   ├── PortfolioView.tsx       # Portfolio detail view
│   ├── PositionManager.tsx     # Position CRUD
│   ├── CSVUpload.tsx           # CSV import
│   └── PortfolioAnalysis.tsx   # Analysis display
├── lib/
│   ├── supabase/
│   │   ├── client.ts      # Browser Supabase client
│   │   ├── server.ts      # Server Supabase client
│   │   └── middleware.ts  # Auth middleware
│   └── utils/
│       └── portfolio-analysis.ts  # Calculation utilities
├── middleware.ts          # Next.js middleware
└── .env.local            # Environment variables
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

- Real-time market data integration
- Historical performance charts
- Risk-adjusted returns (Sharpe ratio, etc.)
- Sector and industry diversification analysis
- Dividend tracking
- Tax loss harvesting suggestions
- Alert system for price movements
- Export analysis reports (PDF/CSV)

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
