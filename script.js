const STORAGE_KEY = 'pricePulseEntries';

const anchorProducts = [
  'Café Tradicional 500g',
  'Arroz Tipo 1 5kg',
  'Feijão Carioca 1kg',
  'Óleo de Soja 900ml',
  'Leite UHT 1L'
];

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const form = document.getElementById('priceForm');
const competitorRows = document.getElementById('competitorRows');
const competitorTemplate = document.getElementById('competitorTemplate');
const addCompetitorBtn = document.getElementById('addCompetitor');
const clearDataBtn = document.getElementById('clearData');
const anchorProductSelect = document.getElementById('anchorProduct');
const trackerProductFilter = document.getElementById('trackerProductFilter');

bootstrap();

function bootstrap() {
  loadAnchorProducts();
  addCompetitorRow();
  addCompetitorRow();
  setDefaultDate();
  bindEvents();
  refreshAll();
}

function bindEvents() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(button => button.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  addCompetitorBtn.addEventListener('click', addCompetitorRow);

  competitorRows.addEventListener('click', event => {
    const removeBtn = event.target.closest('.remove-line');
    if (!removeBtn) return;
    const row = removeBtn.closest('.competitor-row');
    if (competitorRows.children.length > 1) {
      row.remove();
    }
  });

  form.addEventListener('submit', saveEntry);

  clearDataBtn.addEventListener('click', () => {
    const confirmed = window.confirm('Deseja realmente limpar todas as coletas salvas neste dispositivo?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    refreshAll();
  });

  trackerProductFilter.addEventListener('change', renderTracker);
}

function loadAnchorProducts() {
  anchorProductSelect.innerHTML = anchorProducts
    .map(product => `<option value="${product}">${product}</option>`)
    .join('');

  trackerProductFilter.innerHTML = `<option value="todos">Todos os produtos</option>${anchorProducts
    .map(product => `<option value="${product}">${product}</option>`)
    .join('')}`;
}

function setDefaultDate() {
  form.elements.date.valueAsDate = new Date();
}

function addCompetitorRow() {
  const clone = competitorTemplate.content.cloneNode(true);
  competitorRows.appendChild(clone);
}

function saveEntry(event) {
  event.preventDefault();

  const values = Object.fromEntries(new FormData(form).entries());
  const competitors = Array.from(competitorRows.querySelectorAll('.competitor-row'))
    .map(row => ({
      name: row.querySelector('[name="competitorName"]').value.trim(),
      weight: row.querySelector('[name="competitorWeight"]').value.trim(),
      price: Number.parseFloat(row.querySelector('[name="competitorPrice"]').value)
    }))
    .filter(item => item.name && item.weight && Number.isFinite(item.price));

  if (!competitors.length) {
    window.alert('Adicione pelo menos 1 produto concorrente com nome, peso/gramatura e preço.');
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    date: values.date,
    store: values.store.trim(),
    location: values.location.trim(),
    promoter: values.promoter.trim(),
    anchorProduct: values.anchorProduct,
    anchorWeight: values.anchorWeight.trim(),
    anchorPrice: Number.parseFloat(values.anchorPrice),
    competitors,
    notes: values.notes.trim(),
    createdAt: new Date().toISOString()
  };

  const entries = readEntries();
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

  form.reset();
  setDefaultDate();
  competitorRows.innerHTML = '';
  addCompetitorRow();
  addCompetitorRow();
  form.elements.store.focus();

  refreshAll();
}

function refreshAll() {
  const entries = readEntries();
  renderRecentEntries(entries);
  renderQuickStats(entries);
  renderMainStats(entries);
  renderGlobalComparison(entries);
  renderTracker();
}

function readEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderRecentEntries(entries) {
  const tbody = document.getElementById('recentEntries');

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma coleta registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = entries.slice(0, 12).map(entry => {
    const competitorNames = entry.competitors.map(item => `${item.name} (${currency(item.price)})`).join(', ');
    return `
      <tr>
        <td>${formatDate(entry.date)}</td>
        <td>${entry.store}</td>
        <td>${entry.anchorProduct}</td>
        <td>${currency(entry.anchorPrice)}</td>
        <td>${competitorNames}</td>
      </tr>
    `;
  }).join('');
}

function renderQuickStats(entries) {
  const quickStats = document.getElementById('quickStats');
  const stores = new Set(entries.map(item => item.store)).size;
  const avgDiff = averageDiff(entries);

  quickStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Coletas no dispositivo</div>
      <div class="stat-value">${entries.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Supermercados monitorados</div>
      <div class="stat-value">${stores}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Diferença média vs concorrência</div>
      <div class="stat-value">${percent(avgDiff)}</div>
    </div>
  `;
}

function renderMainStats(entries) {
  const statRoot = document.getElementById('mainStats');
  const byPromoter = groupBy(entries, item => item.promoter);
  const topPromoter = Object.entries(byPromoter).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || '-';

  const allCompetitorPrices = entries.flatMap(item => item.competitors.map(comp => comp.price));
  const medianCompetitor = median(allCompetitorPrices);

  statRoot.innerHTML = `
    <article class="stat-card">
      <div class="stat-label">Total de coletas</div>
      <div class="stat-value">${entries.length}</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">Preço médio dos seus produtos</div>
      <div class="stat-value">${currency(average(entries.map(item => item.anchorPrice)))}</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">Preço mediano concorrente</div>
      <div class="stat-value">${currency(medianCompetitor)}</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">Promotor com mais coletas</div>
      <div class="stat-value">${topPromoter}</div>
    </article>
  `;
}

function renderGlobalComparison(entries) {
  const tbody = document.getElementById('globalComparison');
  const grouped = groupBy(entries, item => item.anchorProduct);

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Adicione coletas para visualizar a análise.</td></tr>';
    return;
  }

  tbody.innerHTML = Object.entries(grouped).map(([product, rows]) => {
    const ownAvg = average(rows.map(item => item.anchorPrice));
    const competitorAvg = average(rows.flatMap(item => item.competitors.map(comp => comp.price)));
    const diff = diffPercentage(ownAvg, competitorAvg);

    return `
      <tr>
        <td>${product}</td>
        <td>${currency(ownAvg)}</td>
        <td>${currency(competitorAvg)}</td>
        <td><span class="pill ${diff <= 0 ? 'positive' : 'negative'}">${percent(diff)}</span></td>
        <td>${rows.length}</td>
      </tr>
    `;
  }).join('');
}

function renderTracker() {
  const entries = readEntries();
  const selected = trackerProductFilter.value;
  const filtered = selected && selected !== 'todos'
    ? entries.filter(item => item.anchorProduct === selected)
    : entries;

  const byStore = groupBy(filtered, item => item.store);
  const table = document.getElementById('trackerTable');
  const bars = document.getElementById('trackerBars');

  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="5" class="empty">Sem dados para o filtro selecionado.</td></tr>';
    bars.innerHTML = '<div class="empty">Sem dados para gerar o gráfico.</div>';
    return;
  }

  const rows = Object.entries(byStore).map(([store, items]) => {
    const ownAvg = average(items.map(item => item.anchorPrice));
    const compAvg = average(items.flatMap(item => item.competitors.map(comp => comp.price)));
    const diff = diffPercentage(ownAvg, compAvg);
    const latestDate = items
      .map(item => item.date)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    return { store, ownAvg, compAvg, diff, latestDate };
  }).sort((a, b) => a.diff - b.diff);

  table.innerHTML = rows.map(row => `
    <tr>
      <td>${row.store}</td>
      <td>${currency(row.ownAvg)}</td>
      <td>${currency(row.compAvg)}</td>
      <td><span class="pill ${row.diff <= 0 ? 'positive' : 'negative'}">${percent(row.diff)}</span></td>
      <td>${formatDate(row.latestDate)}</td>
    </tr>
  `).join('');

  const maxPrice = Math.max(...rows.map(row => row.ownAvg), 1);
  bars.innerHTML = rows.map(row => {
    const width = (row.ownAvg / maxPrice) * 100;
    return `
      <div class="bar-row">
        <strong>${row.store}</strong>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${width}%;"></div>
          <span class="bar-text">${currency(row.ownAvg)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function median(numbers) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function averageDiff(entries) {
  if (!entries.length) return 0;
  const diffs = entries.map(item => {
    const compAvg = average(item.competitors.map(comp => comp.price));
    return diffPercentage(item.anchorPrice, compAvg);
  });
  return average(diffs);
}

function diffPercentage(ownPrice, competitorPrice) {
  if (!competitorPrice) return 0;
  return ((ownPrice - competitorPrice) / competitorPrice) * 100;
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function percent(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR').format(date);
}
