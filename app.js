// Dynamic Rendering Method Adjustments with FontAwesome Icons
class XecoledgerApp {
    // ... Database methods remain identical ...

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

    async loadProducts() {
        try {
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
                            <div class="flex space-x-3">
                                <button onclick="app.editProduct(${product.id})" class="text-slate-400 hover:text-emerald-400" title="Edit">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="app.quickStockUpdate(${product.id})" class="text-slate-400 hover:text-sky-400" title="Update Stock">
                                    <i class="fa-solid fa-layer-group"></i>
                                </button>
                                <button onclick="app.deleteProduct(${product.id})" class="text-slate-400 hover:text-rose-400" title="Delete">
                                    <i class="fa-solid fa-trash-can"></i>
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
                        <div class="text-right flex items-center space-x-2">
                            <p class="font-bold text-emerald-400 mr-2">$${product.sellingPrice.toFixed(2)}</p>
                            <span class="text-xs bg-emerald-500/10 text-emerald-400 p-1.5 rounded"><i class="fa-solid fa-cart-plus"></i></span>
                        </div>
                    </div>
                `).join('');
            }

            const customerSelect = document.getElementById('customerSelect');
            customerSelect.innerHTML = '<option value="">Walk-in Customer</option>' +
                customers.map(c => `<option value="${c.phone}">${c.name} (${c.phone})</option>`).join('');
        } catch (error) {
            console.error('Error loading sales panel:', error);
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
}