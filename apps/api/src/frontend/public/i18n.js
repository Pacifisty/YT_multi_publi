(() => {
  const DEFAULT_LOCALE = 'pt-BR';
  const SUPPORTED_LOCALES = new Set(['pt-BR', 'en']);
  const STORAGE_KEY = 'ytmp-locale';
  const COOKIE_NAME = 'pmp_locale';
  const ATTRIBUTES = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
  const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

  const maps = {
    'pt-BR': new Map(),
    en: new Map(),
  };

  const CP1252_CODEPOINT_TO_BYTE = new Map([
    [0x20ac, 0x80],
    [0x201a, 0x82],
    [0x0192, 0x83],
    [0x201e, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02c6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8a],
    [0x2039, 0x8b],
    [0x0152, 0x8c],
    [0x017d, 0x8e],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201c, 0x93],
    [0x201d, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02dc, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9a],
    [0x203a, 0x9b],
    [0x0153, 0x9c],
    [0x017e, 0x9e],
    [0x0178, 0x9f],
  ]);

  function cp1252ByteForCodePoint(codePoint) {
    if (codePoint <= 0xff) return codePoint;
    return CP1252_CODEPOINT_TO_BYTE.get(codePoint) ?? null;
  }

  function decodeCp1252Utf8Mojibake(value) {
    if (!/[\u00c3\u00c2\u00e2\u00f0]/.test(value)) return value;
    if (typeof TextDecoder !== 'function') return value;

    const bytes = [];
    for (const char of value) {
      const byte = cp1252ByteForCodePoint(char.codePointAt(0));
      if (byte === null) return value;
      bytes.push(byte);
    }

    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    } catch {
      return value;
    }
  }

  function repairMojibake(value) {
    let current = String(value ?? '');
    for (let index = 0; index < 4; index += 1) {
      const next = decodeCp1252Utf8Mojibake(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }

  function addPair(pt, en, options = {}) {
    const canonicalPt = repairMojibake(pt);
    const canonicalEn = repairMojibake(en);
    const ptSources = [pt, canonicalPt, ...(options.pt ?? []).map(repairMojibake), ...(options.pt ?? [])].filter(Boolean);
    const enSources = [en, canonicalEn, ...(options.en ?? []).map(repairMojibake), ...(options.en ?? [])].filter(Boolean);
    for (const source of ptSources) {
      maps['pt-BR'].set(source, canonicalPt);
      maps.en.set(source, canonicalEn);
    }
    for (const source of enSources) {
      maps['pt-BR'].set(source, canonicalPt);
      maps.en.set(source, canonicalEn);
    }
  }

  [
    ['Configurações', 'Settings'],
    ['Visual do workspace', 'Workspace visual'],
    ['Modo visual', 'Visual mode'],
    ['3 presets', '3 presets'],
    ['Cor do texto', 'Text tint'],
    ['4 opções', '4 choices', { pt: ['4 opcoes'] }],
    ['Idioma', 'Language'],
    ['Português / English', 'Português / English'],
    ['Dispensar', 'Dismiss'],
    ['Processando...', 'Working...'],
    ['Confirmar', 'Confirm'],
    ['Cancelar', 'Cancel'],
    ['Salvar', 'Save'],
    ['Informação', 'Info', { pt: ['Info'] }],
    ['Aviso', 'Warning'],
    ['Ação necessária', 'Action required', { pt: ['Acao necessaria'] }],
    ['Erro', 'Error'],
    ['Sucesso', 'Success'],
    ['Sair', 'Logout'],
    ['Contas', 'Accounts'],
    ['Vídeos', 'Videos', { pt: ['Videos'] }],
    ['Planos', 'Plans', { pt: ['Planos'] }],
    ['Campanhas', 'Campaigns'],
    ['Entrar', 'Sign in'],
    ['Criar conta', 'Create account'],
    ['Criar workspace', 'Create workspace'],
    ['Acessar workspace', 'Access workspace'],
    ['Começar agora', 'Get started', { pt: ['Comecar agora'] }],
    ['Continuar', 'Continue'],
    ['Voltar', 'Back'],
    ['Atualizar', 'Refresh'],
    ['Buscar', 'Search'],
    ['Aplicar', 'Apply'],
    ['Limpar', 'Clear'],
    ['Anterior', 'Previous'],
    ['Próxima', 'Next', { pt: ['Proxima'] }],
    ['Próxima etapa', 'Next step', { pt: ['Proxima etapa'] }],
    ['Abrir', 'Open'],
    ['Duplicar', 'Duplicate'],
    ['Excluir', 'Delete'],
    ['Comprar', 'Buy'],
    ['Baixar', 'Download'],
    ['Copiar ID', 'Copy ID'],
    ['Excluir ativo', 'Delete asset'],
    ['Excluir campanha', 'Delete campaign'],
    ['Excluir conta conectada', 'Delete connected account'],
    ['Desconectar conta', 'Disconnect account'],
    ['Desconectar', 'Disconnect'],
    ['Ativar', 'Activate'],
    ['Desativar', 'Deactivate'],
    ['Selecionado', 'Selected'],
    ['Todos', 'All'],
    ['Todas', 'All'],
    ['Nenhum', 'None'],
    ['Nenhuma', 'None'],
    ['Sem dados', 'No data', { pt: ['sem dados'] }],
    ['Sem dados.', 'No data.'],
    ['Não encontrado', 'Not found', { pt: ['Nao encontrado'] }],
    ['A página não existe.', 'The page does not exist.', { pt: ['A pagina nao existe.'] }],
    ['Ir para login', 'Go to login'],
    ['Voltar ao dashboard', 'Back to dashboard'],
    ['Esta página do workspace não existe.', 'This workspace page does not exist.', { pt: ['Esta pagina do workspace nao existe.'] }],
    ['Modo de autenticação', 'Authentication mode', { pt: ['Modo de autenticacao'] }],

    ['Abrir configurações', 'Open settings', { pt: ['Abrir configuracoes'] }],
    ['Abrir perfil', 'Open profile'],
    ['Meu perfil', 'My profile'],
    ['Painel do perfil', 'Profile panel'],
    ['Perfil', 'Profile'],
    ['Conta e preferências', 'Account and preferences', { pt: ['Conta e preferencias'] }],
    ['Perfil, idioma e plataforma', 'Profile, language and platform'],
    ['Centro de controle', 'Control center'],
    ['Preferências da plataforma', 'Platform preferences', { pt: ['Preferencias da plataforma'] }],
    ['Controle visual, idioma, perfil e preferências da plataforma.', 'Control visual style, language, profile and platform preferences.', { pt: ['Controle visual, idioma, perfil e preferencias da plataforma.'] }],
    ['Background do plano', 'Plan background'],
    ['Backgrounds desbloqueados', 'Unlocked backgrounds'],
    ['Backgrounds do seu plano', 'Backgrounds for your plan'],
    ['Cada plano adiciona 4 sets; upgrades mantem os backgrounds dos planos anteriores.', 'Each plan adds 4 sets; upgrades keep the backgrounds from previous plans.', { pt: ['Cada plano adiciona 4 sets; upgrades mantem os backgrounds dos planos anteriores.'] }],
    ['Idioma da plataforma', 'Platform language'],
    ['Alterna todos os textos visíveis, labels, titles e aria-labels entre pt-BR e en.', 'Switches all visible text, labels, titles and aria-labels between pt-BR and en.', { pt: ['Alterna todos os textos visiveis, labels, titles e aria-labels entre pt-BR e en.'] }],
    ['Dados da conta, plano ativo, tokens e preferências persistidas.', 'Account data, active plan, tokens and persisted preferences.', { pt: ['Dados da conta, plano ativo, tokens e preferencias persistidas.'] }],
    ['Dados da conta e preferências persistidas neste navegador.', 'Account data and preferences persisted in this browser.', { pt: ['Dados da conta e preferencias persistidas neste navegador.'] }],
    ['Conta, plano, tokens e preferências da plataforma.', 'Account, plan, tokens and platform preferences.', { pt: ['Conta, plano, tokens e preferencias da plataforma.'] }],
    ['Escolha o idioma da interface da plataforma.', 'Choose the platform interface language.'],
    ['Aparência atual', 'Current appearance', { pt: ['Aparencia atual'] }],
    ['Editar aparência', 'Edit appearance', { pt: ['Editar aparencia'] }],
    ['Configurações visuais salvas neste navegador.', 'Visual settings saved in this browser.', { pt: ['Configuracoes visuais salvas neste navegador.'] }],
    ['Background', 'Background'],
    ['Cor do texto', 'Text color'],
    ['Plano visual', 'Visual plan'],
    ['Plano e faturamento', 'Plan and billing'],
    ['Gerencie upgrade, downgrade e compra de tokens avulsos.', 'Manage upgrades, downgrades and one-time token purchases.'],
    ['Abrir planos', 'Open plans'],
    ['Visual simples, variado e direto para comecar sem confusao.', 'Simple, varied and direct visuals to start without confusion.'],
    ['Mais presenca visual, mantendo leitura limpa para operacao recorrente.', 'More visual presence while keeping clean reading for recurring operations.'],
    ['Energia multicanal com contraste claro para fluxos YouTube, TikTok e Instagram.', 'Multi-channel energy with clear contrast for YouTube, TikTok and Instagram flows.'],
    ['Backgrounds mais ricos, com camadas e acabamento premium para operacao avancada.', 'Richer backgrounds with layers and premium finish for advanced operations.'],
    ['Básico', 'Basic', { pt: ['Basico'] }],
    ['Operador', 'Operator'],

    ['Criar sua conta', 'Create your account'],
    ['Entrar no workspace', 'Sign in to your workspace'],
    ['Crie uma conta com email e senha ou continue com Google.', 'Create an account with email and password or continue with Google.'],
    ['Use seu email e senha ou continue com Google para acessar o workspace de publicação.', 'Use your email and password or continue with Google to access the publishing workspace.', { pt: ['Use seu email e senha ou continue com Google para acessar o workspace de publicacao.'] }],
    ['Continuar com Google', 'Continue with Google'],
    ['ou', 'or'],
    ['Bem-vindo de volta', 'Welcome back'],
    ['Comece a publicar em minutos, grátis para uso pessoal.', 'Start publishing in minutes, free forever for personal use.', { en: ['Start publishing in minutes — free forever for personal use.'] }],
    ['Entre para gerenciar campanhas e contas conectadas.', 'Sign in to manage your campaigns and connected accounts.'],
    ['Cadastrar', 'Sign up'],
    ['com email', 'or with email'],
    ['Nome completo', 'Full name'],
    ['Endereço de email', 'Email address', { pt: ['Endereco de email'] }],
    ['Esqueceu?', 'Forgot?'],
    ['Entrar no workspace', 'Sign in to workspace'],
    ['Seu nome', 'Your name'],
    ['Mín. 6 caracteres', 'Min. 6 characters', { pt: ['Min. 6 caracteres'] }],
    ['Sua senha', 'Your password'],
    ['Alternar visibilidade da senha', 'Toggle password visibility'],
    ['Sessão segura · HMAC criptografado', 'Secure session · HMAC encrypted', { pt: ['Sessao segura · HMAC criptografado'] }],
    ['Autenticando', 'Authenticating'],
    ['Carregando sua sessão de operador...', 'Hydrating your operator session...', { pt: ['Carregando sua sessao de operador...'], en: ['Hydrating your operator session…'] }],
    ['Email obrigatório.', 'Email is required.', { pt: ['Email obrigatorio.'] }],
    ['Email deve ser válido.', 'Email must be valid.', { pt: ['Email deve ser valido.'] }],
    ['Senha obrigatória.', 'Password is required.', { pt: ['Senha obrigatoria.'] }],
    ['A senha deve ter pelo menos 6 caracteres.', 'Password must be at least 6 characters.'],
    ['Nome completo deve ter pelo menos 2 caracteres quando informado.', 'Full name must be at least 2 characters when provided.'],
    ['Não foi possível iniciar o login com Google.', 'Unable to start Google sign-in.', { pt: ['Nao foi possivel iniciar o login com Google.'] }],
    ['Criar perfil de operador', 'Create your operator profile'],
    ['Identificar acesso ao workspace', 'Identify your workspace access'],
    ['Autenticar', 'Authenticate'],
    ['Trocar para login', 'Switch to sign in'],
    ['Como devemos identificar você?', 'How should we identify you?', { pt: ['Como devemos identificar voce?'] }],
    ['Crie uma senha com 6+ caracteres', 'Create a 6+ character password'],
    ['Digite sua senha', 'Enter your password'],
    ['Acesso do operador', 'Operator access'],
    ['Acesso ao workspace', 'Workspace access'],
    ['Relé seguro online', 'Secure relay online', { pt: ['Rele seguro online'] }],
    ['Um centro de controle seguro para publicação em YouTube e TikTok.', 'One secure control room for YouTube and TikTok publishing.', { pt: ['Um centro de controle seguro para publicacao em YouTube e TikTok.'] }],
    ['NÓS ONLINE', 'NODES ONLINE', { pt: ['NOS ONLINE'] }],
    ['Etapa 3 de 3', 'Step 3 of 3'],
    ['Sincronizando o workspace da plataforma', 'Syncing the platform workspace'],
    ['Aguarde enquanto validamos a autenticação, carregamos canais e preparamos o dashboard.', 'Hold on while we validate auth, load channel state and prepare the dashboard surfaces.', { pt: ['Aguarde enquanto validamos a autenticacao, carregamos canais e preparamos o dashboard.'] }],

    ['Automação visual para criadores e equipes', 'Visual automation for creators and teams', { pt: ['Automacao visual para criadores e equipes'] }],
    ['YouTube, TikTok e Instagram', 'YouTube, TikTok and Instagram'],
    ['Plataformas', 'Platforms'],
    ['Conteúdo principal', 'Main content', { pt: ['Conteudo principal'] }],
    ['Recursos principais', 'Main features'],
    ['Prévia operacional do produto', 'Operational product preview', { pt: ['Preview operacional do produto'] }],
    ['Escolha de plataforma', 'Platform selector'],
    ['Estados de publicação', 'Publishing states', { pt: ['Estados de publicacao'] }],
    ['Resumo visual do dashboard', 'Dashboard visual summary'],
    ['Campanhas por plataforma', 'Campaigns by platform'],
    ['Biblioteca de mídias', 'Media library', { pt: ['Biblioteca de midias'] }],
    ['Fila de publicação', 'Publishing queue', { pt: ['Fila de publicacao'] }],
    ['Campanhas ativas', 'Active campaigns'],
    ['Vídeos, Shorts, thumbnails, playlists e destinos do canal no mesmo fluxo de campanha.', 'Videos, Shorts, thumbnails, playlists and channel destinations in the same campaign flow.', { pt: ['Videos, Shorts, thumbnails, playlists e destinos do canal no mesmo fluxo de campanha.'] }],
    ['Publicações curtas, privacidade, fila de envio e reautenticação acompanhadas pelo dashboard.', 'Short-form posts, privacy, publishing queue and reauthentication tracked in the dashboard.', { pt: ['Publicacoes curtas, privacidade, fila de envio e reautenticacao acompanhadas pelo dashboard.'] }],
    ['Reels com legenda, conta conectada e status de publicação vistos junto das outras redes.', 'Reels with captions, connected account and publishing status alongside the other networks.', { pt: ['Reels com legenda, conta conectada e status de publicacao vistos junto das outras redes.'] }],
    ['Operação multicanal', 'Multi-channel operation', { pt: ['Operacao multi canal'] }],
    ['Uma campanha, várias redes, menos retrabalho.', 'One campaign, multiple networks, less rework.', { pt: ['Uma campanha, varias redes, menos retrabalho.'] }],
    ['Controle canais, playlists, thumbnails e publicações com histórico de jobs.', 'Control channels, playlists, thumbnails and posts with job history.', { pt: ['Controle canais, playlists, thumbnails e publicacoes com historico de jobs.'] }],
    ['Centralize conta, privacidade, tentativas de envio e bloqueios de autenticação.', 'Centralize account, privacy, upload attempts and authentication blocks.', { pt: ['Centralize conta, privacidade, tentativas de envio e bloqueios de autenticacao.'] }],
    ['Leve Reels para dentro do mesmo planejamento usado pelas outras plataformas.', 'Bring Reels into the same planning flow used by the other platforms.'],
    ['Dashboard de projeto', 'Project dashboard'],
    ['Veja saúde, fila, mídias e riscos antes da publicação sair do trilho.', 'See health, queue, media and risks before publishing drifts off track.', { pt: ['Veja saude, fila, midias e riscos antes da publicacao sair do trilho.'] }],
    ['destinos', 'destinations'],
    ['alertas', 'alerts'],
    ['Base para aparecer no Google', 'Google indexing base'],
    ['Página pública, sitemap, robots e metadados prontos para indexação.', 'Public page, sitemap, robots and metadata ready for indexing.', { pt: ['Pagina publica, sitemap, robots e metadados prontos para indexacao.'] }],
    ['Conteúdo indexável na raiz', 'Indexable content at the root', { pt: ['Conteudo indexavel na raiz'] }],
    ['Sitemap XML público', 'Public XML sitemap', { pt: ['Sitemap XML publico'] }],
    ['Robots com áreas privadas bloqueadas', 'Robots with private areas blocked', { pt: ['Robots com areas privadas bloqueadas'] }],
    ['Title, description e dados estruturados', 'Title, description and structured data'],

    ['Escolha seu plano', 'Choose your account plan'],
    ['Sua conta já foi criada. Escolha o plano antes de entrar no workspace.', 'Your account has already been created. Pick the plan you want to use before entering the workspace.', { pt: ['Sua conta ja foi criada. Escolha o plano antes de entrar no workspace.'] }],
    ['Mais popular', 'Most popular'],
    ['Máximo poder', 'Maximum power', { pt: ['Maximo poder'] }],
    ['Seu plano atual', 'Your current plan'],
    ['Saldo atual:', 'Current balance:'],
    ['Bônus diário já coletado hoje', 'Daily bonus already claimed today', { pt: ['Bonus diario ja coletado hoje'] }],
    ['Grant mensal já recebido este mês', 'Monthly grant already received this month', { pt: ['Grant mensal ja recebido este mes'] }],
    ['Grant mensal pendente este mês', 'Monthly grant pending this month', { pt: ['Grant mensal pendente este mes'] }],
    ['Plano ativo', 'Active plan'],
    ['Carregando plano...', 'Loading plan...'],
    ['Renovar agora', 'Renew now'],
    ['Comprar tokens avulsos', 'Buy one-time tokens'],
    ['Pacotes únicos que somam ao seu saldo. Não substituem a assinatura mensal.', 'One-time packs added to your balance. They do not replace the monthly subscription.', { pt: ['Pacotes unicos que somam ao seu saldo. Nao substituem a assinatura mensal.'] }],
    ['Como funcionam os planos', 'How plans work'],
    ['Cada conta conectada para publicar custa tokens por campanha (1-2 tokens dependendo do plano).', 'Each connected publishing account costs tokens per campaign (1-2 tokens depending on the plan).', { pt: ['Cada conta conectada para publicar custa tokens por campanha (1–2 tokens dependendo do plano).'] }],
    ['Thumbnail custa', 'Thumbnail costs'],
    ['1 token', '1 token'],
    ['no plano Free.', 'on the Free plan.'],
    ['Grátis', 'Free', { pt: ['Gratis'] }],
    ['nos planos pagos.', 'on paid plans.'],
    ['Ao mudar de plano, você recebe os tokens mensais do novo plano imediatamente.', 'When you change plans, you receive the new plan monthly tokens immediately.', { pt: ['Ao mudar de plano, voce recebe os tokens mensais do novo plano imediatamente.'] }],
    ['A publicação só acontece se você tiver tokens suficientes para todas as contas selecionadas.', 'Publishing only runs when you have enough tokens for all selected accounts.', { pt: ['A publicacao so acontece se voce tiver tokens suficientes para todas as contas selecionadas.'] }],
    ['TikTok e Instagram estao disponiveis somente nos planos', 'TikTok and Instagram are available only on the', { pt: ['TikTok e Instagram estao disponiveis somente nos planos'] }],
    ['Planos pagos têm duração de 30 dias e expiram automaticamente para Free.', 'Paid plans last 30 days and automatically expire to Free.', { pt: ['Planos pagos tem duracao de 30 dias e expiram automaticamente para Free.'] }],
    ['Salvando...', 'Saving...'],
    ['Iniciando checkout...', 'Starting checkout...'],
    ['Confirmando pagamento (mock)...', 'Confirming payment (mock)...'],
    ['Checkout iniciado mas sem URL de redirect.', 'Checkout started but no redirect URL was returned.'],
    ['Não foi possível iniciar checkout (sem intent).', 'Unable to start checkout (missing intent).', { pt: ['Nao foi possivel iniciar checkout (sem intent).'] }],
    ['Tokens creditados com sucesso!', 'Tokens credited successfully!'],

    ['Dashboard editorial', 'Editorial Dashboard'],
    ['Resumo rico de sinais para operações e publicação.', 'Signal-rich overview for operations and publishing.', { pt: ['Resumo rico de sinais para operacoes e publicacao.'] }],
    ['Pulso editorial', 'Editorial Pulse'],
    ['Hora atual', 'Current time'],
    ['Agora', 'Now'],
    ['PolÃ­tica de Privacidade', 'Privacy Policy', { pt: ['Politica de Privacidade'] }],
    ['Termos de ServiÃ§o', 'Terms of Service', { pt: ['Termos de Servico'] }],
    ['ExclusÃ£o de Dados do UsuÃ¡rio', 'User Data Deletion', { pt: ['Exclusao de Dados do Usuario'] }],
    ['Criar campanha', 'Create campaign'],
    ['Patrocinado', 'Sponsored'],
    ['Publicidade', 'Advertisement'],
    ['Google AdSense', 'Google AdSense'],
    ['Espaço de anúncio 300x250', 'Ad slot 300x250', { pt: ['Espaco de anuncio 300x250'], en: ['Ad slot 300×250'] }],
    ['Anúncios mantêm este dashboard gratuito', 'Ads keep this dashboard free', { pt: ['Anuncios mantem este dashboard gratuito'] }],
    ['Performance de canais', 'Channel performance'],
    ['Hoje vs. últimas 24h', 'Today vs. last 24h', { pt: ['Hoje vs. ultimas 24h'] }],
    ['Total no workspace', 'Total in workspace'],
    ['Publicadas', 'Published'],
    ['Destinos com sucesso', 'Successful targets'],
    ['Na fila', 'In Queue'],
    ['Jobs na fila + processando', 'Queued + processing jobs'],
    ['Falhas', 'Failures'],
    ['Destinos com erro', 'Targets with error'],
    ['Ativos', 'Assets'],
    ['Tamanho da biblioteca de mídia', 'Media library size', { pt: ['Tamanho da biblioteca de midia'] }],
    ['Cota', 'Quota'],
    ['taxa de sucesso', 'success rate'],
    ['Resumo operacional', 'Operations Summary'],
    ['Destinos', 'Targets'],
    ['Relógio', 'Clock', { pt: ['Relogio'] }],
    ['MELHORES DESEMPENHOS', 'TOP PERFORMERS'],
    ['Vídeos ranqueados por visualizações', 'Ranked videos by views', { pt: ['Videos ranqueados por visualizacoes'] }],
    ['PERFORMANCE DE VISUALIZAÇÕES', 'VIEW PERFORMANCE', { pt: ['PERFORMANCE DE VISUALIZACOES'] }],
    ['Visualizações gerais do canal', 'Overall channel views', { pt: ['Visualizacoes gerais do canal'] }],
    ['Não foi possível carregar dados do dashboard.', 'Unable to load dashboard data.', { pt: ['Nao foi possivel carregar dados do dashboard.'] }],
    ['Falha na requisição do dashboard', 'Dashboard request failed', { pt: ['Falha na requisicao do dashboard'] }],
    ['Sem contas conectadas', 'No connected accounts'],
    ['Conecte uma conta para desbloquear a performance dos canais.', 'Connect accounts to unlock channel performance.'],
    ['Conecte uma conta de', 'Connect a'],
    ['para começar a rastrear visualizações.', 'account to start tracking views.', { pt: ['para comecar a rastrear visualizacoes.'] }],
    ['Visualizações totais', 'Total views', { pt: ['Visualizacoes totais'] }],
    ['Líder', 'Leader', { pt: ['Lider'] }],
    ['Entrega média', 'Avg delivery', { pt: ['Entrega media'] }],
    ['Conta total de visualizações', 'Account total views', { pt: ['Conta total de visualizacoes'] }],
    ['Vídeo mais visto', 'Top video views', { pt: ['Video mais visto'] }],
    ['distribuição de publicação', 'Publishing distribution', { pt: ['Distribuição de publicação', 'Distribuicao de publicacao'] }],
    ['Nenhum destino enviado ainda. Crie uma campanha para ver a distribuição.', 'No targets dispatched yet — start a campaign to see distribution.', { pt: ['Nenhum destino enviado ainda. Crie uma campanha para ver a distribuicao.'] }],
    ['Próximos lançamentos', 'Upcoming launches', { pt: ['Proximos lancamentos'] }],
    ['Saúde operacional', 'Operational health', { pt: ['Saude operacional'] }],
    ['Distribuição por status dos destinos', 'Targets by status', { pt: ['Distribuicao por status dos destinos'] }],
    ['Rank', 'Rank'],
    ['Performance', 'Performance'],

    ['Contas sociais conectadas e canais de publicação.', 'Connected social accounts and publishing channels.', { pt: ['Contas sociais conectadas e canais de publicacao.'] }],
    ['Conta conectada', 'account connected'],
    ['A conta OAuth foi conectada com sucesso.', 'The OAuth callback completed successfully.'],
    ['Não foi possível finalizar o callback OAuth.', 'Unable to finish OAuth callback.', { pt: ['Nao foi possivel finalizar o callback OAuth.'] }],
    ['Conta pronta para recuperar campanhas', 'Account ready to recover campaigns'],
    ['Volte para Campanhas e execute o retry em lote dos destinos que estavam em REAUTH_REQUIRED.', 'Go back to Campaigns and run the bulk retry for destinations that were in REAUTH_REQUIRED.'],
    ['Reprocessar campanhas', 'Reprocess campaigns'],
    ['Nenhuma conta conectada ainda', 'No connected accounts yet'],
    ['Conecte contas YouTube, TikTok ou Instagram para centralizar seu workspace de publicação.', 'Connect YouTube, TikTok, or Instagram accounts to centralize your publishing workspace.', { pt: ['Conecte contas YouTube, TikTok ou Instagram para centralizar seu workspace de publicacao.'] }],
    ['Nenhuma conta corresponde aos filtros atuais', 'No accounts match the current filters'],
    ['Tente limpar busca ou filtros de status para ver as contas conectadas novamente.', 'Try clearing search or status filters to see the connected accounts again.'],
    ['Canais ainda não foram descobertos', 'Channels have not been discovered yet', { pt: ['Canais ainda nao foram descobertos'] }],
    ['Sincronizar canais', 'Sync channels'],
    ['Contas conectadas de YouTube, TikTok e Instagram.', 'Connected YouTube, TikTok, and Instagram publishing accounts.'],
    ['Conectar YouTube', 'Connect YouTube'],
    ['Conectar TikTok', 'Connect TikTok'],
    ['Conectar Instagram', 'Connect Instagram'],
    ['Limpar filtros', 'Clear filters'],
    ['Todas as situações', 'All statuses', { pt: ['Todos os status'] }],
    ['Conectada', 'Connected', { pt: ['Conectado'] }],
    ['Reautenticação necessária', 'Reauth required', { pt: ['Reauth required', 'Reauth Required'] }],
    ['Desconectada', 'Disconnected', { pt: ['Desconectado'] }],
    ['Contas conectadas', 'Connected accounts'],
    ['Lista de identidades', 'Identity roster'],
    ['Canal', 'Channel'],
    ['Conta', 'Account'],
    ['Identificador', 'Handle'],
    ['Estado', 'State'],
    ['Ação', 'Action', { pt: ['Acao'] }],
    ['Conta = canal', 'Account = channel'],
    ['Diretório de canais', 'Channel directory', { pt: ['Diretorio de canais'] }],
    ['Todos os destinos de publicação vinculados', 'All linked publishing destinations', { pt: ['Todos os destinos de publicacao vinculados'] }],
    ['Total descoberto', 'Total discovered'],
    ['Conta em foco', 'Focused account'],
    ['Conta selecionada', 'Selected account'],
    ['Foco ativo', 'Active focus'],
    ['Precisa de atenção', 'Needs attention', { pt: ['Precisa de atencao'] }],
    ['Tudo saudável', 'All healthy', { pt: ['Tudo saudavel'] }],
    ['Alcance', 'Reach'],
    ['Contas visíveis', 'Visible accounts', { pt: ['Contas visiveis'] }],
    ['Canais descobertos', 'Discovered channels'],
    ['Saúde do workspace', 'Workspace health', { pt: ['Saude do workspace'] }],
    ['Cada identidade de publicação,', 'Every publishing identity,', { pt: ['Cada identidade de publicacao,'] }],
    ['um cockpit.', 'one cockpit.'],
    ['Revise saúde, reconecte provedores e roteie campanhas sem sair do workspace.', 'Review health, reconnect providers and route campaigns without leaving the workspace.', { pt: ['Revise saude, reconecte provedores e roteie campanhas sem sair do workspace.'] }],
    ['SINCRONIZAÇÃO AO VIVO', 'LIVE SYNC', { pt: ['SINCRONIZACAO AO VIVO'] }],
    ['Sincronizando...', 'Syncing...'],
    ['Falha na sincronização de canais', 'Channel sync failed', { pt: ['Falha na sincronizacao de canais'] }],
    ['Sincronização de canais concluída', 'Channel sync completed', { pt: ['Sincronizacao de canais concluida'] }],
    ['Canais sincronizados com sucesso.', 'Channels were synced successfully.'],
    ['Conectando...', 'Connecting...'],
    ['Falha no OAuth do YouTube', 'YouTube OAuth failed'],
    ['Falha no OAuth do TikTok', 'TikTok OAuth failed'],
    ['Falha no OAuth do Instagram', 'Instagram OAuth failed'],
    ['URL de redirect OAuth não retornada pela API.', 'OAuth redirect URL not returned by API.', { pt: ['OAuth redirect URL nao retornada pela API.', 'OAuth redirect URL nao retornou pela API.'] }],
    ['Desconectando...', 'Disconnecting...'],
    ['Não foi possível desconectar a conta', 'Unable to disconnect account', { pt: ['Nao foi possivel desconectar a conta'] }],
    ['Conta desconectada', 'Account disconnected'],
    ['A conta selecionada foi desconectada com sucesso.', 'The selected account was disconnected successfully.'],
    ['Excluindo...', 'Deleting...'],
    ['Não foi possível excluir a conta', 'Unable to delete account', { pt: ['Nao foi possivel excluir a conta'] }],
    ['Conta excluída', 'Account deleted', { pt: ['Conta excluida'] }],
    ['Ativando...', 'Activating...'],
    ['Desativando...', 'Deactivating...'],
    ['Falha ao atualizar canal', 'Channel update failed'],
    ['Canal atualizado', 'Channel updated'],

    ['Biblioteca de ativos', 'Asset library'],
    ['Playlists', 'Playlists'],
    ['Mídia de vídeo', 'Video media', { pt: ['Midia de video'] }],
    ['Prévia do ativo', 'Asset preview', { pt: ['Preview do ativo'] }],
    ['Armazenamento de arquivos', 'File storage'],
    ['Duração e agenda', 'Duration and schedule', { pt: ['Duracao e agenda'] }],
    ['Pasta de upload', 'Upload folder'],
    ['Visualização de vídeos', 'Video view', { pt: ['Visualizacao de videos'] }],
    ['Sua biblioteca de vídeos e organização de playlists em um só lugar.', 'Your video library and playlist organization in one place.', { pt: ['Sua biblioteca de videos e organizacao de playlists em um so lugar.'] }],
    ['Ativos reutilizáveis enviados.', 'Uploaded reusable assets.', { pt: ['Ativos reutilizaveis enviados.'], en: ['Uploaded reusable assets.'] }],
    ['Ativos', 'Assets'],
    ['Armazenamento', 'Storage'],
    ['Duração', 'Duration', { pt: ['Duracao'] }],
    ['Duração combinada de mídia', 'Combined media duration', { pt: ['Duracao combinada de midia'] }],
    ['Thumbnails vinculadas', 'Linked Thumbnails'],
    ['Vídeo com thumbnail ou thumbnail vinculada a vídeo', 'Video with thumbnail or thumbnail linked to video', { pt: ['Video com thumbnail ou thumbnail vinculada a video'] }],
    ['Sua biblioteca de mídia está vazia', 'Your media library is empty', { pt: ['Sua biblioteca de midia esta vazia'] }],
    ['Nenhuma mídia corresponde aos filtros atuais', 'No media matches the current filters', { pt: ['Nenhuma midia corresponde aos filtros atuais'] }],
    ['Formato desconhecido', 'Unknown format'],
    ['Biblioteca do workspace', 'Workspace library'],
    ['Passe o mouse para preview e clique para abrir', 'Hover to preview and click to open'],
    ['Passe o mouse para ampliar e clique para abrir', 'Hover to zoom and click to open'],
    ['Exibição:', 'Display:', { pt: ['Exibicao:'] }],
    ['Abrir', 'Open'],
    ['Prévia indisponível.', 'Preview unavailable.', { pt: ['Preview indisponivel.'] }],
    ['Tamanho', 'Size'],
    ['Caminho de armazenamento', 'Storage path'],
    ['Cofre de mídia', 'Media vault', { pt: ['Cofre de midia'] }],
    ['Mantenha cada vídeo e thumbnail pronto para lançamento.', 'Keep every video and thumbnail launch-ready.', { pt: ['Mantenha cada video e thumbnail pronto para lancamento.'] }],
    ['Envie ativos uma vez, reutilize em campanhas YouTube e TikTok.', 'Upload assets once, reuse them across YouTube and TikTok campaigns.'],
    ['STATUS DO COFRE', 'VAULT STATUS'],
    ['Upload', 'Upload'],
    ['Prévia', 'Preview', { pt: ['Preview'] }],
    ['Campanha', 'Campaign'],
    ['Todos os ativos', 'All assets'],
    ['Thumbnails', 'Thumbnails'],
    ['Armazenados', 'Stored'],
    ['Reprodução', 'Playback', { pt: ['Reproducao'] }],
    ['Baia de upload', 'Upload bay'],
    ['Enviar nova mídia', 'Upload new media', { pt: ['Enviar nova midia'] }],
    ['Adicionar vídeo à biblioteca', 'Add video to library', { pt: ['Adicionar video a biblioteca'] }],
    ['MP4 ou MOV · thumbnail opcional', 'MP4 or MOV · Thumbnail is optional', { pt: ['MP4 or MOV - Thumbnail is optional'] }],
    ['Vídeo', 'Video', { pt: ['Video'] }],
    ['Capa', 'Cover'],
    ['*obrigatório', '*required', { pt: ['*obrigatorio'] }],
    ['opcional', 'optional'],
    ['Enviar mídia', 'Upload media', { pt: ['Enviar midia'] }],
    ['Filtros da biblioteca', 'Library filters'],
    ['Filtrar biblioteca', 'Filter library'],
    ['Todos os tipos de ativo', 'All asset types'],
    ['Somente vídeo', 'video only', { pt: ['Somente video'] }],
    ['Somente thumbnail', 'thumbnail only'],
    ['Biblioteca indexada', 'Indexed library'],
    ['Arquivos organizados', 'Organized files'],
    ['Capas vinculadas', 'Linked covers'],
    ['Cards de mídia', 'Media cards', { pt: ['Cards de midia'] }],
    ['Nenhum ativo de mídia encontrado.', 'No media assets found.', { pt: ['Nenhum ativo de midia encontrado.'] }],
    ['Mídia enviada', 'Media uploaded', { pt: ['Midia enviada'] }],
    ['Falha no upload', 'Upload failed'],
    ['Upload falhou.', 'Upload failed.'],
    ['Enviando...', 'Uploading...'],
    ['ID de mídia copiado', 'Media ID copied', { pt: ['ID de midia copiado'] }],
    ['Falha ao copiar', 'Copy failed'],
    ['Não foi possível copiar o ID da mídia para a área de transferência.', 'Unable to copy the media id to the clipboard.', { pt: ['Nao foi possivel copiar o ID da midia para a area de transferencia.'] }],
    ['Mídia excluída', 'Media deleted', { pt: ['Midia excluida'] }],
    ['Falha ao excluir', 'Delete failed'],

    ['Organize, automatize,', 'Organize, automate,'],
    ['não repita.', 'do not repeat.', { pt: ['nao repita.'] }],
    ['Pastas locais viram playlists. Cada vídeo é publicado uma vez e o sistema escolhe o próximo automaticamente.', 'Local folders become playlists. Each video is published once and the system automatically picks the next one.', { pt: ['Pastas locais viram playlists. Cada video e publicado uma vez e o sistema escolhe o proximo automaticamente.'] }],
    ['UTILIZAÇÃO', 'USAGE', { pt: ['UTILIZACAO'] }],
    ['Playlists', 'Playlists'],
    ['Disponíveis', 'Available', { pt: ['Disponiveis'] }],
    ['Já publicados', 'Already published', { pt: ['Ja publicados'] }],
    ['Biblioteca', 'Library', { pt: ['Library'] }],
    ['assets de vídeo', 'video assets', { pt: ['assets de video'] }],
    ['Maior playlist', 'Largest playlist'],
    ['Mais usada', 'Most used'],
    ['Distribuição global', 'Global distribution', { pt: ['Distribuicao global'] }],
    ['disponível', 'available', { pt: ['disponivel'] }],
    ['ATIVO', 'ACTIVE'],
    ['VAZIO', 'EMPTY'],
    ['Baia de importação', 'Import bay', { pt: ['Import bay', 'Baia de importacao'] }],
    ['Escanear pasta local', 'Scan local folder'],
    ['Subpastas → Playlists', 'Subfolders → Playlists'],
    ['Importar da pasta do servidor', 'Import from server folder'],
    ['Cada subpasta vira uma playlist automaticamente', 'Each subfolder becomes a playlist automatically'],
    ['Pasta', 'Folder'],
    ['Automático', 'Auto', { pt: ['Auto'] }],
    ['Escanear e importar', 'Scan and import'],
    ['Manual', 'Manual'],
    ['Criar playlist', 'Create playlist'],
    ['criadas', 'created'],
    ['Crie uma playlist vazia e adicione vídeos manualmente depois.', 'Create an empty playlist and add videos manually later.', { pt: ['Crie uma playlist vazia e adicione videos manualmente depois.'] }],
    ['Nova playlist', 'New playlist', { pt: ['Nova Playlist'] }],
    ['Total de vídeos', 'Total videos', { pt: ['Total videos'] }],
    ['Já usados', 'Already used', { pt: ['Ja usados'] }],
    ['Biblioteca de playlists', 'Playlist library'],
    ['Sem repetição automática', 'Auto · No repetition', { pt: ['Auto · Sem repeticao'] }],
    ['Nenhuma playlist encontrada.', 'No playlists found.', { pt: ['Nenhuma playlist encontrada.'] }],
    ['Nenhuma playlist ainda', 'No playlists yet'],
    ['Escaneando...', 'Scanning...'],
    ['Erro ao escanear', 'Scan failed'],
    ['Scan concluído', 'Scan completed', { pt: ['Scan concluido'] }],
    ['Nome', 'Name'],
    ['Caminho da pasta (opcional)', 'Folder path (optional)'],
    ['Playlist criada', 'Playlist created'],
    ['Excluir playlist?', 'Delete playlist?'],
    ['Erro ao excluir', 'Delete failed'],
    ['Playlist excluída', 'Playlist deleted', { pt: ['Playlist excluida'] }],
    ['Total na playlist', 'Total in playlist'],
    ['Ainda não postados via Auto', 'Not yet posted by Auto', { pt: ['Ainda nao postados via Auto'] }],
    ['Postados pelo modo Auto', 'Posted by Auto mode'],
    ['Progresso', 'Progress'],
    ['Completude da playlist', 'Playlist completion'],
    ['Disponível', 'Available', { pt: ['Disponivel'] }],
    ['usado', 'used'],
    ['disponível', 'available', { pt: ['disponivel'] }],
    ['Playlist manual', 'Manual playlist'],
    ['Criada manualmente', 'Created manually'],
    ['Pasta local', 'Local folder'],
    ['Esgotada', 'Exhausted'],
    ['Playlist vazia', 'Empty playlist'],
    ['Vídeo adicionado', 'Video added', { pt: ['Video adicionado'] }],
    ['Erro ao remover', 'Remove failed'],
    ['Removido', 'Removed'],
    ['Título', 'Title', { pt: ['Titulo'] }],
    ['Descrição', 'Description', { pt: ['Descricao'] }],
    ['Tags (vírgula)', 'Tags (comma)', { pt: ['Tags (virgula)'] }],
    ['Privacidade', 'Privacy'],
    ['Privado', 'Private', { pt: ['private'] }],
    ['Não listado', 'Unlisted', { pt: ['unlisted'] }],
    ['Público', 'Public', { pt: ['public'] }],
    ['Erro ao salvar preset', 'Preset save failed'],
    ['Preset salvo', 'Preset saved'],
    ['Adicionar vídeo', 'Add video', { pt: ['Add video', 'Adicionar video'] }],
    ['Adicionar vídeo existente', 'Add existing video', { pt: ['Adicionar video existente'] }],
    ['disponíveis na biblioteca', 'available in the library', { pt: ['disponiveis na biblioteca'] }],
    ['Selecione um vídeo da biblioteca', 'Select a video from the library', { pt: ['Selecione um video da biblioteca'] }],
    ['Vídeos já na playlist não aparecem', 'Videos already in the playlist are hidden', { pt: ['Videos ja na playlist nao aparecem'] }],
    ['Selecione...', 'Select...'],
    ['Adicionar à playlist', 'Add to playlist', { pt: ['Adicionar a playlist'] }],
    ['Todos os vídeos da biblioteca já estão nesta playlist.', 'All library videos are already in this playlist.', { pt: ['Todos os videos da biblioteca ja estao nesta playlist.'] }],
    ['Status de uso', 'Usage status'],
    ['Restantes', 'Remaining'],
    ['Quando todos os vídeos forem usados, o ciclo reinicia automaticamente a partir dos mais antigos.', 'When every video has been used, the cycle restarts automatically from the oldest ones.', { pt: ['Quando todos os videos forem usados, o ciclo reinicia automaticamente a partir dos mais antigos.'] }],
    ['Biblioteca de vídeos', 'Video library', { pt: ['Video library', 'Biblioteca de videos'] }],
    ['Nenhum vídeo nesta playlist.', 'No videos in this playlist.', { pt: ['Nenhum video nesta playlist.'] }],

    ['Rascunho', 'Draft'],
    ['Ainda editável', 'Still editable', { pt: ['Ainda editavel'] }],
    ['Pronta', 'Ready'],
    ['Pode lançar', 'Can launch', { pt: ['Pode lancar'] }],
    ['Enviando', 'Sending'],
    ['Na fila agora', 'Queued now'],
    ['Concluída', 'Completed', { pt: ['Concluida'] }],
    ['Publicada', 'Published'],
    ['Falhou', 'Failed'],
    ['Precisa revisar', 'Needs review'],
    ['Status da campanha', 'Campaign status'],
    ['Sem plataforma', 'No platform'],
    ['Plataformas da campanha', 'Campaign platforms'],
    ['publicados', 'published'],
    ['erros', 'errors'],
    ['pendentes', 'pending'],
    ['reconectar', 'reauth'],
    ['Progresso de destinos', 'Destination progress'],
    ['Destinos bloqueados', 'Blocked destinations'],
    ['precisam de reconexão', 'need reconnection', { pt: ['precisam de reconexao'] }],
    ['outros', 'others'],
    ['CONTA RECONECTADA', 'ACCOUNT RECONNECTED'],
    ['RECUPERAÇÃO DE CONTAS', 'ACCOUNT RECOVERY', { pt: ['RECUPERACAO DE CONTAS'] }],
    ['destinos pedem reauth', 'destinations need reauth'],
    ['Reconecte a plataforma afetada e depois reenvie todos os destinos que estavam bloqueados por REAUTH_REQUIRED.', 'Reconnect the affected platform, then resend every destination that was blocked by REAUTH_REQUIRED.'],
    ['Campanhas afetadas', 'Affected campaigns'],
    ['Tentar novamente todos reconectados', 'Retry all reconnected'],
    ['Tentar novamente destinos reconectados?', 'Retry reconnected destinations?'],
    ['Tentar novamente', 'Retry'],
    ['Reenfileirando...', 'Requeueing...'],
    ['Retry em lote falhou', 'Bulk retry failed'],
    ['Destinos reenfileirados', 'Destinations requeued'],
    ['Nenhum destino reenfileirado', 'No destinations requeued'],
    ['Marcar pronta', 'Mark ready'],
    ['Lançar', 'Launch', { pt: ['Lancar'] }],
    ['Não foi possível marcar como pronta', 'Unable to mark ready', { pt: ['Unable to mark ready'] }],
    ['Campanha atualizada', 'Campaign updated'],
    ['A campanha agora está pronta para lançamento.', 'The campaign is now ready to launch.', { pt: ['A campanha agora esta pronta para lancamento.'] }],
    ['Lançando...', 'Launching...', { pt: ['Lancando...'] }],
    ['Falha no lançamento', 'Launch failed', { pt: ['Falha no lancamento'] }],
    ['Campanha lançada', 'Campaign launched', { pt: ['Campanha lancada'] }],
    ['O lançamento começou para a campanha selecionada.', 'Launch has started for the selected campaign.', { pt: ['O lancamento comecou para a campanha selecionada.'] }],
    ['Campanha excluída', 'Campaign deleted', { pt: ['Campanha excluida'] }],
    ['A campanha foi removida com sucesso.', 'The campaign was removed successfully.'],
    ['Clonar campanha', 'Clone campaign'],
    ['Criar clone', 'Create clone'],
    ['Título opcional do clone', 'Optional clone title', { pt: ['Titulo opcional do clone'] }],
    ['Deixe em branco para usar o padrão', 'Leave blank for default', { pt: ['Deixe em branco para usar o padrao'] }],
    ['Clonando...', 'Cloning...'],
    ['Falha ao clonar', 'Clone failed'],
    ['Campanha clonada', 'Campaign cloned'],
    ['O clone está pronto para revisão.', 'The cloned campaign is ready for review.', { pt: ['O clone esta pronto para revisao.'] }],
    ['Não foi possível carregar dependências do compositor de campanha.', 'Unable to load campaign composer dependencies.', { pt: ['Nao foi possivel carregar dependencias do compositor de campanha.'] }],
    ['Nenhum destino de publicação conectado disponível.', 'No connected publishing destinations available.', { pt: ['Nenhum destino de publicacao conectado disponivel.'] }],
    ['Destinos de publicação prontos', 'Publishing destinations are ready', { pt: ['Destinos de publicacao prontos'] }],
    ['Conectar contas de publicação', 'Connect publishing accounts', { pt: ['Conectar contas de publicacao'] }],
    ['Conecte contas YouTube, TikTok ou Instagram para direcionar publicações diretamente do compositor.', 'Connect YouTube, TikTok, or Instagram accounts to target publications directly from the composer.', { pt: ['Conecte contas YouTube, TikTok ou Instagram para direcionar publicacoes diretamente do compositor.'] }],
    ['Destinos de publicação conectados', 'Connected publishing destinations', { pt: ['Destinos de publicacao conectados'] }],
    ['escolha onde publicar', 'choose where to publish'],
    ['Não foi possível carregar detalhes da campanha.', 'Unable to load campaign detail.', { pt: ['Nao foi possivel carregar detalhes da campanha.'] }],
    ['Nenhum destino de publicação conectado está disponível. Abra Contas para conectar canais ou contas antes de adicionar um destino.', 'No connected publishing destinations are available. Open Accounts to connect channels or accounts before adding a target.', { pt: ['Nenhum destino de publicacao conectado esta disponivel. Abra Contas para conectar canais ou contas antes de adicionar um destino.'] }],
    ['Destinos conectados não puderam ser carregados automaticamente:', 'Connected destinations could not be loaded automatically:', { pt: ['Destinos conectados nao puderam ser carregados automaticamente:'] }],
    ['Erro desconhecido', 'Unknown error'],
    ['Você ainda pode informar um ID de destino manualmente.', 'You can still enter a destination id manually.', { pt: ['Voce ainda pode informar um ID de destino manualmente.'] }],
    ['Adicionar destino', 'Add target'],
    ['Não foi possível adicionar destino', 'Unable to add target', { pt: ['Nao foi possivel adicionar destino'] }],
    ['Não foi possível remover destino', 'Unable to remove target', { pt: ['Nao foi possivel remover destino'] }],
    ['Configurações da campanha salvas com sucesso.', 'Campaign settings were saved successfully.', { pt: ['Configuracoes da campanha salvas com sucesso.'] }],
    ['Controle rascunhos, filas, agendamentos e resultados de publicação.', 'Control drafts, queues, scheduling and publishing results.', { pt: ['Controle rascunhos, filas, agendamentos e resultados de publicacao.'] }],
    ['Rascunhos', 'Drafts'],
    ['editáveis', 'editable', { pt: ['editaveis'] }],
    ['Prontas', 'Ready'],
    ['aguardando lançamento', 'waiting for launch', { pt: ['aguardando lancamento'] }],
    ['fila ativa', 'active queue'],
    ['Concluídas', 'Completed', { pt: ['Concluidas'] }],
    ['publicadas', 'published'],
    ['Falhas', 'Failures'],
    ['precisam de ação', 'need action', { pt: ['precisam de acao'] }],
    ['Publicadas com sucesso', 'Successfully published'],
    ['Em envio', 'Sending'],
    ['Na fila de publicação', 'In publishing queue', { pt: ['Na fila de publicacao'] }],
    ['Com erro', 'With error'],
    ['Precisam de revisão', 'Need review', { pt: ['Precisam de revisao'] }],
    ['Imediato', 'Immediate'],
    ['Nenhuma campanha ainda', 'No campaigns yet'],
    ['Nenhuma campanha encontrada', 'No campaigns found'],
    ['No campaigns found.', 'No campaigns found.'],
    ['Campanha sem título', 'Untitled campaign', { pt: ['Campanha sem titulo'] }],
    ['Nova campanha', 'New campaign'],
    ['Abrir vídeos', 'Open videos', { pt: ['Abrir videos'] }],
    ['Abrir contas', 'Open accounts'],
    ['AO VIVO', 'LIVE'],
    ['Novo fluxo', 'New flow'],
    ['Campanhas por etapas com plataformas, mídias, destinos, metadados e revisão antes do lançamento.', 'Step-based campaigns with platforms, media, destinations, metadata and review before launch.', { pt: ['Campanhas por etapas com plataformas, midias, destinos, metadados e revisao antes do lancamento.'] }],
    ['Começar campanha', 'Start campaign', { pt: ['Comecar campanha'] }],
    ['PULSO DA FILA - 30 SINAIS', 'QUEUE PULSE - 30 SIGNALS'],
    ['Sem líder', 'No leader', { pt: ['Sem lider'] }],
    ['Publicação', 'Publishing', { pt: ['Publicacao'] }],
    ['INTELIGÊNCIA DA FILA', 'QUEUE INTELLIGENCE', { pt: ['INTELIGENCIA DA FILA'] }],
    ['Taxa de sucesso', 'Success rate'],
    ['Próximo envio', 'Next launch', { pt: ['Proximo envio'] }],
    ['Sem fila', 'No queue'],
    ['Agende uma campanha', 'Schedule a campaign'],
    ['Hoje', 'Today'],
    ['envios agendados', 'scheduled launches'],
    ['Plataforma líder', 'Leading platform', { pt: ['Plataforma lider'] }],
    ['Sem dados ainda', 'No data yet'],
    ['no pipeline', 'in pipeline'],
    ['ÚLTIMOS 7 DIAS', 'LAST 7 DAYS', { pt: ['ULTIMOS 7 DIAS'] }],
    ['no total', 'total'],
    ['Filtros de campanha', 'Campaign filters'],
    ['Refinar fila', 'Refine queue'],
    ['Todos', 'All'],
    ['Painel de lançamento', 'Launch panel', { pt: ['Painel de lancamento'] }],
    ['Mostrando', 'Showing'],
    ['de', 'of'],

    ['Automação', 'Automation', { pt: ['Automacao'] }],
    ['Publicação automática ativa', 'Automatic publishing active', { pt: ['Publicacao automatica ativa'] }],
    ['Configure a automação por etapas', 'Configure automation step by step', { pt: ['Configure a automacao por etapas'] }],
    ['Resumo vivo', 'Live summary'],
    ['Plano', 'Plan'],
    ['Tokens', 'Tokens'],
    ['Origem', 'Source'],
    ['Selecionado', 'Selected'],
    ['Agendamento', 'Schedule'],
    ['Aleatório', 'Random', { pt: ['Aleatorio'] }],
    ['Data fixa', 'Fixed date'],
    ['Manual', 'Manual'],
    ['Crie uma campanha em etapas claras', 'Create a campaign in clear steps'],
    ['Plataformas primeiro, depois mídia, destinos, agenda, metadados e revisão. O fluxo fica salvo no navegador enquanto você ajusta.', 'Platforms first, then media, destinations, schedule, metadata and review. The flow is saved in the browser while you adjust it.', { pt: ['Plataformas primeiro, depois midia, destinos, agenda, metadados e revisao. O fluxo fica salvo no navegador enquanto voce ajusta.'] }],
    ['Voltar para campanhas', 'Back to campaigns'],
    ['Sem conta conectada', 'No connected account'],
    ['Conecte uma conta para habilitar esta opção.', 'Connect an account to enable this option.', { pt: ['Conecte uma conta para habilitar esta opcao.'] }],
    ['Etapa 1', 'Step 1'],
    ['Criando nova campanha', 'Creating a new campaign'],
    ['Escolha uma ou mais plataformas. As plataformas sem conta conectada ficam visíveis, mas bloqueadas.', 'Choose one or more platforms. Platforms without a connected account stay visible but locked.', { pt: ['Escolha uma ou mais plataformas. As plataformas sem conta conectada ficam visiveis, mas bloqueadas.'] }],
    ['Etapa 2', 'Step 2'],
    ['Selecionar vídeo', 'Select video', { pt: ['Selecionar video'] }],
    ['Defina se a campanha usa uma mídia específica ou uma playlist automatizada, e se o formato é vídeo longo ou curto.', 'Choose whether the campaign uses a specific media asset or an automated playlist, and whether the format is long or short video.', { pt: ['Defina se a campanha usa uma midia especifica ou uma playlist automatizada, e se o formato e video longo ou curto.'] }],
    ['Escolher um vídeo manualmente.', 'Choose a video manually.', { pt: ['Escolher um video manualmente.'] }],
    ['Escolha automática a partir de uma playlist.', 'Automatic pick from a playlist.', { pt: ['Escolha automatica a partir de uma playlist.'] }],
    ['Liberado somente para planos pagos.', 'Available only for paid plans.'],
    ['Vídeo longo', 'Long video', { pt: ['Video longo'] }],
    ['Vídeo curto', 'Short video', { pt: ['Video curto'] }],
    ['Selecionar playlist', 'Select playlist'],
    ['Padrão de agendamento aleatório', 'Random scheduling pattern', { pt: ['Padrao de agendamento aleatorio'] }],
    ['Regras de escolha dos vídeos', 'Video selection rules', { pt: ['Regras de escolha dos videos'] }],
    ['Este painel fica limitado ao comportamento da playlist. Horários entram na Etapa 3 e títulos entram na Etapa 4.', 'This panel is limited to playlist behavior. Times go in Step 3 and titles go in Step 4.', { pt: ['Este painel fica limitado ao comportamento da playlist. Horarios entram na Etapa 3 e titulos entram na Etapa 4.'] }],
    ['Ordem dos vídeos', 'Video order', { pt: ['Ordem dos videos'] }],
    ['Sequencial', 'Sequential'],
    ['Não usados primeiro', 'Unused first', { pt: ['Nao usados primeiro'] }],
    ['Quando a playlist acabar', 'When the playlist ends'],
    ['Não repetir até todos saírem', 'Do not repeat until all have been used', { pt: ['Nao repetir ate todos sairem'] }],
    ['Permitir repetição', 'Allow repeats', { pt: ['Permitir repeticao'] }],
    ['Pausar campanha', 'Pause campaign'],
    ['Usar apenas vídeos compatíveis com o formato escolhido.', 'Use only videos compatible with the selected format.', { pt: ['Usar apenas videos compativeis com o formato escolhido.'] }],
    ['Nenhum destino ativo encontrado para as plataformas escolhidas.', 'No active destination found for the selected platforms.'],
    ['Horário deste destino', 'Time for this destination', { pt: ['Horario deste destino'] }],
    ['Mídia', 'Media', { pt: ['Midia'] }],
    ['Metadados', 'Metadata'],
    ['Revisão', 'Review', { pt: ['Revisao'] }],
    ['Fonte', 'Source'],
    ['Formato', 'Format'],
    ['Destino', 'Destination'],
    ['Destino(s)', 'Destination(s)'],
    ['Privacidade do vídeo', 'Video privacy', { pt: ['Privacidade do video'] }],
    ['Base para título aleatório', 'Random title base', { pt: ['Base para titulo aleatorio'] }],
    ['Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.', 'Fill the random title base with at least 12 words to generate a better brief.', { pt: ['Preencha a Base para titulo aleatorio com no minimo 12 palavras para gerar um briefing melhor.'] }],
    ['Base suficiente para briefing.', 'Base is enough for a brief.'],
    ['palavras', 'words'],
    ['Nenhuma capa selecionada', 'No cover selected'],
    ['Brief de capa', 'Cover brief'],
    ['Copiar brief da thumbnail', 'Copy thumbnail brief'],
    ['Seu plano atual pode bloquear:', 'Your current plan may block:'],
    ['Se o backend negar, ajuste o plano ou remova estes destinos.', 'If the backend denies it, adjust the plan or remove these destinations.'],
    ['Campanha salva', 'Campaign saved'],
    ['Falha ao salvar campanha', 'Campaign save failed'],

    ['Duração não detectada', 'Duration not detected', { pt: ['Duracao nao detectada'] }],
    ['Vídeo normal', 'Standard video', { pt: ['Video normal'] }],
    ['Baixo', 'Low'],
    ['Médio', 'Medium', { pt: ['Medio'] }],
    ['Grande', 'Large'],
    ['Neon cinematográfico TikTok.', 'Neon cinematic TikTok.', { pt: ['Neon cinematic TikTok.'] }],
    ['Transmissão vermelho quente.', 'Hot red broadcast.', { pt: ['Hot red broadcast.'] }],
    ['Gradiente social com contraste mais quente.', 'Social gradient with warmer contrast.', { pt: ['Social gradient with warmer contrast.'] }],
    ['Analytics premium escuro.', 'Premium analytics dark.', { pt: ['Premium analytics dark.'] }],
    ['SaaS futurista escuro.', 'Futuristic SaaS dark.', { pt: ['Futuristic SaaS dark.'] }],
    ['UI interna neutra.', 'Neutral internal UI.', { pt: ['Neutral internal UI.'] }],
    ['Energia técnica ciano.', 'Technical cyan energy.', { pt: ['Technical cyan energy.'] }],
    ['Conteúdo minimalista escuro.', 'Minimal content dark.', { pt: ['Minimal content dark.'] }],
    ['Admin clássico claro.', 'Classic light admin.', { pt: ['Classic light admin.'] }],
    ['Dashboards densos equilibrados.', 'Balanced dense dashboards.', { pt: ['Balanced dense dashboards.'] }],
    ['Workspace técnico fresco.', 'Fresh technical workspace.', { pt: ['Fresh technical workspace.'] }],
    ['Produto editorial quente.', 'Editorial warm product.', { pt: ['Editorial warm product.'] }],
    ['Interface criativa suave.', 'Soft creative interface.', { pt: ['Soft creative interface.'] }],
    ['UI de produtividade limpa.', 'Clean productivity UI.', { pt: ['Clean productivity UI.'] }],
    ['Contraste de gradiente hero.', 'Hero gradient contrast.', { pt: ['Hero gradient contrast.'] }],
    ['Energia criativa de marketing.', 'Creative marketing energy.', { pt: ['Creative marketing energy.'] }],
    ['Crescimento e saúde.', 'Growth and health.', { pt: ['Growth and health.'] }],
    ['Gradiente premium profundo.', 'Deep premium gradient.', { pt: ['Deep premium gradient.'] }],
    ['Calor forte de campanha.', 'Bold campaign warmth.', { pt: ['Bold campaign warmth.'] }],
    ['Hub claro de analytics.', 'Light analytics hub.', { pt: ['Light analytics hub.'] }],
    ['Premium escuro texturizado.', 'Textured premium dark.', { pt: ['Textured premium dark.'] }],
    ['Leitura organizada em grade.', 'Organized grid reading.', { pt: ['Organized grid reading.'] }],
    ['Premium moderno artístico.', 'Modern artistic premium.', { pt: ['Modern artistic premium.'] }],
    ['Glass premium claro.', 'Light premium glass.', { pt: ['Light premium glass.'] }],
    ['Escuro criativo não convencional.', 'Creative nonstandard dark.', { pt: ['Creative nonstandard dark.'] }],
    ['Corporativo escuro sério.', 'Serious corporate dark.', { pt: ['Serious corporate dark.'] }],
  ].forEach((entry) => addPair(entry[0], entry[1], entry[2]));

  const patterns = [
    {
      pt: /^Plano (.+)$/i,
      en: /^Plan (.+)$/i,
      toPt: (m) => `Plano ${m[1]}`,
      toEn: (m) => `Plan ${m[1]}`,
    },
    {
      pt: /^Assinar (.+)$/i,
      en: /^Subscribe to (.+)$/i,
      toPt: (m) => `Assinar ${m[1]}`,
      toEn: (m) => `Subscribe to ${m[1]}`,
    },
    {
      pt: /^Saldo atual:\s*(.+)$/i,
      en: /^Current balance:\s*(.+)$/i,
      toPt: (m) => `Saldo atual: ${m[1]}`,
      toEn: (m) => `Current balance: ${m[1]}`,
    },
    {
      pt: /^\+(\d[\d.,]*) tokens disponíveis hoje$/i,
      en: /^\+(\d[\d.,]*) tokens available today$/i,
      toPt: (m) => `+${m[1]} tokens disponíveis hoje`,
      toEn: (m) => `+${m[1]} tokens available today`,
    },
    {
      pt: /^(.+) tokens adicionados ao seu saldo\.$/i,
      en: /^(.+) tokens added to your balance\.$/i,
      toPt: (m) => `${m[1]} tokens adicionados ao seu saldo.`,
      toEn: (m) => `${m[1]} tokens added to your balance.`,
    },
    {
      pt: /^Plano (.+) ativado com sucesso!$/i,
      en: /^Plan (.+) activated successfully!$/i,
      toPt: (m) => `Plano ${m[1]} ativado com sucesso!`,
      toEn: (m) => `Plan ${m[1]} activated successfully!`,
    },
    {
      pt: /^(.+) contas$/i,
      en: /^(.+) accounts$/i,
      toPt: (m) => `${m[1]} contas`,
      toEn: (m) => `${m[1]} accounts`,
    },
    {
      pt: /^(.+) canais$/i,
      en: /^(.+) channels$/i,
      toPt: (m) => `${m[1]} canais`,
      toEn: (m) => `${m[1]} channels`,
    },
    {
      pt: /^(.+) rotas ativas$/i,
      en: /^(.+) active routes$/i,
      toPt: (m) => `${m[1]} rotas ativas`,
      toEn: (m) => `${m[1]} active routes`,
    },
    {
      pt: /^(.+) visíveis de (.+)$/i,
      en: /^(.+) visible of (.+)$/i,
      toPt: (m) => `${m[1]} visíveis de ${m[2]}`,
      toEn: (m) => `${m[1]} visible of ${m[2]}`,
    },
    {
      pt: /^(.+) canais ativos \/ (.+) total$/i,
      en: /^(.+) active \/ (.+) total$/i,
      toPt: (m) => `${m[1]} canais ativos / ${m[2]} total`,
      toEn: (m) => `${m[1]} active / ${m[2]} total`,
    },
    {
      pt: /^Canais — (.+)$/i,
      en: /^Channels — (.+)$/i,
      toPt: (m) => `Canais — ${m[1]}`,
      toEn: (m) => `Channels — ${m[1]}`,
    },
    {
      pt: /^(.+) destinos em (.+) campanhas$/i,
      en: /^(.+) destinations in (.+) campaigns$/i,
      toPt: (m) => `${m[1]} destinos em ${m[2]} campanhas`,
      toEn: (m) => `${m[1]} destinations in ${m[2]} campaigns`,
    },
    {
      pt: /^\+(.+) outros$/i,
      en: /^\+(.+) others$/i,
      toPt: (m) => `+${m[1]} outros`,
      toEn: (m) => `+${m[1]} others`,
    },
    {
      pt: /^(.+) de (.+) usados$/i,
      en: /^(.+) of (.+) used$/i,
      toPt: (m) => `${m[1]} de ${m[2]} usados`,
      toEn: (m) => `${m[1]} of ${m[2]} used`,
    },
    {
      pt: /^(.+) com vídeos · (.+) esgotadas$/i,
      en: /^(.+) with videos · (.+) exhausted$/i,
      toPt: (m) => `${m[1]} com vídeos · ${m[2]} esgotadas`,
      toEn: (m) => `${m[1]} with videos · ${m[2]} exhausted`,
    },
    {
      pt: /^(.+) média por playlist$/i,
      en: /^(.+) average per playlist$/i,
      toPt: (m) => `${m[1]} média por playlist`,
      toEn: (m) => `${m[1]} average per playlist`,
    },
    {
      pt: /^(.+) vídeos$/i,
      en: /^(.+) videos$/i,
      toPt: (m) => `${m[1]} vídeos`,
      toEn: (m) => `${m[1]} videos`,
    },
    {
      pt: /^(.+) disponiveis · (.+) usados$/i,
      en: /^(.+) available · (.+) used$/i,
      toPt: (m) => `${m[1]} disponíveis · ${m[2]} usados`,
      toEn: (m) => `${m[1]} available · ${m[2]} used`,
    },
    {
      pt: /^(.+) usada$/i,
      en: /^(.+) used$/i,
      toPt: (m) => `${m[1]} usada`,
      toEn: (m) => `${m[1]} used`,
    },
    {
      pt: /^Published:\s*(.+)$/i,
      en: /^Published:\s*(.+)$/i,
      toPt: (m) => `Publicados: ${m[1]}`,
      toEn: (m) => `Published: ${m[1]}`,
    },
    {
      pt: /^Failed:\s*(.+)$/i,
      en: /^Failed:\s*(.+)$/i,
      toPt: (m) => `Falhas: ${m[1]}`,
      toEn: (m) => `Failed: ${m[1]}`,
    },
    {
      pt: /^Pending:\s*(.+)$/i,
      en: /^Pending:\s*(.+)$/i,
      toPt: (m) => `Pendentes: ${m[1]}`,
      toEn: (m) => `Pending: ${m[1]}`,
    },
    {
      pt: /^Reauth:\s*(.+)$/i,
      en: /^Reauth:\s*(.+)$/i,
      toPt: (m) => `Reauth: ${m[1]}`,
      toEn: (m) => `Reauth: ${m[1]}`,
    },
    {
      pt: /^Campanhas \((.+)\)$/i,
      en: /^Campaigns \((.+)\)$/i,
      toPt: (m) => `Campanhas (${m[1]})`,
      toEn: (m) => `Campaigns (${m[1]})`,
    },
    {
      pt: /^Cards de mídia \((.+)\)$/i,
      en: /^Media cards \((.+)\)$/i,
      toPt: (m) => `Cards de mídia (${m[1]})`,
      toEn: (m) => `Media cards (${m[1]})`,
    },
    {
      pt: /^Playlists \((.+)\)$/i,
      en: /^Playlists \((.+)\)$/i,
      toPt: (m) => `Playlists (${m[1]})`,
      toEn: (m) => `Playlists (${m[1]})`,
    },
    {
      pt: /^Vídeos da playlist \((.+)\)$/i,
      en: /^Playlist videos \((.+)\)$/i,
      toPt: (m) => `Vídeos da playlist (${m[1]})`,
      toEn: (m) => `Playlist videos (${m[1]})`,
    },
    {
      pt: /^Mostrando (.+)-(.+) de (.+) campanhas\.$/i,
      en: /^Showing (.+)-(.+) of (.+) campaigns\.$/i,
      toPt: (m) => `Mostrando ${m[1]}-${m[2]} de ${m[3]} campanhas.`,
      toEn: (m) => `Showing ${m[1]}-${m[2]} of ${m[3]} campaigns.`,
    },
    {
      pt: /^Etapa (.+) de (.+)$/i,
      en: /^Step (.+) of (.+)$/i,
      toPt: (m) => `Etapa ${m[1]} de ${m[2]}`,
      toEn: (m) => `Step ${m[1]} of ${m[2]}`,
    },
    {
      pt: /^Etapa (.+)$/i,
      en: /^Step (.+)$/i,
      toPt: (m) => `Etapa ${m[1]}`,
      toEn: (m) => `Step ${m[1]}`,
    },
    {
      pt: /^(.+) palavras\. Base suficiente para briefing\.$/i,
      en: /^(.+) words\. Base is enough for a brief\.$/i,
      toPt: (m) => `${m[1]} palavras. Base suficiente para briefing.`,
      toEn: (m) => `${m[1]} words. Base is enough for a brief.`,
    },
    {
      pt: /^(.+)\/12 palavras\. Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor\.$/i,
      en: /^(.+)\/12 words\. Fill the random title base with at least 12 words to generate a better brief\.$/i,
      toPt: (m) => `${m[1]}/12 palavras. Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.`,
      toEn: (m) => `${m[1]}/12 words. Fill the random title base with at least 12 words to generate a better brief.`,
    },
    {
      pt: /^Você tem (.+) tokens\. (.+)$/i,
      en: /^You have (.+) tokens\. (.+)$/i,
      toPt: (m) => `Você tem ${m[1]} tokens. ${translateCore('pt-BR', m[2])}`,
      toEn: (m) => `You have ${m[1]} tokens. ${translateCore('en', m[2])}`,
    },
    {
      pt: /^Bônus diário já coletado\. Volte amanhã para mais (.+) tokens\.$/i,
      en: /^Daily bonus already claimed\. Come back tomorrow for (.+) more tokens\.$/i,
      toPt: (m) => `Bônus diário já coletado. Volte amanhã para mais ${m[1]} tokens.`,
      toEn: (m) => `Daily bonus already claimed. Come back tomorrow for ${m[1]} more tokens.`,
    },
    {
      pt: /^Clique para receber \+(.+) tokens de bônus diário\. Disponível uma vez por dia!$/i,
      en: /^Click to claim \+(.+) daily bonus tokens\. Available once per day!$/i,
      toPt: (m) => `Clique para receber +${m[1]} tokens de bônus diário. Disponível uma vez por dia!`,
      toEn: (m) => `Click to claim +${m[1]} daily bonus tokens. Available once per day!`,
    },
    {
      pt: /^Clique no presente para ganhar \+(.+) tokens!$/i,
      en: /^Click the gift to earn \+(.+) tokens!$/i,
      toPt: (m) => `Clique no presente para ganhar +${m[1]} tokens!`,
      toEn: (m) => `Click the gift to earn +${m[1]} tokens!`,
    },
    {
      pt: /^(.+): (.+) campanhas?$/i,
      en: /^(.+): (.+) campaigns?$/i,
      toPt: (m) => `${m[1]}: ${m[2]} ${Number(m[2]) === 1 ? 'campanha' : 'campanhas'}`,
      toEn: (m) => `${m[1]}: ${m[2]} ${Number(m[2]) === 1 ? 'campaign' : 'campaigns'}`,
    },
  ];

  function normalizeLocale(rawLocale) {
    const value = String(rawLocale ?? '').trim().toLowerCase();
    if (value === 'pt' || value === 'pt-br' || value.startsWith('pt-')) return 'pt-BR';
    if (value === 'en' || value.startsWith('en-')) return 'en';
    return DEFAULT_LOCALE;
  }

  function readCookieLocale() {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!match) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function resolveInitialLocale(serverLocale) {
    let storedLocale = '';
    try {
      storedLocale = localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      storedLocale = '';
    }
    return normalizeLocale(storedLocale || readCookieLocale() || serverLocale || document.documentElement.lang);
  }

  function persistLocale(locale) {
    const normalized = normalizeLocale(locale);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Storage can be unavailable in private or sandboxed contexts.
    }
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    activeLocale = normalized;
    document.documentElement.lang = normalized;
    return normalized;
  }

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';
    return `${leading}${translated}${trailing}`;
  }

  function translatePattern(locale, text) {
    for (const pattern of patterns) {
      const source = locale === 'en' ? pattern.pt : pattern.en;
      const match = text.match(source);
      if (match) {
        return locale === 'en' ? pattern.toEn(match) : pattern.toPt(match);
      }
    }
    return null;
  }

  function translateCore(locale, core) {
    const targetLocale = normalizeLocale(locale);
    const repairedCore = repairMojibake(core);
    const direct = maps[targetLocale].get(repairedCore) ?? maps[targetLocale].get(core);
    if (direct) {
      return direct;
    }
    const normalizedCore = repairedCore.replace(/\s+/g, ' ');
    const normalizedDirect = maps[targetLocale].get(normalizedCore);
    if (normalizedDirect) {
      return normalizedDirect;
    }
    return translatePattern(targetLocale, normalizedCore) ?? core;
  }

  function translateValue(locale, value) {
    const original = String(value ?? '');
    const repairedOriginal = repairMojibake(original);
    const core = repairedOriginal.trim();
    if (!core) return original;
    if (/^(https?:\/\/|mailto:|\/api\/|\/workspace\/|#[0-9a-f]{3,8}\b)/i.test(core)) return repairedOriginal;
    if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(core)) return repairedOriginal;
    const translated = translateCore(locale, core);
    return translated === core ? repairedOriginal : preserveWhitespace(repairedOriginal, translated);
  }

  function t(locale, key, values = {}) {
    const translated = translateValue(locale, key);
    return translated.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    return !parent || SKIP_TEXT_PARENTS.has(parent.tagName) || parent.closest('[data-no-i18n], [contenteditable="true"]');
  }

  function translateTextNodes(root, locale) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const updates = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (shouldSkipTextNode(node)) {
        const repaired = repairMojibake(node.nodeValue);
        if (repaired !== node.nodeValue) {
          updates.push([node, repaired]);
        }
        continue;
      }
      const next = translateValue(locale, node.nodeValue);
      if (next !== node.nodeValue) {
        updates.push([node, next]);
      }
    }
    for (const [node, next] of updates) {
      node.nodeValue = next;
    }
  }

  function translateAttributes(root, locale) {
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const element of elements) {
      if (element.closest('[data-no-i18n]')) {
        for (const attr of ATTRIBUTES) {
          if (!element.hasAttribute(attr)) continue;
          const value = element.getAttribute(attr);
          const repaired = repairMojibake(value);
          if (repaired !== value) {
            element.setAttribute(attr, repaired);
          }
        }
        continue;
      }
      for (const attr of ATTRIBUTES) {
        if (!element.hasAttribute(attr)) continue;
        const value = element.getAttribute(attr);
        const next = translateValue(locale, value);
        if (next !== value) {
          element.setAttribute(attr, next);
        }
      }
    }
  }

  let activeLocale = resolveInitialLocale(document.body?.dataset?.initialLocale);
  let observer = null;
  let observedRoot = null;
  let applying = false;
  let scheduled = false;

  function translateRoot(root, locale) {
    const target = root || document.body;
    if (!target) return;
    applying = true;
    try {
      translateTextNodes(target, locale);
      translateAttributes(target, locale);
      document.documentElement.lang = normalizeLocale(locale);
      document.body.dataset.initialLocale = normalizeLocale(locale);
    } finally {
      applying = false;
    }
  }

  function scheduleTranslate(root) {
    if (applying || scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      translateRoot(root || observedRoot || document.body, activeLocale);
    });
  }

  function ensureObserver(root) {
    const nextRoot = root || document.body;
    if (!nextRoot || observedRoot === nextRoot) return;
    if (observer) {
      observer.disconnect();
    }
    observedRoot = nextRoot;
    observer = new MutationObserver(() => scheduleTranslate(observedRoot));
    observer.observe(observedRoot, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
  }

  function applyLocale(locale, root) {
    activeLocale = normalizeLocale(locale);
    translateRoot(root || document.body, activeLocale);
    ensureObserver(root || document.getElementById('app') || document.body);
  }

  window.PMP_I18N = {
    normalizeLocale,
    resolveInitialLocale,
    persistLocale,
    applyLocale,
    t,
    getCurrentLocale: () => activeLocale,
    supportedLocales: Array.from(SUPPORTED_LOCALES),
  };
})();
