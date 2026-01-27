# Xecoledger - Business Intelligence for Small Businesses

A comprehensive, offline-first Progressive Web Application (PWA) that provides professional-grade business intelligence tools to small businesses, including those without reliable internet access or traditional banking infrastructure.

## 🌟 Features

### 📦 Smart Inventory Management
- **Real-time Tracking**: Add products with name, category, cost price, and selling price
- **Low-Stock Alerts**: Automatic highlighting when items drop below minimum quantity
- **Valuation**: Calculate total inventory value based on cost vs potential revenue
- **Advanced Filtering**: Search by name, filter by category, and stock status
- **Quick Stock Updates**: Rapid quantity adjustments with one-click updates

### 📒 Khatabook (Credit/Debt) Ledger
- **Customer Profiles**: Comprehensive customer management with contact details
- **Credit Tracking**: Record and manage customer credit transactions
- **Debt Aging**: Visual indicators for overdue payments (30+ days)
- **Payment Recording**: Easy payment processing with automatic debt updates
- **Customer Analytics**: Individual customer insights and transaction history

### 💰 Sales & Transaction Engine
- **Shopping Cart**: Full-featured cart system with quantity management
- **Multiple Payment Methods**: Support for cash, mobile money, and credit payments
- **Atomic Transactions**: Ensures data integrity - if anything fails, nothing is saved
- **Automatic Stock Deduction**: Real-time inventory updates on sales completion
- **Customer Integration**: Seamless customer selection for credit sales

### 📊 Financial Analytics Dashboard
- **Real-time Metrics**: Live dashboard with animated counters
- **Profit/Loss Calculations**: Daily, weekly, and monthly financial insights
- **Top Sellers**: Performance tracking with medal rankings
- **Category Analysis**: Visual breakdown of sales by product category
- **Cash Flow Management**: Clear distinction between cash in hand and pending debt

### 🛡️ System & Resilience Features
- **100% Offline PWA**: Works completely offline after initial installation
- **Service Worker**: Intelligent caching and background sync capabilities
- **Data Backup**: JSON export for complete data preservation
- **CSV Export**: Separate exports for inventory and customer data
- **Data Restore**: Full system restoration from backup files
- **Cross-platform**: Works on desktop, tablet, and mobile devices

## 🎯 Social Impact

Xecoledger is designed with a **social impact mission** to democratize business intelligence:

- **Financial Inclusion**: Provides professional tools to underserved businesses
- **No Infrastructure Required**: Works without internet, banks, or expensive hardware
- **Accessibility**: Simple interface designed for users with varying technical skills
- **Data Sovereignty**: Complete control over business data
- **Cost Effective**: Free and open-source alternative to expensive ERP systems

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No internet connection required after initial load

### Installation
1. Open `index.html` in a modern web browser
2. Click "Install" or "Add to Home Screen" (if available)
3. The app will work offline thereafter

### First Time Setup
1. Add your first products using the "Add Product" button
2. Register customers in the Khatabook section
3. Start processing sales immediately

## 📱 Usage

### Adding Products
1. Navigate to **Inventory** tab
2. Click **+ Add Product**
3. Fill in product details:
   - Product name and category
   - Initial quantity and minimum stock level
   - Cost price and selling price
4. Save to add to inventory

### Processing Sales
1. Go to **Sales** tab
2. Add products to cart from the right panel
3. Adjust quantities as needed
4. Select payment method (Cash/Mobile Money/Credit)
5. Choose customer for credit sales
6. Click **Complete Sale**

### Managing Customer Credit
1. Navigate to **Khatabook** tab
2. Add new customers with contact details
3. View customer details by clicking on their card
4. Record payments using the **Record Payment** button
5. Track overdue payments with visual indicators

### Viewing Analytics
1. Check **Dashboard** for real-time overview
2. Visit **Analytics** tab for detailed insights
3. Filter by time periods (Daily/Weekly/Monthly)
4. Export data for external analysis

## 🔧 Technical Architecture

### Database Design
- **IndexedDB**: Client-side database for offline functionality
- **Three Main Stores**:
  - `products`: Inventory management
  - `transactions`: Sales and payment records
  - `customers`: Customer information and credit history

### Atomic Transactions
All critical operations use atomic transactions to ensure data integrity:
```javascript
// Example: Sale Transaction
1. Add transaction record
2. Update product quantities
3. Update customer debt (if credit sale)
// All succeed or all fail together
```

### PWA Features
- **Service Worker**: Caches assets and enables offline functionality
- **Web App Manifest**: Allows installation on devices
- **Responsive Design**: Adapts to all screen sizes
- **Background Sync**: Queues actions when offline, syncs when online

## 📊 Data Management

### Backup Process
1. Click **📥 Backup** in the header
2. Downloads complete JSON backup with all data
3. Store safely for disaster recovery

### Restore Process
1. Click **📤 Restore** in the header
2. Select backup file
3. Confirm data replacement
4. All data restored instantly

### Export Options
- **Inventory Export**: CSV format for spreadsheet analysis
- **Customer Export**: CSV format for customer management
- **Complete Backup**: JSON format for full system restore

## 🎨 Design Principles

### Color Scheme
- **Green (#10b981)**: Primary actions, success states, positive metrics
- **Blue (#3b82f6)**: Information, secondary actions
- **Red (#ef4444)**: Alerts, errors, debt indicators
- **White**: Clean background, readability

### User Experience
- **Progressive Disclosure**: Show relevant information at the right time
- **Visual Feedback**: Immediate responses to all user actions
- **Error Prevention**: Validate inputs and guide users
- **Accessibility**: Semantic HTML, keyboard navigation, screen reader support

## 🔒 Security & Privacy

- **Local Storage**: All data stored locally on device
- **No External Dependencies**: Works without internet or external services
- **Data Encryption**: Browser's built-in security for IndexedDB
- **User Control**: Complete ownership and control of business data

## 🌍 Browser Support

- **Chrome**: Full support with PWA features
- **Firefox**: Full support with PWA features  
- **Safari**: Full support (iOS 11.3+)
- **Edge**: Full support (Chromium-based)

## 🤝 Contributing

This is an open-source project focused on social impact. Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - Free for commercial and personal use

## 🆘 Support

For issues, questions, or feature requests:
- Create an issue in the GitHub repository
- Check existing documentation
- Test in different browsers for compatibility

---

**Xecoledger** - Empowering small businesses with professional-grade intelligence tools.
