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
    situacao: ''
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  // Debounce para os filtros
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
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
      <h1>Inventário SEPLAG/MT</h1>
      
      <div className="filters-card" style={{ 
        backgroundColor: '#fff', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Filtros</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
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
            placeholder="Local" 
            value={filters.local}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input 
            type="text" 
            name="marca"
            placeholder="Marca" 
            value={filters.marca}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input 
            type="text" 
            name="fornecedor"
            placeholder="Fornecedor" 
            value={filters.fornecedor}
            onChange={handleFilterChange}
            className="filter-input"
          />
          <input 
            type="text" 
            name="ua"
            placeholder="Unidade Administrativa" 
            value={filters.ua}
            onChange={handleFilterChange}
            className="filter-input"
          />
           <input 
            type="text" 
            name="situacao"
            placeholder="Situação" 
            value={filters.situacao}
            onChange={handleFilterChange}
            className="filter-input"
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          <span>{syncMsg}</span>
          <button 
            onClick={handleSync} 
            disabled={syncing}
            style={{
              padding: '12px 24px',
              backgroundColor: '#009879',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.7 : 1,
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {syncing ? 'Importando...' : 'Importar Dados da API'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '10px', color: '#666' }}>
        Exibindo {items.length} de {totalItems} registros
      </div>
      
      <div className="table-container" style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
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
                <td style={{ color: '#888', fontSize: '0.9em' }}>{item.idSQBemPerm}</td>
                <td style={{ fontWeight: 'bold' }}>{item.numeroPatrimonio}</td>
                <td style={{ color: '#666', fontSize: '0.9em' }}>{item.numeroPatrimonioAntigo || '-'}</td>
                <td style={{ minWidth: '200px' }}>{item.descricao || item.descricaoMaterial}</td>
                <td>{item.marca || '-'}</td>
                <td>{item.nomeLocal}</td>
                <td>{item.nomeUA || '-'}</td>
                <td>{item.nomeFornecedor || '-'}</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: item.situacaoFisica === 'BOM' ? '#e8f5e9' : '#fff3e0',
                    color: item.situacaoFisica === 'BOM' ? '#2e7d32' : '#ef6c00',
                    fontSize: '0.85em',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.situacaoFisica}
                  </span>
                </td>
                <td>{item.status || '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{item.dataAquisicao ? new Date(item.dataAquisicao).toLocaleDateString('pt-BR') : '-'}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{formatCurrency(item.valorUnitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ padding: '8px 16px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          Anterior
        </button>
        <span>Página {page} de {totalPages}</span>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{ padding: '8px 16px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
        >
          Próxima
        </button>
      </div>
    </div>
  )
}

export default App
