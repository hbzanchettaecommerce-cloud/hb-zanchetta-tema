/* HB Zanchetta — scripts do tema */
(() => {
  const HB = window.HB || { pix: 0, instMax: 1, instMin: 10, routes: { root: '/', cart: '/cart', cartAdd: '/cart/add' } };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const root = (HB.routes.root || '/').replace(/\/?$/, '/');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Aviso flutuante */
  let toastTimer;
  function toast(html) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = html;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
  }

  /* Contador do carrinho no header */
  async function refreshCart() {
    try {
      const c = await (await fetch(HB.routes.cart + '.js', { headers: { Accept: 'application/json' } })).json();
      $$('[data-cart-count]').forEach((e) => (e.textContent = c.item_count));
      $$('[data-cart-total]').forEach((e) => (e.textContent = money(c.total_price)));
    } catch (e) { /* sem conexão: mantém o valor atual */ }
  }

  /* Cliques: quantidade, setas das vitrines, filtros no celular */
  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-qty-btn]');
    if (q) {
      const input = q.parentElement.querySelector('input');
      const min = input.min !== '' ? +input.min : 1;
      input.value = Math.max(min, (+input.value || 0) + +q.dataset.qtyBtn);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const a = e.target.closest('[data-rail-btn]');
    if (a) {
      const rail = a.closest('.shelf').querySelector('[data-rail]');
      if (rail) rail.scrollBy({ left: +a.dataset.railBtn * rail.clientWidth * 0.8, behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-filters-toggle]')) {
      document.body.classList.toggle('filters-open');
      return;
    }
    if (document.body.classList.contains('filters-open') && !e.target.closest('.filters')) {
      document.body.classList.remove('filters-open');
    }
  });

  /* Adicionar ao carrinho sem sair da página */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form.js-ajax-cart');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('[name="add"]');
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Adicionando…'; }
    try {
      const res = await fetch(HB.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: new FormData(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || 'Não foi possível adicionar este produto.');
      toast(`Adicionado ao carrinho: <b>${data.quantity}× ${esc(data.product_title)}</b><a href="${HB.routes.cart}">Ver carrinho</a>`);
      refreshCart();
    } catch (err) {
      toast(esc(err.message));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
    }
  });

  /* Banner principal */
  $$('[data-slider]').forEach((sl) => {
    const slides = $$('.slide', sl);
    const dots = $('.dots', sl);
    if (slides.length < 2) { $$('.sl-arrow, .dots', sl).forEach((x) => (x.hidden = true)); return; }
    let cur = 0, timer;
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Banner ' + (i + 1));
      b.addEventListener('click', () => { go(i); restart(); });
      dots.appendChild(b);
    });
    function go(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('on', k === cur); s.inert = k !== cur; });
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === cur));
    }
    function restart() {
      clearInterval(timer);
      if (sl.dataset.autoplay === 'true' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timer = setInterval(() => go(cur + 1), (+sl.dataset.speed || 6) * 1000);
      }
    }
    $('.sl-prev', sl).addEventListener('click', () => { go(cur - 1); restart(); });
    $('.sl-next', sl).addEventListener('click', () => { go(cur + 1); restart(); });
    let x0 = null;
    sl.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    sl.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); restart(); }
      x0 = null;
    });
    document.addEventListener('shopify:block:select', (e) => {
      const i = slides.indexOf(e.target);
      if (i > -1) { go(i); clearInterval(timer); }
    });
    go(0);
    restart();
  });

  /* Preço, parcelas e Pix ao trocar de variação */
  function renderPrice(box, price, compare) {
    if (!box) return;
    const p = $('[data-price]', box); if (p) p.textContent = money(price);
    const c = $('[data-compare]', box); if (c) c.textContent = compare > price ? money(compare) : '';
    const n = Math.max(1, Math.min(HB.instMax, Math.floor(price / (Math.max(1, HB.instMin) * 100))));
    const inst = $('[data-inst]', box);
    if (inst) { inst.hidden = n < 2; inst.textContent = `ou ${n}x de ${money(Math.floor(price / n))} sem juros`; }
    const pix = $('[data-pix]', box);
    if (pix) pix.textContent = `${money(Math.floor((price * (100 - HB.pix)) / 100))} no Pix`;
  }
  function showMedia(scope, id) {
    $$('[data-media-id]', scope).forEach((s) => s.classList.toggle('on', s.dataset.mediaId == id));
    $$('[data-thumb]', scope).forEach((s) => s.classList.toggle('on', s.dataset.thumb == id));
  }
  $$('[data-product]').forEach((scope) => {
    const jsonEl = $('[data-product-json]', scope);
    $$('[data-thumb]', scope).forEach((t) => t.addEventListener('click', () => showMedia(scope, t.dataset.thumb)));
    if (!jsonEl) return;
    const product = JSON.parse(jsonEl.textContent);
    const idInput = $('[data-variant-id]', scope);
    const addBtn = $('[name="add"]', scope);
    const radios = $$('[data-opt-index]', scope);
    radios.forEach((r) => r.addEventListener('change', () => {
      const sel = [];
      radios.filter((x) => x.checked).forEach((x) => (sel[+x.dataset.optIndex] = x.value));
      $$('[data-opt-label]', scope).forEach((l) => (l.textContent = sel[+l.dataset.optLabel] || ''));
      const v = product.variants.find((vv) => vv.options.every((o, i) => o === sel[i]));
      if (!v) { addBtn.disabled = true; addBtn.textContent = 'Indisponível'; return; }
      idInput.value = v.id;
      addBtn.disabled = !v.available;
      addBtn.textContent = v.available ? 'Adicionar ao carrinho' : 'Esgotado';
      renderPrice($('[data-price-box]', scope), v.price, v.compare_at_price);
      const sku = $('[data-sku]', scope); if (sku) sku.textContent = v.sku ? 'Cód.: ' + v.sku : '';
      if (v.featured_media) showMedia(scope, v.featured_media.id);
      const u = new URL(location.href); u.searchParams.set('variant', v.id); history.replaceState(null, '', u);
    }));
  });

  /* Produtos recomendados */
  $$('[data-recs]').forEach(async (el) => {
    try {
      const html = await (await fetch(el.dataset.url)).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-recs]');
      if (fresh && fresh.innerHTML.trim()) el.innerHTML = fresh.innerHTML;
    } catch (e) { /* sem recomendações */ }
  });

  /* Filtros da coleção: aplica ao mudar */
  $$('[data-filter-form]').forEach((f) => {
    f.addEventListener('change', () => (f.requestSubmit ? f.requestSubmit() : f.submit()));
    f.addEventListener('submit', () => $$('input, select', f).forEach((i) => { if (!i.value) i.disabled = true; }));
  });
  $$('[data-sort]').forEach((s) => s.addEventListener('change', () => {
    const u = new URL(location.href); u.searchParams.set('sort_by', s.value); u.searchParams.delete('page'); location.href = u;
  }));

  /* Carrinho: atualiza sozinho ao mudar a quantidade */
  const cartForm = $('#cart-form');
  if (cartForm) {
    let t;
    cartForm.addEventListener('change', (e) => {
      if (e.target.name !== 'updates[]') return;
      clearTimeout(t);
      t = setTimeout(() => cartForm.requestSubmit($('[name="update"]', cartForm)), 450);
    });
  }

  /* Calcular frete pelo CEP */
  $$('[data-ship-est]').forEach((box) => {
    const input = $('input', box), btn = $('button', box), out = $('.ship-out', box);
    input.addEventListener('input', () => {
      const d = input.value.replace(/\D/g, '').slice(0, 8);
      input.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
    btn.addEventListener('click', async () => {
      const zip = input.value.replace(/\D/g, '');
      if (zip.length !== 8) { out.textContent = 'Digite um CEP com 8 números.'; return; }
      const q = `shipping_address[zip]=${zip.slice(0, 5)}-${zip.slice(5)}&shipping_address[country]=Brazil`;
      out.textContent = 'Calculando…';
      btn.disabled = true;
      try {
        const r = await fetch(`${root}cart/prepare_shipping_rates.json?${q}`, { method: 'POST' });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(Object.values(d).flat().join(' ') || 'Não encontramos esse CEP.');
        }
        for (let i = 0; i < 15; i++) {
          const g = await fetch(`${root}cart/async_shipping_rates.json?${q}`);
          if (g.status === 200) {
            const d = await g.json();
            if (d && d.shipping_rates) {
              out.innerHTML = d.shipping_rates.length
                ? '<ul>' + d.shipping_rates.map((s) => {
                    const cents = Math.round(parseFloat(s.price) * 100);
                    return `<li><span>${esc(s.name)}</span><b>${cents === 0 ? 'Grátis' : money(cents)}</b></li>`;
                  }).join('') + '</ul>'
                : 'Ainda não entregamos neste CEP.';
              return;
            }
          }
          await sleep(700);
        }
        throw new Error('Não foi possível calcular agora. Tente de novo em instantes.');
      } catch (err) {
        out.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
