# R2 + CRM Backend (Node.js + Docker + Swagger + Redis)

## O que faz
- Baixa um arquivo por URL
- Envia para Cloudflare R2 no diretório/prefixo `protocol/`
- Gera URL pública do R2
- Envia essa URL para o CRM via `upload-from-url`
- Armazena o `attachmentId` retornado pelo CRM no Redis (mapeamento `ticketId + r2Key -> attachmentId`)
- Lista todos os arquivos de um mesmo `protocol`
- Substitui arquivo no R2 e atualiza o anexo no CRM (com auto-refresh de token)
- No `/replace`, agora aceita **arquivo direto** via `multipart/form-data` além do modo legado com `fileUrl`

## Rodar
1) Copie `.env.example` para `.env` e preencha as credenciais.
2) Suba:
```bash
docker compose up --build
```

## Swagger
- http://localhost:3000/docs

## Endpoints principais
- POST `/upload-from-url`
- GET `/files?protocol=...&ticketId=...`
- PUT `/replace`
- GET `/health`

## Exemplos

### Listar todos os arquivos de um protocolo
```bash
curl "http://localhost:3000/files?protocol=20265456400"
```

### Replace enviando arquivo direto
```bash
curl -X PUT "http://localhost:3000/replace" \
  -F "file=@/caminho/novo-documento.pdf" \
  -F "protocol=20265456400" \
  -F "key=20265456400/documento-antigo.pdf" \
  -F "ticketId=ad2a2afa7-7ab5-451c-9b56-8692a8fa9c33"
```

### Replace legado por URL
```bash
curl -X PUT "http://localhost:3000/replace" \
  -H "Content-Type: application/json" \
  -d '{
    "fileUrl": "https://site.com/nova.jpg",
    "protocol": "20265456400",
    "key": "20265456400/rg-frente.jpg",
    "ticketId": "ad2a2afa7-7ab5-451c-9b56-8692a8fa9c33"
  }'
```

> Dica: Para atualizar no CRM sem mandar `attachmentId`, use `ticketId + key` e deixe o backend resolver via Redis.
