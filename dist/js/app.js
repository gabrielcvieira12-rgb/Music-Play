// ============================================================
// MUSIC PLAYER — app.js
//
// Fluxo (igual ao diagrama, trocando o Firebase Storage pelo Cloudinary):
//   1. O admin cadastra a música (título, artista, estilo, capa e MP3).
//   2. Os arquivos (MP3 e capa) são enviados ao Cloudinary (gratuito).
//   3. As URLs geradas são salvas no Realtime Database, em "musicas".
//   4. O usuário lê a lista do Realtime Database.
//   5. Ao clicar numa música, ela toca no elemento <audio>.
//
// Organização do arquivo:
//   1. Imports e constantes     6. Biblioteca do usuário
//   2. Funções utilitárias      7. Telas (cards e listas)
//   3. Elementos da página      8. Player
//   4. Estado do app            9. Busca e histórico
//   5. Login e autenticação    10. Admin (adicionar, editar, excluir)
//                              11. Navegação entre telas
// ============================================================


// ============================================================
// 1. IMPORTS E CONSTANTES
// ============================================================

import { auth, db } from "./firebase-config.js";
import { icone, instalarIcones } from "./icons.js";
import { iniciarFundo } from "./bubbles.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const CLOUD_NAME = "jyiqffg6";
const UPLOAD_PRESET = "soundflow";

const MAX_BUSCAS_NO_HISTORICO = 8;
const ESPERA_PARA_SALVAR_BUSCA_MS = 1200; // tempo parado de digitar até salvar no histórico


instalarIcones();
iniciarFundo();


// ============================================================
// 2. FUNÇÕES UTILITÁRIAS
// ============================================================

/** Atalho para document.getElementById. */
const $ = (id) => document.getElementById(id);

/** Evita que textos digitados (ex.: título da música) sejam interpretados como HTML. */
function escaparHtml(texto = "") {
  const trocas = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto).replace(/[&<>"']/g, (letra) => trocas[letra]);
}

/** minúsculas + sem acentos, para a busca achar "Coracao" ao digitar "coração". */
function normalizar(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** 215 segundos -> "3:35" */
function formatarTempo(segundos) {
  if (!isFinite(segundos) || segundos < 0) return "0:00";

  const minutos = Math.floor(segundos / 60);
  const segs = Math.floor(segundos % 60).toString().padStart(2, "0");

  return `${minutos}:${segs}`;
}

function mostrarPrevia(imagem, src) {
  imagem.src = src;
  imagem.style.display = "block";
}

function esconderPrevia(imagem) {
  imagem.style.display = "none";
  imagem.removeAttribute("src");
}

function abrirModal(modal) {
  modal.style.display = "flex";
}

function fecharModal(modal) {
  modal.style.display = "none";
}


// ---------- Envio de arquivos (Cloudinary) ----------

/** Envia um arquivo (MP3 ou imagem) e devolve a URL pública dele. */
async function enviarCloudinary(arquivo) {
  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", UPLOAD_PRESET);

  const resposta = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData },
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.error?.message || "Erro ao enviar arquivo.");
  }

  return dados.secure_url;
}


// ---------- Capa automática ----------
// Se a música não tem capa, desenhamos uma na hora (mesmo nome = mesma cor).
// Ela NÃO é salva no banco: só a URL de uma capa real vai para o Realtime Database.

const cacheCapasAutomaticas = new Map();

function gerarCapaAutomatica(nomeMusica) {
  const nome = (nomeMusica || "?").trim();

  if (cacheCapasAutomaticas.has(nome)) return cacheCapasAutomaticas.get(nome);

  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const matiz = Math.abs(hash) % 360;

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");

  const gradiente = ctx.createLinearGradient(0, 0, 300, 300);
  gradiente.addColorStop(0, `hsl(${matiz}, 70%, 65%)`);
  gradiente.addColorStop(1, `hsl(${(matiz + 60) % 360}, 70%, 42%)`);
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, 300, 300);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 140px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(nome.charAt(0).toUpperCase() || "♪", 150, 164);

  const imagem = canvas.toDataURL("image/png");
  cacheCapasAutomaticas.set(nome, imagem);
  return imagem;
}

function capaOuPlaceholder(musica) {
  return musica.coverUrl || gerarCapaAutomatica(musica.title);
}

/** Capa com o filtro de brilho por cima (ver .cover no CSS). */
function capaHtml(capa, titulo) {
  return `<span class="cover"><img src="${capa}" alt="${titulo}"></span>`;
}


// ---------- Ler dados do arquivo MP3 (antes de enviar) ----------

/** Lê as tags ID3 do MP3 (título, artista, álbum, estilo, capa). */
function lerTagsDoAudio(arquivo) {
  return new Promise((resolve) => {
    if (typeof window.jsmediatags === "undefined") {
      resolve(null);
      return;
    }

    window.jsmediatags.read(arquivo, {
      onSuccess: (tag) => resolve(tag.tags || null),
      onError: () => resolve(null),
    });
  });
}

