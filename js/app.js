const SUPABASE_URL = "https://xmwdtxkoneauvtuaxwxz.supabase.co";
const SUPABASE_KEY = "sb_publishable_99ETmFFHqJ79mpjLL18G6g_1Yhz-KQc";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const $ = (id) => document.getElementById(id);

function safeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

// ---------- Datas ----------

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDay(value) {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(value) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "21 nov" no ano atual, "21 nov 2025" em anos anteriores
function formatShortDay(value) {
  const d = new Date(value);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------- Mensagens nos formulários ----------

function setStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

// ---------- Sessão ----------

async function currentUser() {
  if (!supabaseClient) throw new Error("Não foi possível conectar ao servidor. Recarregue a página.");
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function updateAuthAction() {
  const action = $("auth-action");
  const heroAction = $("hero-action");
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getUser();
  const logged = Boolean(data.user);

  if (action) {
    action.textContent = logged ? "Sair" : "Entrar";
    action.href = logged ? "index.html" : "login.html";
    if (logged) {
      action.className = "secondary-btn";
      action.addEventListener("click", async (event) => {
        event.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
      });
    }
  }
  if (heroAction) {
    heroAction.textContent = logged ? "Adicionar jogo" : "Criar conta";
    heroAction.href = logged ? "dashboard.html" : "signup.html";
  }
}

// ---------- Entrar ----------

const loginForm = $("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("auth-status");
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    setStatus(status, "Entrando…");

    try {
      const email = $("email").value.trim();
      const password = $("password").value;

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.href = "dashboard.html";
    } catch (error) {
      const text = /invalid login/i.test(error.message)
        ? "E-mail ou senha incorretos. Confira e tente de novo."
        : error.message;
      setStatus(status, text, true);
      button.disabled = false;
    }
  });
}

// ---------- Criar conta ----------

const signupForm = $("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("auth-status");
    const button = signupForm.querySelector("button[type=submit]");
    button.disabled = true;
    setStatus(status, "Criando a conta…");

    try {
      const email = $("email").value.trim();
      const password = $("password").value;

      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        window.location.href = "dashboard.html";
      } else {
        setStatus(status, "Conta criada. Abra o link que enviamos para o seu e-mail e depois entre.");
        signupForm.reset();
        button.disabled = false;
      }
    } catch (error) {
      setStatus(status, error.message, true);
      button.disabled = false;
    }
  });
}

// ---------- Jogos: busca compartilhada pelo início e pelo painel ----------

// Busca os jogos, as URLs assinadas das capas e o último save de cada jogo
// com poucas chamadas, em vez de duas por jogo.
async function fetchLibrary(user) {
  const { data: games, error } = await supabaseClient
    .from("games")
    .select("id, name, cover_url, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!games.length) return [];

  const { data: saves, error: savesError } = await supabaseClient
    .from("saves")
    .select("game_id, name, file_name, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (savesError) throw savesError;

  const latest = new Map();
  const counts = new Map();
  for (const save of saves) {
    if (!latest.has(save.game_id)) latest.set(save.game_id, save);
    counts.set(save.game_id, (counts.get(save.game_id) || 0) + 1);
  }

  const paths = games.map((g) => g.cover_url).filter(Boolean);
  const covers = new Map();
  if (paths.length) {
    const { data: signed } = await supabaseClient.storage
      .from("game-covers")
      .createSignedUrls(paths, 3600);
    for (const item of signed || []) {
      if (item.signedUrl) covers.set(item.path, item.signedUrl);
    }
  }

  return games.map((game) => ({
    ...game,
    cover: covers.get(game.cover_url) || "",
    latestSave: latest.get(game.id) || null,
    saveCount: counts.get(game.id) || 0
  }));
}

function coverElement(game, extraClass = "") {
  const cover = document.createElement("div");
  cover.className = `cover ${extraClass} ${game.cover ? "" : "placeholder-cover"}`.trim();
  if (game.cover) {
    cover.style.backgroundImage = `url("${game.cover}")`;
  } else {
    cover.textContent = game.name;
  }
  return cover;
}

function gameCard(game, className, infoClassName) {
  const card = document.createElement("article");
  card.className = className;
  card.dataset.name = game.name;

  const href = `game.html?id=${encodeURIComponent(game.id)}`;

  const info = document.createElement("div");
  info.className = infoClassName;

  const title = document.createElement("h2");
  title.textContent = game.name;

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = game.latestSave
    ? `${plural(game.saveCount, "save", "saves")}, último em ${formatShortDay(game.latestSave.created_at)}`
    : "Nenhum save ainda";

  info.append(title, meta);

  const noteText = game.latestSave?.description || game.description;
  if (noteText) {
    const note = document.createElement("p");
    note.className = "card-note";
    note.textContent = noteText;
    info.append(note);
  }

  card.append(coverElement(game), info);
  card.addEventListener("click", () => { window.location.href = href; });
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", game.name);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.location.href = href;
  });
  return card;
}

