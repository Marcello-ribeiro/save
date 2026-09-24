const SUPABASE_URL = "https://xmwdtxkoneauvtuaxwxz.supabase.co";
const SUPABASE_KEY = "sb_publishable_99ETmFFHqJ79mpjLL18G6g_1Yhz-KQc";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const $ = (id) => document.getElementById(id);

function safeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function currentUser() {
  if (!supabaseClient) throw new Error("Supabase não foi carregado.");
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function updateAuthAction() {
  const action = $("auth-action");
  if (!action || !supabaseClient) return;

  const { data } = await supabaseClient.auth.getUser();
  if (data.user) {
    action.textContent = "MEU PAINEL";
    action.href = "dashboard.html";
  } else {
    action.textContent = "LOGIN";
    action.href = "login.html";
  }
}

// LOGIN
const loginForm = $("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const email = $("email").value.trim();
      const password = $("password").value;

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.href = "dashboard.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

// CADASTRO
const signupForm = $("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const email = $("email").value.trim();
      const password = $("password").value;

      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        window.location.href = "dashboard.html";
      } else {
        alert("Conta criada. Verifique seu e-mail para confirmar a conta.");
        window.location.href = "login.html";
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

// HOME: somente jogos do usuário logado. Sem login, fica vazia.
async function loadHomeGames() {
  const container = $("games");
  const status = $("home-status");
  if (!container || !supabaseClient) return;

  container.innerHTML = "";
  if (status) status.textContent = "Carregando seus jogos...";

  try {
    const user = await currentUser();

    if (!user) {
      if (status) status.textContent = "Entre na sua conta para ver seus jogos.";
      return;
    }

    const { data: games, error } = await supabaseClient
      .from("games")
      .select("id, name, cover_url, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!games.length) {
      container.innerHTML = `
        <section class="empty-state home-empty">
          <h2>Nenhum jogo enviado</h2>
          <p>Os jogos que você enviar aparecerão aqui.</p>
          <a class="primary-btn" href="dashboard.html">ADICIONAR JOGO</a>
        </section>
      `;
      if (status) status.textContent = "";
      return;
    }

    for (const game of games) {
      const card = document.createElement("article");
      card.className = "game-card";
      card.dataset.name = game.name;
      card.addEventListener("click", () => {
        window.location.href = `game.html?id=${encodeURIComponent(game.id)}`;
      });

      let cover = "";
      if (game.cover_url) {
        const { data, error: coverError } = await supabaseClient.storage
          .from("game-covers")
          .createSignedUrl(game.cover_url, 3600);
        if (!coverError) cover = data?.signedUrl || "";
      }

      const coverDiv = document.createElement("div");
      coverDiv.className = `cover ${cover ? "" : "placeholder-cover"}`;
      if (cover) {
        coverDiv.style.backgroundImage = `url("${cover}")`;
        coverDiv.style.backgroundSize = "cover";
        coverDiv.style.backgroundPosition = "center";
      } else {
        coverDiv.textContent = game.name;
      }

      const info = document.createElement("div");
      info.className = "game-info";
      const title = document.createElement("h2");
      title.textContent = game.name;
      const desc = document.createElement("p");
      desc.textContent = game.description || "Sem descrição.";
      info.append(title, desc);

      card.append(coverDiv, info);
      container.appendChild(card);
    }

    if (status) status.textContent = `${games.length} jogo${games.length === 1 ? "" : "s"} seu${games.length === 1 ? "" : "s"}.`;
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "Erro ao carregar seus jogos: " + error.message;
  }
}

const search = $("search");
if (search) {
  search.addEventListener("input", () => {
    const term = search.value.toLowerCase().trim();
    document.querySelectorAll(".game-card").forEach(card => {
      card.style.display = card.dataset.name.toLowerCase().includes(term) ? "" : "none";
    });
  });
}

// PROTEGE O PAINEL
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

  status.textContent = "Carregando jogos...";
  const user = await currentUser();

  const { data: games, error } = await supabaseClient
    .from("games")
    .select("id, name, cover_url, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    status.textContent = "Erro ao carregar jogos: " + error.message;
    return;
  }

  container.innerHTML = "";

  if (!games.length) {
    container.innerHTML = `
      <section class="empty-state">
        <h2>Nenhum jogo cadastrado</h2>
        <p>Adicione seu primeiro jogo para começar a guardar seus saves.</p>
      </section>
    `;
    status.textContent = "";
    return;
  }

  for (const game of games) {
    let cover = "";
    if (game.cover_url) {
      const { data } = await supabaseClient.storage
        .from("game-covers")
        .createSignedUrl(game.cover_url, 3600);
      cover = data?.signedUrl || "";
    }

    const article = document.createElement("article");
    article.className = "dashboard-game";
    article.style.cursor = "pointer";
    article.addEventListener("click", () => {
      window.location.href = `game.html?id=${encodeURIComponent(game.id)}`;
    });

    const coverDiv = document.createElement("div");
    coverDiv.className = `cover ${cover ? "" : "placeholder-cover"}`;
    if (cover) {
      coverDiv.style.backgroundImage = `url("${cover}")`;
      coverDiv.style.backgroundSize = "cover";
      coverDiv.style.backgroundPosition = "center";
    } else {
      coverDiv.textContent = game.name;
    }

    const info = document.createElement("div");
    info.className = "dashboard-game-info";
    const title = document.createElement("h2");
    title.textContent = game.name;
    const desc = document.createElement("p");
    desc.textContent = game.description || "Sem descrição.";
    info.append(title, desc);

    article.append(coverDiv, info);
    container.appendChild(article);
  }

  status.textContent = `${games.length} jogo${games.length === 1 ? "" : "s"} cadastrado${games.length === 1 ? "" : "s"}.`;
}

// LOGOUT
const logout = $("logout");
if (logout) {
  logout.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });
}

