// ===== FIREBASE IMPORTS =====
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  getDocs, getDoc, setDoc, where, writeBatch, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


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
const auth = getAuth(app);

// ===== CONFIG ADMIN =====
const ADMIN_UID = "k3M4PRRdjaXxm2VbNGOyNsR6HoF2";

// ===== CONFIG IMGBB =====
const IMGBB_API_KEY = "b720bed751ebd8db5cf2d61b47abb2ba";
const IMGBB_URL = "https://api.imgbb.com/1/upload";

// ===== ESTADO =====
let currentUser = null;
let isAdmin = false;
let membros = [];
let duplas = [];
let churrascos = [];
let ofensas = [];
let unsubscribes = [];

// ===== LOGIN =====
const formLogin = document.getElementById('form-login');
const telaLogin = document.getElementById('tela-login');
const appContainer = document.getElementById('app-container');
const loginErro = document.getElementById('login-erro');

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  loginErro.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    console.error(err);
    const msgs = {
      'auth/invalid-credential': 'Email ou senha incorretos',
      'auth/user-not-found': 'Usuário não cadastrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/invalid-email': 'Email inválido',
      'auth/too-many-requests': 'Muitas tentativas. Tenta mais tarde.'
    };
    loginErro.textContent = msgs[err.code] || 'Erro ao entrar. Tenta de novo.';
  }
});

// ===== LOGOUT =====
document.getElementById('btn-logout').addEventListener('click', async () => {
  if (!confirm('Sair da conta?')) return;
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  unsubscribes.forEach(u => u && u());
  unsubscribes = [];

  if (user) {
    currentUser = user;
    isAdmin = user.uid === ADMIN_UID;

    telaLogin.classList.add('hidden');
    appContainer.classList.remove('hidden');

    const nomeExibido = user.displayName || user.email.split('@')[0];
    document.getElementById('user-nome').textContent = `👤 ${nomeExibido}`;

    const badge = document.getElementById('user-badge');
    if (isAdmin) badge.classList.remove('hidden');
    else badge.classList.add('hidden');

    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });

    iniciarListeners();
    formLogin.reset();
  } else {
    currentUser = null;
    isAdmin = false;
    telaLogin.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
});

// ===== NAVEGAÇÃO DE ABAS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== HELPERS =====
function nomeAtual() {
  if (!currentUser) return 'Anônimo';
  return currentUser.displayName || currentUser.email.split('@')[0];
}