/** Transforma a capa embutida no MP3 em um arquivo, para enviar ao Cloudinary. */
function tagParaArquivoDeCapa(tags) {
  const imagem = tags?.picture;
  if (!imagem) return null;

  return new File([new Uint8Array(imagem.data)], "capa-do-mp3", { type: imagem.format });
}

/** Descobre a duração do MP3 e devolve no formato "3:35". */
function lerDuracaoDoAudio(arquivo) {
  return new Promise((resolve) => {
    const audioTemporario = new Audio();
    const urlTemporaria = URL.createObjectURL(arquivo);

    audioTemporario.preload = "metadata";
    audioTemporario.src = urlTemporaria;

    audioTemporario.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(urlTemporaria);
      resolve(formatarTempo(audioTemporario.duration));
    });

    audioTemporario.addEventListener("error", () => {
      URL.revokeObjectURL(urlTemporaria);
      resolve("");
    });
  });
}


// ============================================================
// 3. ELEMENTOS DA PÁGINA
// ============================================================

// login
const loginScreen = $("login-screen");
const emailInput = $("email");
const passwordInput = $("password");
const loginBtn = $("login-btn");
const registerBtn = $("register-btn");
const authMessage = $("auth-message");

// app
const app = $("app");
const logoutBtn = $("logout-btn");
const adminNav = $("admin-nav");
const userAvatar = $("user-avatar");

// listas
const musicList = $("music-list");
const libraryMusicList = $("library-music-list");
const libraryEmpty = $("library-empty");
const adminMusicList = $("admin-music-list");

// busca
const searchInput = $("search-input");
const searchList = $("search-list");
const searchHistory = $("search-history");
const historyList = $("history-list");
const clearHistoryBtn = $("clear-history-btn");

// player
const audio = $("audio");
const playerCover = $("player-cover");
const capaDoPlayerVazio = playerCover.innerHTML; // logo mostrada quando não há música
const playerTitle = $("player-title");
const playerArtist = $("player-artist");
const prevBtn = $("prev-btn");
const playBtn = $("play-btn");
const nextBtn = $("next-btn");
const progressBar = $("progress-bar");
const progressFill = $("progress-fill");
const progressHandle = $("progress-handle");
const currentTimeLabel = $("current-time");
const durationTimeLabel = $("duration-time");
const volumeSlider = $("volume-slider");
const volumeIcon = $("volume-icon");

// formulário "Adicionar música"
const musicTitleInput = $("music-title");
const musicArtistInput = $("music-artist");
const musicAlbumInput = $("music-album");
const musicGenreInput = $("music-genre");
const musicAudioInput = $("music-audio");
const musicCoverInput = $("music-cover");
const coverPreview = $("cover-preview");
const identifyHint = $("identify-hint");
const addMusicBtn = $("add-music-btn");
const adminMessage = $("admin-message");

// modal "Editar música"
const editModal = $("edit-modal");
const editTitle = $("edit-title");
const editArtist = $("edit-artist");
const editAlbum = $("edit-album");
const editGenre = $("edit-genre");
const editCover = $("edit-cover");
const editCoverPreview = $("edit-cover-preview");
const editSaveBtn = $("edit-save-btn");
const editCancelBtn = $("edit-cancel-btn");
const editMessage = $("edit-message");

// modal "Confirmar exclusão"
const confirmModal = $("confirm-modal");
const confirmMessage = $("confirm-message");
const confirmCancelBtn = $("confirm-cancel-btn");
const confirmDeleteBtn = $("confirm-delete-btn");

// navegação
const homeGenres = $("home-genres");
const libraryGenres = $("library-genres");
const showAllBtn = $("show-all-btn");
const navBackBtn = $("nav-back");
const navForwardBtn = $("nav-forward");
const secoes = document.querySelectorAll(".page-section");
const botoesNavegacao = document.querySelectorAll(".nav-item[data-section]");


// ============================================================
// 4. ESTADO DO APP
// ============================================================

let usuarioAtual = null;
let ehAdmin = false;

let todasMusicas = [];
let bibliotecaIds = new Set();
let musicaAtualId = null; // id da música que está tocando
let contextoReproducao = "geral"; // "geral" (todas) ou "biblioteca" (só as da biblioteca)

let termoBusca = ""; // o que está escrito no campo de busca agora
let temporizadorBusca = null;

let musicaEmEdicao = null;
let acaoPendente = null; // função que roda se o usuário confirmar a exclusão
let capaDoMp3 = null; // capa que veio dentro do MP3 (se houver)

let generoInicio = "todos";
let generoBiblioteca = "todos";

let historicoNav = ["home"]; // telas visitadas (botões ‹ ›)
let posNav = 0;
let secaoAtual = "home";
let volumeAntesDeSilenciar = 80;

let pararDeObservarMusicas = null;
let pararDeObservarBiblioteca = null;


// ============================================================
// 5. LOGIN E AUTENTICAÇÃO
// ============================================================

function lerCredenciais() {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();

  if (!email || !senha) {
    authMessage.textContent = "Preencha email e senha.";
    return null;
  }

  return { email, senha };
}