// Coloca as capas e o último save do usuário na colagem do início
function fillCollage(library) {
  const pieces = document.querySelectorAll(".hero-collage .cover-piece");
  const withCover = library.filter((g) => g.cover);
  pieces.forEach((piece, i) => {
    const game = withCover[i];
    if (!game) return;
    piece.style.backgroundImage = `url("${game.cover}")`;
    piece.classList.add("has-cover");
  });

  const newest = library
    .filter((g) => g.latestSave)
    .sort((a, b) => new Date(b.latestSave.created_at) - new Date(a.latestSave.created_at))[0];
  if (!newest) return;

  const save = newest.latestSave;
  $("ticket-game").textContent = newest.name;
  $("ticket-file").textContent = save.file_name || save.name || "save";
  $("ticket-note").textContent = save.description || "Sem observação";
  const date = $("ticket-date");
  date.dateTime = save.created_at;
  date.textContent = `Último save: ${formatDay(save.created_at)}, ${formatTime(save.created_at)}`;
}

// ---------- Início ----------

async function loadHomeGames() {
  const container = $("games");
  const status = $("home-status");
  if (!container || !supabaseClient) return;

  container.innerHTML = "";
  setStatus(status, "Carregando…");

  try {
    const user = await currentUser();

    if (!user) {
      container.innerHTML = `
        <section class="empty-state">
          <h2>Entre para ver os seus jogos</h2>
          <p>A sua biblioteca aparece aqui depois que você entrar na conta.</p>
          <a class="primary-btn" href="login.html">Entrar</a>
        </section>`;
      setStatus(status, "");
      return;
    }

    const library = await fetchLibrary(user);

    if (!library.length) {
      container.innerHTML = `
        <section class="empty-state">
          <h2>A sua biblioteca está vazia</h2>
          <p>Adicione um jogo com a capa e o primeiro save. Ele aparece aqui logo em seguida.</p>
          <a class="primary-btn" href="dashboard.html">Adicionar jogo</a>
        </section>`;
      setStatus(status, "");
      return;
    }

    for (const game of library) {
      container.appendChild(gameCard(game, "game-card", "game-info"));
    }
    fillCollage(library);
    setStatus(status, plural(library.length, "jogo", "jogos"));
  } catch (error) {
    console.error(error);
    setStatus(status, "Não foi possível carregar os jogos: " + error.message, true);
  }
}

const search = $("search");
if (search) {
  search.addEventListener("input", () => {
    const term = search.value.toLowerCase().trim();
    document.querySelectorAll(".game-card").forEach((card) => {
      card.style.display = card.dataset.name.toLowerCase().includes(term) ? "" : "none";
    });
  });
}

// ---------- Painel ----------

async function protectDashboard() {
  if (!supabaseClient || !$("my-games")) return;

  try {
    const user = await currentUser();
    if (!user) throw new Error("Sessão não encontrada.");
    await loadGames();
  } catch {
    window.location.href = "login.html";
  }
}

async function loadGames() {
  const container = $("my-games");
  const status = $("dashboard-status");
  if (!container) return;

  setStatus(status, "Carregando…");

  let library;
  try {
    const user = await currentUser();
    library = await fetchLibrary(user);
  } catch (error) {
    setStatus(status, "Não foi possível carregar os jogos: " + error.message, true);
    return;
  }

  container.innerHTML = "";

  if (!library.length) {
    container.innerHTML = `
      <section class="empty-state">
        <h2>Nenhum jogo ainda</h2>
        <p>Use "Adicionar jogo" para enviar a capa e o primeiro save.</p>
      </section>`;
    setStatus(status, "");
    return;
  }

  for (const game of library) {
    container.appendChild(gameCard(game, "dashboard-game", "dashboard-game-info"));
  }

  const total = library.reduce((sum, g) => sum + g.saveCount, 0);
  setStatus(status, `${plural(library.length, "jogo", "jogos")} e ${plural(total, "save", "saves")}`);
}

