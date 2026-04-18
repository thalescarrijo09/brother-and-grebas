// ===== FIREBASE IMPORTS (apenas Firestore agora!) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== CONFIG FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBiZmlRBN7kTnnsgwdXEcRN0pGwWNWBSt8",
  authDomain: "brothers-e-grebas.firebaseapp.com",
  projectId: "brothers-e-grebas",
  storageBucket: "brothers-e-grebas.firebasestorage.app",
  messagingSenderId: "232784475371",
  appId: "1:232784475371:web:9bc1492aeccb4b7c953aae"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== CONFIG IMGBB (hospedagem das fotos - GRÁTIS) =====
const IMGBB_API_KEY = "b720bed751ebd8db5cf2d61b47abb2ba";
const IMGBB_URL = "https://api.imgbb.com/1/upload";

// ===== ESTADO LOCAL =====
let membros = [];
let churrascos = [];
let ofensas = [];
let fotos = [];

// ===== NAVEGAÇÃO DE ABAS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== MEMBROS =====
const formMembro = document.getElementById('form-membro');
formMembro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('membro-nome').value.trim();
  if (!nome) return;
  await addDoc(collection(db, 'membros'), { nome, criadoEm: serverTimestamp() });
  document.getElementById('membro-nome').value = '';
});

onSnapshot(collection(db, 'membros'), (snap) => {
  membros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMembros();
  renderSelectResponsavel();
  renderSelectPresenca();
  renderRankings();
});

function renderMembros() {
  const lista = document.getElementById('lista-membros');
  if (!membros.length) {
    lista.innerHTML = '<p class="hint">Nenhum membro cadastrado ainda. Adicione os brothers e grebas!</p>';
    return;
  }
  lista.innerHTML = membros.map(m => `
    <span class="membro-item">
      👤 ${escapeHtml(m.nome)}
      <button onclick="removerMembro('${m.id}')" title="Remover">✖</button>
    </span>
  `).join('');
}

window.removerMembro = async (id) => {
  if (!confirm('Remover este membro?')) return;
  await deleteDoc(doc(db, 'membros', id));
};

function renderSelectResponsavel() {
  const sel = document.getElementById('churrasco-responsavel');
  sel.innerHTML = '<option value="">Churrasqueiro responsável...</option>' +
    membros.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
}

// ===== AGENDA / CHURRASCOS =====
const formAgenda = document.getElementById('form-agenda');
formAgenda.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = document.getElementById('churrasco-data').value;
  const hora = document.getElementById('churrasco-hora').value;
  const local = document.getElementById('churrasco-local').value.trim();
  const responsavelId = document.getElementById('churrasco-responsavel').value;
  const obs = document.getElementById('churrasco-obs').value.trim();

  const responsavel = membros.find(m => m.id === responsavelId);
  await addDoc(collection(db, 'churrascos'), {
    data, hora, local,
    responsavelId,
    responsavelNome: responsavel ? responsavel.nome : 'Desconhecido',
    obs,
    realizado: false,
    presentes: [],
    criadoEm: serverTimestamp()
  });
  formAgenda.reset();
  alert('🔥 Churrasco agendado!');
});

onSnapshot(query(collection(db, 'churrascos'), orderBy('data', 'asc')), (snap) => {
  churrascos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAgenda();
  renderHistorico();
  renderSelectPresenca();
  renderRankings();
  renderHome();
});

function renderAgenda() {
  const hoje = new Date().toISOString().split('T')[0];
  const proximos = churrascos.filter(c => !c.realizado && c.data >= hoje);
  const lista = document.getElementById('lista-agenda');
  if (!proximos.length) {
    lista.innerHTML = '<p class="hint">Nenhum churrasco agendado. Bora marcar um!</p>';
    return;
  }
  lista.innerHTML = proximos.map(c => `
    <div class="evento-item">
      <div class="data">📅 ${formatarData(c.data)} às ${c.hora}</div>
      <div class="info">📍 ${escapeHtml(c.local)}</div>
      <div class="info">🔥 Churrasqueiro: <strong>${escapeHtml(c.responsavelNome)}</strong></div>
      ${c.obs ? `<div class="info">📝 ${escapeHtml(c.obs)}</div>` : ''}
      <button class="btn-excluir" onclick="excluirChurrasco('${c.id}')">🗑️ Excluir</button>
    </div>
  `).join('');
}

