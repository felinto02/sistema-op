// 1. Pega o ID da URL (ex: index.html?id=123)
const urlParams = new URLSearchParams(window.location.search);
const alvoId = urlParams.get('id');

if (alvoId) {
    // 2. Faz a requisição enviando o ID específico
    fetch(`http://localhost:3000/alvo/${alvoId}`)
      .then(response => {
        if (!response.ok) throw new Error('Não encontrado');
        return response.json();
      })
      .then(data => {
        // Preenche o nome
        document.getElementById('nome-alvo').textContent = data.nome;

        // Atualiza os links dos botões para passarem o ID adiante
        // Assim, as outras páginas saberão qual alvo carregar
        const links = document.querySelectorAll('.buttons a');
        links.forEach(link => {
            const hrefBase = link.getAttribute('href');
            if (hrefBase && hrefBase !== '#') {
                link.href = `${hrefBase}?id=${alvoId}`;
            }
        });

        // Caso tenha o link do mapa no banco
        if (data.link_mapa) {
            document.getElementById('btn-mapa').href = data.link_mapa;
        }
      })
      .catch(error => {
        console.error(error);
        document.getElementById('nome-alvo').textContent = 'Indivíduo não localizado';
      });
} else {
    document.getElementById('nome-alvo').textContent = 'ID não fornecido';
}