// ---------- Sair ----------

const logout = $("logout");
if (logout) {
  logout.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });
}

// ---------- Modal "Adicionar jogo" ----------

const modal = $("game-modal");
const openBtn = $("new-game");
const closeBtn = $("close-modal");
const cancelBtn = $("cancel-modal");

function closeModal() {
  if (modal) modal.classList.add("hidden");
  if (openBtn) openBtn.focus();
}
function openModal() {
  if (!modal) return;
  modal.classList.remove("hidden");
  $("game-name").focus();
}
if (openBtn) openBtn.addEventListener("click", openModal);
if (closeBtn) closeBtn.addEventListener("click", closeModal);
if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
if (modal) {
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
});

// ---------- Envio de jogo + capa + save ----------

const gameForm = $("game-form");
if (gameForm) {
  gameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = $("upload-game");
    const status = $("upload-status");
    button.disabled = true;
    button.textContent = "Enviando…";
    setStatus(status, "Preparando o envio…");

    try {
      const user = await currentUser();
      if (!user) throw new Error("Entre na sua conta para adicionar um jogo.");

      const name = $("game-name").value.trim();
      const note = $("game-note").value.trim();
      const coverFile = $("game-cover").files[0];
      const saveFile = $("game-save").files[0];

      if (!name || !coverFile || !saveFile) {
        throw new Error("Preencha o nome e escolha a capa e o arquivo do save.");
      }

      setStatus(status, "Criando o jogo…");
      const { data: game, error: gameError } = await supabaseClient
        .from("games")
        .insert({ user_id: user.id, name, description: note || null })
        .select()
        .single();
      if (gameError) throw gameError;

      const coverPath = `${user.id}/${game.id}/${Date.now()}-${safeFileName(coverFile.name)}`;
      const savePath = `${user.id}/${game.id}/${Date.now()}-${safeFileName(saveFile.name)}`;

      setStatus(status, "Enviando a capa…");
      const { error: coverError } = await supabaseClient.storage
        .from("game-covers")
        .upload(coverPath, coverFile, {
          upsert: false,
          contentType: coverFile.type || "image/jpeg"
        });
      if (coverError) throw coverError;

      setStatus(status, "Enviando o save…");
      const { error: saveError } = await supabaseClient.storage
        .from("save-files")
        .upload(savePath, saveFile, {
          upsert: false,
          contentType: saveFile.type || "application/octet-stream"
        });
      if (saveError) throw saveError;

      const { error: updateGameError } = await supabaseClient
        .from("games")
        .update({ cover_url: coverPath })
        .eq("id", game.id)
        .eq("user_id", user.id);
      if (updateGameError) throw updateGameError;

      const { error: saveRowError } = await supabaseClient
        .from("saves")
        .insert({
          user_id: user.id,
          game_id: game.id,
          name: saveFile.name,
          description: note || null,
          file_url: savePath,
          file_name: saveFile.name
        });
      if (saveRowError) throw saveRowError;

      setStatus(status, "Jogo adicionado.");
      gameForm.reset();

      setTimeout(() => {
        closeModal();
        setStatus(status, "");
        loadGames();
      }, 700);
    } catch (error) {
      console.error(error);
      setStatus(status, "Não foi possível adicionar: " + error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Adicionar jogo";
    }
  });
}

// ---------- Página do jogo ----------

const REFRESH_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 11A8.1 8.1 0 0 0 5.2 6.2L3 8.5M3 4.5V8.5H7M4 13a8.1 8.1 0 0 0 14.8 4.8L21 15.5M21 19.5V15.5H17"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