function renderHistorico() {
  const realizados = churrascos.filter(c => c.realizado).reverse();
  const lista = document.getElementById('lista-historico');
  if (!realizados.length) {
    lista.innerHTML = '<p class="hint">Nenhum churrasco realizado ainda.</p>';
    return;
  }
  lista.innerHTML = realizados.map(c => {
    const presentesNomes = (c.presentes || []).map(id => {
      const m = membros.find(x => x.id === id);
      return m ? m.nome : '?';
    }).join(', ');
    return `
      <div class="evento-item">
        <div class="data">✅ ${formatarData(c.data)}</div>
        <div class="info">📍 ${escapeHtml(c.local)} — 🔥 ${escapeHtml(c.responsavelNome)}</div>
        <div class="info">👥 Presentes (${(c.presentes||[]).length}): ${escapeHtml(presentesNomes) || '—'}</div>
        <button class="btn-excluir" onclick="excluirChurrasco('${c.id}')">🗑️ Excluir</button>
      </div>
    `;
  }).join('');
}

window.excluirChurrasco = async (id) => {
  if (!confirm('Excluir este churrasco?')) return;
  await deleteDoc(doc(db, 'churrascos', id));
};

// ===== PRESENÇA =====
function renderSelectPresenca() {
  const sel = document.getElementById('select-churrasco-presenca');
  const naoRealizados = churrascos.filter(c => !c.realizado);
  sel.innerHTML = '<option value="">Selecione o churrasco...</option>' +
    naoRealizados.map(c => `<option value="${c.id}">${formatarData(c.data)} — ${escapeHtml(c.local)}</option>`).join('');
}

document.getElementById('select-churrasco-presenca').addEventListener('change', (e) => {
  const id = e.target.value;
  const div = document.getElementById('lista-presenca-membros');
  const btn = document.getElementById('btn-salvar-presenca');
  if (!id) { div.innerHTML = ''; btn.classList.add('hidden'); return; }
  const churrasco = churrascos.find(c => c.id === id);
  const presentes = churrasco.presentes || [];
  div.innerHTML = membros.map(m => `
    <div class="presenca-item">
      <input type="checkbox" id="pres-${m.id}" value="${m.id}" ${presentes.includes(m.id) ? 'checked' : ''} />
      <label for="pres-${m.id}">${escapeHtml(m.nome)}</label>
    </div>
  `).join('') || '<p class="hint">Cadastre membros primeiro.</p>';
  btn.classList.remove('hidden');
  btn.dataset.churrascoId = id;
});

document.getElementById('btn-salvar-presenca').addEventListener('click', async () => {
  const id = document.getElementById('btn-salvar-presenca').dataset.churrascoId;
  if (!id) return;
  const presentes = Array.from(document.querySelectorAll('#lista-presenca-membros input:checked')).map(i => i.value);
  if (!confirm('Salvar presença e marcar churrasco como REALIZADO? Isso atualiza os rankings.')) return;
  await updateDoc(doc(db, 'churrascos', id), { presentes, realizado: true });
  alert('✅ Presença salva! Rankings atualizados.');
  document.getElementById('select-churrasco-presenca').value = '';
  document.getElementById('lista-presenca-membros').innerHTML = '';
  document.getElementById('btn-salvar-presenca').classList.add('hidden');
});