registerBtn.addEventListener("click", async () => {
  const credenciais = lerCredenciais();
  if (!credenciais) return;

  try {
    const { user } = await createUserWithEmailAndPassword(auth, credenciais.email, credenciais.senha);

    await set(ref(db, `usuarios/${user.uid}`), {
      nome: credenciais.email.split("@")[0],
      role: "user",
      criadoEm: Date.now(),
    });

    authMessage.textContent = "Cadastro realizado com sucesso!";
  } catch (erro) {
    console.error(erro);
    authMessage.textContent = "Erro ao cadastrar.";
  }
});

loginBtn.addEventListener("click", async () => {
  const credenciais = lerCredenciais();
  if (!credenciais) return;

  try {
    await signInWithEmailAndPassword(auth, credenciais.email, credenciais.senha);
    authMessage.textContent = "";
  } catch (erro) {
    console.error(erro);
    authMessage.textContent = "Email ou senha incorretos.";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

/** Roda sozinho sempre que alguém entra ou sai. */
onAuthStateChanged(auth, (user) => {
  usuarioAtual = user;

  if (user) {
    aoEntrar(user);
  } else {
    aoSair();
  }
});

async function aoEntrar(user) {
  loginScreen.style.display = "none";
  app.style.display = "flex";

  const nome = user.email ? user.email.split("@")[0] : "U";
  userAvatar.textContent = nome.charAt(0).toUpperCase();
  userAvatar.title = user.email || "";

  ehAdmin = await verificarSeEhAdmin(user.uid);
  adminNav.style.display = ehAdmin ? "block" : "none";

  observarMusicas();
  observarBiblioteca(user.uid);
  renderizarHistorico();
}

function aoSair() {
  audio.pause();
  playerCover.classList.add("is-empty");
  playerCover.innerHTML = capaDoPlayerVazio;
  playerTitle.textContent = "Nenhuma música";
  playerArtist.textContent = "Escolha uma música";

  pararDeObservarMusicas?.();
  pararDeObservarBiblioteca?.();
  pararDeObservarMusicas = null;
  pararDeObservarBiblioteca = null;

  ehAdmin = false;
  todasMusicas = [];
  bibliotecaIds = new Set();
  generoInicio = "todos";
  generoBiblioteca = "todos";
  historicoNav = [];
  posNav = -1;
  secaoAtual = "";

  loginScreen.style.display = "flex";
  app.style.display = "none";
  adminNav.style.display = "none";

  userAvatar.textContent = "U";
  userAvatar.title = "";

  mostrarSecao("home");
}

async function verificarSeEhAdmin(uid) {
  try {
    const snapshot = await get(ref(db, `usuarios/${uid}`));
    return snapshot.exists() && snapshot.val().role === "admin";
  } catch (erro) {
    console.error("Erro ao verificar usuário:", erro);
    return false;
  }
}


// ============================================================
// 6. DADOS: MÚSICAS E BIBLIOTECA DO USUÁRIO (Realtime Database)
// ============================================================

/** Fica "ouvindo" o nó "musicas": qualquer mudança atualiza as telas na hora. */
function observarMusicas() {
  pararDeObservarMusicas?.(); // evita ouvir duas vezes se o usuário entrar de novo

  pararDeObservarMusicas = onValue(
    ref(db, "musicas"),
    (snapshot) => {
      const dados = snapshot.val() || {};
      todasMusicas = Object.entries(dados).map(([id, musica]) => ({ id, ...musica }));

      renderizarTelasDoUsuario();
      if (ehAdmin) renderizarAdmin();
    },
    (erro) => console.error("Erro ao carregar músicas:", erro),
  );
}

function observarBiblioteca(uid) {
  pararDeObservarBiblioteca?.();

  pararDeObservarBiblioteca = onValue(ref(db, `usuarios/${uid}/biblioteca`), (snapshot) => {
    bibliotecaIds = new Set(Object.keys(snapshot.val() || {}));
    renderizarTelasDoUsuario();
  });
}

async function alternarNaBiblioteca(musica) {
  if (!usuarioAtual) return;

  const caminho = ref(db, `usuarios/${usuarioAtual.uid}/biblioteca/${musica.id}`);

  try {
    if (bibliotecaIds.has(musica.id)) {
      await remove(caminho);
    } else {
      await set(caminho, true);
    }
  } catch (erro) {
    console.error("Erro ao atualizar biblioteca:", erro);
  }
}


// ============================================================
// 7. TELAS: CARDS E LISTAS
// ============================================================

/** Redesenha tudo que o usuário comum vê. */
function renderizarTelasDoUsuario() {
  renderizarMusicas();
  renderizarBiblioteca();
  renderizarBusca();
}

/** Limpa o container e desenha um item por música (ou uma mensagem se não houver nenhuma). */
function renderizarLista(container, musicas, criarItem, textoVazio) {
  container.innerHTML = "";

  if (musicas.length === 0) {
    container.innerHTML = `<p>${textoVazio}</p>`;
    return;
  }

  musicas.forEach((musica) => container.appendChild(criarItem(musica)));
}

/** Dados da música já "seguros" para entrar em um template HTML. */
function dadosParaHtml(musica) {
  return {
    titulo: escaparHtml(musica.title || "Sem título"),
    artista: escaparHtml(musica.artist || "Artista desconhecido"),
    capa: escaparHtml(capaOuPlaceholder(musica)),
  };
}

function iconeBiblioteca(musica) {
  return bibliotecaIds.has(musica.id) ? icone("heart-on") : icone("heart");
}

/** Liga os botões "Tocar" e "Biblioteca" de um card ou linha. */
function ligarBotoes(elemento, musica, seletorTocar, aoUsar = () => { }, contexto = "geral") {
  elemento.querySelector(seletorTocar).addEventListener("click", () => {
    aoUsar();
    tocarMusica(musica, contexto);
  });

  elemento.querySelector(".add-to-library").addEventListener("click", () => {
    aoUsar();
    alternarNaBiblioteca(musica);
  });
}

// ---------- Início e biblioteca ----------

function criarCardMusica(musica, contexto = "geral") {
  const { titulo, artista, capa } = dadosParaHtml(musica);

  const card = document.createElement("div");
  card.className = "music-card";
  card.innerHTML = `
    ${capaHtml(capa, titulo)}
    <h3>${titulo}</h3>
    <p>${artista}</p>
    <div class="music-card-actions">
      <button class="btn-jelly play-music">${icone("play")} Tocar</button>
      <button class="btn-jelly add-to-library" title="Adicionar/remover da biblioteca">${iconeBiblioteca(musica)}</button>
    </div>
  `;

  ligarBotoes(card, musica, ".play-music", undefined, contexto);
  return card;
}

// ---------- Filtro por estilo ----------

const chaveGenero = (m) => normalizar(m.genre || "") || "sem-estilo";

function rotuloGenero(musicas, chave) {
  if (chave === "sem-estilo") return "Sem estilo";
  const m = musicas.find((x) => chaveGenero(x) === chave);
  return (m.genre || "").trim();
}

function listarGeneros(musicas) {
  const mapa = new Map();
  musicas.forEach((m) => mapa.set(chaveGenero(m), (mapa.get(chaveGenero(m)) || 0) + 1));
  return [...mapa.entries()]
    .map(([chave, qtd]) => ({ chave, qtd, nome: rotuloGenero(musicas, chave) }))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

function filtrarPorGenero(musicas, genero) {
  return genero === "todos" ? musicas : musicas.filter((m) => chaveGenero(m) === genero);
}

function renderizarChips(container, generos, total, selecionado, aoEscolher) {
  container.innerHTML = "";
  if (generos.length === 0) return;

  const criar = (chave, nome, qtd) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "genre-chip" + (chave === selecionado ? " active" : "");
    b.innerHTML = `${escaparHtml(nome)}<span class="genre-count">${qtd}</span>`;
    b.addEventListener("click", () => aoEscolher(chave));
    container.appendChild(b);
  };

  criar("todos", "Todos", total);
  generos.forEach((g) => criar(g.chave, g.nome, g.qtd));
}

function renderizarMusicas() {
  const generos = listarGeneros(todasMusicas);
  if (generoInicio !== "todos" && !generos.some((g) => g.chave === generoInicio)) generoInicio = "todos";

  renderizarChips(homeGenres, generos, todasMusicas.length, generoInicio, (g) => {
    generoInicio = g;
    renderizarMusicas();
  });

  renderizarLista(musicList, filtrarPorGenero(todasMusicas, generoInicio), criarCardMusica, "Nenhuma música cadastrada.");
}

function renderizarBiblioteca() {
  const musicas = todasMusicas.filter((musica) => bibliotecaIds.has(musica.id));
  const vazia = musicas.length === 0;

  libraryEmpty.style.display = vazia ? "block" : "none";
  libraryMusicList.style.display = vazia ? "none" : "grid";

  const generos = listarGeneros(musicas);
  if (generoBiblioteca !== "todos" && !generos.some((g) => g.chave === generoBiblioteca)) generoBiblioteca = "todos";

  if (vazia) {
    libraryGenres.innerHTML = "";
    return;
  }

  renderizarChips(libraryGenres, generos, musicas.length, generoBiblioteca, (g) => {
    generoBiblioteca = g;
    renderizarBiblioteca();
  });

  renderizarLista(libraryMusicList, filtrarPorGenero(musicas, generoBiblioteca), (m) => criarCardMusica(m, "biblioteca"), "");
}

showAllBtn.addEventListener("click", () => {
  generoInicio = "todos";
  renderizarMusicas();
});


// ============================================================
// 8. PLAYER
// ============================================================

function tocarMusica(musica, contexto = contextoReproducao) {
  musicaAtualId = musica.id;
  contextoReproducao = contexto;

  const { titulo, capa } = dadosParaHtml(musica);

  playerTitle.textContent = musica.title || "Sem título";
  playerArtist.textContent = musica.artist || "Artista desconhecido";
  playerCover.classList.remove("is-empty");
  playerCover.innerHTML = `<img src="${capa}" alt="${titulo}">`;

  durationTimeLabel.textContent = musica.duration || "0:00";
  atualizarBarra(0);
  currentTimeLabel.textContent = "0:00";

  audio.src = musica.audioUrl;
  audio.play().catch((erro) => console.error("Não foi possível tocar:", erro));
}

function alternarPlayPause() {
  if (!audio.src) return;

  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

/** Fila atual: se começou pela biblioteca, só as músicas da biblioteca. */
function listaDeReproducao() {
  return contextoReproducao === "biblioteca"
    ? todasMusicas.filter((m) => bibliotecaIds.has(m.id))
    : todasMusicas;
}

/** passo = +1 (próxima) ou -1 (anterior). Volta ao começo/fim da fila se passar do limite. */
function tocarVizinha(passo) {
  const lista = listaDeReproducao();
  if (lista.length === 0) return;

  const atual = lista.findIndex((m) => m.id === musicaAtualId);
  let proximo;
  if (atual === -1) proximo = passo > 0 ? 0 : lista.length - 1; // a música saiu da fila
  else proximo = (atual + passo + lista.length) % lista.length;

  tocarMusica(lista[proximo]);
}

prevBtn.addEventListener("click", () => tocarVizinha(-1));
nextBtn.addEventListener("click", () => tocarVizinha(1));
playBtn.addEventListener("click", alternarPlayPause);

audio.addEventListener("ended", () => tocarVizinha(1));
audio.addEventListener("play", () => (playBtn.innerHTML = icone("pause")));
audio.addEventListener("pause", () => (playBtn.innerHTML = icone("play")));


// ---------- Barra de progresso (clique ou arraste) ----------

let arrastandoProgresso = false;

function atualizarBarra(fracao) {
  progressFill.style.width = `${fracao * 100}%`;
  progressHandle.style.left = `${fracao * 100}%`;
}

/** Leva a barra até a posição do mouse/dedo e devolve o valor entre 0 e 1. */
function moverBarraPara(clientX) {
  const caixa = progressBar.getBoundingClientRect();
  const fracao = Math.min(1, Math.max(0, (clientX - caixa.left) / caixa.width));

  atualizarBarra(fracao);

  if (audio.duration) {
    currentTimeLabel.textContent = formatarTempo(fracao * audio.duration);
  }

  return fracao;
}

function terminarArraste(clientX) {
  if (!arrastandoProgresso) return;

  const fracao = moverBarraPara(clientX);
  if (audio.duration) audio.currentTime = fracao * audio.duration;

  arrastandoProgresso = false;
  progressBar.classList.remove("dragging");
}

audio.addEventListener("loadedmetadata", () => {
  durationTimeLabel.textContent = formatarTempo(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  if (arrastandoProgresso || !audio.duration) return;

  atualizarBarra(audio.currentTime / audio.duration);
  currentTimeLabel.textContent = formatarTempo(audio.currentTime);
});

// "pointer" funciona igual para mouse e toque
progressBar.addEventListener("pointerdown", (e) => {
  arrastandoProgresso = true;
  progressBar.classList.add("dragging");
  moverBarraPara(e.clientX);
});

window.addEventListener("pointermove", (e) => {
  if (arrastandoProgresso) moverBarraPara(e.clientX);
});

window.addEventListener("pointerup", (e) => terminarArraste(e.clientX));
window.addEventListener("pointercancel", (e) => terminarArraste(e.clientX));


// ---------- Volume ----------

// Navegadores não conseguem ler o volume do Windows/macOS. Então o volume
// do player é lembrado (localStorage) e restaurado ao abrir o site.
const CHAVE_VOLUME = "soundflow:volume";

function aplicarVolume(valor, salvar = true) {
  const v = Math.min(100, Math.max(0, Math.round(Number(valor) || 0)));
  audio.volume = v / 100;
  volumeSlider.value = v;
  volumeIcon.innerHTML = icone(v === 0 ? "volume-off" : "volume");
  if (v > 0) volumeAntesDeSilenciar = v;
  if (salvar) {
    try { localStorage.setItem(CHAVE_VOLUME, String(v)); } catch { /* sem storage */ }
  }
}

(function restaurarVolume() {
  let salvo = null;
  try { salvo = localStorage.getItem(CHAVE_VOLUME); } catch { /* sem storage */ }
  aplicarVolume(salvo !== null && salvo !== "" ? salvo : volumeSlider.value, false);
})();

volumeSlider.addEventListener("input", () => aplicarVolume(volumeSlider.value));

volumeIcon.addEventListener("click", () => {
  aplicarVolume(audio.volume === 0 ? volumeAntesDeSilenciar : 0);
});


// ============================================================
// 9. BUSCA E HISTÓRICO
//
//  - Campo vazio  -> mostra o histórico ("Buscas recentes").
//  - Digitando    -> a cada letra, mostra só as músicas que combinam.
//  - Sair da tela de busca -> o campo é limpo.
//  O histórico fica no navegador (localStorage), separado por usuário.
// ============================================================

// ---------- Filtro ----------

function filtrarMusicas(termo) {
  const busca = normalizar(termo);
  if (!busca) return [];

  return todasMusicas.filter((musica) =>
    [musica.title, musica.artist, musica.album, musica.genre].some((campo) =>
      normalizar(campo).includes(busca),
    ),
  );
}

// ---------- Resultados ----------

function criarLinhaBusca(musica) {
  const { titulo, artista, capa } = dadosParaHtml(musica);

  const linha = document.createElement("div");
  linha.className = "search-result-item";
  linha.innerHTML = `
    ${capaHtml(capa, titulo)}
    <h3>${titulo}</h3>
    <p>${artista}</p>
    <button class="btn-jelly play-search">${icone("play")} Tocar</button>
    <button class="btn-jelly add-to-library" title="Adicionar/remover da biblioteca">${iconeBiblioteca(musica)}</button>
  `;

  // Usar um resultado confirma que a busca foi útil: guardamos no histórico.
  ligarBotoes(linha, musica, ".play-search", () => salvarBusca(termoBusca));
  return linha;
}

/** Mostra o histórico (campo vazio) ou os resultados (campo preenchido). */
function renderizarBusca() {
  const buscando = termoBusca !== "";

  searchHistory.style.display = buscando ? "none" : "";
  searchList.style.display = buscando ? "" : "none";

  if (buscando) {
    renderizarLista(searchList, filtrarMusicas(termoBusca), criarLinhaBusca, "Nenhuma música encontrada.");
  } else {
    renderizarHistorico();
  }
}

// ---------- Histórico ----------

function chaveDoHistorico() {
  return `historicoBusca:${usuarioAtual?.uid}`;
}

function lerHistorico() {
  try {
    return JSON.parse(localStorage.getItem(chaveDoHistorico())) || [];
  } catch {
    return [];
  }
}

function gravarHistorico(lista) {
  try {
    localStorage.setItem(chaveDoHistorico(), JSON.stringify(lista));
  } catch (erro) {
    console.error("Não foi possível salvar o histórico:", erro);
  }
}

function salvarBusca(termo) {
  const texto = termo.trim();
  if (!usuarioAtual || texto.length < 2) return;

  const novo = normalizar(texto);

  // Tira buscas repetidas e as "pedaços" da mesma busca (ex.: "bli" quando agora é "blinding").
  const historico = lerHistorico().filter((item) => !novo.startsWith(normalizar(item)));

  historico.unshift(texto); // a mais recente fica no topo
  gravarHistorico(historico.slice(0, MAX_BUSCAS_NO_HISTORICO));
  renderizarHistorico();
}

function removerDoHistorico(termo) {
  gravarHistorico(lerHistorico().filter((item) => item !== termo));
  renderizarHistorico();
}

function renderizarHistorico() {
  if (!usuarioAtual) return;

  const historico = lerHistorico();
  historyList.innerHTML = "";
  clearHistoryBtn.style.display = historico.length ? "" : "none";

  if (historico.length === 0) {
    historyList.innerHTML = `<p class="history-empty">Você ainda não pesquisou nada.</p>`;
    return;
  }

  historico.forEach((termo) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const botaoTermo = document.createElement("button");
    botaoTermo.className = "history-term";
    botaoTermo.innerHTML = `${icone("clock")} ${escaparHtml(termo)}`;
    botaoTermo.addEventListener("click", () => buscarTexto(termo));

    const botaoRemover = document.createElement("button");
    botaoRemover.className = "history-remove";
    botaoRemover.title = "Remover do histórico";
    botaoRemover.innerHTML = icone("close");
    botaoRemover.addEventListener("click", () => removerDoHistorico(termo));

    item.append(botaoTermo, botaoRemover);
    historyList.appendChild(item);
  });
}

clearHistoryBtn.addEventListener("click", () => {
  gravarHistorico([]);
  renderizarHistorico();
});

// ---------- Campo de busca ----------

/** Preenche o campo e busca (usado ao clicar numa busca do histórico). */
function buscarTexto(texto) {
  searchInput.value = texto;
  aoDigitarNaBusca();
  searchInput.focus();
}

function aoDigitarNaBusca() {
  termoBusca = searchInput.value.trim();

  mostrarSecao("search");
  renderizarBusca();

  // Só guarda no histórico depois que a pessoa para de digitar (evita salvar "b", "bl", "bli"...).
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(() => salvarBusca(termoBusca), ESPERA_PARA_SALVAR_BUSCA_MS);
}

/** Chamado ao sair da tela de busca: guarda a busca e limpa o campo "O que você quer ouvir?". */
function sairDaBusca() {
  clearTimeout(temporizadorBusca);
  salvarBusca(termoBusca);

  termoBusca = "";
  searchInput.value = "";
  renderizarBusca();
}

searchInput.addEventListener("input", aoDigitarNaBusca);

searchInput.addEventListener("focus", () => {
  mostrarSecao("search");
  renderizarBusca();
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(temporizadorBusca);
    salvarBusca(termoBusca);
  }
});


// ============================================================
// 10. ADMIN: ADICIONAR, EDITAR E EXCLUIR MÚSICAS
// ============================================================

// ---------- Formulário: prévia da capa e leitura automática do MP3 ----------

musicCoverInput.addEventListener("change", () => {
  const arquivo = musicCoverInput.files[0];
  if (arquivo) mostrarPrevia(coverPreview, URL.createObjectURL(arquivo));
});

musicAudioInput.addEventListener("change", async () => {
  const arquivo = musicAudioInput.files[0];
  if (!arquivo) return;

  capaDoMp3 = null;
  identifyHint.textContent = "Identificando música...";

  const tags = await lerTagsDoAudio(arquivo);

  if (!tags || (!tags.title && !tags.artist)) {
    identifyHint.textContent = "Não conseguimos identificar — preencha manualmente.";
    return;
  }

  // Só preenche o que ainda está vazio. trim() remove espaços que as tags ID3 costumam trazer.
  const preencherSeVazio = (campo, valor) => {
    if (valor && !campo.value) campo.value = valor.trim();
  };

  preencherSeVazio(musicTitleInput, tags.title);
  preencherSeVazio(musicArtistInput, tags.artist);
  preencherSeVazio(musicAlbumInput, tags.album);
  preencherSeVazio(musicGenreInput, tags.genre);

  capaDoMp3 = tagParaArquivoDeCapa(tags);

  if (capaDoMp3 && !musicCoverInput.files[0]) {
    mostrarPrevia(coverPreview, URL.createObjectURL(capaDoMp3));
  }

  identifyHint.textContent = "Identificamos alguns dados automaticamente — confira antes de salvar!";
});

function limparFormularioDeMusica() {
  [musicTitleInput, musicArtistInput, musicAlbumInput, musicGenreInput, musicCoverInput, musicAudioInput]
    .forEach((campo) => (campo.value = ""));

  esconderPrevia(coverPreview);
  identifyHint.textContent = "";
  capaDoMp3 = null;
}

// ---------- Adicionar música (Create) ----------

addMusicBtn.addEventListener("click", async () => {
  if (!ehAdmin) {
    alert("Você não tem permissão para adicionar músicas.");
    return;
  }

  const title = musicTitleInput.value.trim();
  const artist = musicArtistInput.value.trim();
  const audioFile = musicAudioInput.files[0];

  if (!title || !artist || !audioFile) {
    adminMessage.textContent = "Preencha pelo menos título, artista e o arquivo MP3.";
    return;
  }

  addMusicBtn.disabled = true;

  try {
    adminMessage.textContent = "Enviando música...";
    const [audioUrl, duration] = await Promise.all([
      enviarCloudinary(audioFile),
      lerDuracaoDoAudio(audioFile),
    ]);

    const musica = {
      title,
      artist,
      album: musicAlbumInput.value.trim(),
      genre: musicGenreInput.value.trim(),
      duration,
      audioUrl,
      criadoEm: Date.now(),
      criadoPor: usuarioAtual.uid,
    };

    // Capa escolhida pelo admin > capa do próprio MP3 > (nenhuma: o site gera uma na hora)
    const arquivoDeCapa = musicCoverInput.files[0] || capaDoMp3;

    if (arquivoDeCapa) {
      adminMessage.textContent = "Enviando capa...";
      musica.coverUrl = await enviarCloudinary(arquivoDeCapa);
    }

    adminMessage.textContent = "Salvando música...";
    await set(push(ref(db, "musicas")), musica);

    adminMessage.textContent = "Música adicionada com sucesso!";
    limparFormularioDeMusica();
  } catch (erro) {
    console.error(erro);
    adminMessage.textContent = "Erro ao adicionar música.";
  } finally {
    addMusicBtn.disabled = false;
  }
});

// ---------- Lista do admin (Read) ----------

function criarItemAdmin(musica) {
  const { titulo, artista, capa } = dadosParaHtml(musica);

  const detalhes = [artista, escaparHtml(musica.genre), escaparHtml(musica.duration)]
    .filter(Boolean)
    .join(" · ");

  const item = document.createElement("div");
  item.className = "admin-music-item";
  item.innerHTML = `
    ${capaHtml(capa, titulo)}

    <div class="admin-music-info">
      <strong>${titulo}</strong>
      <p>${detalhes}</p>
    </div>

    <div class="admin-music-actions">
      <button class="btn-jelly editar-musica">${icone("edit")} Editar</button>
      <button class="btn-jelly excluir-musica">${icone("trash")} Excluir</button>
    </div>
  `;

  item.querySelector(".editar-musica").addEventListener("click", () => abrirModalEdicao(musica));
  item.querySelector(".excluir-musica").addEventListener("click", () => pedirExclusao(musica));

  return item;
}

function renderizarAdmin() {
  renderizarLista(adminMusicList, todasMusicas, criarItemAdmin, "Nenhuma música cadastrada.");
}

// ---------- Editar música (Update) ----------

function abrirModalEdicao(musica) {
  musicaEmEdicao = musica;

  editTitle.value = musica.title || "";
  editArtist.value = musica.artist || "";
  editAlbum.value = musica.album || "";
  editGenre.value = musica.genre || "";
  editCover.value = "";
  editMessage.textContent = "";

  mostrarPrevia(editCoverPreview, capaOuPlaceholder(musica));
  abrirModal(editModal);
}

function fecharModalEdicao() {
  fecharModal(editModal);
  musicaEmEdicao = null;
}

editCover.addEventListener("change", () => {
  const arquivo = editCover.files[0];
  if (arquivo) mostrarPrevia(editCoverPreview, URL.createObjectURL(arquivo));
});

editCancelBtn.addEventListener("click", fecharModalEdicao);

editModal.addEventListener("click", (e) => {
  if (e.target === editModal) fecharModalEdicao(); // clicou fora do cartão
});

editSaveBtn.addEventListener("click", async () => {
  if (!musicaEmEdicao || !ehAdmin) return;

  const title = editTitle.value.trim();
  const artist = editArtist.value.trim();

  if (!title || !artist) {
    editMessage.textContent = "Preencha pelo menos título e artista.";
    return;
  }

  editSaveBtn.disabled = true;
  editMessage.textContent = "Salvando...";

  try {
    const dadosAtualizados = {
      title,
      artist,
      album: editAlbum.value.trim(),
      genre: editGenre.value.trim(),
      atualizadoEm: Date.now(),
    };

    const novaCapa = editCover.files[0];

    if (novaCapa) {
      editMessage.textContent = "Enviando nova capa...";
      dadosAtualizados.coverUrl = await enviarCloudinary(novaCapa);
    }

    await update(ref(db, `musicas/${musicaEmEdicao.id}`), dadosAtualizados);

    editMessage.textContent = "Música atualizada com sucesso!";
    setTimeout(fecharModalEdicao, 700);
  } catch (erro) {
    console.error(erro);
    editMessage.textContent = "Erro ao atualizar música.";
  } finally {
    editSaveBtn.disabled = false;
  }
});

// ---------- Excluir música (Delete) ----------

function pedirExclusao(musica) {
  confirmMessage.textContent =
    `Tem certeza que deseja excluir "${musica.title || "esta música"}"? Essa ação não pode ser desfeita.`;

  acaoPendente = async () => {
    try {
      await remove(ref(db, `musicas/${musica.id}`));
    } catch (erro) {
      console.error(erro);
      alert("Erro ao excluir música.");
    }
  };

  abrirModal(confirmModal);
}

function fecharConfirmacao() {
  fecharModal(confirmModal);
  acaoPendente = null;
}

confirmCancelBtn.addEventListener("click", fecharConfirmacao);

confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) fecharConfirmacao();
});

