// Xecoledger - Business Intelligence for Small Businesses
class XecoledgerDB {
    constructor() {
        this.dbName = 'XecoledgerDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Products store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                }
                
                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('type', 'type', { unique: false });
                }
                
                // Customers store
                if (!db.objectStoreNames.contains('customers')) {
                    const customerStore = db.createObjectStore('customers', { keyPath: 'phone' });
                    customerStore.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    async addProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');
            const request = store.add(product);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProduct(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateProduct(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const product = getRequest.result;
                Object.assign(product, updates);
                const updateRequest = store.put(product);
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addTransaction(transaction) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions', 'products', 'customers'], 'readwrite');
            
            // Add transaction
            const transactionStore = txn.objectStore('transactions');
            const addRequest = transactionStore.add(transaction);
            
            addRequest.onsuccess = () => {
                const transactionId = addRequest.result;
                
                // Update product quantities
                const productStore = txn.objectStore('products');
                const promises = transaction.items.map(item => {
                    return new Promise((resolveUpdate, rejectUpdate) => {
                        const getProductRequest = productStore.get(item.productId);
                        getProductRequest.onsuccess = () => {
                            const product = getProductRequest.result;
                            if (product.quantity >= item.quantity) {
                                product.quantity -= item.quantity;
                                const updateRequest = productStore.put(product);
                                updateRequest.onsuccess = () => resolveUpdate();
                                updateRequest.onerror = () => rejectUpdate(updateRequest.error);
                            } else {
                                rejectUpdate(new Error('Insufficient stock'));
                            }
                        };
                        getProductRequest.onerror = () => rejectUpdate(getProductRequest.error);
                    });
                });
                
                // Update customer debt if credit sale
                if (transaction.paymentMethod === 'credit' && transaction.customerPhone) {
                    promises.push(new Promise((resolveCustomer, rejectCustomer) => {
                        const customerStore = txn.objectStore('customers');
                        const getCustomerRequest = customerStore.get(transaction.customerPhone);
                        getCustomerRequest.onsuccess = () => {
                            let customer = getCustomerRequest.result;
                            if (!customer) {
                                customer = {
                                    phone: transaction.customerPhone,
                                    name: transaction.customerName || 'Unknown',
                                    debt: 0,
                                    transactions: []
                                };
                            }
                            customer.debt = (customer.debt || 0) + transaction.total;
                            if (!customer.transactions) customer.transactions = [];
                            customer.transactions.push({
                                id: transactionId,
                                date: transaction.date,
                                amount: transaction.total,
                                type: 'sale'
                            });
                            const putCustomerRequest = customerStore.put(customer);
                            putCustomerRequest.onsuccess = () => resolveCustomer();
                            putCustomerRequest.onerror = () => rejectCustomer(putCustomerRequest.error);
                        };
                        getCustomerRequest.onerror = () => rejectCustomer(getCustomerRequest.error);
                    }));
                }
                
                Promise.all(promises)
                    .then(() => resolve(transactionId))
                    .catch(reject);
            };
            
            addRequest.onerror = () => reject(addRequest.error);
        });
    }

    async getAllTransactions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addCustomer(customer) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const request = store.put(customer);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllCustomers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getCustomer(phone) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.get(phone);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateCustomer(phone, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            
            const getRequest = store.get(phone);
            getRequest.onsuccess = () => {
                const customer = getRequest.result;
                Object.assign(customer, updates);
                const updateRequest = store.put(customer);
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async exportData() {
        const products = await this.getAllProducts();
        const transactions = await this.getAllTransactions();
        const customers = await this.getAllCustomers();
        
        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            data: {
                products,
                transactions,
                customers
            }
        };
    }

    async importData(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products', 'transactions', 'customers'], 'readwrite');
            
            // Clear existing data
            const productStore = transaction.objectStore('products');
            const transactionStore = transaction.objectStore('transactions');
            const customerStore = transaction.objectStore('customers');
            
            productStore.clear();
            transactionStore.clear();
            customerStore.clear();
            
            transaction.oncomplete = () => {
                // Add imported data
                const importTransaction = this.db.transaction(['products', 'transactions', 'customers'], 'readwrite');
                
                data.products.forEach(product => {
                    importTransaction.objectStore('products').add(product);
                });
                
                data.transactions.forEach(txn => {
                    importTransaction.objectStore('transactions').add(txn);
                });
                
                data.customers.forEach(customer => {
                    importTransaction.objectStore('customers').add(customer);
                });
                
                importTransaction.oncomplete = () => resolve();
                importTransaction.onerror = () => reject(importTransaction.error);
            };
            
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Main Application
class XecoledgerApp {
    constructor() {
        this.db = new XecoledgerDB();
        this.currentTab = 'dashboard';
        this.cart = [];
        this.selectedCustomer = null;
        this.realTimeUpdateInterval = null;
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            this.setupRealTimeUpdates();
            this.loadDashboard();
            this.updateConnectionStatus();
            console.log('Xecoledger initialized successfully');
            this.showToast('Welcome to Xecoledger! 🎉', 'success');
        } catch (error) {
            console.error('Failed to initialize Xecoledger:', error);
            this.showToast('Failed to initialize application. Please refresh the page.', 'error');
        }
    }

    setupRealTimeUpdates() {
        // Update dashboard every 30 seconds
        this.realTimeUpdateInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.loadDashboard();
            }
        }, 30000);