async function downloadSave(save, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Baixando…";
  try {
    const { data, error } = await supabaseClient.storage
      .from("save-files")
      .download(save.file_url);
    if (error) throw error;

    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = save.file_name || save.name || "save";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert("Não foi possível baixar o save: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

async function loadGamePage() {
  const status = $("game-status");
  const content = $("game-content");
  if (!status || !content) return;

  try {
    const user = await currentUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const gameId = new URLSearchParams(window.location.search).get("id");
    if (!gameId) throw new Error("Nenhum jogo foi informado. Volte ao painel e escolha um jogo.");

    const { data: game, error: gameError } = await supabaseClient
      .from("games")
      .select("id, name, cover_url, description, created_at")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();
    if (gameError) throw new Error("Este jogo não está na sua conta. Volte ao painel e escolha outro.");

    game.cover = "";
    if (game.cover_url) {
      const { data } = await supabaseClient.storage
        .from("game-covers")
        .createSignedUrl(game.cover_url, 3600);
      game.cover = data?.signedUrl || "";
    }

    const { data: saves, error: savesError } = await supabaseClient
      .from("saves")
      .select("id, name, description, file_url, file_name, created_at")
      .eq("game_id", game.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (savesError) throw savesError;

    document.title = `${game.name} — SaveVault`;
    content.innerHTML = "";

    // Cabeçalho do jogo
    const hero = document.createElement("section");
    hero.className = "game-hero";

    const heroInfo = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = game.name;
    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = game.description || "Sem observação sobre este jogo.";
    heroInfo.append(title, desc);
    hero.append(coverElement(game, "large"), heroInfo);
    content.appendChild(hero);

    // Título da lista + adicionar save
    const head = document.createElement("div");
    head.className = "saves-head";
    const h2 = document.createElement("h2");
    h2.textContent = "Saves";
    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = saves.length ? plural(saves.length, "arquivo", "arquivos") : "";
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "primary-btn";
    addButton.textContent = "Adicionar save";
    addButton.addEventListener("click", () => openSaveUpdateModal(null, game, user, "new"));
    head.append(h2, count, addButton);
    content.appendChild(head);

    const list = document.createElement("section");
    list.className = "save-list";

    if (!saves.length) {
      const empty = document.createElement("section");
      empty.className = "empty-state";
      empty.innerHTML = "<h2>Nenhum save neste jogo</h2><p>Use \"Adicionar save\" para enviar o primeiro arquivo.</p>";
      list.appendChild(empty);
    }

    saves.forEach((save, index) => {
      const item = document.createElement("div");
      item.className = "save-item";

      const when = document.createElement("time");
      when.className = "save-date";
      when.dateTime = save.created_at;
      when.innerHTML = `<strong></strong><span></span>`;
      when.querySelector("strong").textContent = formatDay(save.created_at);
      when.querySelector("span").textContent = formatTime(save.created_at);

      const info = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = save.file_name || save.name || "Save";
      if (index === 0 && saves.length > 1) {
        const tag = document.createElement("span");
        tag.className = "latest-tag";
        tag.textContent = "Mais recente";
        name.appendChild(tag);
      }
      const note = document.createElement("p");
      note.textContent = save.description || "Sem observação.";
      info.append(name, note);

      const actions = document.createElement("div");
      actions.className = "save-actions";

      const updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.className = "secondary-btn";
      updateButton.innerHTML = `${REFRESH_ICON}<span>Atualizar</span>`;
      updateButton.setAttribute("aria-label", `Atualizar ${name.firstChild.textContent}`);
      updateButton.addEventListener("click", () => openSaveUpdateModal(save, game, user, "update"));

      const downloadButton = document.createElement("button");
      downloadButton.type = "button";
      downloadButton.className = "primary-btn";
      downloadButton.textContent = "Baixar";
      downloadButton.addEventListener("click", () => downloadSave(save, downloadButton));

      actions.append(updateButton, downloadButton);
      item.append(when, info, actions);
      list.appendChild(item);
    });

    content.appendChild(list);
    content.classList.remove("hidden");
    status.classList.add("hidden");
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
}

// ---------- Modal de save (atualizar ou adicionar) ----------

function createSaveModal() {
  let saveModal = $("save-update-modal");
  if (saveModal) return saveModal;

  saveModal = document.createElement("div");
  saveModal.id = "save-update-modal";
  saveModal.className = "modal hidden";
  saveModal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
      <button id="save-modal-close" class="close" type="button" aria-label="Fechar">×</button>
      <h2 id="save-modal-title">Atualizar save</h2>
      <p id="save-modal-text" class="muted"></p>

      <form id="save-update-form">
        <label for="update-save-file">Arquivo do save</label>
        <div class="file-pick">
          <label for="update-save-file" class="file-upload-btn">Escolher arquivo</label>
          <span id="selected-file-name" class="selected-file-name">Nenhum arquivo escolhido</span>
        </div>
        <input id="update-save-file" type="file" hidden>

        <label for="update-save-note">Observação</label>
        <textarea id="update-save-note" placeholder="Ex.: depois da missão final"></textarea>

        <div class="modal-actions">
          <button type="button" id="save-form-back" class="secondary-btn">Cancelar</button>
          <button type="submit" id="save-form-submit" class="primary-btn">Salvar</button>
        </div>
        <p id="save-update-status" class="form-status" role="status"></p>
      </form>
    </div>
  `;

  document.body.appendChild(saveModal);
  return saveModal;
}

function openSaveUpdateModal(save, game, user, mode = "update") {
  const saveModal = createSaveModal();
  const replacing = mode === "update";

  const form = $("save-update-form");
  const title = $("save-modal-title");
  const text = $("save-modal-text");
  const fileInput = $("update-save-file");
  const selectedFileName = $("selected-file-name");
  const noteInput = $("update-save-note");
  const status = $("save-update-status");
  const submit = $("save-form-submit");
  const submitLabel = replacing ? "Atualizar save" : "Adicionar save";

  function resetFile() {
    fileInput.value = "";
    selectedFileName.textContent = "Nenhum arquivo escolhido";
    selectedFileName.classList.remove("chosen");
  }

  function close() {
    saveModal.classList.add("hidden");
    resetFile();
    setStatus(status, "");
  }

  fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
      selectedFileName.textContent = fileInput.files[0].name;
      selectedFileName.classList.add("chosen");
    } else {
      resetFile();
    }
  };

  resetFile();
  setStatus(status, "");
  submit.textContent = submitLabel;

  if (replacing) {
    title.textContent = "Atualizar save";
    text.textContent = `O arquivo ${save.file_name || save.name || "atual"} será substituído pelo novo.`;
    noteInput.value = save.description || "";
  } else {
    title.textContent = "Adicionar save";
    text.textContent = `Os saves atuais de ${game.name} continuam guardados. O novo entra no topo da lista.`;
    noteInput.value = "";
  }

  saveModal.classList.remove("hidden");

  $("save-form-back").onclick = close;
  $("save-modal-close").onclick = close;
  saveModal.onclick = (event) => { if (event.target === saveModal) close(); };

  form.onsubmit = async (event) => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      setStatus(status, "Escolha o arquivo do save antes de continuar.", true);
      return;
    }

    submit.disabled = true;
    submit.textContent = "Enviando…";
    setStatus(status, "Enviando o arquivo…");

    try {
      const newSavePath = `${user.id}/${game.id}/${Date.now()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("save-files")
        .upload(newSavePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });
      if (uploadError) throw uploadError;

      if (replacing) {
        try {
          // Atualiza o registro para o novo arquivo
          const { error: rowError } = await supabaseClient
            .from("saves")
            .update({
              name: file.name,
              description: noteInput.value.trim() || null,
              file_url: newSavePath,
              file_name: file.name
            })
            .eq("id", save.id)
            .eq("user_id", user.id)
            .eq("game_id", game.id);
          if (rowError) throw rowError;
        } catch (error) {
          // Se o registro não mudou, apaga o arquivo novo para não deixar lixo
          await supabaseClient.storage.from("save-files").remove([newSavePath]);
          throw error;
        }

        // O registro já aponta para o arquivo novo: apagar o antigo é só limpeza.
        // (Antes, uma falha aqui apagava o arquivo novo que já estava em uso.)
        const { error: deleteError } = await supabaseClient.storage
          .from("save-files")
          .remove([save.file_url]);
        if (deleteError) console.error("Não foi possível apagar o arquivo antigo:", deleteError);
      } else {
        const { error: rowError } = await supabaseClient
          .from("saves")
          .insert({
            user_id: user.id,
            game_id: game.id,
            name: file.name,
            description: noteInput.value.trim() || null,
            file_url: newSavePath,
            file_name: file.name
          });
        if (rowError) {
          await supabaseClient.storage.from("save-files").remove([newSavePath]);
          throw rowError;
        }
      }

      setStatus(status, replacing ? "Save atualizado." : "Save adicionado.");

      setTimeout(() => {
        close();
        loadGamePage();
      }, 500);
    } catch (error) {
      console.error(error);
      setStatus(status, "Não foi possível salvar: " + error.message, true);
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  };
}

updateAuthAction();
loadHomeGames();
protectDashboard();
loadGamePage();
