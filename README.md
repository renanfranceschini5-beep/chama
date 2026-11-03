# Chama

Treino em grupo para família e amigos. Web app instalável (PWA) feito com Vite + Supabase, hospedado na Vercel.

## Como publicar

1. **Supabase**: crie um projeto, abra o *SQL Editor* e rode `supabase/schema.sql` inteiro.
2. **Chave pública**: em *Project Settings → API*, copie a *Project URL* e a chave *anon public* para `src/config.js`.
   (A chave anon é feita para ficar no navegador; os dados são protegidos pelas regras RLS do banco.)
3. **Login por link**: em *Authentication → URL Configuration*, coloque o endereço da Vercel em *Site URL* e em *Redirect URLs*.
4. **Vercel**: *Add New → Project*, importe este repositório. A Vercel detecta Vite sozinha (build `npm run build`, saída `dist`).

## Rodar localmente

```bash
npm install
npm run dev
```

## Instalar no celular

- **iPhone**: abrir no Safari → Compartilhar → Adicionar à Tela de Início.
- **Android**: abrir no Chrome → menu ⋮ → Instalar app.

## Regras

Dia ativo = treino de 30 min ou mais. Chama (sequência) tolera 1 folga por semana (seg–dom). Placar por dias ativos na temporada; empates dividem a posição. Tudo é recalculado a partir dos check-ins (`src/rules.js`).
