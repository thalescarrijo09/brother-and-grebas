// ===== FIREBASE IMPORTS =====
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  getDocs, where, writeBatch, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js";



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
// ⚠️ SUBSTITUA pelo SEU UID copiado do Firebase Auth!
const ADMIN_UID = "DJtE0gEcDRd4JFARFxAobJshd8j1";

// ===== CONFIG IMGBB =====
const IMGBB_API_KEY = "b720bed751ebd8db5cf2d61b47abb2ba";
const IMGBB_URL = "https://api.imgbb.com/1/upload";

// ===== ESTADO =====
let currentUser = null;
let isAdmin = false;
let membros = [];
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
const formUsuario = document.getElementById('form-usuario');
const usuarioStatus = document.getElementById('usuario-status');

formUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome  = document.getElementById('usuario-nome').value.trim();
  const email = document.getElementById('usuario-email').value.trim();
  const senha = document.getElementById('usuario-senha').value;

  usuarioStatus.style.color = '#ff7a33';
  usuarioStatus.textContent = 'Criando conta...';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);

    // grava o nome no perfil do Auth
    await updateProfile(cred.user, { displayName: nome });

    // TODO: aqui você grava o membro no Firestore/Realtime DB,
    // usando cred.user.uid como chave, se for o caso.

    usuarioStatus.style.color = '#7aff7a';
    usuarioStatus.textContent = `Conta de ${nome} criada!`;
    formUsuario.reset();
  } catch (err) {
    console.error(err);
    const msgs = {
      'auth/email-already-in-use': 'Esse email já tem conta',
      'auth/invalid-email': 'Email inválido',
      'auth/weak-password': 'Senha fraca (mín. 6 caracteres)'
    };
    usuarioStatus.style.color = '#ff7a33';
    usuarioStatus.textContent = msgs[err.code] || 'Erro ao criar conta.';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  if (!confirm('Sair da conta?')) return;
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  // Desliga listeners antigos
  unsubscribes.forEach(u => u && u());
  unsubscribes = [];

  if (user) {
    currentUser = user;
    isAdmin = user.uid === ADMIN_UID;

    telaLogin.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Mostra nome do usuário (parte antes do @)
    const nomeExibido = user.displayName || user.email.split('@')[0];
    document.getElementById('user-nome').textContent = `👤 ${nomeExibido}`;

    // Badge admin
    const badge = document.getElementById('user-badge');
    if (isAdmin) badge.classList.remove('hidden');
    else badge.classList.add('hidden');

    // Esconde aba de membros pra não-admin
    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });

    // Esconde formulário de cadastrar membro pra não-admin
    const formMembro = document.getElementById('form-membro');
    if (formMembro) {
      formMembro.style.display = isAdmin ? '' : 'none';
    }

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

// ===== HELPER: nome do usuário atual =====
function nomeAtual() {
  if (!currentUser) return 'Anônimo';
  return currentUser.displayName || currentUser.email.split('@')[0];
}

// ===== HELPER: upload de imagem para ImgBB (reutilizável) =====
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
  renderMembros();
  renderMembrosAdmin();          // <-- adicione esta linha
  renderSelectResponsavel();
  renderSelectPresenca();
  renderRankings();
}));


  unsubscribes.push(onSnapshot(query(collection(db, 'churrascos'), orderBy('data', 'asc')), (snap) => {
    churrascos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAgenda();
    renderHistorico();
    renderSelectPresenca();
    renderRankings();
    renderHome();
  }));

  carregarOfensas();
}