async function uploadImagemImgBB(arquivo) {
  const formData = new FormData();
  formData.append('image', arquivo);
  const response = await fetch(`${IMGBB_URL}?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'Erro no upload da imagem');
  }
  return result.data.url;
}

// ===== LISTENERS =====
function iniciarListeners() {
  unsubscribes.push(onSnapshot(collection(db, 'membros'), (snap) => {
    membros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMembrosAdmin();
    renderSelectMembrosDupla();
    renderSelectResponsavel();
    renderSelectPresenca();
    renderRankings();
    renderHome();
  }));

  unsubscribes.push(onSnapshot(collection(db, 'duplas'), (snap) => {
    duplas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDuplasAdmin();
    renderSelectResponsavel();
    renderRankings();
    renderHome();
  }));

  unsubscribes.push(onSnapshot(query(collection(db, 'churrascos'), orderBy('data', 'asc')), (snap) => {
    churrascos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAgenda();
    renderHistorico();
    renderSelectPresenca();
    renderRankings();
    renderHome();
  }));

  // Financeiro: doc fixo config/financeiro
  unsubscribes.push(onSnapshot(doc(db, 'config', 'financeiro'), (snap) => {
    const dados = snap.exists() ? snap.data() : null;
    renderFinanceiroHome(dados);
    renderFinanceiroAdmin(dados);
  }));

  carregarOfensas();  carregarFotos();

}

// ===== CADASTRAR USUÁRIO (CONTA + MEMBRO) — SÓ ADMIN =====
document.getElementById('form-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) { alert('🚫 Só o admin pode cadastrar usuários!'); return; }

  const nome   = document.getElementById('usuario-nome').value.trim();
  const email  = document.getElementById('usuario-email').value.trim();
  const senha  = document.getElementById('usuario-senha').value;
  const status = document.getElementById('usuario-status');
  if (!nome || !email || !senha) return;

  status.style.color = '#ff7a33';
  status.textContent = '⏳ Criando conta...';

  const secApp  = initializeApp(firebaseConfig, 'secundario-' + Date.now());
  const secAuth = getAuth(secApp);

  try {
    const cred = await createUserWithEmailAndPassword(secAuth, email, senha);
    const novoUid = cred.user.uid;

    await addDoc(collection(db, 'membros'), {
      nome,
      uid: novoUid,
      email,
      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp()
    });

    status.style.color = '#7aff7a';
    status.textContent = '✅ Conta e membro criados!';
    e.target.reset();
  } catch (err) {
    console.error(err);
    const msgs = {
      'auth/email-already-in-use': 'Esse email já tem conta.',
      'auth/invalid-email': 'Email inválido.',
      'auth/weak-password': 'Senha fraca (mínimo 6 caracteres).'
    };
    status.style.color = '#ff7a33';
    status.textContent = '❌ ' + (msgs[err.code] || err.message);
  } finally {
    await signOut(secAuth).catch(() => {});
    await deleteApp(secApp).catch(() => {});
  }
});

// ===== CADASTRAR DUPLA — SÓ ADMIN =====
function renderSelectMembrosDupla() {
  const s1 = document.getElementById('dupla-membro1');
  const s2 = document.getElementById('dupla-membro2');
  if (!s1 || !s2) return;
  const opcoes = membros.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
  s1.innerHTML = '<option value="">Membro 1...</option>' + opcoes;
  s2.innerHTML = '<option value="">Membro 2...</option>' + opcoes;
}

document.getElementById('form-dupla').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) { alert('🚫 Só o admin pode cadastrar casais!'); return; }

  const id1 = document.getElementById('dupla-membro1').value;
  const id2 = document.getElementById('dupla-membro2').value;
  const status = document.getElementById('dupla-status');

  if (!id1 || !id2) { status.textContent = '❌ Escolha os dois membros.'; return; }
  if (id1 === id2) { status.textContent = '❌ O casal precisa de dois membros diferentes.'; return; }

  const m1 = membros.find(m => m.id === id1);
  const m2 = membros.find(m => m.id === id2);
  const nomeDupla = `${m1.nome} & ${m2.nome}`;

  // Evita dupla repetida (mesma combinação, em qualquer ordem)
  const jaExiste = duplas.some(d =>
    (d.membro1Id === id1 && d.membro2Id === id2) ||
    (d.membro1Id === id2 && d.membro2Id === id1)
  );
  if (jaExiste) { status.textContent = '❌ Essa casal já existe.'; return; }

  try {
    await addDoc(collection(db, 'duplas'), {
      nome: nomeDupla,
      membro1Id: id1, membro1Nome: m1.nome,
      membro2Id: id2, membro2Nome: m2.nome,
      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp()
    });
    status.style.color = '#7aff7a';
    status.textContent = '✅ Casal criado!';
    e.target.reset();
  } catch (err) {
    console.error(err);
    status.style.color = '#ff7a33';
    status.textContent = '❌ ' + err.message;
  }
});

function renderDuplasAdmin() {
  const lista = document.getElementById('lista-duplas-admin');
  if (!lista) return;
  if (!isAdmin) { lista.innerHTML = ''; return; }
  if (!duplas.length) {
    lista.innerHTML = '<p class="hint">Nenhum casal cadastrado.</p>';
    return;
  }
  lista.innerHTML = duplas.map(d => `
    <div class="evento-item" style="display:flex;justify-content:space-between;align-items:center;">
      <span>👥 <strong>${escapeHtml(d.nome)}</strong></span>
      <button class="btn-excluir" onclick="excluirDupla('${d.id}')">🗑️ Excluir</button>
    </div>
  `).join('');
}

window.excluirDupla = async (duplaId) => {
  if (!isAdmin) return alert('🚫 Só admin.');
  const d = duplas.find(x => x.id === duplaId);
  if (!d) return;
  if (!confirm(`Excluir o casal "${d.nome}"?\n\nOs churrascos já realizados por ela continuam no histórico e no ranking.`)) return;
  try {
    await deleteDoc(doc(db, 'duplas', duplaId));
  } catch (err) {
    console.error(err);
    alert('Erro: ' + err.message);
  }
};

// ===== LISTA DE MEMBROS COM EXCLUSÃO (SÓ ADMIN) =====
function renderMembrosAdmin() {
  const lista = document.getElementById('lista-membros-admin');
  if (!lista) return;
  if (!isAdmin) { lista.innerHTML = ''; return; }
  if (!membros.length) {
    lista.innerHTML = '<p class="hint">Nenhum membro cadastrado.</p>';
    return;
  }
  lista.innerHTML = membros.map(m => `
    <div class="evento-item" style="display:flex;justify-content:space-between;align-items:center;">
      <span>👤 <strong>${escapeHtml(m.nome)}</strong>${m.email ? ` <span style="opacity:.6;font-size:.85rem;">(${escapeHtml(m.email)})</span>` : ''}${m.uid ? '' : ' <span style="opacity:.5;font-size:.75rem;">[sem login]</span>'}</span>
      <button class="btn-excluir" onclick="excluirDadosMembro('${m.id}')">🗑️ Excluir dados</button>
    </div>
  `).join('');
}

window.excluirDadosMembro = async (membroId) => {
  if (!isAdmin) return alert('🚫 Só admin.');
  const m = membros.find(x => x.id === membroId);
  if (!m) return;

  const aviso = m.uid
    ? `Excluir "${m.nome}" e TODOS os dados dele (ofensas, comentários, presença)?\n\n⚠️ O LOGIN continua no console do Firebase. Remova manualmente lá.\n\nOs casais que incluem esse membro também serão apagadas.`
    : `Excluir "${m.nome}" e os dados de presença dele?\n\nOs casais que incluem esse membro também serão apagadas.`;
  if (!confirm(aviso)) return;

  try {
    // 1) Remove a presença desse membro de todos os churrascos
    const churrasSnap = await getDocs(collection(db, 'churrascos'));
    const batch = writeBatch(db);
    churrasSnap.forEach(cDoc => {
      const c = cDoc.data();
      if ((c.presentes || []).includes(membroId)) {
        batch.update(cDoc.ref, { presentes: arrayRemove(membroId) });
      }
    });
    await batch.commit();

    // 2) Apaga duplas que contenham esse membro
    const duplasDoMembro = duplas.filter(d => d.membro1Id === membroId || d.membro2Id === membroId);
    for (const d of duplasDoMembro) {
      await deleteDoc(doc(db, 'duplas', d.id));
    }

    // 3) Se tiver uid, apaga ofensas e comentários do usuário
    if (m.uid) {
      const ofensasSnap = await getDocs(
        query(collection(db, 'ofensas'), where('uid', '==', m.uid))
      );
      for (const ofDoc of ofensasSnap.docs) {
        const comSnap = await getDocs(collection(db, 'ofensas', ofDoc.id, 'comentarios'));
        for (const com of comSnap.docs) {
          await deleteDoc(doc(db, 'ofensas', ofDoc.id, 'comentarios', com.id));
        }
        await deleteDoc(doc(db, 'ofensas', ofDoc.id));
      }
    }

    // 4) Apaga o documento do membro
    await deleteDoc(doc(db, 'membros', membroId));

    alert('✅ Dados do membro excluídos. Lembra de remover o login no console do Firebase.');
  } catch (err) {
    console.error('Erro ao excluir dados do membro:', err);
    alert('Erro: ' + err.message);
  }
};

// ===== SELECT DE RESPONSÁVEL (DUPLAS + MEMBROS AVULSOS) =====
function renderSelectResponsavel() {
  const sel = document.getElementById('churrasco-responsavel');
  if (!sel) return;
  const optDuplas = duplas.length
    ? `<optgroup label="👥 Casais">${duplas.map(d => `<option value="dupla:${d.id}">${escapeHtml(d.nome)}</option>`).join('')}</optgroup>`
    : '';
  const optMembros = membros.length
    ? `<optgroup label="👤 Avulsos">${membros.map(m => `<option value="membro:${m.id}">${escapeHtml(m.nome)}</option>`).join('')}</optgroup>`
    : '';
  sel.innerHTML = '<option value="">Churrasqueiro responsável...</option>' + optDuplas + optMembros;
}

// ===== AGENDA =====
document.getElementById('form-agenda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = document.getElementById('churrasco-data').value;
  const valorResp = document.getElementById('churrasco-responsavel').value; // "dupla:id" ou "membro:id"
  const obs = document.getElementById('churrasco-obs').value.trim();

  if (!valorResp) { alert('Escolha o churrasqueiro responsável.'); return; }

  const [tipo, idResp] = valorResp.split(':');
  let nomeResp = 'Desconhecido';
  if (tipo === 'dupla') {
    const d = duplas.find(x => x.id === idResp);
    nomeResp = d ? d.nome : 'Casal removido';
  } else {
    const m = membros.find(x => x.id === idResp);
    nomeResp = m ? m.nome : 'Membro removido';
  }

  await addDoc(collection(db, 'churrascos'), {
    data,
    responsavelTipo: tipo,            // "dupla" ou "membro"
    responsavelId: idResp,
    responsavelNome: nomeResp,
    obs,
    realizado: false,
    presentes: [],
    criadoPor: currentUser.uid,
    criadoPorNome: nomeAtual(),
    criadoEm: serverTimestamp()
  });
  e.target.reset();
  alert('🔥 Churrasco agendado!');
});

function renderAgenda() {
  const hoje = new Date().toISOString().split('T')[0];
  const proximos = churrascos.filter(c => !c.realizado && c.data >= hoje);
  const lista = document.getElementById('lista-agenda');
  if (!proximos.length) {
    lista.innerHTML = '<p class="hint">Nenhum churrasco agendado. Bora marcar um!</p>';
    return;
  }
  lista.innerHTML = proximos.map(c => {
    const podeExcluir = isAdmin || c.criadoPor === currentUser.uid;
    return `
      <div class="evento-item">
        <div class="data">📅 ${formatarData(c.data)}</div>
        <div class="info">🔥 Churrasqueiro: <strong>${escapeHtml(c.responsavelNome)}</strong></div>
        ${c.obs ? `<div class="info">📝 ${escapeHtml(c.obs)}</div>` : ''}
        ${c.criadoPorNome ? `<div class="info" style="font-size:0.8rem;opacity:0.7;">— agendado por ${escapeHtml(c.criadoPorNome)}</div>` : ''}
        ${podeExcluir ? `<button class="btn-excluir" onclick="excluirChurrasco('${c.id}')">🗑️ Excluir</button>` : ''}
      </div>
    `;
  }).join('');
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
    const podeExcluir = isAdmin || c.criadoPor === currentUser.uid;
    return `
      <div class="evento-item">
        <div class="data">✅ ${formatarData(c.data)}</div>
        <div class="info">🔥 ${escapeHtml(c.responsavelNome)}</div>
        <div class="info">👥 Presentes (${(c.presentes||[]).length}): ${escapeHtml(presentesNomes) || '—'}</div>
        ${podeExcluir ? `<button class="btn-excluir" onclick="excluirChurrasco('${c.id}')">🗑️ Excluir</button>` : ''}
      </div>
    `;
  }).join('');
}

window.excluirChurrasco = async (id) => {
  const c = churrascos.find(x => x.id === id);
  if (!c) return;
  if (!isAdmin && c.criadoPor !== currentUser.uid) {
    return alert('🚫 Só quem criou (ou o admin) pode excluir');
  }
  if (!confirm('Excluir este churrasco?')) return;
  await deleteDoc(doc(db, 'churrascos', id));
};

// ===== PRESENÇA (POR MEMBRO) =====
function renderSelectPresenca() {
  const sel = document.getElementById('select-churrasco-presenca');
  if (!sel) return;
  const naoRealizados = churrascos.filter(c => !c.realizado);
  sel.innerHTML = '<option value="">Selecione o churrasco...</option>' +
    naoRealizados.map(c => `<option value="${c.id}">${formatarData(c.data)} — ${escapeHtml(c.responsavelNome)}</option>`).join('');
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
  if (!confirm('Salvar presença e marcar churrasco como REALIZADO?')) return;
  await updateDoc(doc(db, 'churrascos', id), { presentes, realizado: true });
  alert('✅ Presença salva! Rankings atualizados.');
  document.getElementById('select-churrasco-presenca').value = '';
  document.getElementById('lista-presenca-membros').innerHTML = '';
  document.getElementById('btn-salvar-presenca').classList.add('hidden');
});

// ===== RANKINGS =====
// Churrasqueiro: agrupa por chave composta tipo:id (dupla ou membro)
function renderRankings() {
  const realizados = churrascos.filter(c => c.realizado);
  const totalRealizados = realizados.length;

  const contagemChurras = {}; // chave "tipo:id" -> { nome, total }
  realizados.forEach(c => {
    const tipo = c.responsavelTipo || 'membro';
    const chave = `${tipo}:${c.responsavelId}`;
    if (!contagemChurras[chave]) {
      contagemChurras[chave] = { nome: c.responsavelNome || '?', total: 0 };
    }
    contagemChurras[chave].total += 1;
  });
  const rankingChurras = Object.values(contagemChurras).sort((a, b) => b.total - a.total);

  const listaRank = document.getElementById('lista-ranking');
  if (listaRank) listaRank.innerHTML = rankingChurras.length
    ? rankingChurras.map(r => `<li><span class="nome">${escapeHtml(r.nome)}</span><span class="valor">${r.total} 🔥</span></li>`).join('')
    : '<p class="hint">Sem dados ainda.</p>';

  // Sumidos: por MEMBRO individual
  const contagemFaltas = {};
  realizados.forEach(c => {
    const presentes = c.presentes || [];
    membros.forEach(m => {
      if (!presentes.includes(m.id)) contagemFaltas[m.id] = (contagemFaltas[m.id] || 0) + 1;
    });
  });
  const rankingSumido = membros.map(m => ({
    nome: m.nome, faltas: contagemFaltas[m.id] || 0, total: totalRealizados
  })).sort((a, b) => b.faltas - a.faltas);

  const listaSumido = document.getElementById('lista-sumido');
  if (listaSumido) listaSumido.innerHTML = rankingSumido.length && totalRealizados
    ? rankingSumido.map(r => `<li><span class="nome">${escapeHtml(r.nome)}</span><span class="valor">${r.faltas}/${r.total} 👻</span></li>`).join('')
    : '<p class="hint">Sem churrascos realizados ainda.</p>';
}

// ===== HOME =====
function renderHome() {
  const hoje = new Date().toISOString().split('T')[0];
  const proximos = churrascos.filter(c => !c.realizado && c.data >= hoje);
  const prox = proximos[0];
  const divProx = document.getElementById('proximo-churrasco');
  if (divProx) divProx.innerHTML = prox
    ? `<div class="evento-item" style="margin:0;">
         <div class="data">📅 ${formatarData(prox.data)}</div>
         <div class="info">🔥 Churrasqueiro: <strong>${escapeHtml(prox.responsavelNome)}</strong></div>
         ${prox.obs ? `<div class="info">📝 ${escapeHtml(prox.obs)}</div>` : ''}
       </div>`
    : '<p class="hint">Nenhum churrasco agendado. Bora marcar um! 🔥</p>';

  const realizados = churrascos.filter(c => c.realizado);
  const elTotal = document.getElementById('total-churrascos');
  if (elTotal) elTotal.textContent = realizados.length;

  // Mestre por chave composta
  const contagem = {};
  realizados.forEach(c => {
    const tipo = c.responsavelTipo || 'membro';
    const chave = `${tipo}:${c.responsavelId}`;
    if (!contagem[chave]) contagem[chave] = { nome: c.responsavelNome || '?', total: 0 };
    contagem[chave].total += 1;
  });
  let mestreNome = null, max = 0;
  for (const chave in contagem) {
    if (contagem[chave].total > max) { max = contagem[chave].total; mestreNome = contagem[chave].nome; }
  }
  const elMestre = document.getElementById('mestre-churrasco');
  if (elMestre) elMestre.textContent = mestreNome ? `🥇 ${mestreNome} (${max})` : '—';

  // Sumido por membro
  const faltas = {};
  realizados.forEach(c => {
    const p = c.presentes || [];
    membros.forEach(m => { if (!p.includes(m.id)) faltas[m.id] = (faltas[m.id] || 0) + 1; });
  });
  let sumido = null, maxF = 0;
  for (const id in faltas) if (faltas[id] > maxF) { maxF = faltas[id]; sumido = id; }
  const sumidoObj = membros.find(m => m.id === sumido);
  const elSum = document.getElementById('sumido-vez');
  if (elSum) elSum.textContent = sumidoObj && maxF > 0 ? `👻 ${sumidoObj.nome} (${maxF})` : '—';
}

// ===== FINANCEIRO =====
document.getElementById('form-financeiro').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) { alert('🚫 Só o admin pode atualizar o saldo!'); return; }
  const saldo = parseFloat(document.getElementById('financeiro-saldo').value);
  const status = document.getElementById('financeiro-status');
  if (isNaN(saldo)) { status.style.color = '#ff7a33'; status.textContent = '❌ Informe um valor válido.'; return; }

  try {
    await setDoc(doc(db, 'config', 'financeiro'), {
      saldo,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: nomeAtual()
    });
    status.style.color = '#7aff7a';
    status.textContent = '✅ Saldo atualizado!';
    e.target.reset();
  } catch (err) {
    console.error(err);
    status.style.color = '#ff7a33';
    status.textContent = '❌ ' + err.message;
  }
});

function formatarReal(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderFinanceiroHome(dados) {
  const elSaldo = document.getElementById('caixinha-saldo');
  const elData = document.getElementById('caixinha-data');
  if (!elSaldo) return;
  if (!dados || dados.saldo == null) {
    elSaldo.textContent = '—';
    if (elData) elData.textContent = '';
    return;
  }
  elSaldo.textContent = formatarReal(dados.saldo);
  if (elData) {
    const d = dados.atualizadoEm?.toDate?.();
    elData.textContent = d ? `Atualizado em ${d.toLocaleDateString('pt-BR')}` : '';
  }
}

function renderFinanceiroAdmin(dados) {
  const div = document.getElementById('financeiro-atual');
  if (!div) return;
  if (!isAdmin) { div.innerHTML = ''; return; }
  if (!dados || dados.saldo == null) {
    div.innerHTML = '<p class="hint">Nenhum saldo registrado ainda.</p>';
    return;
  }
  const d = dados.atualizadoEm?.toDate?.();
  div.innerHTML = `
    <div class="evento-item" style="margin:0;">
      <div class="info">💰 Saldo atual: <strong>${formatarReal(dados.saldo)}</strong></div>
      ${d ? `<div class="info">📅 Atualizado em ${d.toLocaleString('pt-BR')}</div>` : ''}
      ${dados.atualizadoPor ? `<div class="info" style="font-size:0.8rem;opacity:0.7;">— por ${escapeHtml(dados.atualizadoPor)}</div>` : ''}
    </div>
  `;
}

// ===== POSTAR OFENSA (COM FOTO OPCIONAL) =====
document.getElementById('form-ofensa').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = document.getElementById('ofensa-texto').value.trim();
  if (!texto) return;

  const inputFoto = document.getElementById('ofensa-foto');
  const statusFoto = document.getElementById('ofensa-foto-status');
  const btnPostar = document.getElementById('btn-postar-ofensa');
  const arquivo = inputFoto?.files?.[0] || null;
  let fotoUrl = null;

  if (btnPostar) btnPostar.disabled = true;

  try {
    if (arquivo) {
      if (arquivo.size > 32 * 1024 * 1024) {
        alert('❌ Imagem muito grande. Máximo 32MB.');
        if (btnPostar) btnPostar.disabled = false;
        return;
      }
      if (statusFoto) statusFoto.textContent = '📤 Enviando imagem...';
      fotoUrl = await uploadImagemImgBB(arquivo);
    }

    await addDoc(collection(db, 'ofensas'), {
      texto,
      fotoUrl,
      autor: nomeAtual(),
      uid: currentUser.uid,
      criadoEm: serverTimestamp()
    });

    e.target.reset();
    if (statusFoto) statusFoto.textContent = '';
  } catch (err) {
    console.error('Erro ao postar ofensa:', err);
    alert('Erro ao postar ofensa: ' + err.message);
    if (statusFoto) statusFoto.textContent = '';
  } finally {
    if (btnPostar) btnPostar.disabled = false;
  }
});

// ============================================
// OFENSAS COM COMENTÁRIOS
// ============================================
function carregarOfensas() {
  const q = query(collection(db, "ofensas"), orderBy("criadoEm", "desc"));

  const unsub = onSnapshot(q, (snapshot) => {
    const lista = document.getElementById("lista-ofensas");

    if (snapshot.empty) {
      lista.innerHTML = '<p class="hint">Nenhuma ofensa ainda. Bora zoar a galera! 😈</p>';
      return;
    }

    lista.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const ofensa = docSnap.data();
      const ofensaId = docSnap.id;
      const data = ofensa.criadoEm?.toDate?.() || new Date();
      const dataFormatada = data.toLocaleString('pt-BR');

      const podeExcluir = isAdmin || (currentUser && ofensa.uid === currentUser.uid);

      const imagemHtml = ofensa.fotoUrl
        ? `<img src="${ofensa.fotoUrl}" class="ofensa-img" alt="imagem da ofensa" loading="lazy" onclick="window.open('${ofensa.fotoUrl}','_blank')" />`
        : '';

      const div = document.createElement("div");
      div.className = "ofensa-item";
      div.innerHTML = `
        <span class="data-ofensa">📅 ${dataFormatada}</span>
        <span class="autor">${ofensa.autor || 'Anônimo'}</span>
        <p class="texto">${escapeHtml(ofensa.texto)}</p>
        ${imagemHtml}

        <div class="ofensa-acoes">
          <button class="btn-comentar" data-id="${ofensaId}">💬 Responder</button>
          <span class="contador-comentarios" id="contador-${ofensaId}">0 comentários</span>
          ${podeExcluir ? `<button class="btn-excluir" data-id="${ofensaId}" data-tipo="ofensa">🗑️ Excluir</button>` : ''}
        </div>

        <div class="form-comentario hidden" id="form-${ofensaId}">
          <textarea placeholder="✍️ Escreve sua resposta..." id="texto-${ofensaId}"></textarea>
          <button class="btn-mini" data-id="${ofensaId}">🔥 Postar Resposta</button>
        </div>

        <div class="lista-comentarios" id="comentarios-${ofensaId}"></div>
      `;

      lista.appendChild(div);
      carregarComentarios(ofensaId);
    });

    document.querySelectorAll('.btn-comentar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        document.getElementById(`form-${id}`).classList.toggle('hidden');
      });
    });

    document.querySelectorAll('.form-comentario .btn-mini').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ofensaId = e.target.dataset.id;
        const textarea = document.getElementById(`texto-${ofensaId}`);
        const texto = textarea.value.trim();

        if (!texto) {
          alert('Escreve algo aí, brother! 😅');
          return;
        }

        try {
          await addDoc(collection(db, "ofensas", ofensaId, "comentarios"), {
            texto: texto,
            autor: currentUser.email.split('@')[0],
            uid: currentUser.uid,
            criadoEm: serverTimestamp()
          });
          textarea.value = '';
          document.getElementById(`form-${ofensaId}`).classList.add('hidden');
        } catch (err) {
          console.error('Erro ao postar comentário:', err);
          alert('Erro ao postar. Tenta de novo!');
        }
      });
    });

    document.querySelectorAll('.btn-excluir[data-tipo="ofensa"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('Excluir essa ofensa e todos os comentários?')) return;
        const id = e.target.dataset.id;
        try {
          await deleteDoc(doc(db, "ofensas", id));
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao excluir!');
        }
      });
    });
  });

  unsubscribes.push(unsub);
}

// ============================================
// CARREGAR COMENTÁRIOS DE UMA OFENSA
// ============================================
function carregarComentarios(ofensaId) {
  const q = query(
    collection(db, "ofensas", ofensaId, "comentarios"),
    orderBy("criadoEm", "asc")
  );

  onSnapshot(q, (snapshot) => {
    const container = document.getElementById(`comentarios-${ofensaId}`);
    const contador = document.getElementById(`contador-${ofensaId}`);

    if (!container) return;

    container.innerHTML = "";
    if (contador) {
      contador.textContent = `💬 ${snapshot.size} ${snapshot.size === 1 ? 'comentário' : 'comentários'}`;
    }

    snapshot.forEach((docSnap) => {
      const c = docSnap.data();
      const cid = docSnap.id;
      const data = c.criadoEm?.toDate?.() || new Date();
      const dataFormatada = data.toLocaleString('pt-BR');

      const podeExcluir = isAdmin || (currentUser && c.uid === currentUser.uid);

      const div = document.createElement("div");
      div.className = "comentario-item";
      div.innerHTML = `
        <span class="autor-comentario">${c.autor || 'Anônimo'}</span>
        <span class="data-comentario">${dataFormatada}</span>
        <div class="texto-comentario">${escapeHtml(c.texto)}</div>
        ${podeExcluir ? `<button class="btn-excluir-mini" data-ofensa="${ofensaId}" data-comentario="${cid}">✕</button>` : ''}
      `;
      container.appendChild(div);
    });

    container.querySelectorAll('.btn-excluir-mini').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('Excluir esse comentário?')) return;
        const ofId = e.target.dataset.ofensa;
        const coId = e.target.dataset.comentario;
        try {
          await deleteDoc(doc(db, "ofensas", ofId, "comentarios", coId));
        } catch (err) {
          console.error('Erro:', err);
        }
      });
    });
  });
}
// ============================================
// MURAL DE FOTOS
// ============================================
const modalAddFoto = document.getElementById('modal-add-foto');
const modalVerFoto = document.getElementById('modal-ver-foto');
let arquivoFotoSelecionado = null;

document.getElementById('btn-nova-foto').addEventListener('click', () => {
  modalAddFoto.classList.remove('hidden');
});
document.getElementById('fechar-add-foto').addEventListener('click', fecharModalAddFoto);
modalAddFoto.addEventListener('click', (e) => {
  if (e.target === modalAddFoto) fecharModalAddFoto();
});

function fecharModalAddFoto() {
  modalAddFoto.classList.add('hidden');
  document.getElementById('form-foto').reset();
  arquivoFotoSelecionado = null;
  document.getElementById('foto-preview').classList.add('hidden');
  document.getElementById('foto-dropzone-texto').classList.remove('hidden');
  document.getElementById('foto-status').textContent = '';
}

// Prévia da imagem selecionada
document.getElementById('foto-arquivo').addEventListener('change', (e) => {
  const arquivo = e.target.files?.[0];
  if (!arquivo) return;
  arquivoFotoSelecionado = arquivo;
  const preview = document.getElementById('foto-preview');
  preview.src = URL.createObjectURL(arquivo);
  preview.classList.remove('hidden');
  document.getElementById('foto-dropzone-texto').classList.add('hidden');
});

// Postar foto
document.getElementById('form-foto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const arquivo = arquivoFotoSelecionado;
  const legenda = document.getElementById('foto-legenda').value.trim();
  const status = document.getElementById('foto-status');
  const btn = document.getElementById('btn-postar-foto');

  if (!arquivo) { status.textContent = '❌ Selecione uma foto.'; return; }
  if (arquivo.size > 32 * 1024 * 1024) { status.textContent = '❌ Imagem muito grande (máx. 32MB).'; return; }

  btn.disabled = true;
  status.style.color = '#ff7a33';
  status.textContent = '📤 Enviando foto...';

  try {
    const fotoUrl = await uploadImagemImgBB(arquivo);
    await addDoc(collection(db, 'fotos'), {
      fotoUrl,
      legenda: legenda || 'Sem legenda',
      autor: nomeAtual(),
      uid: currentUser.uid,
      criadoEm: serverTimestamp()
    });
    fecharModalAddFoto();
  } catch (err) {
    console.error('Erro ao postar foto:', err);
    status.style.color = '#ff7a33';
    status.textContent = '❌ ' + err.message;
  } finally {
    btn.disabled = false;
  }
});

// Carregar galeria
function carregarFotos() {
  const q = query(collection(db, 'fotos'), orderBy('criadoEm', 'desc'));
  const unsub = onSnapshot(q, (snapshot) => {
    const galeria = document.getElementById('galeria-fotos');
    if (!galeria) return;

    if (snapshot.empty) {
      galeria.innerHTML = '<p class="hint">Nenhuma foto ainda. Bora postar a primeira! 📸</p>';
      return;
    }

    galeria.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const f = docSnap.data();
      const id = docSnap.id;
      const data = f.criadoEm?.toDate?.() || new Date();
      const dataFmt = data.toLocaleDateString('pt-BR');
      const podeExcluir = isAdmin || (currentUser && f.uid === currentUser.uid);

      const card = document.createElement('div');
      card.className = 'foto-card';
      card.innerHTML = `
        <img src="${f.fotoUrl}" class="foto-thumb" alt="foto" loading="lazy" />
        <div class="foto-legenda-box">
          <span class="foto-titulo">${escapeHtml(f.legenda || 'Sem legenda')}</span>
          <span class="foto-data">📅 ${dataFmt}</span>
        </div>
        ${podeExcluir ? `<button class="btn-excluir-foto" data-id="${id}">🗑️</button>` : ''}
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-excluir-foto')) return;
        abrirModalVerFoto(id, f, dataFmt);
      });

      const btnDel = card.querySelector('.btn-excluir-foto');
      if (btnDel) {
        btnDel.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Excluir essa foto e todos os comentários dela?')) return;
          try {
            const comSnap = await getDocs(collection(db, 'fotos', id, 'comentarios'));
            for (const com of comSnap.docs) {
              await deleteDoc(doc(db, 'fotos', id, 'comentarios', com.id));
            }
            await deleteDoc(doc(db, 'fotos', id));
          } catch (err) {
            console.error('Erro ao excluir foto:', err);
            alert('Erro ao excluir.');
          }
        });
      }

      galeria.appendChild(card);
    });
  });
  unsubscribes.push(unsub);
}

