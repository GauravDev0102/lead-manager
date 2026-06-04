const STORAGE_LEADS = 'leads_data';
const STORAGE_STATUS = 'leads_status';
const STORAGE_META = 'leads_meta';
const STORAGE_DARK = 'leads_dark';

function loadLeads() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LEADS)) || []; } catch { return []; }
}
function saveLeads(d) { localStorage.setItem(STORAGE_LEADS, JSON.stringify(d)); }

function loadStatuses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_STATUS)) || {}; } catch { return {}; }
}
function saveStatuses(s) { localStorage.setItem(STORAGE_STATUS, JSON.stringify(s)); }

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(STORAGE_META)) || {}; } catch { return {}; }
}
function saveMeta(m) { localStorage.setItem(STORAGE_META, JSON.stringify(m)); }

// Clear old cached seed data on first load
if (localStorage.getItem('leads_ver') !== 'v3') {
  localStorage.removeItem(STORAGE_LEADS);
  localStorage.removeItem(STORAGE_STATUS);
  localStorage.removeItem(STORAGE_META);
  localStorage.setItem('leads_ver', 'v3');
}

let leads = loadLeads();
if (!leads.length) { leads = []; saveLeads(leads); }
let statuses = loadStatuses();
let meta = loadMeta();
let openMenuId = null;
let showArchived = false;

const STATUS_LABELS = {not:'🔴 Not Contacted',int:'🟢 Interested',mtg:'🔵 Meeting Scheduled',cli:'💰 Client Closed'};
const STATUS_ICONS = {not:'🔴',int:'🟢',mtg:'🔵',cli:'💰'};

// Dark mode
if (localStorage.getItem(STORAGE_DARK) === 'true') document.body.classList.add('dark');

function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem(STORAGE_DARK, document.body.classList.contains('dark'));
}

function getMeta(id) { return meta[id] || { notes:'', followUp:'', archived:false, revenue:0 }; }
function setMetaField(id, field, val) {
  if (!meta[id]) meta[id] = { notes:'', followUp:'', archived:false, revenue:0 };
  meta[id][field] = val;
  saveMeta(meta);
}

function getStatus(id) { return statuses[id] !== undefined ? statuses[id] : 'not'; }
function setStatus(id, s) {
  statuses[id] = s;
  saveStatuses(statuses);
  if (s === 'cli') {
    const m = getMeta(id);
    if (!m.revenue) {
      const rev = prompt('Revenue from this client (₹):', '0');
      if (rev !== null) setMetaField(id, 'revenue', parseFloat(rev) || 0);
    }
  }
  render();
}

function toggleMenu(id) {
  const menu = document.getElementById('menu-'+id);
  if (!menu) return;
  const wasOpen = openMenuId === id;
  document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
  openMenuId = wasOpen ? null : id;
  if (!wasOpen) menu.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.status-badge')) {
    document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
    openMenuId = null;
  }
});

function delLead(id) {
  if (!confirm('Delete "'+leads[id].n+'" forever?')) return;
  leads.splice(id, 1);
  const newStatuses = {}, newMeta = {};
  Object.keys(statuses).forEach(k => {
    const ki = parseInt(k);
    if (ki < id) { newStatuses[k] = statuses[k]; newMeta[k] = meta[k]; }
    else if (ki > id) { newStatuses[ki-1] = statuses[ki]; newMeta[ki-1] = meta[ki]; }
  });
  statuses = newStatuses; meta = newMeta;
  saveLeads(leads); saveStatuses(statuses); saveMeta(meta);
  render();
}

function toggleArchive(id) {
  const m = getMeta(id);
  setMetaField(id, 'archived', !m.archived);
  render();
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parts[2] + ' ' + months[parseInt(parts[1])-1] + ' ' + parts[0];
}

function isOverdue(d) {
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(d+'T00:00:00') < today;
}

function isToday(d) {
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(d+'T00:00:00').getTime() === today.getTime();
}

