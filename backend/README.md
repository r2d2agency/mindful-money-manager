# PsiFinance Backend API

API REST para o sistema PsiFinance. Deploy via Easypanel com PostgreSQL.

## Setup no Easypanel

1. Crie um serviço PostgreSQL no Easypanel
2. Crie um serviço App (Node.js) apontando para este diretório
3. Configure as variáveis de ambiente:

```
DATABASE_URL=postgresql://user:pass@postgres:5432/psifinance
JWT_SECRET=sua-chave-secreta-aqui
PORT=3001
```

4. Execute as migrations: `npm run migrate`
5. Crie o admin inicial: `npm run seed`

## Endpoints

### Auth
- `POST /api/auth/login` - Login

### Patients (autenticado)
- `GET /api/patients` - Lista pacientes (psicólogo vê só os seus)
- `POST /api/patients` - Criar paciente
- `PUT /api/patients/:id` - Atualizar
- `DELETE /api/patients/:id` - Remover

### Sessions, Psychologists, Personal Expenses, Bank Accounts
- Mesmo padrão CRUD

### Users (admin only)
- `GET /api/users` - Lista usuários
- `POST /api/users` - Criar usuário
- `DELETE /api/users/:id` - Remover
