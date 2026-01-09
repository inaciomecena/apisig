import { useState, useEffect } from 'react'
import axios from 'axios'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
  
  const [selectedItem, setSelectedItem] = useState(null)
  
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
      limit: 30,
      ...debouncedFilters
    })
    
    axios.get(`/api/inventario?${params.toString()}`)
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
      const response = await axios.post('/api/sync')
      setSyncMsg(`Sucesso: ${response.data.message} (${response.data.total} itens)`)
      fetchData() // Recarregar dados do banco após importação
    } catch (err) {
      console.error(err)
      setSyncMsg('Erro ao importar dados.')
    } finally {
      setSyncing(false)
    }
  }

  const handleSavePDF = async () => {
    const element = document.getElementById('modal-content')
    if (!element) return

    // Clonar o elemento para ajustar estilos para impressão (sem scroll)
    const clone = element.cloneNode(true)
    
    // Remover botões do clone (fechar e salvar)
    const buttons = clone.querySelectorAll('button')
    buttons.forEach(btn => btn.style.display = 'none')
    
    // Ajustar estilos para capturar todo o conteúdo
    clone.style.position = 'absolute'
    clone.style.top = '-9999px'
    clone.style.left = '0'
    clone.style.width = '800px' // Manter largura padrão do modal
    clone.style.height = 'auto'
    clone.style.maxHeight = 'none'
    clone.style.overflow = 'visible'
    clone.style.borderRadius = '0'
    clone.style.boxShadow = 'none'
    
    // Ajustar o corpo do modal clonado
    const modalBody = clone.querySelector('.modal-body')
    if (modalBody) {
      modalBody.style.overflow = 'visible'
      modalBody.style.height = 'auto'
    }

    document.body.appendChild(clone)

    try {
      const canvas = await html2canvas(clone, {
        scale: 2, // Melhor qualidade
        useCORS: true,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width
      
      let heightLeft = imgHeight
      let position = 0

      // Adicionar primeira página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight

      // Se o conteúdo for maior que uma página, adicionar mais páginas
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
      }

      pdf.save(`patrimonio_${selectedItem.numeroPatrimonio}.pdf`)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      document.body.removeChild(clone)
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
              <th>Valor Unitário</th>
              <th>Valor Corrigido</th>
              <th>Valor UFIR</th>
              <th>Órgão</th>
              <th>UG</th>
              <th>Cód. Entrada</th>
              <th>Cód. Bem Serviço</th>
              <th>Garantia Início</th>
              <th>Garantia Fim</th>
              <th>Cód. Situação</th>
              <th>Cód. Status</th>
              <th>Cód. Conta</th>
              <th>Cód. Material</th>
              <th>Desc. Material</th>
              <th>Cód. Grupo</th>
              <th>Desc. Grupo</th>
              <th>Cód. SubGrupo</th>
              <th>Desc. SubGrupo</th>
              <th>Data Inclusão</th>
              <th>Data Contábil</th>
              <th>Data Baixa</th>
              <th>Cód. Fornecedor</th>
              <th>Tipo Bem</th>
              <th>Cód. Tipo Bem</th>
              <th>Operação</th>
              <th>Cód. Operação</th>
              <th>Forma Operação</th>
              <th>Cat. Terceiro</th>
              <th>Cód. UA</th>
              <th>Cód. UL</th>
              <th>Cód. Local</th>
              <th>Resp. UA</th>
              <th>Desc. Completa</th>
              <th>Centro Custo</th>
              <th>Cód. Material SIASG</th>
              <th>Ano Fab.</th>
              <th>Ano Mod.</th>
              <th>Chassi</th>
              <th>Placa</th>
              <th>Renavam</th>
              <th>Tipo Veículo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr 
                key={item.idSQBemPerm || item.numeroPatrimonio}
                onClick={() => setSelectedItem(item)}
                className="clickable-row"
              >
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
                <td className="cell-money">{item.valorCorrigido ? formatCurrency(item.valorCorrigido) : '-'}</td>
                <td className="cell-nowrap">{item.valorUfir || '-'}</td>
                <td>{item.orgao || '-'}</td>
                <td>{item.nomeUG || item.descricaoUG || '-'}</td>
                <td>{item.codigoEntrada || '-'}</td>
                <td>{item.codigoBemServico || '-'}</td>
                <td className="cell-nowrap">{item.dataInicioGarantia ? new Date(item.dataInicioGarantia).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="cell-nowrap">{item.dataFimGarantia ? new Date(item.dataFimGarantia).toLocaleDateString('pt-BR') : '-'}</td>
                <td>{item.codigoSituacaoFisica || '-'}</td>
                <td>{item.codigoStatus || '-'}</td>
                <td>{item.codigoConta || '-'}</td>
                <td>{item.codigoMaterial || '-'}</td>
                <td className="cell-wide">{item.descricaoMaterial || '-'}</td>
                <td>{item.codigoGrupo || '-'}</td>
                <td>{item.descricaoGrupo || '-'}</td>
                <td>{item.codigoSubGrupo || '-'}</td>
                <td>{item.descricaoSubGrupo || '-'}</td>
                <td className="cell-nowrap">{item.dataInclusao ? new Date(item.dataInclusao).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="cell-nowrap">{item.dataContabil ? new Date(item.dataContabil).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="cell-nowrap">{item.dataBaixa ? new Date(item.dataBaixa).toLocaleDateString('pt-BR') : '-'}</td>
                <td>{item.codigoFornecedor || '-'}</td>
                <td>{item.tipoBem || '-'}</td>
                <td>{item.codigoTipoBem || '-'}</td>
                <td>{item.descricaoOperacao || '-'}</td>
                <td>{item.codigoOperacao || '-'}</td>
                <td>{item.formaOperacao || '-'}</td>
                <td>{item.categoriaTerceiro || '-'}</td>
                <td>{item.codigoUA || '-'}</td>
                <td>{item.codigoUL || '-'}</td>
                <td>{item.codigoLocal || '-'}</td>
                <td>{item.responsavelUA || '-'}</td>
                <td className="cell-wide">{item.descricaoCompleta || '-'}</td>
                <td>{item.centroCusto || '-'}</td>
                <td>{item.codigoMaterialSiasg || '-'}</td>
                <td>{item.anoFabricacao || '-'}</td>
                <td>{item.anoModelo || '-'}</td>
                <td>{item.numeroChassi || '-'}</td>
                <td>{item.descricaoPlaca || '-'}</td>
                <td>{item.numeroRenavam || '-'}</td>
                <td>{item.descricaoTipoVeiculo || '-'}</td>
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

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div id="modal-content" className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalhes do Patrimônio</h2>
              <button className="btn-close" onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3 className="section-title">Informações Principais</h3>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <label>Descrição Completa</label>
                    <div className="detail-value text-large">{selectedItem.descricaoCompleta || selectedItem.descricao || selectedItem.descricaoMaterial}</div>
                  </div>

                  <div className="detail-item">
                    <label>Número Patrimônio</label>
                    <div className="detail-value highlight">{selectedItem.numeroPatrimonio}</div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Patrimônio Antigo</label>
                    <div className="detail-value">{selectedItem.numeroPatrimonioAntigo || '-'}</div>
                  </div>

                  <div className="detail-item">
                    <label>Marca</label>
                    <div className="detail-value">{selectedItem.marca || '-'}</div>
                  </div>

                  <div className="detail-item">
                    <label>Situação Física</label>
                    <div className="detail-value">
                      <span className={getSituacaoBadgeClass(selectedItem.situacaoFisica)}>
                        {selectedItem.situacaoFisica}
                      </span>
                      {selectedItem.codigoSituacaoFisica && <span className="code-hint"> ({selectedItem.codigoSituacaoFisica})</span>}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Status</label>
                    <div className="detail-value">
                      {selectedItem.status || '-'}
                      {selectedItem.codigoStatus && <span className="code-hint"> ({selectedItem.codigoStatus})</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">Localização e Responsável</h3>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <label>Localização</label>
                    <div className="detail-value">
                      {selectedItem.nomeLocal}
                      {selectedItem.codigoLocal && <span className="code-hint"> (Cód: {selectedItem.codigoLocal})</span>}
                    </div>
                  </div>

                  <div className="detail-item full-width">
                    <label>Unidade Administrativa (UA)</label>
                    <div className="detail-value">
                      {selectedItem.nomeUA || '-'}
                      {selectedItem.codigoUA && <span className="code-hint"> (Cód: {selectedItem.codigoUA})</span>}
                    </div>
                  </div>

                  <div className="detail-item full-width">
                    <label>Unidade Gestora (UG)</label>
                    <div className="detail-value">
                      {selectedItem.nomeUG || '-'}
                      {selectedItem.descricaoUG && <span className="code-hint"> ({selectedItem.descricaoUG})</span>}
                    </div>
                  </div>

                  <div className="detail-item full-width">
                    <label>Responsável</label>
                    <div className="detail-value">
                      {selectedItem.responsavel || '-'}
                      {selectedItem.responsavelUA && <span className="code-hint"> / UA: {selectedItem.responsavelUA}</span>}
                    </div>
                  </div>
                  
                  <div className="detail-item">
                     <label>Órgão</label>
                     <div className="detail-value">{selectedItem.orgao || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">Dados Financeiros e Contábeis</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Valor Unitário</label>
                    <div className="detail-value">{formatCurrency(selectedItem.valorUnitario)}</div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Valor Corrigido</label>
                    <div className="detail-value">{selectedItem.valorCorrigido ? formatCurrency(selectedItem.valorCorrigido) : '-'}</div>
                  </div>

                  <div className="detail-item">
                    <label>Valor UFIR</label>
                    <div className="detail-value">{selectedItem.valorUfir ? parseFloat(selectedItem.valorUfir).toLocaleString('pt-BR') : '-'}</div>
                  </div>

                  <div className="detail-item">
                    <label>Data Aquisição</label>
                    <div className="detail-value">
                      {selectedItem.dataAquisicao ? new Date(selectedItem.dataAquisicao).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Data Contábil</label>
                    <div className="detail-value">
                      {selectedItem.dataContabil ? new Date(selectedItem.dataContabil).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Data Inclusão</label>
                    <div className="detail-value">
                      {selectedItem.dataInclusao ? new Date(selectedItem.dataInclusao).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>

                   <div className="detail-item">
                    <label>Data Baixa</label>
                    <div className="detail-value">
                      {selectedItem.dataBaixa ? new Date(selectedItem.dataBaixa).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>

                  <div className="detail-item full-width">
                    <label>Conta / Categoria</label>
                    <div className="detail-value">
                      {selectedItem.conta || '-'}
                      {selectedItem.codigoConta && <span className="code-hint"> (Cód: {selectedItem.codigoConta})</span>}
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Centro de Custo</label>
                    <div className="detail-value">{selectedItem.centroCusto || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">Dados do Material</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Grupo</label>
                    <div className="detail-value">
                      {selectedItem.descricaoGrupo || '-'}
                      {selectedItem.codigoGrupo && <span className="code-hint"> ({selectedItem.codigoGrupo})</span>}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Subgrupo</label>
                    <div className="detail-value">
                      {selectedItem.descricaoSubGrupo || '-'}
                      {selectedItem.codigoSubGrupo && <span className="code-hint"> ({selectedItem.codigoSubGrupo})</span>}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Material</label>
                    <div className="detail-value">
                      {selectedItem.descricaoMaterial || '-'}
                      {selectedItem.codigoMaterial && <span className="code-hint"> ({selectedItem.codigoMaterial})</span>}
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Material SIASG</label>
                    <div className="detail-value">{selectedItem.codigoMaterialSiasg || '-'}</div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Tipo de Bem</label>
                    <div className="detail-value">
                      {selectedItem.tipoBem || '-'}
                      {selectedItem.codigoTipoBem && <span className="code-hint"> ({selectedItem.codigoTipoBem})</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">Operação e Origem</h3>
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <label>Fornecedor</label>
                    <div className="detail-value">
                      {selectedItem.nomeFornecedor || '-'}
                      {selectedItem.codigoFornecedor && <span className="code-hint"> (Cód: {selectedItem.codigoFornecedor})</span>}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Operação</label>
                    <div className="detail-value">
                      {selectedItem.descricaoOperacao || '-'}
                      {selectedItem.codigoOperacao && <span className="code-hint"> ({selectedItem.codigoOperacao})</span>}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Forma Operação</label>
                    <div className="detail-value">{selectedItem.formaOperacao || '-'}</div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Código Entrada</label>
                    <div className="detail-value">{selectedItem.codigoEntrada || '-'}</div>
                  </div>

                  <div className="detail-item">
                    <label>ID Sistema (Bem/Perm)</label>
                    <div className="detail-value">{selectedItem.idSQBemPerm}</div>
                  </div>
                  
                  <div className="detail-item">
                    <label>Código Bem Serviço</label>
                    <div className="detail-value">{selectedItem.codigoBemServico || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">Garantia</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Início Garantia</label>
                    <div className="detail-value">
                      {selectedItem.dataInicioGarantia ? new Date(selectedItem.dataInicioGarantia).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  <div className="detail-item">
                    <label>Fim Garantia</label>
                    <div className="detail-value">
                      {selectedItem.dataFimGarantia ? new Date(selectedItem.dataFimGarantia).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {(selectedItem.descricaoPlaca || selectedItem.numeroRenavam || selectedItem.numeroChassi) && (
                <div className="detail-section">
                  <h3 className="section-title">Dados de Veículo</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Placa</label>
                      <div className="detail-value highlight">{selectedItem.descricaoPlaca || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>Renavam</label>
                      <div className="detail-value">{selectedItem.numeroRenavam || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>Chassi</label>
                      <div className="detail-value">{selectedItem.numeroChassi || '-'}</div>
                    </div>
                     <div className="detail-item">
                      <label>Tipo Veículo</label>
                      <div className="detail-value">{selectedItem.descricaoTipoVeiculo || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>Ano Fabricação</label>
                      <div className="detail-value">{selectedItem.anoFabricacao || '-'}</div>
                    </div>
                    <div className="detail-item">
                      <label>Ano Modelo</label>
                      <div className="detail-value">{selectedItem.anoModelo || '-'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleSavePDF} style={{ marginRight: '10px' }}>
                Salvar PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
