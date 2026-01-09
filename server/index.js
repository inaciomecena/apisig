const express = require('express');
const cors = require('cors');
const axios = require('axios');
const db = require('./db');
const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

async function initDb() {
  try {
    const connection = await db.getConnection();
    
    // Criar tabela base se não existir
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_bem_perm INT,
        numero_patrimonio VARCHAR(50),
        descricao TEXT,
        nome_local VARCHAR(255),
        situacao_fisica VARCHAR(100),
        data_aquisicao DATE,
        valor_unitario DECIMAL(15, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_patrimonio (numero_patrimonio)
      )
    `);

    // Adicionar colunas novas se não existirem (tentar adicionar e ignorar erro se já existe)
    const columnsToAdd = [
      'ALTER TABLE inventario ADD COLUMN marca VARCHAR(100)',
      'ALTER TABLE inventario ADD COLUMN status VARCHAR(100)',
      'ALTER TABLE inventario ADD COLUMN nome_fornecedor VARCHAR(255)',
      'ALTER TABLE inventario ADD COLUMN nome_ua VARCHAR(255)',
      'ALTER TABLE inventario ADD COLUMN numero_patrimonio_antigo VARCHAR(50)',
      'ALTER TABLE inventario ADD COLUMN responsavel_ul VARCHAR(255)',
      'ALTER TABLE inventario ADD COLUMN conta_atual VARCHAR(255)'
    ];

    for (const sql of columnsToAdd) {
      try {
        await connection.query(sql);
      } catch (err) {
        // Ignora erro se coluna já existe (code 1060 no MySQL)
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.log(`Nota: ${err.message}`);
        }
      }
    }

    console.log('Banco de dados inicializado e atualizado.');
    connection.release();
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error.message);
  }
}

initDb();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.get('/', (req, res) => {
  res.send('Hello from Server!');
});

app.get('/api/inventario', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    // Filtros individuais
    const filters = {
      patrimonio: req.query.patrimonio,
      descricao: req.query.descricao,
      local: req.query.local,
      marca: req.query.marca,
      fornecedor: req.query.fornecedor,
      ua: req.query.ua,
      situacao: req.query.situacao,
      responsavel: req.query.responsavel,
      conta: req.query.conta
    };

    const connection = await db.getConnection();
    try {
      let query = 'SELECT * FROM inventario';
      let countQuery = 'SELECT COUNT(*) as total FROM inventario';
      const params = [];
      const conditions = [];

      if (filters.patrimonio) {
        conditions.push('numero_patrimonio LIKE ?');
        params.push(`%${filters.patrimonio}%`);
      }
      if (filters.descricao) {
        conditions.push('descricao LIKE ?');
        params.push(`%${filters.descricao}%`);
      }
      if (filters.local) {
        conditions.push('nome_local LIKE ?');
        params.push(`%${filters.local}%`);
      }
      if (filters.marca) {
        conditions.push('marca LIKE ?');
        params.push(`%${filters.marca}%`);
      }
      if (filters.fornecedor) {
        conditions.push('nome_fornecedor LIKE ?');
        params.push(`%${filters.fornecedor}%`);
      }
      if (filters.ua) {
        conditions.push('nome_ua LIKE ?');
        params.push(`%${filters.ua}%`);
      }
      if (filters.situacao) {
        conditions.push('situacao_fisica LIKE ?');
        params.push(`%${filters.situacao}%`);
      }
      if (filters.responsavel) {
        conditions.push('responsavel_ul LIKE ?');
        params.push(`%${filters.responsavel}%`);
      }
      if (filters.conta) {
        conditions.push('conta_atual LIKE ?');
        params.push(`%${filters.conta}%`);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      
      // Para o count não precisamos de limit/offset, mas precisamos dos params de busca
      const [countResult] = await connection.query(countQuery, params);
      const total = countResult[0].total;

      // Adicionar limit e offset aos params para a query principal
      const queryParams = [...params, limit, offset];
      const [rows] = await connection.query(query, queryParams);

      res.json({
        data: rows.map(row => ({
          idSQBemPerm: row.id_bem_perm,
          numeroPatrimonio: row.numero_patrimonio,
          numeroPatrimonioAntigo: row.numero_patrimonio_antigo,
          descricao: row.descricao,
          nomeLocal: row.nome_local,
          situacaoFisica: row.situacao_fisica,
          dataAquisicao: row.data_aquisicao,
          valorUnitario: row.valor_unitario,
          marca: row.marca,
          status: row.status,
          nomeFornecedor: row.nome_fornecedor,
          nomeUA: row.nome_ua,
          responsavel: row.responsavel_ul,
          conta: row.conta_atual
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar inventario do banco:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do banco de dados', details: error.message });
  }
});

app.get('/api/filter-options', async (req, res) => {
  try {
    const connection = await db.getConnection();
    try {
      // Consultas para obter valores únicos de cada campo
      const [locais] = await connection.query('SELECT DISTINCT nome_local FROM inventario WHERE nome_local IS NOT NULL ORDER BY nome_local');
      const [marcas] = await connection.query('SELECT DISTINCT marca FROM inventario WHERE marca IS NOT NULL AND marca != "" ORDER BY marca');
      const [fornecedores] = await connection.query('SELECT DISTINCT nome_fornecedor FROM inventario WHERE nome_fornecedor IS NOT NULL AND nome_fornecedor != "" ORDER BY nome_fornecedor');
      const [uas] = await connection.query('SELECT DISTINCT nome_ua FROM inventario WHERE nome_ua IS NOT NULL ORDER BY nome_ua');
      const [situacoes] = await connection.query('SELECT DISTINCT situacao_fisica FROM inventario WHERE situacao_fisica IS NOT NULL ORDER BY situacao_fisica');
      const [responsaveis] = await connection.query('SELECT DISTINCT responsavel_ul FROM inventario WHERE responsavel_ul IS NOT NULL AND responsavel_ul != "" ORDER BY responsavel_ul');
      const [contas] = await connection.query('SELECT DISTINCT conta_atual FROM inventario WHERE conta_atual IS NOT NULL ORDER BY conta_atual');

      res.json({
        locais: locais.map(row => row.nome_local),
        marcas: marcas.map(row => row.marca),
        fornecedores: fornecedores.map(row => row.nome_fornecedor),
        uas: uas.map(row => row.nome_ua),
        situacoes: situacoes.map(row => row.situacao_fisica),
        responsaveis: responsaveis.map(row => row.responsavel_ul),
        contas: contas.map(row => row.conta_atual)
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao buscar opções de filtro:', error.message);
    res.status(500).json({ error: 'Erro ao buscar opções de filtro' });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    // 1. Buscar dados da API externa
    const response = await axios.get('https://servicos.seplag.mt.gov.br/apisigpatseaf/inventario/listarTodosCustomizado/3a46beefb6997be4a7230a92c7ba5e041ef1d017', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        },
        httpsAgent: new (require('https').Agent)({  
            rejectUnauthorized: false 
        })
    });

    const items = response.data;
    if (!Array.isArray(items)) {
      throw new Error('Formato de dados inválido da API externa');
    }

    // 2. Inserir/Atualizar no Banco de Dados
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      for (const item of items) {
        await connection.query(`
          INSERT INTO inventario (
            id_bem_perm, numero_patrimonio, descricao, nome_local, 
            situacao_fisica, data_aquisicao, valor_unitario,
            marca, status, nome_fornecedor, nome_ua, numero_patrimonio_antigo,
            responsavel_ul, conta_atual
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            descricao = VALUES(descricao),
            nome_local = VALUES(nome_local),
            situacao_fisica = VALUES(situacao_fisica),
            data_aquisicao = VALUES(data_aquisicao),
            valor_unitario = VALUES(valor_unitario),
            marca = VALUES(marca),
            status = VALUES(status),
            nome_fornecedor = VALUES(nome_fornecedor),
            nome_ua = VALUES(nome_ua),
            numero_patrimonio_antigo = VALUES(numero_patrimonio_antigo),
            responsavel_ul = VALUES(responsavel_ul),
            conta_atual = VALUES(conta_atual)
        `, [
          item.idSQBemPerm,
          item.numeroPatrimonio,
          item.descricao || item.descricaoMaterial,
          item.nomeLocal,
          item.situacaoFisica,
          item.dataAquisicao,
          item.valorUnitario,
          item.marca,
          item.status,
          item.nomeFornecedor,
          item.nomeUA,
          item.numeroPatrimonioAntigo,
          item.responsavelUL,
          item.contaAtual
        ]);
      }

      await connection.commit();
      res.json({ message: 'Sincronização concluída com sucesso', total: items.length });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Erro ao sincronizar:', error.message);
    res.status(500).json({ error: 'Erro ao sincronizar dados', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
