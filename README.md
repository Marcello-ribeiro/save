# SaveVault

Backups dos saves dos seus jogos de PC, guardados em ZIP e separados por jogo.

Você escolhe a pasta de saves, o navegador cria um ZIP e envia para a sua conta. Para restaurar, é só baixar o ZIP e extrair na mesma pasta.

## Visual

Tema inspirado na interface de um console moderno, em branco e preto, com destaque rosa de pôr do sol (#ff6fb5) e lilás de apoio:

- ondas finas de luz passando devagar na parte de baixo da tela e uma listra diagonal com um brilho em loop;
- um controle original em SVG que flutua e inclina com o mouse. Ele é branco no tema escuro e preto no tema claro;
- capas que crescem e ganham um contorno claro quando estão selecionadas, com navegação pelas setas do teclado.

Os temas são claro, escuro e automático. As cores de destaque são rosa, azul, lilás e branco puro. Os efeitos de fundo podem ser desligados e também desligam sozinhos com `prefers-reduced-motion`.

## Recursos

- **Biblioteca:** grade de capas com busca, quantidade de backups e data do último.
- **Catálogo:** 360 jogos populares de PC, com capa e as pastas de save no Windows separadas por loja (Steam, GOG, Microsoft Store, Epic…), com "Copiar caminho".
- **Cadastrar jogo:** pelo catálogo, com capa própria ou só com o nome.
  - Você seleciona a pasta de saves e o navegador gera o ZIP (com JSZip) e envia, mostrando o progresso.
  - O formulário avisa quando o ZIP passa do limite de 50 MB.
  - Se algum passo falhar, tudo o que já tinha subido é desfeito.
- **Página do jogo:** baixar, renomear, editar a observação e mover para a lixeira; novo backup, editar jogo e excluir jogo.
- **Backups:** espaço usado, abas Ativos e Lixeira, restaurar, apagar de vez e esvaziar os itens com mais de 30 dias.
- **Sincronização:** exporta a biblioteca inteira num arquivo `.savevault` (ZIP com `manifest.json`, capas e backups).
  - Na importação, mostra um resumo antes de enviar e pula os duplicados, comparando pelo SHA-256.
- **Configurações:** seção inicial, aparência e conta. As preferências ficam na sua conta (`profiles.preferences`) e valem em qualquer computador.
- **Conta:** entrar, criar conta, esqueci a senha e nova senha, com os erros em português.
  - Sem conta dá para navegar e consultar o catálogo.

## Stack

- Vite, React e TypeScript, com CSS próprio em variáveis. Sem framework de UI e sem biblioteca de animação.
- Supabase:
  - Auth para a conta;
  - Postgres com RLS, em que cada pessoa só vê as próprias linhas;
  - Storage com buckets privados.
- JSZip para gerar o ZIP no navegador.

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave publicável do Supabase
npm run dev
```

| Variável | Onde achar |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `VITE_SUPABASE_KEY` | Supabase > Project Settings > API Keys > publishable key |

A chave publicável pode ficar no navegador; quem protege os dados são as policies de RLS. Nunca use a chave secreta (`service_role`) aqui.

Para gerar a versão de produção, rode `npm run build`; o resultado sai em `dist/`. A versão que aparece no canto da tela vem do campo `version` do `package.json`.

## Catálogo

```bash
npm run catalog
```

O script `scripts/build-catalog.mjs` gera `src/data/catalog.json` em quatro passos:

1. Monta a lista com os jogos mais jogados da Steam e completa com as listas da SteamSpy.
2. Lê a seção "Save game data location" de cada jogo na API da PCGamingWiki.
   - Quando a API recusa acesso automático (ela fica atrás de uma checagem da Cloudflare), o script usa o [manifesto do Ludusavi](https://github.com/mtkennerly/ludusavi-manifest), que é gerado a partir das mesmas páginas.
3. Troca as variáveis da wiki por `%APPDATA%`, `%LOCALAPPDATA%`, `%USERPROFILE%\Documents`, "Pasta da Steam", "Pasta do jogo" e `<ID do perfil>`.
4. Guarda a URL da capa vertical da CDN da Steam. Nenhuma imagem vai para o repositório. Se uma capa não carregar, o site mostra o nome do jogo sobre um degradê.

## Banco (Supabase)

Rode no SQL Editor, em ordem, as migrações de `supabase/migrations/` que ainda não rodou. Todas podem rodar mais de uma vez e nenhuma apaga tabela.

| Arquivo | O que faz |
| --- | --- |
| `001` a `003` | Migrações da versão anterior. Rode só se ainda não rodou. |
| `004_games_v3.sql` | `games`: `catalog_id` vira texto e entram `cover_source` e `updated_at`. |
| `005_backups.sql` | Cria a tabela `backups`, com lixeira por `deleted_at`, e as policies dela. |
| `006_profiles_preferences.sql` | `profiles.preferences` (jsonb) e as policies de `profiles`. |
| `007_saves_to_backups.sql` | Copia os saves da tabela antiga `saves` para `backups`. A tabela `saves` continua existindo. |
| `008_storage_policies.sql` | Buckets privados `game-covers` e `save-files`, com acesso só à pasta `user_id/…`, e as policies de `games`. |

## Deploy na Vercel

Use estas configurações:

- framework **Vite**;
- build `npm run build`;
- saída `dist`;
- as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` em Settings > Environment Variables.

O `vercel.json` manda todas as rotas para o `index.html`.

## Créditos

- Caminhos de saves: [PCGamingWiki](https://www.pcgamingwiki.com), sob a licença [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Eles vêm pelo manifesto do [Ludusavi](https://github.com/mtkennerly/ludusavi-manifest).
- Capas: arte dos próprios jogos, servida pela CDN da Steam.
- O visual é original e não usa logos, nomes ou símbolos de nenhuma fabricante de console.

## Licença

[MIT](LICENSE)
