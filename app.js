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
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            this.loadDashboard();
            console.log('Xecoledger initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Xecoledger:', error);
            alert('Failed to initialize application. Please refresh the page.');
        }
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

        // Sales
        document.getElementById('completeSaleBtn').addEventListener('click', () => {
            this.completeSale();
        });

        // Backup/Restore
        document.getElementById('backupBtn').addEventListener('click', () => {
            this.backupData();
        });

        document.getElementById('restoreBtn').addEventListener('click', () => {
            this.restoreData();
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
        activeBtn.classList.remove('text-gray-600', 'border-transparent');
        activeBtn.classList.add('text-green', 'border-green');

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

            // Update dashboard
            document.getElementById('todaySales').textContent = `$${todaySales.toFixed(2)}`;
            document.getElementById('totalProducts').textContent = products.length;
            document.getElementById('pendingDebt').textContent = `$${pendingDebt.toFixed(2)}`;
            document.getElementById('lowStockCount').textContent = lowStockCount;

            // Load recent transactions
            this.loadRecentTransactions(transactions.slice(-5).reverse());
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    loadRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No transactions yet</p>';
            return;
        }

        container.innerHTML = transactions.map(t => `
            <div class="flex justify-between items-center p-3 border rounded">
                <div>
                    <p class="font-medium">${t.type || 'Sale'}</p>
                    <p class="text-sm text-gray-500">${new Date(t.date).toLocaleString()}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-green">$${t.total.toFixed(2)}</p>
                    <p class="text-sm text-gray-500">${t.paymentMethod}</p>
                </div>
            </div>
        `).join('');
    }

    async loadProducts() {
        try {
            const products = await this.db.getAllProducts();
            const tbody = document.getElementById('productTableBody');
            
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No products yet</td></tr>';
                return;
            }

            tbody.innerHTML = products.map(product => `
                <tr class="border-b ${product.quantity <= product.minStock ? 'bg-red-50' : ''}">
                    <td class="py-2">
                        <div>
                            <p class="font-medium">${product.name}</p>
                            <p class="text-sm text-gray-500">${product.category}</p>
                        </div>
                    </td>
                    <td class="py-2">
                        <span class="${product.quantity <= product.minStock ? 'text-red font-bold' : ''}">
                            ${product.quantity}
                        </span>
                        ${product.quantity <= product.minStock ? '<span class="text-xs text-red ml-1">LOW</span>' : ''}
                    </td>
                    <td class="py-2">$${product.sellingPrice.toFixed(2)}</td>
                    <td class="py-2">
                        <button onclick="app.editProduct(${product.id})" class="text-blue hover:underline mr-2">Edit</button>
                        <button onclick="app.deleteProduct(${product.id})" class="text-red hover:underline">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading products:', error);
        }
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
                productList.innerHTML = '<p class="text-gray-500 text-center py-8">No products available</p>';
            } else {
                productList.innerHTML = products
                    .filter(p => p.quantity > 0)
                    .map(product => `
                        <div class="flex justify-between items-center p-2 border rounded hover:bg-gray-50 cursor-pointer" 
                             onclick="app.addToCart(${product.id})">
                            <div>
                                <p class="font-medium">${product.name}</p>
                                <p class="text-sm text-gray-500">Stock: ${product.quantity}</p>
                            </div>
                            <p class="font-bold text-green">$${product.sellingPrice.toFixed(2)}</p>
                        </div>
                    `).join('');
            }

            // Load customers
            const customerSelect = document.getElementById('customerSelect');
            if (customers.length === 0) {
                customerSelect.innerHTML = '<option value="">Walk-in Customer</option>';
            } else {
                customerSelect.innerHTML = '<option value="">Walk-in Customer</option>' +
                    customers.map(c => `<option value="${c.phone}">${c.name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading sales interface:', error);
        }
    }

    addToCart(productId) {
        // This would be implemented with proper cart management
        console.log('Add to cart:', productId);
    }

    async completeSale() {
        // This would be implemented with proper sale completion logic
        console.log('Complete sale');
    }

    async loadCustomers() {
        try {
            const customers = await this.db.getAllCustomers();
            const container = document.getElementById('customerList');
            
            if (customers.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">No customers yet</p>';
                return;
            }

            container.innerHTML = customers.map(customer => `
                <div class="border rounded p-4 hover:bg-gray-50">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold">${customer.name}</p>
                            <p class="text-gray-500">${customer.phone}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold ${customer.debt > 0 ? 'text-red' : 'text-green'}">
                                $${(customer.debt || 0).toFixed(2)}
                            </p>
                            <p class="text-sm text-gray-500">${customer.debt > 0 ? 'Debt' : 'Clear'}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading customers:', error);
        }
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
                debt: 0,
                createdAt: new Date().toISOString()
            };

            await this.db.addCustomer(customer);
            this.hideCustomerModal();
            this.loadCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Failed to save customer. Please try again.');
        }
    }

    async loadAnalytics() {
        try {
            const transactions = await this.db.getAllTransactions();
            const customers = await this.db.getAllCustomers();
            
            // Calculate analytics
            const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
            const cashInHand = cashTransactions.reduce((sum, t) => sum + t.total, 0);
            const pendingDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
            const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);

            document.getElementById('cashInHand').textContent = `$${cashInHand.toFixed(2)}`;
            document.getElementById('pendingDebtAnalytics').textContent = `$${pendingDebt.toFixed(2)}`;
            document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
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
        } catch (error) {
            console.error('Error backing up data:', error);
            alert('Failed to backup data. Please try again.');
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
                    alert('Data restored successfully!');
                    this.loadDashboard();
                }
            } catch (error) {
                console.error('Error restoring data:', error);
                alert('Failed to restore data. Please check the file format.');
            }
        };
        
        input.click();
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new XecoledgerApp();
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}