// ===== MEMBROS (SÓ ADMIN) =====
document.getElementById('form-membro').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) { alert('🚫 Só o admin pode cadastrar membros!'); return; }
  const nome = document.getElementById('membro-nome').value.trim();
  if (!nome) return;
  await addDoc(collection(db, 'membros'), {
    nome,
    criadoPor: currentUser.uid,
    criadoEm: serverTimestamp()
  });
  document.getElementById('membro-nome').value = '';
});
// ===== CADASTRAR USUÁRIO (CONTA + MEMBRO) — SÓ ADMIN =====
document.getElementById('form-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin) { alert('🚫 Só o admin pode cadastrar usuários!'); return; }

  const nome   = document.getElementById('usuario-nome').value.trim();
  const email  = document.getElementById('usuario-email').value.trim();
  const senha  = document.getElementById('usuario-senha').value;
  const status = document.getElementById('usuario-status');
  if (!nome || !email || !senha) return;

  status.textContent = '⏳ Criando conta...';

  // Segunda instância: cria a conta SEM trocar a sessão do admin
  const secApp  = initializeApp(firebaseConfig, 'secundario-' + Date.now());
  const secAuth = getAuth(secApp);

  try {
    const cred = await createUserWithEmailAndPassword(secAuth, email, senha);
    const novoUid = cred.user.uid;

    // Cria o membro vinculado ao uid da conta nova (usa o db da sessão do admin)
    await addDoc(collection(db, 'membros'), {
      nome,
      uid: novoUid,
      email,
      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp()
    });

    status.textContent = '✅ Conta e membro criados!';
    e.target.reset();
  } catch (err) {
    console.error(err);
    const msgs = {
      'auth/email-already-in-use': 'Esse email já tem conta.',
      'auth/invalid-email': 'Email inválido.',
      'auth/weak-password': 'Senha fraca (mínimo 6 caracteres).'
    };
    status.textContent = '❌ ' + (msgs[err.code] || err.message);
  } finally {
    // Desliga a sessão secundária e descarta o app, sem afetar o admin
    await signOut(secAuth).catch(() => {});
    await deleteApp(secApp).catch(() => {});
  }
});


function renderMembros() {
  const lista = document.getElementById('lista-membros');
  if (!membros.length) {
    lista.innerHTML = '<p class="hint">Nenhum membro cadastrado ainda.</p>';
    return;
  }
  lista.innerHTML = membros.map(m => `
    <span class="membro-item">
      👤 ${escapeHtml(m.nome)}
      ${isAdmin ? `<button onclick="removerMembro('${m.id}')" title="Remover">✖</button>` : ''}
    </span>
  `).join('');
}
// ===== LISTA DE MEMBROS COM EXCLUSÃO DE DADOS (SÓ ADMIN) =====
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

// Apaga o membro e tudo ligado a ele
window.excluirDadosMembro = async (membroId) => {
  if (!isAdmin) return alert('🚫 Só admin.');
  const m = membros.find(x => x.id === membroId);
  if (!m) return;

  const aviso = m.uid
    ? `Excluir "${m.nome}" e TODOS os dados dele (ofensas, comentários, presença)?\n\n⚠️ O LOGIN continua no console do Firebase. Remova manualmente lá.`
    : `Excluir "${m.nome}" e os dados de presença dele?`;
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

    // 2) Se tiver uid, apaga ofensas e comentários do usuário
    if (m.uid) {
      const ofensasSnap = await getDocs(
        query(collection(db, 'ofensas'), where('uid', '==', m.uid))
      );
      for (const ofDoc of ofensasSnap.docs) {
        // apaga comentários da ofensa antes da ofensa
        const comSnap = await getDocs(collection(db, 'ofensas', ofDoc.id, 'comentarios'));
        for (const com of comSnap.docs) {
          await deleteDoc(doc(db, 'ofensas', ofDoc.id, 'comentarios', com.id));
        }
        await deleteDoc(doc(db, 'ofensas', ofDoc.id));
      }
    }

    // 3) Apaga o documento do membro
    await deleteDoc(doc(db, 'membros', membroId));

    alert('✅ Dados do membro excluídos. Lembra de remover o login no console do Firebase.');
  } catch (err) {
    console.error('Erro ao excluir dados do membro:', err);
    alert('Erro: ' + err.message);
  }
};

window.removerMembro = async (id) => {
  if (!isAdmin) return alert('🚫 Só admin remove membros');
  if (!confirm('Remover este membro?')) return;
  await deleteDoc(doc(db, 'membros', id));
};

