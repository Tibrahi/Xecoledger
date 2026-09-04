class Database {
    constructor() {
        this.products = JSON.parse(localStorage.getItem('xecoledger_products')) || [];
        this.customers = JSON.parse(localStorage.getItem('xecoledger_customers')) || [];
        this.sales = JSON.parse(localStorage.getItem('xecoledger_sales')) || [];
    }

    save() {
        localStorage.setItem('xecoledger_products', JSON.stringify(this.products));
        localStorage.setItem('xecoledger_customers', JSON.stringify(this.customers));
        localStorage.setItem('xecoledger_sales', JSON.stringify(this.sales));
    }

    async getAllProducts() { return this.products; }
    async getAllCustomers() { return this.customers; }
    async getAllSales() { return this.sales; }

    async addProduct(product) {
        product.id = Date.now();
        this.products.push(product);
        this.save();
        return product;
    }

    async updateProduct(id, updated) {
        const idx = this.products.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.products[idx] = { ...this.products[idx], ...updated };
            this.save();
        }
    }

    async deleteProduct(id) {
        this.products = this.products.filter(p => p.id !== id);
        this.save();
    }

    async addCustomer(customer) {
        this.customers.push({ ...customer, id: Date.now(), balance: 0 });
        this.save();
    }

    async addSale(sale) {
        sale.id = Date.now();
        sale.date = new Date().toISOString();
        this.sales.push(sale);
        
        // Stock subtraction
        sale.items.forEach(item => {
            const prod = this.products.find(p => p.id === item.id);
            if (prod) prod.quantity -= item.quantity;
        });

        this.save();
        return sale;
    }
}

class XecoledgerApp {
    constructor() {
        this.db = new Database();
        this.cart = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadSalesInterface();
        await this.loadCustomers();
    }