// ===== RANKINGS =====
function renderRankings() {
  const realizados = churrascos.filter(c => c.realizado);
  const totalRealizados = realizados.length;

  const contagemChurras = {};
  realizados.forEach(c => {
    contagemChurras[c.responsavelId] = (contagemChurras[c.responsavelId] || 0) + 1;
  });
  const rankingChurras = membros.map(m => ({
    nome: m.nome,
    total: contagemChurras[m.id] || 0
  })).sort((a,b) => b.total - a.total);

  document.getElementById('lista-ranking').innerHTML = rankingChurras.length
    ? rankingChurras.map(r => `
        <li><span class="nome">${escapeHtml(r.nome)}</span><span class="valor">${r.total} 🔥</span></li>
      `).join('')
    : '<p class="hint">Sem dados ainda.</p>';

  const contagemFaltas = {};
  realizados.forEach(c => {
    const presentes = c.presentes || [];
    membros.forEach(m => {
      if (!presentes.includes(m.id)) {
        contagemFaltas[m.id] = (contagemFaltas[m.id] || 0) + 1;
      }
    });
  });
  const rankingSumido = membros.map(m => ({
    nome: m.nome,
    faltas: contagemFaltas[m.id] || 0,
    total: totalRealizados
  })).sort((a,b) => b.faltas - a.faltas);

  document.getElementById('lista-sumido').innerHTML = rankingSumido.length && totalRealizados
    ? rankingSumido.map(r => `
        <li><span class="nome">${escapeHtml(r.nome)}</span><span class="valor">${r.faltas}/${r.total} 👻</span></li>
      `).join('')
    : '<p class="hint">Sem churrascos realizados ainda.</p>';
}

// ===== HOME =====
function renderHome() {
  const hoje = new Date().toISOString().split('T')[0];
  const proximos = churrascos.filter(c => !c.realizado && c.data >= hoje);
  const prox = proximos[0];
  const divProx = document.getElementById('proximo-churrasco');
  divProx.innerHTML = prox
    ? `<div class="evento-item" style="margin:0;">
         <div class="data">📅 ${formatarData(prox.data)} às ${prox.hora}</div>
         <div class="info">📍 ${escapeHtml(prox.local)}</div>
         <div class="info">🔥 Churrasqueiro: <strong>${escapeHtml(prox.responsavelNome)}</strong></div>
         ${prox.obs ? `<div class="info">📝 ${escapeHtml(prox.obs)}</div>` : ''}
       </div>`
    : '<p class="hint">Nenhum churrasco agendado. Bora marcar um! 🔥</p>';

  const realizados = churrascos.filter(c => c.realizado);
  document.getElementById('total-churrascos').textContent = realizados.length;

  const contagem = {};
  realizados.forEach(c => { contagem[c.responsavelId] = (contagem[c.responsavelId] || 0) + 1; });
  let mestre = null, max = 0;
  for (const id in contagem) if (contagem[id] > max) { max = contagem[id]; mestre = id; }
  const mestreObj = membros.find(m => m.id === mestre);
  document.getElementById('mestre-churrasco').textContent = mestreObj ? `🥇 ${mestreObj.nome} (${max})` : '—';

  const faltas = {};
  realizados.forEach(c => {
    const p = c.presentes || [];
    membros.forEach(m => { if (!p.includes(m.id)) faltas[m.id] = (faltas[m.id]||0)+1; });
  });
  let sumido = null, maxF = 0;
  for (const id in faltas) if (faltas[id] > maxF) { maxF = faltas[id]; sumido = id; }
  const sumidoObj = membros.find(m => m.id === sumido);
  document.getElementById('sumido-vez').textContent = sumidoObj && maxF > 0 ? `👻 ${sumidoObj.nome} (${maxF})` : '—';
}

