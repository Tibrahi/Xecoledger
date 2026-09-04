class XecoledgerSystem {
    constructor() {
        this.products = JSON.parse(localStorage.getItem('xl_products')) || [];
        this.customers = JSON.parse(localStorage.getItem('xl_customers')) || [];
        this.sales = JSON.parse(localStorage.getItem('xl_sales')) || [];
        this.cart = [];
        this.selectedCustomer = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderAll();
    }

    save() {
        localStorage.setItem('xl_products', JSON.stringify(this.products));
        localStorage.setItem('xl_customers', JSON.stringify(this.customers));
        localStorage.setItem('xl_sales', JSON.stringify(this.sales));
        this.renderAll();
    }

    renderAll() {
        this.renderDashboard();
        this.renderInventory();
        this.renderSalesInterface();
        this.renderCustomers();
        this.renderAnalytics();
    }

    bindEvents() {
        // Navigation Tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.tab;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav'));
                e.currentTarget.classList.add('active-nav');
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
                document.getElementById(target)?.classList.remove('hidden');
            });
        });

        // Search Inputs
        document.getElementById('productSearch')?.addEventListener('input', () => this.renderInventory());
        document.getElementById('categoryFilter')?.addEventListener('change', () => this.renderInventory());
        document.getElementById('saleProductSearch')?.addEventListener('input', () => this.renderSalesInterface());
        document.getElementById('customerSearch')?.addEventListener('input', () => this.renderCustomers());

        // Modals
        document.getElementById('addProductBtn')?.addEventListener('click', () => this.openProductModal());
        document.getElementById('cancelProductBtn')?.addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('addCustomerBtn')?.addEventListener('click', () => this.openModal('customerModal'));
        document.getElementById('cancelCustomerBtn')?.addEventListener('click', () => this.closeModal('customerModal'));

        // Form Submissions
        document.getElementById('productForm')?.addEventListener('submit', (e) => this.handleProductSubmit(e));
        document.getElementById('customerForm')?.addEventListener('submit', (e) => this.handleCustomerSubmit(e));

        // Cart Actions
        document.getElementById('clearCartBtn')?.addEventListener('click', () => {
            this.cart = [];
            this.updateCart();
        });
        document.getElementById('completeSaleBtn')?.addEventListener('click', () => this.completeSale());

        // Import & Export
        document.getElementById('backupBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('restoreBtn')?.addEventListener('click', () => document.getElementById('restoreInput').click());
        document.getElementById('restoreInput')?.addEventListener('change', (e) => this.importData(e));
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toastIcon');
        document.getElementById('toastMessage').textContent = message;
        
        icon.innerHTML = type === 'success' 
            ? '<i class="fa-solid fa-circle-check text-emerald-400"></i>' 
            : '<i class="fa-solid fa-circle-xmark text-rose-400"></i>';

        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
    closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

    // --- DASHBOARD ---
    renderDashboard() {
        const todayStr = new Date().toDateString();
        const todaySales = this.sales
            .filter(s => new Date(s.date).toDateString() === todayStr)
            .reduce((sum, s) => sum + s.total, 0);

        const totalDebt = this.customers.reduce((sum, c) => sum + (c.debt || 0), 0);
        const lowStock = this.products.filter(p => p.quantity <= p.minStock).length;

        document.getElementById('todaySales').textContent = `$${todaySales.toFixed(2)}`;
        document.getElementById('totalProducts').textContent = this.products.length;
        document.getElementById('pendingDebt').textContent = `$${totalDebt.toFixed(2)}`;
        document.getElementById('lowStockCount').textContent = lowStock;

        const recent = [...this.sales].reverse().slice(0, 5);
        const container = document.getElementById('recentTransactions');
        
        if (recent.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-center py-4">No recent transactions recorded</p>`;
            return;
        }

        container.innerHTML = recent.map(s => `
            <div class="flex justify-between items-center p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-receipt text-slate-400"></i>
                    <div>
                        <p class="text-sm font-semibold text-slate-200">Order #${s.id}</p>
                        <p class="text-xs text-slate-400">${new Date(s.date).toLocaleString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-emerald-400">$${s.total.toFixed(2)}</p>
                    <p class="text-xs text-slate-400 capitalize">${s.paymentMethod}</p>
                </div>
            </div>
        `).join('');
    }

    // --- INVENTORY ---
    openProductModal(product = null) {
        document.getElementById('productForm').reset();
        if (product) {
            document.getElementById('productModalTitle').textContent = 'Edit Product';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productQuantity').value = product.quantity;
            document.getElementById('productMinStock').value = product.minStock;
            document.getElementById('productCost').value = product.costPrice;
            document.getElementById('productPrice').value = product.sellingPrice;
        } else {
            document.getElementById('productModalTitle').textContent = 'Add Product';
            document.getElementById('productId').value = '';
        }
        this.openModal('productModal');
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const newProduct = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            quantity: parseInt(document.getElementById('productQuantity').value),
            minStock: parseInt(document.getElementById('productMinStock').value),
            costPrice: parseFloat(document.getElementById('productCost').value),
            sellingPrice: parseFloat(document.getElementById('productPrice').value)
        };

        if (id) {
            const idx = this.products.findIndex(p => p.id === parseInt(id));
            if (idx !== -1) this.products[idx] = newProduct;
        } else {
            this.products.push(newProduct);
        }

        this.closeModal('productModal');
        this.save();
        this.showToast('Product saved successfully');
    }

    deleteProduct(id) {
        this.products = this.products.filter(p => p.id !== id);
        this.save();
        this.showToast('Product deleted');
    }

    renderInventory() {
        const search = document.getElementById('productSearch')?.value.toLowerCase() || '';
        const category = document.getElementById('categoryFilter')?.value || '';
        const tbody = document.getElementById('productTableBody');

        // Populate Category Filter
        const categories = [...new Set(this.products.map(p => p.category))];
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
                categories.map(c => `<option value="${c}">${c}</option>`).join('');
            categoryFilter.value = category;
        }

        const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(search) &&
            (category === '' || p.category === category)
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">No products available</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(p => `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td class="p-3 font-medium text-slate-200">${p.name}</td>
                <td class="p-3 text-slate-400">${p.category}</td>
                <td class="p-3">
                    <span class="px-2 py-1 text-xs rounded ${p.quantity <= p.minStock ? 'bg-rose-500/20 text-rose-400 font-bold' : 'bg-slate-800 text-slate-300'}">
                        ${p.quantity} Qty
                    </span>
                </td>
                <td class="p-3 text-slate-400">$${p.costPrice.toFixed(2)}</td>
                <td class="p-3 text-emerald-400 font-bold">$${p.sellingPrice.toFixed(2)}</td>
                <td class="p-3 text-slate-300">$${(p.quantity * p.sellingPrice).toFixed(2)}</td>
                <td class="p-3 flex gap-3">
                    <button onclick="app.openProductModal(app.products.find(p=>p.id===${p.id}))" class="text-slate-400 hover:text-emerald-400">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="app.deleteProduct(${p.id})" class="text-slate-400 hover:text-rose-400">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // --- SALES ENGINE ---
    renderSalesInterface() {
        const search = document.getElementById('saleProductSearch')?.value.toLowerCase() || '';
        const container = document.getElementById('saleProductList');
        const customerSelect = document.getElementById('customerSelect');

        // Customer Select Dropdown Sync
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">Select Customer</option>' +
                this.customers.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('');
        }

        const filtered = this.products.filter(p => p.name.toLowerCase().includes(search) && p.quantity > 0);

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-center py-6 text-slate-500">No stock available</p>`;
            return;
        }

        container.innerHTML = filtered.map(p => `
            <div onclick="app.addToCart(${p.id})" class="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg hover:border-emerald-500/50 cursor-pointer flex justify-between items-center">
                <div>
                    <p class="font-medium text-slate-200 text-sm">${p.name}</p>
                    <p class="text-xs text-slate-400">Available: ${p.quantity}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-emerald-400 text-sm">$${p.sellingPrice.toFixed(2)}</span>
                    <i class="fa-solid fa-plus text-xs bg-emerald-500/10 text-emerald-400 p-2 rounded"></i>
                </div>
            </div>
        `).join('');
    }

    addToCart(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;

        const cartItem = this.cart.find(item => item.id === id);
        if (cartItem) {
            if (cartItem.quantity + 1 > product.quantity) {
                this.showToast('Not enough stock available', 'error');
                return;
            }
            cartItem.quantity++;
        } else {
            this.cart.push({ id: product.id, name: product.name, price: product.sellingPrice, cost: product.costPrice, quantity: 1 });
        }
        this.updateCart();
    }

    updateCart() {
        const container = document.getElementById('cartItems');
        const totalElem = document.getElementById('cartTotal');
        const countElem = document.getElementById('cartCount');

        if (this.cart.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-center py-8">Cart is empty</p>`;
            totalElem.textContent = '$0.00';
            countElem.textContent = '0 items';
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        container.innerHTML = this.cart.map((item, idx) => `
            <div class="flex justify-between items-center p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                <div>
                    <p class="text-sm font-medium text-slate-200">${item.name}</p>
                    <p class="text-xs text-slate-400">$${item.price.toFixed(2)} each</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="app.adjustCartQty(${idx}, -1)" class="w-6 h-6 bg-slate-700 rounded text-xs flex items-center justify-center text-slate-200"><i class="fa-solid fa-minus"></i></button>
                    <span class="text-sm font-bold px-2">${item.quantity}</span>
                    <button onclick="app.adjustCartQty(${idx}, 1)" class="w-6 h-6 bg-slate-700 rounded text-xs flex items-center justify-center text-slate-200"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="app.removeFromCart(${idx})" class="text-slate-500 hover:text-rose-400 ml-2"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join('');

        totalElem.textContent = `$${total.toFixed(2)}`;
        countElem.textContent = `${count} item${count > 1 ? 's' : ''}`;
    }

    adjustCartQty(idx, delta) {
        const item = this.cart[idx];
        const product = this.products.find(p => p.id === item.id);

        if (delta > 0 && item.quantity + 1 > product.quantity) {
            this.showToast('Exceeds stock limits', 'error');
            return;
        }

        item.quantity += delta;
        if (item.quantity <= 0) this.cart.splice(idx, 1);
        this.updateCart();
    }

    removeFromCart(idx) {
        this.cart.splice(idx, 1);
        this.updateCart();
    }

    completeSale() {
        if (this.cart.length === 0) {
            this.showToast('Add items to cart before completing sale', 'error');
            return;
        }

        const paymentMethod = document.getElementById('paymentMethod').value;
        const customerId = document.getElementById('customerSelect').value;

        if (paymentMethod === 'credit' && !customerId) {
            this.showToast('Please select a customer for Credit Ledger sales', 'error');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const profit = this.cart.reduce((sum, item) => sum + ((item.price - item.cost) * item.quantity), 0);

        // Deduct inventory
        this.cart.forEach(item => {
            const product = this.products.find(p => p.id === item.id);
            if (product) product.quantity -= item.quantity;
        });

        // Add Customer Debt if payment is Credit
        if (paymentMethod === 'credit' && customerId) {
            const customer = this.customers.find(c => c.id === parseInt(customerId));
            if (customer) {
                customer.debt = (customer.debt || 0) + total;
                customer.history = customer.history || [];
                customer.history.push({
                    date: new Date().toISOString(),
                    type: 'DEBT_ADDED',
                    amount: total,
                    note: 'Credit Purchase'
                });
            }
        }

        // Record Sale
        const saleRecord = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: [...this.cart],
            total: total,
            profit: profit,
            paymentMethod: paymentMethod,
            customerId: customerId ? parseInt(customerId) : null
        };

        this.sales.push(saleRecord);
        this.cart = [];
        this.updateCart();
        this.save();
        this.showToast('Sale completed successfully');
    }

    // --- CREDIT LEDGER ---
    handleCustomerSubmit(e) {
        e.preventDefault();
        const newCustomer = {
            id: Date.now(),
            name: document.getElementById('customerName').value,
            phone: document.getElementById('customerPhone').value,
            email: document.getElementById('customerEmail').value,
            debt: 0,
            history: []
        };
        this.customers.push(newCustomer);
        this.closeModal('customerModal');
        this.save();
        this.showToast('Customer registered');
    }

    renderCustomers() {
        const search = document.getElementById('customerSearch')?.value.toLowerCase() || '';
        const container = document.getElementById('customerList');

        const filtered = this.customers.filter(c => 
            c.name.toLowerCase().includes(search) || c.phone.includes(search)
        );

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-center py-6 text-slate-500">No customers found</p>`;
            return;
        }

        container.innerHTML = filtered.map(c => `
            <div onclick="app.selectCustomer(${c.id})" class="p-3 bg-slate-800/40 border ${this.selectedCustomer?.id === c.id ? 'border-emerald-500' : 'border-slate-700/50'} rounded-lg cursor-pointer flex justify-between items-center hover:border-emerald-500/50">
                <div>
                    <p class="font-medium text-slate-200 text-sm">${c.name}</p>
                    <p class="text-xs text-slate-400">${c.phone}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold ${c.debt > 0 ? 'text-rose-400' : 'text-emerald-400'}">$${(c.debt || 0).toFixed(2)}</p>
                    <p class="text-[10px] text-slate-500">Debt</p>
                </div>
            </div>
        `).join('');
    }

    selectCustomer(id) {
        this.selectedCustomer = this.customers.find(c => c.id === id);
        this.renderCustomers();

        const placeholder = document.getElementById('customerDetailsPlaceholder');
        const content = document.getElementById('customerDetailsContent');

        if (!this.selectedCustomer) {
            placeholder.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        placeholder.classList.add('hidden');
        content.classList.remove('hidden');

        content.innerHTML = `
            <div class="flex justify-between items-start border-b border-slate-700/50 pb-4">
                <div>
                    <h3 class="text-xl font-bold text-slate-100">${this.selectedCustomer.name}</h3>
                    <p class="text-xs text-slate-400"><i class="fa-solid fa-phone mr-1"></i>${this.selectedCustomer.phone}</p>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-bold text-rose-400">$${(this.selectedCustomer.debt || 0).toFixed(2)}</p>
                    <p class="text-xs text-slate-400">Total Outstanding Debt</p>
                </div>
            </div>

            <div class="space-y-3">
                <h4 class="text-sm font-semibold text-slate-300">Settle Balance</h4>
                <div class="flex gap-2">
                    <input type="number" id="paymentAmountInput" placeholder="Amount ($)" class="input-field">
                    <button onclick="app.processDebtPayment()" class="btn btn-primary flex items-center gap-2 whitespace-nowrap">
                        <i class="fa-solid fa-hand-holding-dollar"></i> Record Payment
                    </button>
                </div>
            </div>

            <div class="space-y-3">
                <h4 class="text-sm font-semibold text-slate-300">Ledger Activity</h4>
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    ${(this.selectedCustomer.history || []).slice().reverse().map(h => `
                        <div class="flex justify-between items-center p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-xs">
                            <div>
                                <p class="font-medium ${h.type === 'DEBT_ADDED' ? 'text-rose-400' : 'text-emerald-400'}">${h.note}</p>
                                <p class="text-[10px] text-slate-500">${new Date(h.date).toLocaleString()}</p>
                            </div>
                            <span class="font-bold text-sm ${h.type === 'DEBT_ADDED' ? 'text-rose-400' : 'text-emerald-400'}">
                                ${h.type === 'DEBT_ADDED' ? '+' : '-'}$${h.amount.toFixed(2)}
                            </span>
                        </div>
                    `).join('') || '<p class="text-slate-500 text-xs">No ledger history available.</p>'}
                </div>
            </div>
        `;
    }

    processDebtPayment() {
        const input = document.getElementById('paymentAmountInput');
        const amount = parseFloat(input?.value);

        if (!amount || amount <= 0 || !this.selectedCustomer) {
            this.showToast('Please enter a valid payment amount', 'error');
            return;
        }

        this.selectedCustomer.debt = Math.max(0, (this.selectedCustomer.debt || 0) - amount);
        this.selectedCustomer.history = this.selectedCustomer.history || [];
        this.selectedCustomer.history.push({
            date: new Date().toISOString(),
            type: 'PAYMENT_MADE',
            amount: amount,
            note: 'Debt Settlement'
        });

        this.save();
        this.selectCustomer(this.selectedCustomer.id);
        this.showToast('Payment recorded successfully');
    }

    // --- ANALYTICS ---
    renderAnalytics() {
        const totalProfit = this.sales.reduce((sum, s) => sum + (s.profit || 0), 0);
        const valuation = this.products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0);

        document.getElementById('totalProfitMetric').textContent = `$${totalProfit.toFixed(2)}`;
        document.getElementById('inventoryValuationMetric').textContent = `$${valuation.toFixed(2)}`;
        document.getElementById('totalSalesCountMetric').textContent = this.sales.length;
    }

    // --- BACKUP & RESTORE ---
    exportData() {
        const data = {
            products: this.products,
            customers: this.customers,
            sales: this.sales
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xecoledger_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.products && data.customers && data.sales) {
                    this.products = data.products;
                    this.customers = data.customers;
                    this.sales = data.sales;
                    this.save();
                    this.showToast('Database imported successfully');
                } else {
                    this.showToast('Invalid backup file format', 'error');
                }
            } catch (err) {
                this.showToast('Failed to parse backup JSON file', 'error');
            }
        };
        reader.readAsText(file);
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new XecoledgerSystem();
});