const axios = require('axios');
const https = require('https');

async function checkApi() {
  try {
    const response = await axios.get('https://servicos.seplag.mt.gov.br/apisigpatseaf/inventario/listarTodosCustomizado/3a46beefb6997be4a7230a92c7ba5e041ef1d017', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        },
        httpsAgent: new https.Agent({  
            rejectUnauthorized: false 
        })
    });
    
    if (response.data && response.data.length > 0) {
        console.log('Campos disponíveis no primeiro item:');
        console.log(Object.keys(response.data[0]));
        console.log('Exemplo de item:', response.data[0]);
    } else {
        console.log('Nenhum dado retornado ou array vazio');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkApi();