function render() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const sf = document.getElementById('statusFilter').value;
  const lf = document.getElementById('locFilter').value;

  const locs = [...new Set(leads.map(l => l.loc).filter(Boolean))].sort();
  const locSel = document.getElementById('locFilter');
  const curLoc = locSel.value;
  locSel.innerHTML = '<option value="all">📍 All</option>' +
    locs.map(l => `<option value="${l}"${l===curLoc?' selected':''}>${l}</option>`).join('');

  let filtered = leads.filter((r, i) => {
    const s = getStatus(i);
    const m = getMeta(i);
    if (!showArchived && m.archived) return false;
    if (sf !== 'all' && s !== sf) return false;
    if (lf !== 'all' && r.loc !== lf) return false;
    if (q && !r.n.toLowerCase().includes(q) && !r.cat.toLowerCase().includes(q) && !r.loc.toLowerCase().includes(q)) return false;
    return true;
  });

  let counts = {not:0,int:0,mtg:0,cli:0};
  let totalRev = 0;
  leads.forEach((_,i) => {
    const s = getStatus(i);
    counts[s]++;
    if (s === 'cli') {
      const m = getMeta(i);
      totalRev += parseFloat(m.revenue) || 0;
    }
  });
  const total = counts.not + counts.int + counts.mtg + counts.cli;
  const convRate = total > 0 ? (counts.cli / total * 100).toFixed(1) : '0.0';

  document.getElementById('totalCount').textContent = leads.length;
  document.getElementById('locCount').textContent = locs.length;
  document.getElementById('cNot').textContent = counts.not;
  document.getElementById('cInt').textContent = counts.int;
  document.getElementById('cMtg').textContent = counts.mtg;
  document.getElementById('cCli').textContent = counts.cli;
  document.getElementById('totalRev').textContent = '₹' + totalRev.toLocaleString('en-IN');
  document.getElementById('convRate').textContent = convRate + '%';

  if (filtered.length === 0) {
    document.getElementById('list').innerHTML = '<div class="empty">No leads match your filter.</div>';
    return;
  }

  document.getElementById('list').innerHTML = filtered.map((r, fi) => {
    const id = leads.indexOf(r);
    const s = getStatus(id);
    const m = getMeta(id);
    const ph = r.ph || '';
    const waLink = ph ? `<a class="wa-link" href="https://wa.me/${ph.replace(/[^0-9]/g,'')}" target="_blank" title="WhatsApp">💬</a>` : '';
    const ov = isOverdue(m.followUp);
    const td = isToday(m.followUp);
    const extraOpen = m.notes || m.followUp || m.revenue;
    return `
    <div class="lead-card${m.archived?' archived':''}${ov?' lead-card-overdue':''}${td?' lead-card-today':''}">
      <div class="lead-row">
        <div class="lead-info">
          <div class="lead-name">${r.n}</div>
          <div class="lead-meta">
            <span class="lead-cat">${r.cat}</span>
            <span>📍${r.loc}</span>
            ${ph ? '<span>📞'+ph+'</span>' : ''}
            ${waLink}
            ${m.revenue ? '<span class="rev-badge">💰 ₹'+parseFloat(m.revenue).toLocaleString('en-IN')+'</span>' : ''}
            ${m.archived ? '<span style="font-size:.65rem;color:var(--text2)">📦 Archived</span>' : ''}
          </div>
        </div>
        <div class="lead-actions">
          <button class="lead-toggle" onclick="toggleExtra(${id})">${extraOpen?'▾':'▸'}</button>
          <div class="status-badge" data-status="${s}" onclick="toggleMenu(${id})">
            ${STATUS_ICONS[s]}
            <div class="status-menu" id="menu-${id}">
              ${Object.entries(STATUS_ICONS).map(([k,v]) => `
                <button class="status-opt" onclick="event.stopPropagation();setStatus(${id},'${k}')">${v} ${STATUS_LABELS[k]}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="lead-extra" id="extra-${id}"${extraOpen?'':' style="display:none"'}>
        <textarea placeholder="Notes..." oninput="setMetaField(${id},'notes',this.value)">${m.notes||''}</textarea>
        <div class="lead-extra-row">
          <label>📅 Follow-up:</label>
          <input type="date" value="${m.followUp||''}" onchange="setMetaField(${id},'followUp',this.value);render()">
          ${m.followUp ? '<span style="font-size:.7rem;color:var(--text2)">'+formatDate(m.followUp)+(ov?' ⚠️ Overdue':td?' 📌 Today':'')+'</span>' : ''}
          <input type="number" placeholder="₹ Revenue" value="${m.revenue||''}" min="0" style="width:100px" onchange="setMetaField(${id},'revenue',parseFloat(this.value)||0);render()">
          <button class="btn-sm ${m.archived?'btn-sm-restore':'btn-sm-archive'}" onclick="toggleArchive(${id})">${m.archived?'↩ Restore':'📦 Archive'}</button>
          <button class="btn-sm btn-sm-del" onclick="delLead(${id})">🗑 Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleExtra(id) {
  const el = document.getElementById('extra-'+id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function openAdd() {
  document.getElementById('modalTitle').textContent = 'Add Lead';
  document.getElementById('fName').value = '';
  document.getElementById('fCat').value = '';
  document.getElementById('fLoc').value = '';
  document.getElementById('fPh').value = '';
  document.getElementById('modal').classList.add('open');
  document.getElementById('fName').focus();
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function saveLead() {
  const n = document.getElementById('fName').value.trim();
  const cat = document.getElementById('fCat').value.trim();
  const loc = document.getElementById('fLoc').value.trim();
  const ph = document.getElementById('fPh').value.trim();
  if (!n || !cat || !loc) { alert('Name, Category, and Location are required.'); return; }
  leads.push({ n, cat, loc, ph });
  saveLeads(leads);
  closeModal();
  render();
}

function toggleShowArchived() {
  showArchived = !showArchived;
  document.getElementById('archiveToggle').textContent = showArchived ? 'Hide Archived' : 'Show Archived';
  render();
}

function exportCSV() {
  const rows = [['Name','Category','Location','Phone','Status','Revenue','Notes','FollowUp']];
  leads.forEach((r, i) => {
    const s = getStatus(i);
    const m = getMeta(i);
    rows.push([r.n, r.cat, r.loc, r.ph||'', STATUS_LABELS[s], m.revenue||'0', m.notes||'', m.followUp||'']);
  });
  const csv = rows.map(row => row.map(cell => '"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leads_export_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

function importCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0;
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim().replace(/^"(.*)"$/, '$1'));
      if (parts.length >= 3) {
        leads.push({ n: parts[0], cat: parts[1], loc: parts[2], ph: parts[3] || '' });
        added++;
      }
    });
    saveLeads(leads);
    render();
    alert('Imported ' + added + ' leads.');
  };
  reader.readAsText(file);
  e.target.value = '';
}

render();
