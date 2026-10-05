# Logo nova (ainda NÃO ligada ao site)

| Arquivo | O que é |
|---|---|
| `logo.png` | 1284×1312, fundo transparente, alpha idêntico ao seu PNG original (só otimizado: 111 KB → 47 KB) |
| `logo-2x.png` | 2568×2624, transparente, para telas retina/grandes |
| `logo.svg` | vetor (51 KB), nítido em qualquer tamanho; serve para watermark e logo pequena |
| `logo-original.png` | seu arquivo original, sem alteração |
| `favicon/favicon.svg` | favicon que fica claro no modo escuro do navegador |
| `favicon/favicon.ico` | favicon 16/32/48 com fundo `#f5f5f5` (legível em aba clara e escura) |
| `favicon/apple-touch-icon.png` | ícone do iPhone (180×180, opaco) |
| `favicon/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | ícones de Android/app instalado |

O desenho não foi editado: só redução, ampliação e margem, sem recorte nem distorção.

## Para ligar no site depois

No `<head>` (troca as 4 linhas de favicon atuais):

```html
<link rel="icon" href="/img/logo/favicon/favicon.ico" sizes="48x48">
<link rel="icon" href="/img/logo/favicon/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/logo/favicon/apple-touch-icon.png">
<link rel="manifest" href="/img/logo/favicon/site.webmanifest">
```

Watermark: trocar `img/watermark.png` por `img/logo/logo.svg` (ou `logo-2x.png`) nas páginas, mantendo o CSS atual.
Opcional: copiar `favicon/favicon.ico` para a raiz do site (`/favicon.ico`, hoje dá 404).

O pacote completo (309 arquivos, vários tamanhos e formatos, scripts) ficou fora do repositório em
`~/desktop/redemunhos-logo-completo/` e pode ser apagado.
