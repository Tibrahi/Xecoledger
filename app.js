// Xecoledger - Enhanced Business Intelligence Engine
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
                
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('type', 'type', { unique: false });
                }
                
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
                if (!product) return reject(new Error('Product not found'));
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

    async addTransaction(transactionData) {
        return new Promise((resolve, reject) => {
            const txn = this.db.transaction(['transactions', 'products', 'customers'], 'readwrite');
            const productStore = txn.objectStore('products');
            const transactionStore = txn.objectStore('transactions');
            const customerStore = txn.objectStore('customers');

            txn.onerror = () => reject(txn.error || new Error('Transaction failed'));
            
            let transactionId = null;

            // Step 1: Add main transaction record
            const addTxnReq = transactionStore.add(transactionData);
            addTxnReq.onsuccess = () => {
                transactionId = addTxnReq.result;

                // Step 2: Validate and update product stock items
                const checkAndDeductStock = transactionData.items.map(item => {
                    return new Promise((res, rej) => {
                        const prodReq = productStore.get(item.productId);
                        prodReq.onsuccess = () => {
                            const product = prodReq.result;
                            if (!product) return rej(new Error(`Item ID ${item.productId} not found.`));
                            if (product.quantity < item.quantity) {
                                return rej(new Error(`Insufficient stock for ${product.name}`));
                            }
                            product.quantity -= item.quantity;
                            const updateReq = productStore.put(product);
                            updateReq.onsuccess = () => res();
                            updateReq.onerror = () => rej(updateReq.error);
                        };
                        prodReq.onerror = () => rej(prodReq.error);
                    });
                });

                Promise.all(checkAndDeductStock).then(() => {
                    // Step 3: Handle customer debt allocation
                    if (transactionData.paymentMethod === 'credit' && transactionData.customerPhone) {
                        const custReq = customerStore.get(transactionData.customerPhone);
                        custReq.onsuccess = () => {
                            let customer = custReq.result || {
                                phone: transactionData.customerPhone,
                                name: transactionData.customerName || 'Unknown',
                                debt: 0,
                                transactions: []
                            };
                            customer.debt = (customer.debt || 0) + transactionData.total;
                            if (!customer.transactions) customer.transactions = [];
                            customer.transactions.push({
                                id: transactionId,
                                date: transactionData.date,
                                amount: transactionData.total,
                                type: 'sale'
                            });
                            const putCustReq = customerStore.put(customer);
                            putCustReq.onsuccess = () => resolve(transactionId);
                            putCustReq.onerror = () => reject(putCustReq.error);
                        };
                        custReq.onerror = () => reject(custReq.error);
                    } else {
                        resolve(transactionId);
                    }
                }).catch(err => {
                    txn.abort();
                    reject(err);
                });
            };
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
                if (!customer) return reject(new Error('Customer not found'));
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
            data: { products, transactions, customers }
        };
    }

    async importData(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products', 'transactions', 'customers'], 'readwrite');
            transaction.objectStore('products').clear();
            transaction.objectStore('transactions').clear();
            transaction.objectStore('customers').clear();
            
            transaction.oncomplete = () => {
                const importTransaction = this.db.transaction(['products', 'transactions', 'customers'], 'readwrite');
                data.products.forEach(p => importTransaction.objectStore('products').add(p));
                data.transactions.forEach(t => importTransaction.objectStore('transactions').add(t));
                data.customers.forEach(c => importTransaction.objectStore('customers').add(c));
                
                importTransaction.oncomplete = () => resolve();
                importTransaction.onerror = () => reject(importTransaction.error);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Main Application Controller
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
            this.showToast('Welcome to Xecoledger! 🚀', 'success');
        } catch (error) {
            console.error('Failed to initialize Xecoledger:', error);
            this.showToast('Failed to initialize database.', 'error');
        }
    }

    setupRealTimeUpdates() {
        this.realTimeUpdateInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.loadDashboard();
            }
        }, 30000);

        window.addEventListener('online', () => this.updateConnectionStatus());
        window.addEventListener('offline', () => this.updateConnectionStatus());
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (navigator.onLine) {
                statusElement.innerHTML = '<span class="w-2 h-2 bg-emerald-400 rounded-full mr-1.5 animate-pulse"></span>Online';
            } else {
                statusElement.innerHTML = '<span class="w-2 h-2 bg-rose-500 rounded-full mr-1.5"></span>Offline';
            }
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');
        
        if (!toast) return;
        toastMessage.textContent = message;
        toastIcon.textContent = type === 'success' ? '✅' : '❌';
        
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        document.getElementById('addProductBtn')?.addEventListener('click', () => this.showProductModal());
        document.getElementById('productForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        document.getElementById('cancelProductBtn')?.addEventListener('click', () => this.hideProductModal());

        document.getElementById('productSearch')?.addEventListener('input', (e) => this.filterProducts(e.target.value));
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => this.filterProductsByCategory(e.target.value));
        document.getElementById('stockFilter')?.addEventListener('change', (e) => this.filterProductsByStock(e.target.value));

        document.getElementById('addCustomerBtn')?.addEventListener('click', () => this.showCustomerModal());
        document.getElementById('customerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCustomer();
        });
        document.getElementById('cancelCustomerBtn')?.addEventListener('click', () => this.hideCustomerModal());
        document.getElementById('customerSearch')?.addEventListener('input', (e) => this.filterCustomers(e.target.value));

        document.getElementById('completeSaleBtn')?.addEventListener('click', () => this.completeSale());
        document.getElementById('clearCartBtn')?.addEventListener('click', () => this.clearCart());
        document.getElementById('saleProductSearch')?.addEventListener('input', (e) => this.filterSaleProducts(e.target.value));
        document.getElementById('revenuePeriod')?.addEventListener('change', (e) => this.updateAnalyticsPeriod(e.target.value));

        document.getElementById('backupBtn')?.addEventListener('click', () => this.backupData());
        document.getElementById('restoreBtn')?.addEventListener('click', () => this.restoreData());
        document.getElementById('exportInventoryBtn')?.addEventListener('click', () => this.exportInventory());
        document.getElementById('exportCustomersBtn')?.addEventListener('click', () => this.exportCustomers());

        document.getElementById('paymentModalForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPaymentSubmission();
        });
        document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => this.hidePaymentModal());

        document.getElementById('stockModalForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processStockSubmission();
        });
        document.getElementById('cancelStockBtn')?.addEventListener('click', () => this.hideStockModal());
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
        document.getElementById(tabName)?.classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active-nav');
            btn.classList.add('text-slate-400');
        });

        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active-nav');
            activeBtn.classList.remove('text-slate-400');
        }

        this.currentTab = tabName;

        switch(tabName) {
            case 'dashboard': this.loadDashboard(); break;
            case 'inventory': this.loadProducts(); break;
            case 'sales': this.loadSalesInterface(); break;
            case 'khatabook': this.loadCustomers(); break;
            case 'analytics': this.loadAnalytics(); break;
        }
    }

    async loadDashboard() {
        try {
            const products = await this.db.getAllProducts();
            const transactions = await this.db.getAllTransactions();
            const customers = await this.db.getAllCustomers();

            const today = new Date().toDateString();
            const todaySales = transactions
                .filter(t => new Date(t.date).toDateString() === today)
                .reduce((sum, t) => sum + t.total, 0);

            const pendingDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
            const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;

            this.animateValue('todaySales', 0, todaySales, 800, '$');
            this.animateValue('totalProducts', 0, products.length, 800);
            this.animateValue('pendingDebt', 0, pendingDebt, 800, '$');
            this.animateValue('lowStockCount', 0, lowStockCount, 800);

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
            container.innerHTML = '<p class="text-slate-400 text-center py-8">No recent transactions</p>';
            return;
        }

        container.innerHTML = transactions.map(t => `
            <div class="flex justify-between items-center p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30 transition-all">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 font-bold">
                        ${this.getPaymentIcon(t.paymentMethod)}
                    </div>
                    <div>
                        <p class="font-medium text-slate-200">${t.type || 'Sale'} #${t.id}</p>
                        <p class="text-xs text-slate-400">${new Date(t.date).toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-emerald-400">$${t.total.toFixed(2)}</p>
                    <p class="text-xs text-slate-400 capitalize">${t.paymentMethod}</p>
                </div>
            </div>
        `).join('');
    }

    getPaymentIcon(method) {
        const icons = { cash: '💵', mobile: '📱', credit: '💳' };
        return icons[method] || '💰';
    }

    async loadProducts() {
        try {
            const products = await this.db.getAllProducts();
            const tbody = document.getElementById('productTableBody');
            if (!tbody) return;
            
            if (products.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-400">
                    <div class="text-4xl mb-2">📦</div>
                    <p class="font-medium">No products in inventory</p>
                </td></tr>`;
                return;
            }

            this.updateCategoryFilter(products);

            tbody.innerHTML = products.map(product => {
                const isLowStock = product.quantity <= product.minStock;
                const totalValue = product.quantity * product.sellingPrice;
                
                return `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-4 font-medium text-slate-200">${product.name}</td>
                        <td class="py-3 px-4 text-slate-400">${product.category}</td>
                        <td class="py-3 px-4">
                            <span class="px-2 py-1 text-xs rounded-md ${isLowStock ? 'bg-rose-500/10 text-rose-400 font-bold' : 'bg-emerald-500/10 text-emerald-400'}">
                                ${product.quantity} ${isLowStock ? '(Low)' : ''}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-slate-300">$${product.costPrice.toFixed(2)}</td>
                        <td class="py-3 px-4 text-emerald-400 font-semibold">$${product.sellingPrice.toFixed(2)}</td>
                        <td class="py-3 px-4 text-slate-200">$${totalValue.toFixed(2)}</td>
                        <td class="py-3 px-4">
                            <div class="flex space-x-2">
                                <button onclick="app.editProduct(${product.id})" class="p-1 hover:text-emerald-400" title="Edit">✏️</button>
                                <button onclick="app.quickStockUpdate(${product.id})" class="p-1 hover:text-blue-400" title="Update Stock">📦</button>
                                <button onclick="app.deleteProduct(${product.id})" class="p-1 hover:text-rose-400" title="Delete">🗑️</button>
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
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    filterProducts(searchTerm) {
        const rows = document.querySelectorAll('#productTableBody tr');
        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    filterProductsByCategory(category) {
        const rows = document.querySelectorAll('#productTableBody tr');
        rows.forEach(row => {
            row.style.display = !category || row.children[1]?.textContent === category ? '' : 'none';
        });
    }

    filterProductsByStock(stockFilter) {
        const rows = document.querySelectorAll('#productTableBody tr');
        rows.forEach(row => {
            const hasLow = row.children[2]?.textContent.includes('(Low)');
            if (stockFilter === 'low') row.style.display = hasLow ? '' : 'none';
            else if (stockFilter === 'available') row.style.display = !hasLow ? '' : 'none';
            else row.style.display = '';
        });
    }

    async editProduct(id) {
        const product = await this.db.getProduct(id);
        if (product) this.showProductModal(product);
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
                this.showToast('Product updated successfully!');
            } else {
                await this.db.addProduct(product);
                this.showToast('Product created successfully!');
            }

            this.hideProductModal();
            this.loadProducts();
            this.loadDashboard();
        } catch (error) {
            console.error('Error saving product:', error);
            this.showToast('Failed to save product.', 'error');
        }
    }

    async deleteProduct(id) {
        if (confirm('Are you sure you want to remove this product?')) {
            try {
                await this.db.deleteProduct(id);
                this.loadProducts();
                this.loadDashboard();
                this.showToast('Product deleted.');
            } catch (error) {
                this.showToast('Failed to delete product.', 'error');
            }
        }
    }

    async loadSalesInterface() {
        try {
            const products = await this.db.getAllProducts();
            const customers = await this.db.getAllCustomers();
            
            const productList = document.getElementById('saleProductList');
            if (products.length === 0) {
                productList.innerHTML = '<p class="text-slate-400 text-center py-6">No inventory found.</p>';
            } else {
                productList.innerHTML = products.filter(p => p.quantity > 0).map(product => `
                    <div onclick="app.addToCart(${product.id})" class="flex justify-between items-center p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/50 cursor-pointer">
                        <div>
                            <p class="font-medium text-slate-200">${product.name}</p>
                            <p class="text-xs text-slate-400">Stock: ${product.quantity}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-emerald-400">$${product.sellingPrice.toFixed(2)}</p>
                            <span class="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">+ Add</span>
                        </div>
                    </div>
                `).join('');
            }

            const customerSelect = document.getElementById('customerSelect');
            customerSelect.innerHTML = '<option value="">🚶 Walk-in Customer</option>' +
                customers.map(c => `<option value="${c.phone}">${c.name} (${c.phone})</option>`).join('');
        } catch (error) {
            console.error('Error loading sales panel:', error);
        }
    }

    async addToCart(productId) {
        try {
            const product = await this.db.getProduct(productId);
            if (!product || product.quantity === 0) {
                this.showToast('Product unavailable', 'error');
                return;
            }

            const item = this.cart.find(i => i.productId === productId);
            if (item) {
                if (item.quantity < product.quantity) {
                    item.quantity++;
                } else {
                    this.showToast('Stock limit reached', 'error');
                }
            } else {
                this.cart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.sellingPrice,
                    quantity: 1,
                    maxQuantity: product.quantity
                });
            }
            this.updateCartDisplay();
        } catch (error) {
            this.showToast('Error adding to cart', 'error');
        }
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const cartCount = document.getElementById('cartCount');

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p class="text-slate-400 text-center py-12">Cart is currently empty</p>';
            cartTotal.textContent = '$0.00';
            cartCount.textContent = '0 items';
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        cartItems.innerHTML = this.cart.map((item, idx) => `
            <div class="flex justify-between items-center p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <div>
                    <p class="font-medium text-slate-200">${item.name}</p>
                    <p class="text-xs text-slate-400">$${item.price.toFixed(2)} each</p>
                </div>
                <div class="flex items-center space-x-3">
                    <button onclick="app.updateCartQty(${idx}, -1)" class="w-6 h-6 bg-slate-700 rounded text-slate-200">-</button>
                    <span class="text-slate-200 font-medium">${item.quantity}</span>
                    <button onclick="app.updateCartQty(${idx}, 1)" class="w-6 h-6 bg-slate-700 rounded text-slate-200">+</button>
                    <button onclick="app.removeFromCart(${idx})" class="text-rose-400 hover:text-rose-300 ml-2">🗑️</button>
                </div>
            </div>
        `).join('');

        cartTotal.textContent = `$${total.toFixed(2)}`;
        cartCount.textContent = `${count} item${count > 1 ? 's' : ''}`;
    }

    updateCartQty(idx, change) {
        const item = this.cart[idx];
        const newQty = item.quantity + change;
        if (newQty <= 0) {
            this.removeFromCart(idx);
        } else if (newQty <= item.maxQuantity) {
            item.quantity = newQty;
            this.updateCartDisplay();
        } else {
            this.showToast('Exceeds available stock', 'error');
        }
    }

    removeFromCart(idx) {
        this.cart.splice(idx, 1);
        this.updateCartDisplay();
    }

    clearCart() {
        this.cart = [];
        this.updateCartDisplay();
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
                const c = await this.db.getCustomer(customerPhone);
                if (c) customerName = c.name;
            }

            const total = this.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            const transactionData = {
                date: new Date().toISOString(),
                items: this.cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                subtotal: total,
                tax: 0,
                total,
                paymentMethod,
                customerPhone,
                customerName,
                type: 'sale'
            };

            await this.db.addTransaction(transactionData);
            this.cart = [];
            this.updateCartDisplay();
            this.loadSalesInterface();
            this.loadDashboard();
            this.showToast(`Sale completed! Total: $${total.toFixed(2)}`);
        } catch (error) {
            console.error('Sale error:', error);
            this.showToast(error.message || 'Transaction failed', 'error');
        }
    }

    async loadCustomers() {
        try {
            const customers = await this.db.getAllCustomers();
            const container = document.getElementById('customerList');
            if (!container) return;

            if (customers.length === 0) {
                container.innerHTML = '<p class="text-slate-400 text-center py-8">No customer accounts created</p>';
                return;
            }

            container.innerHTML = customers.map(c => `
                <div onclick="app.selectCustomer('${c.phone}')" class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/30 cursor-pointer flex justify-between items-center">
                    <div>
                        <p class="font-bold text-slate-200">${c.name}</p>
                        <p class="text-xs text-slate-400">${c.phone}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold ${c.debt > 0 ? 'text-rose-400' : 'text-emerald-400'}">$${(c.debt || 0).toFixed(2)}</p>
                        <span class="text-xs text-slate-400">${c.debt > 0 ? 'Outstanding' : 'Balanced'}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Customer load error:', error);
        }
    }

    async selectCustomer(phone) {
        const customer = await this.db.getCustomer(phone);
        if (!customer) return;
        this.selectedCustomer = customer;

        const details = document.getElementById('customerDetails');
        details.innerHTML = `
            <div class="space-y-4">
                <div>
                    <h3 class="text-lg font-bold text-slate-200">${customer.name}</h3>
                    <p class="text-sm text-slate-400">${customer.phone}</p>
                </div>
                <div class="p-3 bg-slate-800/60 rounded-lg flex justify-between items-center">
                    <span class="text-slate-400">Current Balance:</span>
                    <span class="font-bold text-lg ${customer.debt > 0 ? 'text-rose-400' : 'text-emerald-400'}">$${(customer.debt || 0).toFixed(2)}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="app.showPaymentModal('${customer.phone}')" class="btn btn-primary w-full">Record Payment</button>
                </div>
            </div>
        `;
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
            this.showToast('Customer recorded!');
        } catch (error) {
            this.showToast('Failed to add customer.', 'error');
        }
    }

    showPaymentModal(phone) {
        document.getElementById('paymentCustomerPhone').value = phone;
        document.getElementById('paymentModal').classList.remove('hidden');
    }

    hidePaymentModal() {
        document.getElementById('paymentModal').classList.add('hidden');
        document.getElementById('paymentModalForm').reset();
    }

    async processPaymentSubmission() {
        const phone = document.getElementById('paymentCustomerPhone').value;
        const amount = parseFloat(document.getElementById('paymentAmountInput').value);

        if (isNaN(amount) || amount <= 0) return;

        try {
            const customer = await this.db.getCustomer(phone);
            if (!customer) return;

            customer.debt = Math.max(0, (customer.debt || 0) - amount);
            customer.transactions.push({
                date: new Date().toISOString(),
                amount,
                type: 'payment'
            });

            await this.db.updateCustomer(phone, customer);
            this.hidePaymentModal();
            this.loadCustomers();
            this.selectCustomer(phone);
            this.showToast('Payment credited.');
        } catch (error) {
            this.showToast('Payment failed.', 'error');
        }
    }

    quickStockUpdate(productId) {
        document.getElementById('stockProductId').value = productId;
        document.getElementById('stockModal').classList.remove('hidden');
    }

    hideStockModal() {
        document.getElementById('stockModal').classList.add('hidden');
        document.getElementById('stockModalForm').reset();
    }

    async processStockSubmission() {
        const id = parseInt(document.getElementById('stockProductId').value);
        const qty = parseInt(document.getElementById('stockQtyInput').value);

        if (isNaN(qty) || qty < 0) return;

        try {
            await this.db.updateProduct(id, { quantity: qty });
            this.hideStockModal();
            this.loadProducts();
            this.loadDashboard();
            this.showToast('Stock quantity updated.');
        } catch (error) {
            this.showToast('Stock update failed.', 'error');
        }
    }

    async loadAnalytics() {
        try {
            const transactions = await this.db.getAllTransactions();
            const customers = await this.db.getAllCustomers();
            
            const cashTotal = transactions.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0);
            const debtTotal = customers.reduce((s, c) => s + (c.debt || 0), 0);
            const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);

            this.animateValue('cashInHand', 0, cashTotal, 800, '$');
            this.animateValue('pendingDebtAnalytics', 0, debtTotal, 800, '$');
            this.animateValue('totalRevenue', 0, totalRevenue, 800, '$');

            this.renderRevenueChart(transactions);
        } catch (error) {
            console.error('Analytics load error:', error);
        }
    }

    renderRevenueChart(transactions) {
        const canvas = document.getElementById('analyticsChartCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const days = 7;
        const data = new Array(days).fill(0);
        
        transactions.forEach(t => {
            const diff = Math.floor((new Date() - new Date(t.date)) / (1000 * 3600 * 24));
            if (diff < days) data[days - 1 - diff] += t.total;
        });

        const max = Math.max(...data, 10);
        const stepX = canvas.width / (days - 1);

        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;

        data.forEach((val, i) => {
            const x = i * stepX;
            const y = canvas.height - (val / max) * (canvas.height - 20) - 10;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }

    updateAnalyticsPeriod() {
        this.loadAnalytics();
    }

    filterCustomers(term) {
        const items = document.querySelectorAll('#customerList > div');
        items.forEach(i => i.style.display = i.textContent.toLowerCase().includes(term.toLowerCase()) ? '' : 'none');
    }

    filterSaleProducts(term) {
        const items = document.querySelectorAll('#saleProductList > div');
        items.forEach(i => i.style.display = i.textContent.toLowerCase().includes(term.toLowerCase()) ? '' : 'none');
    }

    async backupData() {
        const data = await this.db.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xecoledger-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await this.db.importData(JSON.parse(text).data);
            this.loadDashboard();
            this.showToast('Data restored!');
        };
        input.click();
    }

    async exportInventory() {
        const products = await this.db.getAllProducts();
        this.downloadCSV(products, 'inventory.csv');
    }

    async exportCustomers() {
        const customers = await this.db.getAllCustomers();
        this.downloadCSV(customers, 'customers.csv');
    }

    downloadCSV(data, filename) {
        if (!data.length) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(r => Object.values(r).map(v => typeof v === 'string' ? `"${v}"` : v).join(','));
        const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    static initialize() {
        return new XecoledgerApp();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = XecoledgerApp.initialize();
});