// MODAL DO DASHBOARD
const modal = $("game-modal");
const openBtn = $("new-game");
const closeBtn = $("close-modal");
const cancelBtn = $("cancel-modal");

function closeModal() {
  if (modal) modal.classList.add("hidden");
}
function openModal() {
  if (modal) modal.classList.remove("hidden");
}
if (openBtn) openBtn.addEventListener("click", openModal);
if (closeBtn) closeBtn.addEventListener("click", closeModal);
if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

// UPLOAD DE JOGO + CAPA + SAVE
const gameForm = $("game-form");
if (gameForm) {
  gameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = $("upload-game");
    const status = $("upload-status");
    button.disabled = true;
    button.textContent = "ENVIANDO...";
    status.textContent = "Preparando upload...";

    try {
      const user = await currentUser();
      if (!user) throw new Error("Faça login para enviar um jogo.");

      const name = $("game-name").value.trim();
      const note = $("game-note").value.trim();
      const coverFile = $("game-cover").files[0];
      const saveFile = $("game-save").files[0];

      if (!name || !coverFile || !saveFile) {
        throw new Error("Preencha o nome, a capa e o arquivo do save.");
      }

      status.textContent = "Criando jogo...";
      const { data: game, error: gameError } = await supabaseClient
        .from("games")
        .insert({ user_id: user.id, name, description: note || null })
        .select()
        .single();
      if (gameError) throw gameError;

      const coverPath = `${user.id}/${game.id}/${Date.now()}-${safeFileName(coverFile.name)}`;
      const savePath = `${user.id}/${game.id}/${Date.now()}-${safeFileName(saveFile.name)}`;

      status.textContent = "Enviando capa...";
      const { error: coverError } = await supabaseClient.storage
        .from("game-covers")
        .upload(coverPath, coverFile, {
          upsert: false,
          contentType: coverFile.type || "image/jpeg"
        });
      if (coverError) throw coverError;

      status.textContent = "Enviando save...";
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

      status.textContent = "Jogo e save enviados com sucesso.";
      gameForm.reset();

      setTimeout(() => {
        closeModal();
        status.textContent = "";
        loadGames();
      }, 700);
    } catch (error) {
      console.error(error);
      status.textContent = "Erro: " + error.message;
    } finally {
      button.disabled = false;
      button.textContent = "UPAR";
    }
  });
}

// PÁGINA DO JOGO: mostra somente o jogo pertencente ao usuário logado e seus saves.
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
    if (!gameId) throw new Error("Jogo não informado.");

    const { data: game, error: gameError } = await supabaseClient
      .from("games")
      .select("id, name, cover_url, description, created_at")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();
    if (gameError) throw new Error("Jogo não encontrado na sua conta.");

    let cover = "";
    if (game.cover_url) {
      const { data } = await supabaseClient.storage
        .from("game-covers")
        .createSignedUrl(game.cover_url, 3600);
      cover = data?.signedUrl || "";
    }

    const { data: saves, error: savesError } = await supabaseClient
      .from("saves")
      .select("id, name, description, file_url, file_name, created_at")
      .eq("game_id", game.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (savesError) throw savesError;

    content.innerHTML = "";

    const hero = document.createElement("section");
    hero.className = "game-hero";

    const coverDiv = document.createElement("div");
    coverDiv.className = `cover large ${cover ? "" : "placeholder-cover"}`;
    if (cover) {
      coverDiv.style.backgroundImage = `url("${cover}")`;
      coverDiv.style.backgroundSize = "cover";
      coverDiv.style.backgroundPosition = "center";
    } else {
      coverDiv.textContent = game.name;
    }

    const heroInfo = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "JOGO";
    const title = document.createElement("h1");
    title.textContent = game.name;
    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = game.description || "Seus arquivos de save armazenados.";
    heroInfo.append(eyebrow, title, desc);
    hero.append(coverDiv, heroInfo);
    content.appendChild(hero);

    const list = document.createElement("section");
    list.className = "save-list";

    if (!saves.length) {
      const empty = document.createElement("section");
      empty.className = "empty-state";
      empty.innerHTML = "<h2>Nenhum save enviado</h2><p>Envie um save pelo painel para ele aparecer aqui.</p>";
      list.appendChild(empty);
    } else {
      for (const save of saves) {
        const item = document.createElement("div");
        item.className = "save-item";

        const info = document.createElement("div");
        const name = document.createElement("h2");
        name.textContent = save.name || save.file_name || "Save";
        const note = document.createElement("p");
        note.textContent = save.description || "Sem observação.";
        info.append(name, note);

        const button = document.createElement("button");
        button.className = "primary-btn";
        button.textContent = "BAIXAR";
        button.addEventListener("click", async () => {
          button.disabled = true;
          button.textContent = "BAIXANDO...";
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
            alert("Erro ao baixar: " + error.message);
          } finally {
            button.disabled = false;
            button.textContent = "BAIXAR";
          }
        });

        item.append(info, button);
        list.appendChild(item);
      }
    }

    content.appendChild(list);
    content.classList.remove("hidden");
    status.textContent = "";
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
}

updateAuthAction();
loadHomeGames();
protectDashboard();
loadGamePage();
