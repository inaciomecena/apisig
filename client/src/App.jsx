import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  
  // Estados para paginação e filtro
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  
  const [filters, setFilters] = useState({
    patrimonio: '',
    descricao: '',
    local: '',
    marca: '',
    fornecedor: '',
    ua: '',
    situacao: '',
    responsavel: '',
    conta: ''
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  const [filterOptions, setFilterOptions] = useState({
    locais: [],
    marcas: [],
    fornecedores: [],
    uas: [],
    situacoes: [],
    responsaveis: [],
    contas: []
  })
  
  // Debounce para os filtros
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  // Buscar opções de filtro ao carregar
  useEffect(() => {
    axios.get('http://localhost:3002/api/filter-options')
      .then(response => {
        setFilterOptions(response.data)
      })
      .catch(err => console.error('Erro ao buscar opções de filtro:', err))
  }, [])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      patrimonio: '',
      descricao: '',
      local: '',
      marca: '',
      fornecedor: '',
      ua: '',
      situacao: '',
      responsavel: '',
      conta: ''
    })
  }

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({
      page,
      limit: 100,
      ...debouncedFilters
    })
    
    axios.get(`http://localhost:3002/api/inventario?${params.toString()}`)
      .then(response => {
        setItems(response.data.data)
        setTotalPages(response.data.pagination.totalPages)
        setTotalItems(response.data.pagination.total)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError('Erro ao carregar dados do inventário.')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [page, debouncedFilters])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getSituacaoBadgeClass = (situacaoFisica) => {
    const value = (situacaoFisica || '').toString().trim().toUpperCase()
    if (!value) return 'badge badge-muted'
    if (value.includes('BOM')) return 'badge badge-success'
    if (value.includes('IRRECUP') || value.includes('INSERV') || value.includes('INUTIL')) return 'badge badge-danger'
    return 'badge badge-warning'
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('Importando dados da API...')
    try {
      const response = await axios.post('http://localhost:3002/api/sync')
      setSyncMsg(`Sucesso: ${response.data.message} (${response.data.total} itens)`)
      fetchData() // Recarregar dados do banco após importação
    } catch (err) {
      console.error(err)
      setSyncMsg('Erro ao importar dados.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !items.length) return <div className="loading">Carregando inventário...</div>
  if (error) return <div className="loading">{error}</div>

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventário SEPLAG/MT</h1>
          <div className="page-subtitle">Consulta local via banco de dados (MySQL)</div>
        </div>
        <div className="page-header-actions">
          {!!syncMsg && <div className="status-pill" role="status">{syncMsg}</div>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary"
          >
            {syncing ? 'Importando...' : 'Importar Dados da API'}
          </button>
        </div>
      </div>
      
      <div className="card filters-card">
        <div className="card-header">
          <h2 className="card-title">Filtros</h2>
          <button onClick={handleClearFilters} className="btn btn-ghost" type="button">
            Limpar
          </button>
        </div>
        <div className="filters-grid">
          <input 
            type="text" 
            name="patrimonio"
            placeholder="Patrimônio" 
            value={filters.patrimonio}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input 
            type="text" 
            name="descricao"
            placeholder="Descrição" 
            value={filters.descricao}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input 
            type="text" 
            name="local"
            list="locais-list"
            placeholder="Local" 
            value={filters.local}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="locais-list">
            {filterOptions.locais.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

          <input 
            type="text" 
            name="marca"
            list="marcas-list"
            placeholder="Marca" 
            value={filters.marca}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="marcas-list">
            {filterOptions.marcas.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

          <input 
            type="text" 
            name="fornecedor"
            list="fornecedores-list"
            placeholder="Fornecedor" 
            value={filters.fornecedor}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="fornecedores-list">
            {filterOptions.fornecedores.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

          <input 
            type="text" 
            name="ua"
            list="uas-list"
            placeholder="Unidade Administrativa" 
            value={filters.ua}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="uas-list">
            {filterOptions.uas.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

           <input 
            type="text" 
            name="situacao"
            list="situacoes-list"
            placeholder="Situação" 
            value={filters.situacao}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="situacoes-list">
            {filterOptions.situacoes.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

          <input 
            type="text" 
            name="responsavel"
            list="responsaveis-list"
            placeholder="Responsável" 
            value={filters.responsavel}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="responsaveis-list">
            {filterOptions.responsaveis.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>

          <input 
            type="text" 
            name="conta"
            list="contas-list"
            placeholder="Conta / Categoria" 
            value={filters.conta}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <datalist id="contas-list">
            {filterOptions.contas.map((opt, i) => <option key={i} value={opt} />)}
          </datalist>
        </div>
      </div>

      <div className="meta-row">
        <div className="meta-pill">
          Exibindo <strong>{items.length}</strong> de <strong>{totalItems}</strong> registros
        </div>
        <div className="meta-pill">
          Página <strong>{page}</strong> de <strong>{totalPages || 1}</strong>
        </div>
      </div>
      
      <div className="card table-card">
        <div className="table-scroll">
          <table className="inventory-table">
          <thead>
            <tr>
              <th>ID Sistema</th>
              <th>Patrimônio</th>
              <th>Patrimônio Antigo</th>
              <th>Descrição</th>
              <th>Marca</th>
              <th>Local</th>
              <th>UA</th>
              <th>Responsável</th>
              <th>Conta</th>
              <th>Fornecedor</th>
              <th>Situação</th>
              <th>Status</th>
              <th>Data Aquisição</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.idSQBemPerm || item.numeroPatrimonio}>
                <td className="cell-muted">{item.idSQBemPerm}</td>
                <td className="cell-strong">{item.numeroPatrimonio}</td>
                <td className="cell-muted">{item.numeroPatrimonioAntigo || '-'}</td>
                <td className="cell-wide">{item.descricao || item.descricaoMaterial}</td>
                <td>{item.marca || '-'}</td>
                <td>{item.nomeLocal}</td>
                <td>{item.nomeUA || '-'}</td>
                <td>{item.responsavel || '-'}</td>
                <td>{item.conta || '-'}</td>
                <td>{item.nomeFornecedor || '-'}</td>
                <td>
                  <span className={getSituacaoBadgeClass(item.situacaoFisica)}>
                    {item.situacaoFisica}
                  </span>
                </td>
                <td>{item.status || '-'}</td>
                <td className="cell-nowrap">{item.dataAquisicao ? new Date(item.dataAquisicao).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="cell-money">{formatCurrency(item.valorUnitario)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <div className="pagination">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="btn btn-secondary"
        >
          Anterior
        </button>
        <span className="pagination-label">Página {page} de {totalPages || 1}</span>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="btn btn-secondary"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}

export default App