        // Listen for online/offline events
        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (navigator.onLine) {
                statusElement.innerHTML = '<span class="w-2 h-2 bg-green-400 rounded-full mr-1"></span>Online';
            } else {
                statusElement.innerHTML = '<span class="w-2 h-2 bg-red-400 rounded-full mr-1"></span>Offline';
            }
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');
        
        toastMessage.textContent = message;
        toastIcon.textContent = type === 'success' ? '✅' : '❌';
        
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Product Management
        document.getElementById('addProductBtn').addEventListener('click', () => {
            this.showProductModal();
        });

        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        document.getElementById('cancelProductBtn').addEventListener('click', () => {
            this.hideProductModal();
        });

        // Product search and filters
        document.getElementById('productSearch')?.addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });

        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            this.filterProductsByCategory(e.target.value);
        });

        document.getElementById('stockFilter')?.addEventListener('change', (e) => {
            this.filterProductsByStock(e.target.value);
        });

        // Customer Management
        document.getElementById('addCustomerBtn').addEventListener('click', () => {
            this.showCustomerModal();
        });

        document.getElementById('customerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCustomer();
        });

        document.getElementById('cancelCustomerBtn').addEventListener('click', () => {
            this.hideCustomerModal();
        });

        // Customer search
        document.getElementById('customerSearch')?.addEventListener('input', (e) => {
            this.filterCustomers(e.target.value);
        });

        // Sales
        document.getElementById('completeSaleBtn').addEventListener('click', () => {
            this.completeSale();
        });

        document.getElementById('clearCartBtn')?.addEventListener('click', () => {
            this.clearCart();
        });

        // Product search for sales
        document.getElementById('saleProductSearch')?.addEventListener('input', (e) => {
            this.filterSaleProducts(e.target.value);
        });

        // Analytics period selector
        document.getElementById('revenuePeriod')?.addEventListener('change', (e) => {
            this.updateAnalyticsPeriod(e.target.value);
        });

        // Backup/Restore
        document.getElementById('backupBtn').addEventListener('click', () => {
            this.backupData();
        });

        document.getElementById('restoreBtn').addEventListener('click', () => {
            this.restoreData();
        });

        // Export buttons
        document.getElementById('exportInventoryBtn')?.addEventListener('click', () => {
            this.exportInventory();
        });

        document.getElementById('exportCustomersBtn')?.addEventListener('click', () => {
            this.exportCustomers();
        });

        // Settings button
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.showSettings();
        });

        // Modal close on overlay click
        document.getElementById('productModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'productModal') {
                this.hideProductModal();
            }
        });

        document.getElementById('customerModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'customerModal') {
                this.hideCustomerModal();
            }
        });
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });

        // Show selected tab
        document.getElementById(tabName).classList.remove('hidden');

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('text-green', 'border-green');
            btn.classList.add('text-gray-600', 'border-transparent');
        });

        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-600', 'border-transparent');
            activeBtn.classList.add('text-green', 'border-green');
        }

        this.currentTab = tabName;

        // Load tab-specific data
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'inventory':
                this.loadProducts();
                break;
            case 'sales':
                this.loadSalesInterface();
                break;
            case 'khatabook':
                this.loadCustomers();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadDashboard() {
        try {
            const products = await this.db.getAllProducts();
            const transactions = await this.db.getAllTransactions();
            const customers = await this.db.getAllCustomers();

            // Calculate today's sales
            const today = new Date().toDateString();
            const todaySales = transactions
                .filter(t => new Date(t.date).toDateString() === today)
                .reduce((sum, t) => sum + t.total, 0);

            // Calculate pending debt
            const pendingDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);

            // Count low stock items
            const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;

            // Update dashboard with animations
            this.animateValue('todaySales', 0, todaySales, 1000, '$');
            this.animateValue('totalProducts', 0, products.length, 1000);
            this.animateValue('pendingDebt', 0, pendingDebt, 1000, '$');
            this.animateValue('lowStockCount', 0, lowStockCount, 1000);

            // Load recent transactions
            this.loadRecentTransactions(transactions.slice(-5).reverse());
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    animateValue(id, start, end, duration, prefix = '') {
        const element = document.getElementById(id);
        if (!element) return;
        
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = prefix + current.toFixed(2);
        }, 16);
    }

    loadRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No transactions yet</p>';
            return;
        }

        container.innerHTML = transactions.map(t => `
            <div class="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors fade-in">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span class="text-green">${this.getPaymentIcon(t.paymentMethod)}</span>
                    </div>
                    <div>
                        <p class="font-medium">${t.type || 'Sale'} #${t.id}</p>
                        <p class="text-sm text-gray-500">${new Date(t.date).toLocaleString()}</p>
                        ${t.customerName ? `<p class="text-sm text-gray-500">Customer: ${t.customerName}</p>` : ''}
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-green">$${t.total.toFixed(2)}</p>
                    <p class="text-sm text-gray-500">${t.paymentMethod}</p>
                </div>
            </div>
        `).join('');
    }

    getPaymentIcon(method) {
        const icons = {
            cash: '💵',
            mobile: '📱',
            credit: '💳'
        };
        return icons[method] || '💰';
    }

    async loadProducts() {
        try {
            const products = await this.db.getAllProducts();
            const tbody = document.getElementById('productTableBody');
            
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-gray-500"><div class="mb-4"><span class="text-4xl">📦</span></div><p class="font-medium mb-2">No products added yet</p><p class="text-sm">Start by adding your first product to the inventory</p></td></tr>';
                return;
            }

            // Update category filter
            this.updateCategoryFilter(products);

            tbody.innerHTML = products.map(product => {
                const isLowStock = product.quantity <= product.minStock;
                const totalValue = product.quantity * product.sellingPrice;
                const profit = (product.sellingPrice - product.costPrice) * product.quantity;
                
                return `
                    <tr class="border-b hover:bg-gray-50 transition-colors ${isLowStock ? 'low-stock' : ''}">
                        <td class="py-3 px-2">
                            <div class="flex items-center space-x-2">
                                <div class="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                    <span class="text-xs">${product.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <p class="font-medium">${product.name}</p>
                                    <p class="text-xs text-gray-500">${product.category}</p>
                                </div>
                            </div>
                        </td>
                        <td class="py-3 px-2">
                            <div class="flex items-center space-x-2">
                                <span class="font-medium ${isLowStock ? 'text-red' : ''}">${product.quantity}</span>
                                ${isLowStock ? '<span class="text-xs bg-red-100 text-red px-2 py-1 rounded">LOW</span>' : ''}
                            </div>
                            <p class="text-xs text-gray-500">Min: ${product.minStock}</p>
                        </td>
                        <td class="py-3 px-2">
                            <p class="font-medium">$${product.costPrice.toFixed(2)}</p>
                        </td>
                        <td class="py-3 px-2">
                            <p class="font-medium text-green">$${product.sellingPrice.toFixed(2)}</p>
                            <p class="text-xs text-gray-500">${((product.sellingPrice - product.costPrice) / product.costPrice * 100).toFixed(1)}% margin</p>
                        </td>
                        <td class="py-3 px-2">
                            <p class="font-medium">$${totalValue.toFixed(2)}</p>
                            <p class="text-xs ${profit >= 0 ? 'text-green' : 'text-red'}">$${profit.toFixed(2)} profit</p>
                        </td>
                        <td class="py-3 px-2">
                            <div class="flex space-x-1">
                                <button onclick="app.editProduct(${product.id})" class="text-blue hover:bg-blue-50 p-1 rounded" title="Edit">
                                    ✏️
                                </button>
                                <button onclick="app.quickStockUpdate(${product.id})" class="text-green hover:bg-green-50 p-1 rounded" title="Update Stock">
                                    📦
                                </button>
                                <button onclick="app.deleteProduct(${product.id})" class="text-red hover:bg-red-50 p-1 rounded" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    updateCategoryFilter(products) {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;
        
        const categories = [...new Set(products.map(p => p.category))].sort();
        const currentValue = categoryFilter.value;
        
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        
        categoryFilter.value = currentValue;
    }

    filterProducts(searchTerm) {
        const rows = document.querySelectorAll('#productTableBody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    filterProductsByCategory(category) {
        const rows = document.querySelectorAll('#productTableBody tr');
        
        rows.forEach(row => {
            if (!category) {
                row.style.display = '';
            } else {
                const rowCategory = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase();
                row.style.display = rowCategory?.includes(category.toLowerCase()) ? '' : 'none';
            }
        });
    }

    filterProductsByStock(stockFilter) {
        const rows = document.querySelectorAll('#productTableBody tr');
        
        rows.forEach(row => {
            if (!stockFilter) {
                row.style.display = '';
            } else {
                const stockCell = row.querySelector('td:nth-child(2)');
                const hasLowStock = stockCell?.textContent.includes('LOW');
                const quantity = parseInt(stockCell?.textContent.match(/\d+/)?.[0] || '0');
                
                switch(stockFilter) {
                    case 'low':
                        row.style.display = hasLowStock ? '' : 'none';
                        break;
                    case 'out':
                        row.style.display = quantity === 0 ? '' : 'none';
                        break;
                    case 'available':
                        row.style.display = quantity > 0 && !hasLowStock ? '' : 'none';
                        break;
                }
            }
        });
    }

    showProductModal(product = null) {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        
        if (product) {
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productQuantity').value = product.quantity;
            document.getElementById('productCost').value = product.costPrice;
            document.getElementById('productPrice').value = product.sellingPrice;
            document.getElementById('productMinStock').value = product.minStock;
            form.dataset.editId = product.id;
        } else {
            form.reset();
            delete form.dataset.editId;
        }
        
        modal.classList.remove('hidden');
    }

    hideProductModal() {
        document.getElementById('productModal').classList.add('hidden');
        document.getElementById('productForm').reset();
    }

    async saveProduct() {
        try {
            const form = document.getElementById('productForm');
            const product = {
                name: document.getElementById('productName').value,
                category: document.getElementById('productCategory').value,
                quantity: parseInt(document.getElementById('productQuantity').value),
                costPrice: parseFloat(document.getElementById('productCost').value),
                sellingPrice: parseFloat(document.getElementById('productPrice').value),
                minStock: parseInt(document.getElementById('productMinStock').value),
                createdAt: new Date().toISOString()
            };

            if (form.dataset.editId) {
                await this.db.updateProduct(parseInt(form.dataset.editId), product);
            } else {
                await this.db.addProduct(product);
            }

            this.hideProductModal();
            this.loadProducts();
            this.loadDashboard();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Failed to save product. Please try again.');
        }
    }

    async deleteProduct(id) {
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                await this.db.deleteProduct(id);
                this.loadProducts();
                this.loadDashboard();
            } catch (error) {
                console.error('Error deleting product:', error);
                alert('Failed to delete product. Please try again.');
            }
        }
    }

    async loadSalesInterface() {
        try {
            const products = await this.db.getAllProducts();
            const customers = await this.db.getAllCustomers();
            
            // Load products for sale
            const productList = document.getElementById('saleProductList');
            if (products.length === 0) {
                productList.innerHTML = '<div class="text-center py-8 text-gray-500"><span class="text-3xl mb-2 block">📦</span><p class="text-sm">No products available</p></div>';
            } else {
                const availableProducts = products.filter(p => p.quantity > 0);
                productList.innerHTML = availableProducts.map(product => `
                    <div class="flex justify-between items-center p-3 border rounded-lg hover:bg-green-50 cursor-pointer transition-colors" 
                         onclick="app.addToCart(${product.id})">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span class="text-sm font-medium">${product.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                                <p class="font-medium">${product.name}</p>
                                <p class="text-xs text-gray-500">Stock: ${product.quantity}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-green">$${product.sellingPrice.toFixed(2)}</p>
                            <button class="text-xs bg-green text-white px-2 py-1 rounded hover:bg-green-600">Add +</button>
                        </div>
                    </div>
                `).join('');
            }

            // Load customers
            const customerSelect = document.getElementById('customerSelect');
            if (customers.length === 0) {
                customerSelect.innerHTML = '<option value="">🚶 Walk-in Customer</option>';
            } else {
                customerSelect.innerHTML = '<option value="">🚶 Walk-in Customer</option>' +
                    customers.map(c => `<option value="${c.phone}">${c.name} (${c.phone})</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading sales interface:', error);
        }
    }

    async addToCart(productId) {
        try {
            const product = await this.db.getProduct(productId);
            if (!product || product.quantity === 0) {
                this.showToast('Product not available', 'error');
                return;
            }

            const existingItem = this.cart.find(item => item.productId === productId);
            
            if (existingItem) {
                if (existingItem.quantity < product.quantity) {
                    existingItem.quantity++;
                    this.updateCartDisplay();
                } else {
                    this.showToast('Insufficient stock', 'error');
                }
            } else {
                this.cart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.sellingPrice,
                    quantity: 1,
                    maxQuantity: product.quantity
                });
                this.updateCartDisplay();
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showToast('Failed to add product to cart', 'error');
        }
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartSubtotal = document.getElementById('cartSubtotal');
        const cartTax = document.getElementById('cartTax');
        const cartTotal = document.getElementById('cartTotal');

        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <span class="text-4xl mb-4 block">🛒</span>
                    <p class="font-medium mb-2">Your cart is empty</p>
                    <p class="text-sm">Add products from the right panel to get started</p>
                </div>
            `;
            cartCount.textContent = '0 items';
            cartSubtotal.textContent = '$0.00';
            cartTax.textContent = '$0.00';
            cartTotal.textContent = '$0.00';
            return;
        }

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = 0; // No tax for simplicity
        const total = subtotal + tax;

        cartItems.innerHTML = this.cart.map((item, index) => `
            <div class="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span class="text-sm font-medium">${item.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                        <p class="font-medium">${item.name}</p>
                        <p class="text-sm text-gray-500">$${item.price.toFixed(2)} each</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-1">
                        <button onclick="app.updateCartItemQuantity(${index}, -1)" class="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300">-</button>
                        <span class="w-12 text-center font-medium">${item.quantity}</span>
                        <button onclick="app.updateCartItemQuantity(${index}, 1)" class="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300">+</button>
                    </div>
                    <p class="font-bold text-green w-20 text-right">$${(item.price * item.quantity).toFixed(2)}</p>
                    <button onclick="app.removeFromCart(${index})" class="text-red hover:bg-red-50 p-2 rounded">🗑️</button>
                </div>
            </div>
        `).join('');

        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
        cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
        cartTax.textContent = `$${tax.toFixed(2)}`;
        cartTotal.textContent = `$${total.toFixed(2)}`;
    }

    updateCartItemQuantity(index, change) {
        const item = this.cart[index];
        const newQuantity = item.quantity + change;
        
        if (newQuantity <= 0) {
            this.removeFromCart(index);
        } else if (newQuantity <= item.maxQuantity) {
            item.quantity = newQuantity;
            this.updateCartDisplay();
        } else {
            this.showToast('Insufficient stock', 'error');
        }
    }

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCartDisplay();
    }

    clearCart() {
        if (this.cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
            this.cart = [];
            this.updateCartDisplay();
            this.showToast('Cart cleared', 'success');
        }
    }

    async completeSale() {
        if (this.cart.length === 0) {
            this.showToast('Cart is empty', 'error');
            return;
        }

        try {
            const paymentMethod = document.getElementById('paymentMethod').value;
            const customerPhone = document.getElementById('customerSelect').value;
            let customerName = 'Walk-in Customer';

            if (customerPhone) {
                const customer = await this.db.getCustomer(customerPhone);
                customerName = customer ? customer.name : customerPhone;
            }

            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = 0;
            const total = subtotal + tax;

            const transaction = {
                date: new Date().toISOString(),
                items: this.cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal,
                tax,
                total,
                paymentMethod,
                customerPhone,
                customerName,
                type: 'sale'
            };

            await this.db.addTransaction(transaction);
            this.cart = [];
            this.updateCartDisplay();
            this.loadSalesInterface();
            this.loadDashboard();
            
            this.showToast(`Sale completed successfully! $${total.toFixed(2)}`, 'success');
        } catch (error) {
            console.error('Error completing sale:', error);
            this.showToast('Failed to complete sale: ' + error.message, 'error');
        }
    }

    async loadCustomers() {
        try {
            const customers = await this.db.getAllCustomers();
            const container = document.getElementById('customerList');
            
            if (customers.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <span class="text-4xl mb-4 block">👥</span>
                        <p class="font-medium mb-2">No customers yet</p>
                        <p class="text-sm">Add your first customer to start tracking credit</p>
                    </div>
                `;
                this.updateCustomerStats([]);
                return;
            }

            // Update stats
            this.updateCustomerStats(customers);

            container.innerHTML = customers.map(customer => {
                const hasDebt = customer.debt > 0;
                const overdueDays = this.calculateOverdueDays(customer);
                
                return `
                    <div class="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer" 
                         onclick="app.selectCustomer('${customer.phone}')">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center space-x-3">
                                <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span class="text-lg font-medium">${customer.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <p class="font-bold text-lg">${customer.name}</p>
                                    <p class="text-gray-500">${customer.phone}</p>
                                    ${customer.email ? `<p class="text-sm text-gray-500">${customer.email}</p>` : ''}
                                    ${overdueDays > 0 ? `<p class="text-xs text-red-500 mt-1">⚠️ ${overdueDays} days overdue</p>` : ''}
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-bold ${hasDebt ? 'text-red' : 'text-green'}">
                                    $${(customer.debt || 0).toFixed(2)}
                                </p>
                                <p class="text-sm text-gray-500">${hasDebt ? 'Debt' : 'Clear'}</p>
                                <div class="flex space-x-1 mt-2">
                                    <button onclick="event.stopPropagation(); app.recordPayment('${customer.phone}')" 
                                            class="text-xs bg-green text-white px-2 py-1 rounded hover:bg-green-600">
                                        💳 Payment
                                    </button>
                                    <button onclick="event.stopPropagation(); app.viewCustomerHistory('${customer.phone}')" 
                                            class="text-xs bg-blue text-white px-2 py-1 rounded hover:bg-blue-600">
                                        📋 History
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    updateCustomerStats(customers) {
        const totalCustomers = document.getElementById('totalCustomers');
        const totalCredit = document.getElementById('totalCredit');
        const overdueCredit = document.getElementById('overdueCredit');

        if (!totalCustomers || !totalCredit || !overdueCredit) return;

        const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
        const overdueDebt = customers.reduce((sum, c) => {
            const overdueDays = this.calculateOverdueDays(c);
            return overdueDays > 0 ? sum + (c.debt || 0) : sum;
        }, 0);

        totalCustomers.textContent = customers.length;
        totalCredit.textContent = `$${totalDebt.toFixed(2)}`;
        overdueCredit.textContent = `$${overdueDebt.toFixed(2)}`;
    }

    calculateOverdueDays(customer) {
        if (!customer.debt || customer.debt <= 0) return 0;
        
        const transactions = customer.transactions || [];
        const oldestTransaction = transactions
            .filter(t => t.type === 'sale')
            .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        
        if (!oldestTransaction) return 0;
        
        const daysSince = Math.floor((Date.now() - new Date(oldestTransaction.date)) / (1000 * 60 * 60 * 24));
        return Math.max(0, daysSince - 30); // Consider overdue after 30 days
    }

    async selectCustomer(phone) {
        try {
            const customer = await this.db.getCustomer(phone);
            if (!customer) return;

            this.selectedCustomer = customer;
            const detailsContainer = document.getElementById('customerDetails');
            
            const transactions = customer.transactions || [];
            const recentTransactions = transactions.slice(-5).reverse();
            
            detailsContainer.innerHTML = `
                <div class="space-y-4">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span class="text-2xl font-bold">${customer.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <h3 class="font-bold text-lg">${customer.name}</h3>
                        <p class="text-gray-500">${customer.phone}</p>
                        ${customer.email ? `<p class="text-sm text-gray-500">${customer.email}</p>` : ''}
                    </div>
                    
                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-gray-600">Current Debt:</span>
                            <span class="font-bold text-lg ${customer.debt > 0 ? 'text-red' : 'text-green'}">
                                $${(customer.debt || 0).toFixed(2)}
                            </span>
                        </div>
                        
                        <div class="space-y-2">
                            <button onclick="app.recordPayment('${customer.phone}')" 
                                    class="w-full btn btn-primary">
                                💳 Record Payment
                            </button>
                            <button onclick="app.viewCustomerHistory('${customer.phone}')" 
                                    class="w-full btn btn-secondary">
                                📋 View Full History
                            </button>
                        </div>
                    </div>
                    
                    ${recentTransactions.length > 0 ? `
                        <div class="border-t pt-4">
                            <h4 class="font-medium mb-2">Recent Activity</h4>
                            <div class="space-y-2">
                                ${recentTransactions.map(t => `
                                    <div class="flex justify-between items-center text-sm">
                                        <span class="text-gray-600">${new Date(t.date).toLocaleDateString()}</span>
                                        <span class="font-medium">$${t.amount.toFixed(2)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (error) {
            console.error('Error selecting customer:', error);
        }
    }

    filterCustomers(searchTerm) {
        const customers = document.querySelectorAll('#customerList > div');
        const term = searchTerm.toLowerCase();
        
        customers.forEach(customer => {
            const text = customer.textContent.toLowerCase();
            customer.style.display = text.includes(term) ? '' : 'none';
        });
    }

    showCustomerModal() {
        document.getElementById('customerModal').classList.remove('hidden');
    }

    hideCustomerModal() {
        document.getElementById('customerModal').classList.add('hidden');
        document.getElementById('customerForm').reset();
    }

    async saveCustomer() {
        try {
            const customer = {
                phone: document.getElementById('customerPhone').value,
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                address: document.getElementById('customerAddress').value,
                debt: 0,
                createdAt: new Date().toISOString(),
                transactions: []
            };

            await this.db.addCustomer(customer);
            this.hideCustomerModal();
            this.loadCustomers();
            this.showToast('Customer added successfully!', 'success');
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showToast('Failed to save customer. Please try again.', 'error');
        }
    }

    async recordPayment(customerPhone) {
        const amount = prompt('Enter payment amount:');
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return;
        }

        try {
            const customer = await this.db.getCustomer(customerPhone);
            if (!customer) return;

            const paymentAmount = parseFloat(amount);
            if (paymentAmount > (customer.debt || 0)) {
                this.showToast('Payment amount exceeds debt', 'error');
                return;
            }

            const newDebt = (customer.debt || 0) - paymentAmount;
            
            // Add payment transaction
            const paymentTransaction = {
                date: new Date().toISOString(),
                amount: paymentAmount,
                type: 'payment',
                method: 'cash', // Default payment method
                description: `Payment by ${customer.name}`
            };

            if (!customer.transactions) customer.transactions = [];
            customer.transactions.push(paymentTransaction);
            customer.debt = newDebt;

            await this.db.updateCustomer(customerPhone, customer);
            this.loadCustomers();
            this.selectCustomer(customerPhone); // Refresh details
            this.showToast(`Payment of $${paymentAmount.toFixed(2)} recorded successfully!`, 'success');
        } catch (error) {
            console.error('Error recording payment:', error);
            this.showToast('Failed to record payment', 'error');
        }
    }

    viewCustomerHistory(customerPhone) {
        // This would open a detailed history modal
        alert('Customer history feature coming soon!');
    }

    async loadAnalytics() {
        try {
            const transactions = await this.db.getAllTransactions();
            const customers = await this.db.getAllCustomers();
            const products = await this.db.getAllProducts();
            
            // Calculate analytics
            const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
            const cashInHand = cashTransactions.reduce((sum, t) => sum + t.total, 0);
            const pendingDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
            const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);

            // Update analytics display with animations
            this.animateValue('cashInHand', 0, cashInHand, 1000, '$');
            this.animateValue('pendingDebtAnalytics', 0, pendingDebt, 1000, '$');
            this.animateValue('totalRevenue', 0, totalRevenue, 1000, '$');

            // Load top sellers
            this.loadTopSellers(transactions, products);
            
            // Load category sales
            this.loadCategorySales(transactions, products);
            
            // Load transaction history
            this.loadTransactionHistory(transactions);
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    loadTopSellers(transactions, products) {
        const topSellersContainer = document.getElementById('topSellers');
        if (!topSellersContainer) return;

        // Calculate product sales
        const productSales = {};
        
        transactions.forEach(transaction => {
            transaction.items?.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    if (!productSales[product.name]) {
                        productSales[product.name] = {
                            name: product.name,
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    productSales[product.name].quantity += item.quantity;
                    productSales[product.name].revenue += item.price * item.quantity;
                }
            });
        });

        const topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        if (topProducts.length === 0) {
            topSellersContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <span class="text-2xl mb-2 block">🏆</span>
                    <p class="text-sm">No sales data available</p>
                </div>
            `;
            return;
        }

        topSellersContainer.innerHTML = topProducts.map((product, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            return `
                <div class="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div class="flex items-center space-x-3">
                        <span class="text-2xl">${medal}</span>
                        <div>
                            <p class="font-medium">${product.name}</p>
                            <p class="text-sm text-gray-500">${product.quantity} units sold</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-green">$${product.revenue.toFixed(2)}</p>
                        <p class="text-xs text-gray-500">Revenue</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadCategorySales(transactions, products) {
        const categorySalesContainer = document.getElementById('categorySales');
        if (!categorySalesContainer) return;

        // Calculate category sales
        const categorySales = {};
        
        transactions.forEach(transaction => {
            transaction.items?.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    if (!categorySales[product.category]) {
                        categorySales[product.category] = 0;
                    }
                    categorySales[product.category] += item.price * item.quantity;
                }
            });
        });

        const sortedCategories = Object.entries(categorySales)
            .sort(([,a], [,b]) => b - a);

        if (sortedCategories.length === 0) {
            categorySalesContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <span class="text-2xl mb-2 block">📂</span>
                    <p class="text-sm">Category data will appear here</p>
                </div>
            `;
            return;
        }

        const totalCategorySales = Object.values(categorySales).reduce((sum, val) => sum + val, 0);

        categorySalesContainer.innerHTML = sortedCategories.map(([category, revenue]) => {
            const percentage = (revenue / totalCategorySales * 100).toFixed(1);
            return `
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-medium">${category}</span>
                            <span class="text-sm text-gray-500">${percentage}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <div class="ml-4 text-right">
                        <p class="font-bold">$${revenue.toFixed(2)}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadTransactionHistory(transactions) {
        const historyContainer = document.getElementById('transactionHistory');
        if (!historyContainer) return;

        const recentTransactions = transactions.slice(-10).reverse();

        if (recentTransactions.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <span class="text-2xl mb-2 block">📋</span>
                    <p class="text-sm">No transactions yet</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = recentTransactions.map(transaction => `
            <div class="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div>
                    <p class="font-medium">${transaction.type || 'Sale'} #${transaction.id}</p>
                    <p class="text-sm text-gray-500">${new Date(transaction.date).toLocaleDateString()}</p>
                    ${transaction.customerName ? `<p class="text-xs text-gray-500">${transaction.customerName}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="font-bold text-green">$${transaction.total.toFixed(2)}</p>
                    <p class="text-xs text-gray-500">${transaction.paymentMethod}</p>
                </div>
            </div>
        `).join('');
    }

    updateAnalyticsPeriod(period) {
        // This would update the analytics based on the selected period
        console.log('Updating analytics for period:', period);
        this.loadAnalytics();
    }

    async backupData() {
        try {
            const data = await this.db.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xecoledger-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Backup downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error backing up data:', error);
            this.showToast('Failed to backup data. Please try again.', 'error');
        }
    }

    async restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (confirm('This will replace all existing data. Are you sure?')) {
                    await this.db.importData(data.data);
                    this.showToast('Data restored successfully!', 'success');
                    this.loadDashboard();
                    this.loadProducts();
                    this.loadCustomers();
                }
            } catch (error) {
                console.error('Error restoring data:', error);
                this.showToast('Failed to restore data. Please check the file format.', 'error');
            }
        };
        
        input.click();
    }

    async exportInventory() {
        try {
            const products = await this.db.getAllProducts();
            const csv = this.convertToCSV(products);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Inventory exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting inventory:', error);
            this.showToast('Failed to export inventory', 'error');
        }
    }

    async exportCustomers() {
        try {
            const customers = await this.db.getAllCustomers();
            const csv = this.convertToCSV(customers);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Customers exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting customers:', error);
            this.showToast('Failed to export customers', 'error');
        }
    }

    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : value;
            }).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    }

    showSettings() {
        alert('Settings panel coming soon!');
    }

    async quickStockUpdate(productId) {
        const product = await this.db.getProduct(productId);
        if (!product) return;
        
        const newQuantity = prompt(`Update stock for ${product.name}:\nCurrent: ${product.quantity}\nNew quantity:`, product.quantity);
        
        if (newQuantity === null || isNaN(newQuantity) || parseInt(newQuantity) < 0) {
            return;
        }
        
        try {
            await this.db.updateProduct(productId, { quantity: parseInt(newQuantity) });
            this.loadProducts();
            this.loadDashboard();
            this.showToast(`Stock updated for ${product.name}`, 'success');
        } catch (error) {
            console.error('Error updating stock:', error);
            this.showToast('Failed to update stock', 'error');
        }
    }

    filterSaleProducts(searchTerm) {
        const products = document.querySelectorAll('#saleProductList > div');
        const term = searchTerm.toLowerCase();
        
        products.forEach(product => {
            const text = product.textContent.toLowerCase();
            product.style.display = text.includes(term) ? '' : 'none';
        });
    }

    // Initialize the application
    static initialize() {
        return new XecoledgerApp();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = XecoledgerApp.initialize();
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}
