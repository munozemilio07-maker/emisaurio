// Constructores de formularios del inspector y paneles.
export function initUI(app) {
  function field(parent, { label, type = 'range', min, max, step, get, set, fmt, options, wide, pro, def, after }) {
    if (pro && !app.pro) return null;
    const row = document.createElement('div');
    row.className = 'field' + (wide || ['select', 'color', 'text', 'textarea', 'chips', 'checkbox'].includes(type) ? ' wide' : '') + (pro ? ' is-pro' : '');
    const lab = document.createElement('label');
    lab.textContent = label;
    row.appendChild(lab);
    let input;
    if (type === 'chips') {
      input = document.createElement('div');
      input.className = 'chips';
      for (const [v, l] of options) {
        const b = document.createElement('button');
        b.className = 'chip' + (String(get()) === String(v) ? ' on' : '');
        b.textContent = l;
        b.addEventListener('click', () => { app.beginEdit(); set(v); app.endEdit(); after?.(); });
        input.appendChild(b);
      }
      row.appendChild(input);
      parent.appendChild(row);
      return row;
    }
    if (type === 'select') {
      input = document.createElement('select');
      input.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      input.value = get();
    } else if (type === 'textarea') {
      input = document.createElement('textarea'); input.value = get();
    } else if (type === 'checkbox') {
      input = document.createElement('label');
      input.className = 'switch';
      input.innerHTML = `<input type="checkbox"${get() ? ' checked' : ''}><i></i>`;
    } else {
      input = document.createElement('input');
      input.type = type;
      if (min != null) input.min = min; if (max != null) input.max = max; if (step != null) input.step = step;
      input.value = get();
    }
    row.appendChild(input);
    const el = type === 'checkbox' ? input.querySelector('input') : input;
    let out = null;
    if (type === 'range') { out = document.createElement('output'); out.textContent = fmt ? fmt(+get()) : get(); row.appendChild(out); }
    const read = () => (type === 'checkbox' ? el.checked : type === 'range' || type === 'number' ? +el.value : el.value);
    el.addEventListener('focus', () => app.beginEdit());
    el.addEventListener('pointerdown', () => app.beginEdit());
    el.addEventListener('input', () => {
      if (!app._snap) app.beginEdit();
      set(read());
      if (out) out.textContent = fmt ? fmt(read()) : read();
      app.player.invalidate();
      if (type !== 'range' && type !== 'textarea' && type !== 'text') app.timeline.render();
    });
    el.addEventListener('change', () => { set(read()); app.endEdit(); after?.(); });
    if (type === 'range' && def != null) {
      lab.title = 'Doble clic para restablecer';
      const reset = () => { app.beginEdit(); set(def); app.endEdit(); after?.(); };
      lab.addEventListener('dblclick', reset);
      el.addEventListener('dblclick', reset);
    }
    parent.appendChild(row);
    return row;
  }

  function section(root, title, { open = true, pro = false, right = '' } = {}) {
    if (pro && !app.pro) return null;
    const s = document.createElement('section');
    s.className = 'sec' + (open ? ' open' : '');
    s.innerHTML = `<h3 class="sec-h"><span>${title}</span>${right}<b class="caret">▾</b></h3><div class="sec-b"></div>`;
    s.querySelector('.sec-h').addEventListener('click', (e) => { if (e.target.closest('button')) return; s.classList.toggle('open'); });
    root.appendChild(s);
    return s.querySelector('.sec-b');
  }

  function button(parent, label, onClick, cls = 'btn small') {
    const b = document.createElement('button');
    b.className = cls; b.innerHTML = label;
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  }

  return { field, section, button };
}

export const pct = (v) => Math.round(v * 100) + '%';
export const sec = (v) => v.toFixed(2) + 's';
export const signed = (v) => (v > 0 ? '+' : '') + Math.round(v * 100);
export function esc(s) { return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