    bindEvents() {
        // Navigation Tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav', 'text-emerald-400'));
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.add('text-slate-400'));
                e.currentTarget.classList.add('active-nav');
                
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
                document.getElementById(targetTab)?.classList.remove('hidden');
            });
        });

        // Modals Toggle
        document.getElementById('addProductBtn')?.addEventListener('click', () => {
            document.getElementById('productForm').reset();
            document.getElementById('productModal').classList.remove('hidden');
        });

        document.getElementById('cancelProductBtn')?.addEventListener('click', () => {
            document.getElementById('productModal').classList.add('hidden');
        });

        document.getElementById('addCustomerBtn')?.addEventListener('click', () => {
            document.getElementById('customerForm').reset();
            document.getElementById('customerModal').classList.remove('hidden');
        });

        document.getElementById('cancelCustomerBtn')?.addEventListener('click', () => {
            document.getElementById('customerModal').classList.add('hidden');
        });

        document.getElementById('cancelStockBtn')?.addEventListener('click', () => {
            document.getElementById('stockModal').classList.add('hidden');
        });

        // Form Submit Actions
        document.getElementById('productForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const product = {
                name: document.getElementById('productName').value,
                category: document.getElementById('productCategory').value,
                quantity: parseInt(document.getElementById('productQuantity').value),
                minStock: parseInt(document.getElementById('productMinStock').value),
                costPrice: parseFloat(document.getElementById('productCost').value),
                sellingPrice: parseFloat(document.getElementById('productPrice').value)
            };
            await this.db.addProduct(product);
            document.getElementById('productModal').classList.add('hidden');
            this.showToast('Product created successfully');
            await this.refreshAll();
        });

        document.getElementById('customerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const customer = {
                name: document.getElementById('customerName').value,
                phone: document.getElementById('customerPhone').value,
                email: document.getElementById('customerEmail').value,
                address: document.getElementById('customerAddress').value
            };
            await this.db.addCustomer(customer);
            document.getElementById('customerModal').classList.add('hidden');
            this.showToast('Customer account added');
            await this.refreshAll();
        });

        document.getElementById('completeSaleBtn')?.addEventListener('click', () => this.processSale());
        document.getElementById('clearCartBtn')?.addEventListener('click', () => {
            this.cart = [];
            this.updateCartDisplay();
        });
    }

    async refreshAll() {
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadSalesInterface();
        await this.loadCustomers();
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');
        
        if (!toast) return;
        toastMessage.textContent = message;
        toastIcon.innerHTML = type === 'success' 
            ? '<i class="fa-solid fa-circle-check text-emerald-400"></i>' 
            : '<i class="fa-solid fa-circle-xmark text-rose-400"></i>';
        
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    async loadDashboard() {
        const products = await this.db.getAllProducts();
        const sales = await this.db.getAllSales();
        
        const todayStr = new Date().toDateString();
        const todayTotal = sales
            .filter(s => new Date(s.date).toDateString() === todayStr)
            .reduce((sum, s) => sum + s.total, 0);

        const lowStock = products.filter(p => p.quantity <= p.minStock).length;

        document.getElementById('todaySales').textContent = `$${todayTotal.toFixed(2)}`;
        document.getElementById('totalProducts').textContent = products.length;
        document.getElementById('lowStockCount').textContent = lowStock;

        this.loadRecentTransactions(sales.slice(-5).reverse());
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
                    <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-slate-300">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div>
                        <p class="font-medium text-slate-200">Sale #${t.id}</p>
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

    async loadProducts() {
        const products = await this.db.getAllProducts();
        const tbody = document.getElementById('productTableBody');
        if (!tbody) return;
        
        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-400">
                <div class="text-3xl mb-2"><i class="fa-solid fa-box-open"></i></div>
                <p class="font-medium">No products in inventory</p>
            </td></tr>`;
            return;
        }

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
                        <div class="flex space-x-3">
                            <button onclick="app.deleteProduct(${product.id})" class="text-slate-400 hover:text-rose-400" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadSalesInterface() {
        const products = await this.db.getAllProducts();
        const customers = await this.db.getAllCustomers();
        const productList = document.getElementById('saleProductList');
        
        if (!productList) return;

        if (products.length === 0) {
            productList.innerHTML = '<p class="text-slate-400 text-center py-6">No inventory found.</p>';
        } else {
            productList.innerHTML = products.filter(p => p.quantity > 0).map(product => `
                <div onclick="app.addToCart(${product.id})" class="flex justify-between items-center p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/50 cursor-pointer">
                    <div>
                        <p class="font-medium text-slate-200">${product.name}</p>
                        <p class="text-xs text-slate-400">Stock: ${product.quantity}</p>
                    </div>
                    <div class="text-right flex items-center space-x-2">
                        <p class="font-bold text-emerald-400 mr-2">$${product.sellingPrice.toFixed(2)}</p>
                        <span class="text-xs bg-emerald-500/10 text-emerald-400 p-1.5 rounded"><i class="fa-solid fa-cart-plus"></i></span>
                    </div>
                </div>
            `).join('');
        }

        const customerSelect = document.getElementById('customerSelect');
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">Walk-in Customer</option>' +
                customers.map(c => `<option value="${c.phone}">${c.name} (${c.phone})</option>`).join('');
        }
    }

    async addToCart(productId) {
        const products = await this.db.getAllProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(item => item.id === productId);
        if (existing) {
            if (existing.quantity + 1 > product.quantity) {
                this.showToast('Exceeds available stock', 'error');
                return;
            }
            existing.quantity++;
        } else {
            this.cart.push({ id: product.id, name: product.name, price: product.sellingPrice, quantity: 1 });
        }
        this.updateCartDisplay();
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const cartCount = document.getElementById('cartCount');

        if (!cartItems) return;

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
                    <button onclick="app.updateCartQty(${idx}, -1)" class="w-6 h-6 bg-slate-700 rounded text-slate-200 flex items-center justify-center">
                        <i class="fa-solid fa-minus text-xs"></i>
                    </button>
                    <span class="text-slate-200 font-medium">${item.quantity}</span>
                    <button onclick="app.updateCartQty(${idx}, 1)" class="w-6 h-6 bg-slate-700 rounded text-slate-200 flex items-center justify-center">
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                    <button onclick="app.removeFromCart(${idx})" class="text-slate-400 hover:text-rose-400 ml-2">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `).join('');

        cartTotal.textContent = `$${total.toFixed(2)}`;
        cartCount.textContent = `${count} item${count > 1 ? 's' : ''}`;
    }

    updateCartQty(index, delta) {
        if (this.cart[index]) {
            this.cart[index].quantity += delta;
            if (this.cart[index].quantity <= 0) {
                this.cart.splice(index, 1);
            }
            this.updateCartDisplay();
        }
    }

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCartDisplay();
    }

    async processSale() {
        if (this.cart.length === 0) {
            this.showToast('Cart is empty', 'error');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const paymentMethod = document.getElementById('paymentMethod').value;
        const customerPhone = document.getElementById('customerSelect').value;

        const sale = {
            items: [...this.cart],
            total: total,
            paymentMethod: paymentMethod,
            customerPhone: customerPhone
        };

        await this.db.addSale(sale);
        this.cart = [];
        this.updateCartDisplay();
        this.showToast('Sale completed successfully');
        await this.refreshAll();
    }

    async loadCustomers() {
        const customers = await this.db.getAllCustomers();
        const container = document.getElementById('customerList');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-center py-8">No customer accounts registered</p>';
            return;
        }

        container.innerHTML = customers.map(c => `
            <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-slate-300">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                        <p class="font-medium text-slate-200">${c.name}</p>
                        <p class="text-xs text-slate-400">${c.phone}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-slate-200">$${(c.balance || 0).toFixed(2)}</p>
                    <p class="text-xs text-slate-400">Balance</p>
                </div>
            </div>
        `).join('');
    }

    async deleteProduct(id) {
        await this.db.deleteProduct(id);
        this.showToast('Product deleted');
        await this.refreshAll();
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new XecoledgerApp();
});