// ===== GALERIA (COM IMGBB - GRÁTIS!) =====
const formFoto = document.getElementById('form-foto');
formFoto.addEventListener('submit', async (e) => {
  e.preventDefault();
  const arquivo = document.getElementById('foto-arquivo').files[0];
  const legenda = document.getElementById('foto-legenda').value.trim();
  if (!arquivo) return;

  // Validação de tamanho (ImgBB aceita até 32MB)
  if (arquivo.size > 32 * 1024 * 1024) {
    alert('❌ Foto muito grande! Máximo 32MB.');
    return;
  }

  const status = document.getElementById('upload-status');
  status.textContent = '📤 Enviando foto pro ImgBB...';

  try {
    // Monta o formulário pro ImgBB
    const formData = new FormData();
    formData.append('image', arquivo);

    // Envia pro ImgBB
    const response = await fetch(`${IMGBB_URL}?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Erro no upload');
    }

    // Pega a URL da foto hospedada no ImgBB
    const urlFoto = result.data.url;
    const urlThumb = result.data.thumb?.url || urlFoto;
    const deleteUrl = result.data.delete_url; // URL pra deletar no ImgBB (opcional)

    // Salva só a URL no Firestore (texto leve, tudo grátis)
    await addDoc(collection(db, 'fotos'), {
      url: urlFoto,
      thumb: urlThumb,
      deleteUrl,
      legenda,
      criadoEm: serverTimestamp()
    });

    status.textContent = '✅ Foto enviada com sucesso!';
    formFoto.reset();
    setTimeout(() => status.textContent = '', 3000);
  } catch (err) {
    console.error('Erro upload:', err);
    status.textContent = '❌ Erro: ' + err.message;
  }
});

onSnapshot(query(collection(db, 'fotos'), orderBy('criadoEm', 'desc')), (snap) => {
  fotos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGaleria();
});

function renderGaleria() {
  const grid = document.getElementById('galeria-grid');
  if (!fotos.length) {
    grid.innerHTML = '<p class="hint">Nenhuma foto ainda. Bora registrar os churrascos!</p>';
    return;
  }
  grid.innerHTML = fotos.map(f => `
    <div class="galeria-item" onclick="abrirFoto('${f.url}','${f.id}')">
      <img src="${f.thumb || f.url}" alt="${escapeHtml(f.legenda||'')}" loading="lazy" />
      ${f.legenda ? `<div class="legenda">${escapeHtml(f.legenda)}</div>` : ''}
    </div>
  `).join('');
}

window.abrirFoto = (url, id) => {
  const acao = confirm('Deseja REMOVER esta foto da galeria?\n\n(Cancelar = apenas abrir em nova aba)');
  if (acao) {
    removerFoto(id);
  } else {
    window.open(url, '_blank');
  }
};

async function removerFoto(id) {
  try {
    await deleteDoc(doc(db, 'fotos', id));
    // Nota: a foto continua no ImgBB, mas some da galeria. Sem custo.
  } catch(e) {
    console.error(e);
    alert('Erro ao remover foto');
  }
}

// ===== MURAL DE OFENSAS =====
const formOfensa = document.getElementById('form-ofensa');
formOfensa.addEventListener('submit', async (e) => {
  e.preventDefault();
  const autor = document.getElementById('ofensa-autor').value.trim();
  const texto = document.getElementById('ofensa-texto').value.trim();
  if (!autor || !texto) return;
  await addDoc(collection(db, 'ofensas'), { autor, texto, criadoEm: serverTimestamp() });
  document.getElementById('ofensa-texto').value = '';
});

onSnapshot(query(collection(db, 'ofensas'), orderBy('criadoEm', 'desc')), (snap) => {
  ofensas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderOfensas();
});

function renderOfensas() {
  const lista = document.getElementById('lista-ofensas');
  if (!ofensas.length) {
    lista.innerHTML = '<p class="hint">Nenhuma ofensa ainda. Seja o primeiro a zoar! 🤬</p>';
    return;
  }
  lista.innerHTML = ofensas.map(o => {
    const data = o.criadoEm?.toDate ? o.criadoEm.toDate().toLocaleString('pt-BR') : '';
    return `
      <div class="ofensa-item">
        <span class="data-ofensa">${data}</span>
        <span class="autor">${escapeHtml(o.autor)}</span>
        <div class="texto">${escapeHtml(o.texto)}</div>
        <button class="btn-excluir" onclick="removerOfensa('${o.id}')" style="margin-top:8px;padding:4px 8px;font-size:0.75rem;">🗑️</button>
      </div>
    `;
  }).join('');
}

window.removerOfensa = async (id) => {
  if (!confirm('Remover esta ofensa?')) return;
  await deleteDoc(doc(db, 'ofensas', id));
};

// ===== UTILS =====
function formatarData(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