// Abrir modal de visualização + comentários
let unsubComentariosFoto = null;
function abrirModalVerFoto(id, foto, dataFmt) {
  document.getElementById('ver-foto-img').src = foto.fotoUrl;
  document.getElementById('ver-foto-legenda').textContent = foto.legenda || 'Sem legenda';
  document.getElementById('ver-foto-data').textContent = `📅 ${dataFmt} — por ${foto.autor || 'Anônimo'}`;
  modalVerFoto.classList.remove('hidden');

  const btnComentar = document.getElementById('btn-comentar-foto');
  btnComentar.onclick = async () => {
    const textarea = document.getElementById('ver-foto-comentario');
    const texto = textarea.value.trim();
    if (!texto) { alert('Escreve algo aí, brother! 😅'); return; }
    try {
      await addDoc(collection(db, 'fotos', id, 'comentarios'), {
        texto,
        autor: nomeAtual(),
        uid: currentUser.uid,
        criadoEm: serverTimestamp()
      });
      textarea.value = '';
    } catch (err) {
      console.error('Erro ao comentar:', err);
      alert('Erro ao comentar. Tenta de novo!');
    }
  };

  if (unsubComentariosFoto) unsubComentariosFoto();
  const q = query(collection(db, 'fotos', id, 'comentarios'), orderBy('criadoEm', 'asc'));
  unsubComentariosFoto = onSnapshot(q, (snapshot) => {
    const container = document.getElementById('ver-foto-comentarios');
    if (!container) return;
    container.innerHTML = '';
    if (snapshot.empty) {
      container.innerHTML = '<p class="hint" style="padding:10px;">Nenhum comentário ainda.</p>';
      return;
    }
    snapshot.forEach((docSnap) => {
      const c = docSnap.data();
      const cid = docSnap.id;
      const d = c.criadoEm?.toDate?.() || new Date();
      const dFmt = d.toLocaleString('pt-BR');
      const podeExcluir = isAdmin || (currentUser && c.uid === currentUser.uid);

      const div = document.createElement('div');
      div.className = 'comentario-item';
      div.innerHTML = `
        <span class="autor-comentario">${escapeHtml(c.autor || 'Anônimo')}</span>
        <span class="data-comentario">${dFmt}</span>
        <div class="texto-comentario">${escapeHtml(c.texto)}</div>
        ${podeExcluir ? `<button class="btn-excluir-mini" data-com="${cid}">✕</button>` : ''}
      `;
      const btnDel = div.querySelector('.btn-excluir-mini');
      if (btnDel) {
        btnDel.addEventListener('click', async () => {
          if (!confirm('Excluir esse comentário?')) return;
          try {
            await deleteDoc(doc(db, 'fotos', id, 'comentarios', cid));
          } catch (err) { console.error(err); }
        });
      }
      container.appendChild(div);
    });
  });
}

function fecharModalVerFoto() {
  modalVerFoto.classList.add('hidden');
  if (unsubComentariosFoto) { unsubComentariosFoto(); unsubComentariosFoto = null; }
  document.getElementById('ver-foto-comentario').value = '';
}
document.getElementById('fechar-ver-foto').addEventListener('click', fecharModalVerFoto);
modalVerFoto.addEventListener('click', (e) => {
  if (e.target === modalVerFoto) fecharModalVerFoto();
});

// Função auxiliar pra escapar HTML (segurança)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== UTILS =====
function formatarData(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}
