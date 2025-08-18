// Quick Add Script
(() => {
  class QuickAddPopup {
    constructor({
      popupSelector = '#quickadd-popup',
      bodySelector = '#quickadd-body',
      ctaSelector = '.quickadd-cta'
    } = {}) {
      this.popup = document.querySelector(popupSelector);
      if (!this.popup) throw new Error(`Popup not found: ${popupSelector}`);
      this.body = this.popup.querySelector(bodySelector) || this.popup;
      this.overlay = this.popup.querySelector('.quickadd-overlay');
      this.closeBtn = this.popup.querySelector('.quickadd-close');
      this.ctaSelector = ctaSelector;

      this.cache = new Map();       // cache products by handle
      this.product = null;          // current product JSON
      this.currentVariant = null;   // current resolved variant
      this.bound = false;

      this._bindStatic();
    }

    init() {
      // handle CTA clicks anywhere on the page (event delegation)
      document.addEventListener('click', (e) => {
        const cta = e.target.closest(this.ctaSelector);
        if (!cta) return;
        e.preventDefault();
        const handle = cta.dataset.handle;
        if (handle) this.open(handle);
      });
    }

    _bindStatic() {
      if (this.overlay) this.overlay.addEventListener('click', () => this.close());
      if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

      // Single delegated listener inside popup body
      this.body.addEventListener('click', (e) => {
        // Swatch select
        const swatch = e.target.closest('.custom-swatch');
        if (swatch) {
          const wrapper = swatch.closest('.swatches');
          if (wrapper) {
            wrapper.querySelectorAll('.custom-swatch').forEach(b => b.classList.remove('active'));
            swatch.classList.add('active');
            this._updateVariantFromSelections();
          }
          return;
        }

        // Dropdown toggle
        const toggle = e.target.closest('.dropdown-toggle');
        if (toggle) {
          const dd = toggle.closest('.custom-dropdown');
          dd?.classList.toggle('open');
          return;
        }

        // Dropdown item select
        if (e.target.tagName === 'LI' && e.target.closest('.dropdown-menu')) {
          const li = e.target;
          const dd = li.closest('.custom-dropdown');
          if (dd) {
            dd.dataset.selected = li.dataset.value;
            const labelEl = dd.querySelector('.dropdown-toggle .selected-size');
            if (labelEl) labelEl.textContent = li.dataset.value;
            dd.classList.remove('open');
            this._updateVariantFromSelections();
          }
          return;
        }

        // Add to Cart
        const addBtn = e.target.closest('.add-to-cart');
        if (addBtn) {
          this._handleAddToCart(addBtn);
        }
      });

      // Close on ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.popup.classList.contains('active')) this.close();
      });
    }

    async open(handle) {
      try {
        const product = await this._getProduct(handle);
        this.product = product;
        this._render(product);
        this._preselectInitialVariant(product);
        this._updateVariantFromSelections(); // sets id/price/image/availability
        this.popup.classList.add('active');
        this.popup.setAttribute('aria-hidden', 'false');
      } catch (err) {
        console.error('QuickAdd open error:', err);
        alert('Sorry, something went wrong loading this product.');
      }
    }

    close() {
      this.popup.classList.remove('active');
      this.popup.setAttribute('aria-hidden', 'true');
      // optional cleanup if needed
    }

    async _getProduct(handle) {
      if (this.cache.has(handle)) return this.cache.get(handle);
      const res = await fetch(`/products/${handle}.js`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
      const product = await res.json();
      this.cache.set(handle, product);
      return product;
    }

    _render(product) {
      const priceHtml = this._formatMoney((product.price ?? product.variants[0]?.price ?? 0));
      const imgSrc = product?.images?.[0] || '';

      this.body.innerHTML = `
        <div class="quick-popup-content">
          <img class="quick-image" src="${imgSrc}" alt="${this._escape(product.title)}">
          <div class="product-details-inner">
            <h3 class="quick-title">${this._escape(product.title)}</h3>
            <p class="quick-price">${priceHtml}</p>
            <div class="product-description">${this._shortenDesc(product.description || '')}</div>
          </div>
        </div>

        ${this._renderOptions(product)}

        <button class="add-to-cart button-primary button-dark" data-id="" disabled>
          Add to Cart
          <svg width="69" height="30" viewBox="0 0 69 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.75879 13.1458L0.758789 13.1458L0.758789 17.1458L2.75879 17.1458L2.75879 15.1458L2.75879 13.1458ZM68.173 16.56C68.9541 15.779 68.9541 14.5127 68.173 13.7316L55.4451 1.00368C54.664 0.222633 53.3977 0.222633 52.6167 1.00368C51.8356 1.78473 51.8356 3.05106 52.6167 3.83211L63.9304 15.1458L52.6167 26.4595C51.8356 27.2406 51.8356 28.5069 52.6167 29.288C53.3977 30.069 54.664 30.069 55.4451 29.288L68.173 16.56ZM2.75879 15.1458L2.75879 17.1458L66.7588 17.1458L66.7588 15.1458L66.7588 13.1458L2.75879 13.1458L2.75879 15.1458Z" fill="black"/>
        </svg>
        </button>
      `;
    }

    _renderOptions(product) {
      // product.options is array of { name, position, values }
      if (!Array.isArray(product.options) || !product.options.length) return '';

      const blocks = product.options.map(opt => {
        const name = opt.name;
        if (name.toLowerCase() === 'color') {
          const swatches = (opt.values || []).map(val => `
            <button 
              type="button" 
              class="custom-swatch" 
              data-value="${this._escapeAttr(val)}"
              aria-label="${this._escapeAttr(name)}: ${this._escapeAttr(val)}">
              <span class="swatch-color" style="border:1px solid #000; background:${this._escapeAttr(val)};"></span>
              ${this._escape(val)}
            </button>
          `).join('');

          return `
            <div class="product-option">
              <label>${this._escape(name)}</label>
              <div class="swatches" data-option-name="${this._escapeAttr(name)}">
                ${swatches}
              </div>
            </div>
          `;
        }

        // Non-color → custom dropdown
        const lis = (opt.values || []).map(val => `
          <li data-value="${this._escapeAttr(val)}">${this._escape(val)}</li>
        `).join('');

        return `
          <div class="product-option">
            <label>${this._escape(name)}</label>
            <div class="custom-dropdown" data-option-name="${this._escapeAttr(name)}" data-selected="">
              <button type="button" class="dropdown-toggle">
                <span class="selected-size">Choose your ${this._escape(name)}</span>
                <span class="dropdown-arrow" aria-hidden="true">
                  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2L8 8L14 2" stroke="black" stroke-width="1.5" stroke-linecap="square"/>
                  </svg>
                </span>
              </button>
              <ul class="dropdown-menu" role="listbox">
                ${lis}
              </ul>
            </div>
          </div>
        `;
      }).join('');

      return `<div class="product-options-wrapper">${blocks}</div>`;
    }

    _preselectInitialVariant(product) {
      // Use first available variant; fallback to first
      const v = product.variants.find(x => x.available) || product.variants[0];
      if (!v) return;

      // Reflect selection in UI
      (product.options || []).forEach((opt, idx) => {
        const optName = opt.name;
        const chosen = v[`option${idx + 1}`];

        // swatch
        const swWrap = this.body.querySelector(`.swatches[data-option-name="${CSS.escape(optName)}"]`);
        if (swWrap) {
          swWrap.querySelectorAll('.custom-swatch').forEach(b => {
            b.classList.toggle('active', b.dataset.value === chosen);
          });
        }

        // dropdown
        const dd = this.body.querySelector(`.custom-dropdown[data-option-name="${CSS.escape(optName)}"]`);
        if (dd) {
          dd.dataset.selected = chosen;
          // const labelEl = dd.querySelector('.dropdown-toggle .selected-size');
          // if (labelEl) labelEl.textContent = chosen;
        }
      });
    }

    _collectSelections() {
      const selections = [];
      (this.product.options || []).forEach((opt) => {
        const name = opt.name;

        // swatch
        const swWrap = this.body.querySelector(`.swatches[data-option-name="${CSS.escape(name)}"]`);
        if (swWrap) {
          const active = swWrap.querySelector('.custom-swatch.active');
          selections.push(active ? active.dataset.value : null);
          return;
        }

        // dropdown
        const dd = this.body.querySelector(`.custom-dropdown[data-option-name="${CSS.escape(name)}"]`);
        if (dd) {
          selections.push(dd.dataset.selected || null);
          return;
        }

        selections.push(null);
      });
      return selections;
    }

    _findVariantBySelections(selections) {
      if (!this.product?.variants?.length) return null;
      return this.product.variants.find(v =>
        selections.every((val, idx) => (val == null ? true : v[`option${idx + 1}`] === val))
      ) || null;
    }

    _updateVariantFromSelections() {
      const selections = this._collectSelections();

      // If any selection missing, don’t resolve yet
      if (selections.some(v => v == null)) {
        this._applyVariant(null);
        return;
      }

      const variant = this._findVariantBySelections(selections);
      this._applyVariant(variant);
    }

    _applyVariant(variant) {
      this.currentVariant = variant;
      const addBtn = this.body.querySelector('.add-to-cart');
      const priceEl = this.body.querySelector('.quick-price');
      const imgEl = this.body.querySelector('.quick-image');

      if (!addBtn) return;

      if (!variant) {
        addBtn.dataset.id = '';
        addBtn.disabled = true;
        if (priceEl) priceEl.textContent = '—';
        return;
      }

      addBtn.dataset.id = variant.id;
      addBtn.disabled = !variant.available;

      if (priceEl) priceEl.textContent = this._formatMoney(variant.price);
      if (imgEl) {
        const vimg = variant.featured_image?.src || variant.featured_image || null;
        if (vimg) imgEl.src = vimg;
      }
    }

    async _handleAddToCart(btn) {
      const id = btn.dataset.id;
      if (!id) {
        alert('Please select all options.');
        return;
      }
      btn.disabled = true;

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, quantity: 1 })
        });
        if (!res.ok) throw new Error(`Add to cart failed: ${res.status}`);
        const addonProduct = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 45517952057578, // variant ID
            quantity: 1
          })
        });
        if (!addonProduct.ok) throw new Error(`Add to cart failed: ${addonProduct.status}`);
        this.close();
        window.location.href = '/cart'; // Redirect to cart page
      } catch (err) {
        console.error(err);
        alert('Could not add to cart. Please try again.');
      } finally {
        btn.disabled = false;
      }
    }

    // Utils
    _formatMoney(priceLike) {
      // Shopify /products/*.js often gives variant.price in cents (integer)
      const cents = typeof priceLike === 'number'
        ? priceLike
        : parseInt(String(priceLike), 10) || 0;

      if (window.Shopify && typeof Shopify.formatMoney === 'function') {
        return Shopify.formatMoney(cents);
      }
      const amount = (cents / 100).toFixed(2);
      const code = (window.Shopify && Shopify.currency && Shopify.currency.active) || '';
      return code ? `${amount} ${code}` : amount;
    }

    _shortenDesc(html) {
      // Quick, safe-ish text grab of first sentence
      const div = document.createElement('div');
      div.innerHTML = html || '';
      const text = (div.textContent || '').trim();
      const firstSentence = text.split('. ')[0];
      return firstSentence ? `${firstSentence}.` : '';
    }

    _escape(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    _escapeAttr(str) {
      return this._escape(str).replace(/"/g, '&quot;');
    }
  }

  // Expose globally
  window.QuickAddPopup = QuickAddPopup;
})();
// Initialize once, anywhere after the popup HTML exists
document.addEventListener('DOMContentLoaded', () => {
  const quickAdd = new QuickAddPopup({
  });
  quickAdd.init();
});