function renderSelectResponsavel() {
  const sel = document.getElementById('churrasco-responsavel');
  if (!sel) return;
  sel.innerHTML = '<option value="">Churrasqueiro responsável...</option>' +
    membros.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
}

// ===== AGENDA =====
document.getElementById('form-agenda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = document.getElementById('churrasco-data').value;
  const responsavelId = document.getElementById('churrasco-responsavel').value;
  const obs = document.getElementById('churrasco-obs').value.trim();
  const responsavel = membros.find(m => m.id === responsavelId);

  await addDoc(collection(db, 'churrascos'), {
    data,
    responsavelId,
    responsavelNome: responsavel ? responsavel.nome : 'Desconhecido',
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

// ===== PRESENÇA =====
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
function renderRankings() {
  const realizados = churrascos.filter(c => c.realizado);
  const totalRealizados = realizados.length;

  const contagemChurras = {};
  realizados.forEach(c => {
    contagemChurras[c.responsavelId] = (contagemChurras[c.responsavelId] || 0) + 1;
  });
  const rankingChurras = membros.map(m => ({
    nome: m.nome, total: contagemChurras[m.id] || 0
  })).sort((a,b) => b.total - a.total);

  const listaRank = document.getElementById('lista-ranking');
  if (listaRank) listaRank.innerHTML = rankingChurras.length
    ? rankingChurras.map(r => `<li><span class="nome">${escapeHtml(r.nome)}</span><span class="valor">${r.total} 🔥</span></li>`).join('')
    : '<p class="hint">Sem dados ainda.</p>';

  const contagemFaltas = {};
  realizados.forEach(c => {
    const presentes = c.presentes || [];
    membros.forEach(m => {
      if (!presentes.includes(m.id)) contagemFaltas[m.id] = (contagemFaltas[m.id] || 0) + 1;
    });
  });
  const rankingSumido = membros.map(m => ({
    nome: m.nome, faltas: contagemFaltas[m.id] || 0, total: totalRealizados
  })).sort((a,b) => b.faltas - a.faltas);

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

  const contagem = {};
  realizados.forEach(c => { contagem[c.responsavelId] = (contagem[c.responsavelId] || 0) + 1; });
  let mestre = null, max = 0;
  for (const id in contagem) if (contagem[id] > max) { max = contagem[id]; mestre = id; }
  const mestreObj = membros.find(m => m.id === mestre);
  const elMestre = document.getElementById('mestre-churrasco');
  if (elMestre) elMestre.textContent = mestreObj ? `🥇 ${mestreObj.nome} (${max})` : '—';

  const faltas = {};
  realizados.forEach(c => {
    const p = c.presentes || [];
    membros.forEach(m => { if (!p.includes(m.id)) faltas[m.id] = (faltas[m.id]||0)+1; });
  });
  let sumido = null, maxF = 0;
  for (const id in faltas) if (faltas[id] > maxF) { maxF = faltas[id]; sumido = id; }
  const sumidoObj = membros.find(m => m.id === sumido);
  const elSum = document.getElementById('sumido-vez');
  if (elSum) elSum.textContent = sumidoObj && maxF > 0 ? `👻 ${sumidoObj.nome} (${maxF})` : '—';
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

  // Trava o botão pra não duplicar envio
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
      fotoUrl, // null quando não há imagem
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

  onSnapshot(q, (snapshot) => {
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

      // Renderiza a imagem só quando existir
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

      // Carrega os comentários dessa ofensa
      carregarComentarios(ofensaId);
    });

    // ===== Listeners dos botões =====

    // Botão "Responder" (toggle do form)
    document.querySelectorAll('.btn-comentar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        document.getElementById(`form-${id}`).classList.toggle('hidden');
      });
    });

    // Botão "Postar Resposta"
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

    // Botão "Excluir Ofensa"
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
    contador.textContent = `💬 ${snapshot.size} ${snapshot.size === 1 ? 'comentário' : 'comentários'}`;

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

    // Listener dos botões de excluir comentário
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