confirmDeleteBtn.addEventListener("click", async () => {
  const acao = acaoPendente;
  fecharConfirmacao();

  if (acao) await acao();
});

// Esc fecha qualquer modal aberto
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  fecharModalEdicao();
  fecharConfirmacao();
});


// ============================================================
// 11. NAVEGAÇÃO ENTRE TELAS
// ============================================================

/** Mostra uma tela ("home", "search", "library" ou "admin") e destaca o botão do menu. */
function mostrarSecao(nome, { registrar = true } = {}) {
  // Saiu da busca? Limpa o campo "O que você quer ouvir?".
  if (nome !== "search") sairDaBusca();

  // histórico para os botões ‹ ›
  if (registrar && nome !== secaoAtual) {
    historicoNav = historicoNav.slice(0, posNav + 1);
    historicoNav.push(nome);
    posNav = historicoNav.length - 1;
  }
  secaoAtual = nome;

  secoes.forEach((secao) => {
    secao.style.display = secao.id === `${nome}-section` ? "block" : "none";
  });

  botoesNavegacao.forEach((botao) => {
    botao.classList.toggle("active", botao.dataset.section === nome);
  });

  atualizarBotoesNavegacao();
}

function atualizarBotoesNavegacao() {
  navBackBtn.disabled = posNav <= 0;
  navForwardBtn.disabled = posNav >= historicoNav.length - 1;
}

function irNoHistorico(passo) {
  const destino = posNav + passo;
  if (destino < 0 || destino >= historicoNav.length) return;
  posNav = destino;

  const nome = historicoNav[posNav];
  mostrarSecao(nome, { registrar: false });
  if (nome === "search") {
    renderizarBusca();
    searchInput.focus();
  }
}

navBackBtn.addEventListener("click", () => irNoHistorico(-1));
navForwardBtn.addEventListener("click", () => irNoHistorico(1));

botoesNavegacao.forEach((botao) => {
  botao.addEventListener("click", () => {
    const nome = botao.dataset.section;

    mostrarSecao(nome);

    if (nome === "search") {
      renderizarBusca();
      searchInput.focus();
    }
  });
});