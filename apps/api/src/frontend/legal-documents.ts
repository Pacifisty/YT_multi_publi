export type LegalDocumentKey = 'privacy' | 'terms' | 'data-deletion';

export interface LegalDocumentSection {
  heading: string;
  html: string;
}

export interface LegalDocument {
  key: LegalDocumentKey;
  title: string;
  ptTitle: string;
  subtitle: string;
  lastUpdated: string;
  reviewNote: string;
  sections: LegalDocumentSection[];
}

export const LEGAL_CONTACT_EMAIL = 'PlataformMultiPublisher@gmail.com';
export const LEGAL_LAST_UPDATED = '4 de setembro de 2026';
export const LEGAL_REVIEW_NOTE =
  'Versão revisada em linguagem clara. Recomenda-se validação por profissional jurídico habilitado antes da publicação definitiva ou do uso em processos de aprovação de plataformas.';
export const LEGAL_TRANSPARENCY_NOTICE =
  'O Platform Multi Publisher é um serviço independente e não pertence, não é endossado, patrocinado nem operado oficialmente por TikTok, YouTube, Google, Instagram, Meta ou suas afiliadas.';

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    key: 'privacy',
    title: 'Política de Privacidade',
    ptTitle: 'Política de Privacidade',
    subtitle:
      'Entenda quais dados o Platform Multi Publisher trata, por que eles são necessários e como exercer seus direitos.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: '1. Objetivo desta Política',
        html: `<p>Esta Política de Privacidade explica como o Platform Multi Publisher ("Platform Multi Publisher", "PMP", "nós" ou "nosso") coleta, utiliza, armazena, compartilha e protege dados pessoais durante o uso do site, do workspace e das integrações com YouTube, TikTok e Instagram.</p><p>${LEGAL_TRANSPARENCY_NOTICE}</p>`,
      },
      {
        heading: '2. Quem é o responsável pelo tratamento',
        html: `<ul><li>Serviço: Platform Multi Publisher.</li><li>Responsável: Lucas Domingues.</li><li>Site: <a href="https://www.plataformmultipublisher.com">www.plataformmultipublisher.com</a>.</li><li>Canal de privacidade: <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>.</li><li>Endereço informado: Alameda dos Mutuns.</li><li>Público principal: usuários localizados no Brasil.</li></ul><p>Para solicitações relacionadas a dados pessoais, utilize o canal de privacidade acima.</p>`,
      },
      {
        heading: '3. Abrangência',
        html: '<p>Esta Política se aplica ao cadastro, autenticação, biblioteca de mídia, campanhas, agendamentos, filas de publicação, pagamentos, suporte e conexões de contas realizadas por APIs oficiais. Cada plataforma conectada possui termos e políticas próprios, que também se aplicam ao uso de seus serviços.</p>',
      },
      {
        heading: '4. Dados que podemos tratar',
        html: '<ul><li><strong>Cadastro e acesso:</strong> nome, e-mail, identificadores de login, hash de senha quando aplicável, plano, status da conta, sessões e preferências.</li><li><strong>Contas conectadas:</strong> provedor, identificador da conta, nome de exibição, e-mail quando fornecido, escopos autorizados, validade do token, status da conexão e tokens de acesso ou atualização armazenados de forma criptografada.</li><li><strong>Campanhas e publicações:</strong> título, vídeo, destino, canal, legenda, descrição, tags, thumbnail, privacidade, playlist, agendamento, controles de interação, status, tentativas, identificadores externos e mensagens de erro.</li><li><strong>Mídia:</strong> vídeos e imagens enviados, nome original, tipo do arquivo, tamanho, duração, localização no armazenamento e vínculos com campanhas.</li><li><strong>Uso e segurança:</strong> cookies necessários, endereço IP, navegador, dispositivo, registros de acesso, auditoria, falhas e eventos de segurança.</li><li><strong>Plano e pagamento:</strong> plano escolhido, saldo de tokens, datas de cobrança, referências de transação e status do pagamento. Dados completos de cartão são tratados pelo provedor de pagamento, quando aplicável, e não pelo PMP.</li><li><strong>Atendimento:</strong> conteúdo das mensagens, e-mail de contato e dados necessários para solucionar a solicitação.</li></ul>',
      },
      {
        heading: '5. Dados recebidos das APIs do TikTok',
        html: '<p>Quando você conecta o TikTok, podemos solicitar apenas os escopos necessários à funcionalidade disponibilizada: <code>user.info.basic</code>, <code>video.upload</code> e <code>video.publish</code>. No ambiente de testes, o aplicativo pode solicitar somente <code>user.info.basic</code>.</p><ul><li><code>user.info.basic</code>: identifica a conta conectada e pode fornecer open ID, nome de exibição e URL do avatar.</li><li><code>video.upload</code>: prepara ou envia ao TikTok o vídeo selecionado pelo usuário.</li><li><code>video.publish</code>: publica o vídeo na conta conectada após comando do usuário.</li></ul><p>Também podemos guardar escopos concedidos, tokens criptografados, datas de expiração, privacidade e controles de interação escolhidos, status da publicação, identificador externo e erros técnicos necessários para concluir a operação ou solicitar reconexão.</p>',
      },
      {
        heading: '6. Dados recebidos das APIs do Google/YouTube e Meta/Instagram',
        html: '<p><strong>Google/YouTube:</strong> utilizamos os escopos <code>openid</code>, <code>email</code>, <code>profile</code>, <code>https://www.googleapis.com/auth/youtube.readonly</code>, <code>https://www.googleapis.com/auth/youtube.upload</code> e <code>https://www.googleapis.com/auth/youtube.force-ssl</code> para autenticar o usuário, listar canais disponíveis, enviar vídeos escolhidos e aplicar metadados ou ações de publicação autorizadas.</p><p>O uso e a transferência de informações recebidas das APIs do Google seguem a <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a>, inclusive os requisitos de Uso Limitado (<em>Limited Use</em>).</p><p><strong>Meta/Instagram:</strong> utilizamos os escopos <code>instagram_business_basic</code> e <code>instagram_business_content_publish</code> para identificar a conta profissional conectada e publicar Reels selecionados pelo usuário, com as legendas e configurações autorizadas.</p>',
      },
      {
        heading: '7. Finalidades do tratamento',
        html: '<ul><li>Criar, autenticar e proteger contas e sessões.</li><li>Conectar contas autorizadas por OAuth e exibir seus destinos disponíveis.</li><li>Armazenar mídias, campanhas, metadados, preferências e agendamentos criados pelo usuário.</li><li>Publicar conteúdo apenas nos destinos escolhidos e após ação do usuário.</li><li>Acompanhar filas, status, tentativas, falhas e necessidades de nova autorização.</li><li>Administrar planos, pagamentos e saldo de tokens.</li><li>Prestar suporte, prevenir fraude e abuso, manter a segurança e cumprir obrigações legais.</li><li>Produzir registros operacionais e de auditoria necessários à prestação do serviço.</li></ul>',
      },
      {
        heading: '8. Bases legais',
        html: '<p>Conforme a finalidade e a relação com o titular, o tratamento pode se apoiar em: execução de contrato ou procedimentos preliminares; consentimento e autorização OAuth; cumprimento de obrigação legal ou regulatória; exercício regular de direitos; legítimo interesse para operar, aperfeiçoar e proteger o serviço, após avaliação dos direitos e expectativas do titular; e prevenção à fraude e segurança em processos de identificação e autenticação. Quando o consentimento for a base aplicável, ele poderá ser revogado por procedimento gratuito e facilitado.</p>',
      },
      {
        heading: '9. Como usamos os dados do TikTok',
        html: '<p>Usamos dados do TikTok somente para conectar e identificar a conta autorizada, preparar os destinos da campanha, aplicar as escolhas de privacidade e interação, enviar ou publicar vídeos selecionados, consultar o status, exibir erros e renovar ou invalidar tokens quando necessário.</p>',
      },
      {
        heading: '10. O que não fazemos com dados das plataformas',
        html: '<ul><li>Não vendemos nem alugamos dados recebidos das plataformas.</li><li>Não usamos esses dados para criar perfis publicitários nem segmentar anúncios.</li><li>Não compartilhamos dados com terceiros, exceto operadores necessários ao serviço, plataformas escolhidas pelo usuário ou quando houver obrigação legal.</li><li>Não publicamos sem uma conta autorizada e sem uma ação ou campanha configurada pelo usuário.</li><li>Não alegamos vínculo oficial, patrocínio ou endosso das plataformas integradas.</li></ul>',
      },
      {
        heading: '11. Compartilhamento e operadores',
        html: '<p>Podemos compartilhar apenas os dados necessários com fornecedores de hospedagem, banco de dados, armazenamento, pagamento, envio de e-mails, suporte, monitoramento, segurança e assessoria profissional. Conforme as funcionalidades utilizadas, esses fornecedores podem incluir Cloudflare e Mercado Pago, além de Google/YouTube, TikTok e Meta/Instagram como plataformas de destino.</p><p>Conteúdo e metadados são enviados à plataforma selecionada para executar a publicação autorizada. Também poderemos divulgar informações para cumprir a lei, ordem válida de autoridade competente, proteger direitos e segurança ou exercer direitos em processos.</p><p>Os operadores recebem somente os dados necessários à finalidade contratada e ficam sujeitos às obrigações aplicáveis de confidencialidade, segurança e proteção de dados.</p>',
      },
      {
        heading: '12. Cookies e tecnologias semelhantes',
        html: '<p>Utilizamos cookies e armazenamento local necessários para autenticação, segurança, preferência de idioma, tema e funcionamento do workspace. Não utilizamos provedor de analytics no momento. Se isso mudar, esta Política e, quando necessário, os mecanismos de consentimento serão atualizados.</p>',
      },
      {
        heading: '13. Retenção e eliminação',
        html: '<p>Os dados são mantidos somente pelo período necessário para prestar o serviço e atender às finalidades descritas, incluindo segurança, prevenção a fraude, suporte, obrigações legais, registros financeiros e exercício regular de direitos.</p><p>No fluxo de exclusão de conta, a conta permanece ativa por 24 horas após a confirmação do pedido, é então desativada e os dados aplicáveis são eliminados ou anonimizados em até 30 dias. Poderemos conservar registros mínimos quando houver fundamento legal, obrigação regulatória, disputa, prevenção a fraude, necessidade de segurança, dependência operacional ainda não resolvida ou ciclo técnico de backup. Dados mantidos por obrigação ficam bloqueados para usos incompatíveis.</p><p>A simples desconexão de uma plataforma interrompe o uso do token em novas publicações, mas não equivale à exclusão de toda a conta PMP. Para excluir dados mantidos pelo PMP, siga o procedimento descrito em <a href="/data-deletion" data-link>/data-deletion</a>.</p>',
      },
      {
        heading: '14. Segurança da informação',
        html: '<p>Adotamos medidas técnicas e administrativas proporcionais aos riscos, como conexão HTTPS quando configurada, criptografia de tokens OAuth em repouso, controles de acesso, proteção de sessões, limitação de requisições, registros de auditoria e monitoramento operacional. Nenhum serviço conectado à internet é totalmente livre de riscos; por isso, os controles são revistos conforme a evolução do produto e das ameaças.</p><p>Os dados são armazenados na infraestrutura de banco de dados e mídia configurada para o aplicativo. O provedor de hospedagem e armazenamento informado é a Cloudflare.</p>',
      },
      {
        heading: '15. Direitos do titular',
        html: `<p>Nos termos da LGPD, você pode solicitar, conforme aplicável: confirmação do tratamento; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade; portabilidade, observada a regulamentação; informação sobre compartilhamentos; informação sobre a possibilidade de negar consentimento e suas consequências; revogação do consentimento; oposição a tratamento irregular; e revisão de decisões unicamente automatizadas que afetem seus interesses.</p><p>Solicitações são gratuitas e podem exigir verificação de identidade. Envie o pedido para <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a> usando o e-mail associado à conta e descrevendo o direito que deseja exercer. Se uma providência imediata não for possível, informaremos a justificativa e o andamento aplicável. O titular também pode peticionar perante a ANPD e os órgãos de defesa do consumidor.</p>`,
      },
      {
        heading: '16. Como desconectar contas e revogar o acesso',
        html: '<p>Você pode desconectar uma conta na área <strong>Contas</strong> do workspace. Também pode revogar a autorização diretamente nas configurações de aplicativos conectados do TikTok, da Conta Google/YouTube ou da Meta/Instagram. A revogação impede novas ações com o token, mas publicações já concluídas permanecem sujeitas às regras da plataforma de destino.</p>',
      },
      {
        heading: '17. Crianças e adolescentes',
        html: '<p>O PMP não é destinado a crianças. Para criar uma conta, o usuário deve ter pelo menos 18 anos, ser maior de idade em sua jurisdição ou atender à idade mínima exigida pelas plataformas conectadas — prevalecendo o requisito mais alto. Não coletamos intencionalmente dados de crianças por meio do serviço.</p>',
      },
      {
        heading: '18. Transferências internacionais',
        html: '<p>Alguns fornecedores e plataformas podem processar dados fora do Brasil. Quando houver transferência internacional, adotaremos mecanismos compatíveis com a LGPD e a regulamentação aplicável, considerando a finalidade, a necessidade da transferência, medidas de segurança, cláusulas contratuais e garantias oferecidas pelo destinatário.</p>',
      },
      {
        heading: '19. Alterações desta Política',
        html: '<p>Esta Política poderá ser atualizada para refletir mudanças no produto, nas integrações, nas práticas de dados ou na legislação. A data de atualização será modificada e, quando a alteração afetar materialmente os direitos do titular ou depender de novo consentimento, será apresentado aviso adequado antes de sua aplicação.</p>',
      },
      {
        heading: '20. Contato',
        html: `<p>Para dúvidas, solicitações ou reclamações sobre privacidade, entre em contato com Lucas Domingues pelo e-mail <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>. Endereço informado: Alameda dos Mutuns.</p>`,
      },
    ],
  },
  terms: {
    key: 'terms',
    title: 'Termos de Uso',
    ptTitle: 'Termos de Uso',
    subtitle:
      'Regras para criar uma conta, conectar canais, organizar campanhas e publicar conteúdo pelo Platform Multi Publisher.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: '1. Aceitação dos Termos',
        html: '<p>Estes Termos de Uso ("Termos") regulam o acesso e o uso do Platform Multi Publisher ("PMP" ou "Serviço"). Ao criar uma conta, conectar uma plataforma, enviar mídia, contratar um plano ou iniciar uma campanha, você declara que leu e concorda com estes Termos e com a Política de Privacidade.</p><p>Se você utilizar o Serviço em nome de empresa, cliente ou organização, declara possuir poderes para representá-los dentro dos limites de sua autorização.</p>',
      },
      {
        heading: '2. Sobre o Serviço',
        html: `<p>O PMP é uma aplicação web para organizar mídias, conectar contas autorizadas do YouTube, TikTok e Instagram, configurar campanhas, legendas e metadados, agendar ou iniciar publicações e acompanhar o status operacional em um único workspace.</p><p>${LEGAL_TRANSPARENCY_NOTICE}</p>`,
      },
      {
        heading: '3. Elegibilidade',
        html: '<p>Você deve ter pelo menos 18 anos, ser maior de idade em sua jurisdição ou cumprir a idade mínima de cada plataforma conectada — prevalecendo o requisito mais alto — e possuir capacidade legal para aceitar estes Termos.</p>',
      },
      {
        heading: '4. Cadastro e segurança da conta',
        html: '<p>Você deve fornecer informações corretas, mantê-las atualizadas e proteger credenciais, sessões e acessos do workspace. Avise-nos imediatamente ao suspeitar de uso não autorizado. Você responde pelas ações realizadas por pessoas que autorizou a utilizar sua conta, sem prejuízo das responsabilidades que a legislação atribuir ao PMP.</p>',
      },
      {
        heading: '5. Conexões por OAuth e permissões',
        html: '<p>Você escolhe quais contas do YouTube, TikTok ou Instagram deseja conectar. Ao concluir a autorização OAuth, permite que o PMP acesse os dados e execute apenas as ações correspondentes aos escopos aprovados e às funcionalidades solicitadas.</p><p>É proibido conectar conta que você não possua ou não esteja autorizado a administrar. A conexão pode ser encerrada no workspace ou revogada diretamente na plataforma correspondente.</p>',
      },
      {
        heading: '6. Integração com o TikTok',
        html: '<p>A integração pode identificar a conta conectada, configurar opções da campanha, preparar ou enviar vídeos selecionados, publicar após comando do usuário e consultar o status. Para essas funções, o aplicativo pode solicitar <code>user.info.basic</code>, <code>video.upload</code> e <code>video.publish</code>.</p><p>O TikTok pode aprovar, negar, limitar, suspender ou alterar o acesso a seus produtos e escopos. O uso da integração também está sujeito aos termos, políticas e diretrizes do TikTok.</p>',
      },
      {
        heading: '7. Responsabilidades do usuário',
        html: '<ul><li>Revisar vídeos, capas, legendas, títulos, descrições, tags, privacidade, playlists, agendas e destinos antes de publicar.</li><li>Possuir todos os direitos, licenças, autorizações e consentimentos necessários para usar e publicar o conteúdo.</li><li>Cumprir a legislação aplicável e os termos, políticas, diretrizes da comunidade, regras autorais, publicitárias e de API de cada plataforma.</li><li>Manter cópia de segurança dos conteúdos importantes e conferir o resultado em cada destino.</li><li>Usar o Serviço de boa-fé e cooperar na apuração de incidentes de segurança ou uso indevido.</li></ul>',
      },
      {
        heading: '8. Usos proibidos',
        html: '<ul><li>Praticar spam, fraude, assédio, personificação, atividade ilegal, vigilância indevida ou coleta não autorizada de dados.</li><li>Enviar conteúdo que viole propriedade intelectual, privacidade, imagem, contrato ou outros direitos.</li><li>Vender, revender, compartilhar sem autorização ou usar dados de plataformas para publicidade não informada.</li><li>Contornar limites, controles de segurança, revisão, consentimento OAuth ou restrições das APIs.</li><li>Usar APIs não documentadas, automatizar ações proibidas ou conectar contas sem autorização.</li><li>Tentar acessar, copiar, descompilar, interromper, sobrecarregar ou comprometer o Serviço ou terceiros, exceto quando a lei autorizar expressamente.</li></ul>',
      },
      {
        heading: '9. Conteúdo e licença operacional',
        html: '<p>Você mantém a titularidade de seu conteúdo. Para prestar o Serviço, concede ao PMP licença limitada, não exclusiva, revogável e válida enquanto necessária para hospedar, armazenar, processar, adaptar tecnicamente, exibir no workspace e transmitir conteúdo e metadados aos destinos escolhidos.</p><p>Essa licença não autoriza a venda do conteúdo nem seu uso publicitário pelo PMP. As plataformas de destino tratarão e publicarão o material segundo os termos próprios e as configurações selecionadas.</p>',
      },
      {
        heading: '10. Serviços e decisões de terceiros',
        html: '<p>TikTok, YouTube, Instagram, Google, Meta, provedores de pagamento, hospedagem e outros terceiros são independentes do PMP. Seus serviços podem ficar indisponíveis, sofrer atrasos, mudar, limitar requisições ou rejeitar operações por motivos fora de nosso controle.</p><p>As plataformas podem analisar, rejeitar, remover, restringir, desmonetizar ou moderar conteúdo conforme regras próprias. O PMP não garante aprovação, publicação, permanência, audiência, receita ou qualquer resultado específico.</p>',
      },
      {
        heading: '11. Planos, tokens e pagamentos',
        html: '<p>Recursos podem ser gratuitos ou depender de plano pago, assinatura, tokens ou compra avulsa. Preço, tributos, ciclo de cobrança, limites, consumo de tokens e condições aplicáveis serão apresentados antes da contratação.</p><p>Pagamentos podem ser processados por fornecedor independente. Cancelamentos, arrependimento e reembolsos observarão a oferta apresentada e os direitos obrigatórios previstos na legislação de consumo. Tokens não representam moeda, ativo financeiro ou investimento e somente podem ser usados no Serviço conforme as regras do plano.</p>',
      },
      {
        heading: '12. Disponibilidade e alterações do Serviço',
        html: '<p>Buscamos manter o Serviço disponível e seguro, mas não garantimos operação ininterrupta. Manutenções, incidentes, falhas de internet, indisponibilidade de APIs, limites das plataformas, problemas de pagamento ou eventos de segurança podem afetar recursos.</p><p>Podemos modificar ou descontinuar funcionalidades por razões técnicas, legais, comerciais ou de segurança. Quando a mudança afetar materialmente um recurso pago vigente, forneceremos aviso compatível com a legislação aplicável.</p>',
      },
      {
        heading: '13. Privacidade e proteção de dados',
        html: '<p>A <a href="/privacy" data-link>Política de Privacidade</a> explica como os dados são tratados e integra estes Termos. O procedimento de revogação e exclusão está disponível em <a href="/data-deletion" data-link>Exclusão de Dados</a>.</p>',
      },
      {
        heading: '14. Suspensão e encerramento',
        html: '<p>Você pode deixar de usar o Serviço ou solicitar a exclusão da conta. Podemos restringir, suspender ou encerrar o acesso quando houver violação destes Termos, risco técnico ou jurídico relevante, fraude, inadimplência, uso indevido das APIs ou necessidade de proteção de usuários e terceiros. Sempre que razoável e permitido, informaremos o motivo e ofereceremos oportunidade de correção ou contestação.</p><p>As plataformas conectadas também podem limitar suas integrações independentemente do PMP.</p>',
      },
      {
        heading: '15. Garantias e limites técnicos',
        html: '<p>O Serviço é fornecido conforme disponível e está em evolução. Na extensão permitida pela lei, não oferecemos garantias de compatibilidade permanente com APIs de terceiros, ausência total de erros ou obtenção de resultados comerciais. Nada nestes Termos exclui garantias, deveres ou direitos que não possam ser afastados pela legislação aplicável, inclusive normas de proteção do consumidor e de dados pessoais.</p>',
      },
      {
        heading: '16. Responsabilidade',
        html: '<p>Cada parte responde pelos danos que causar de acordo com a legislação aplicável. Na extensão permitida pela lei, o PMP não responde por atos exclusivos do usuário ou de terceiros, conteúdo enviado pelo usuário, decisões das plataformas, perda decorrente de credenciais expostas pelo usuário ou indisponibilidade externa fora de seu controle razoável.</p><p>Qualquer limitação será interpretada de forma restritiva e não se aplica em caso de dolo, culpa grave, violação de dever legal inderrogável, dano à pessoa, incidente imputável ao PMP ou outra hipótese em que a lei proíba a limitação.</p>',
      },
      {
        heading: '17. Reclamações de terceiros',
        html: '<p>Se seu conteúdo, campanha, conta conectada ou uso irregular gerar reclamação de terceiro, você deverá cooperar com informações e medidas razoáveis para solucionar o caso. Para usuários empresariais, e quando permitido por lei, a parte responsável pela violação deverá ressarcir os prejuízos comprovados que causar à outra parte. Esta cláusula não reduz direitos obrigatórios de consumidores.</p>',
      },
      {
        heading: '18. Alterações destes Termos',
        html: '<p>Podemos atualizar estes Termos para acompanhar mudanças legais, técnicas ou comerciais. A nova data será indicada nesta página. Alterações materiais serão comunicadas de modo adequado e não produzirão efeitos retroativos indevidos. Quando a lei exigir nova concordância, ela será solicitada antes da continuidade do uso afetado.</p>',
      },
      {
        heading: '19. Lei aplicável e solução de conflitos',
        html: '<p>Aplicam-se as leis da República Federativa do Brasil. As partes buscarão uma solução direta e de boa-fé pelo canal de contato. O foro competente será definido conforme a legislação aplicável; nada nestes Termos impede o consumidor de recorrer aos órgãos de defesa do consumidor ou ao foro legalmente assegurado.</p>',
      },
      {
        heading: '20. Contato',
        html: `<p>Entre em contato com Lucas Domingues pelo e-mail <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>. Endereço informado: Alameda dos Mutuns.</p>`,
      },
    ],
  },
  'data-deletion': {
    key: 'data-deletion',
    title: 'Exclusão de Dados e Revogação de Acesso',
    ptTitle: 'Exclusão de Dados e Revogação de Acesso',
    subtitle:
      'Saiba como desconectar uma plataforma, revogar permissões ou solicitar a eliminação de dados mantidos pelo PMP.',
    lastUpdated: LEGAL_LAST_UPDATED,
    reviewNote: LEGAL_REVIEW_NOTE,
    sections: [
      {
        heading: '1. Escolha entre desconectar e excluir',
        html: '<p><strong>Desconectar ou revogar acesso</strong> impede novas ações com a conta da plataforma. <strong>Excluir dados</strong> solicita a eliminação ou anonimização dos registros aplicáveis mantidos pelo PMP. Revogar o acesso na plataforma não exclui automaticamente toda a conta PMP, e excluir a conta PMP não remove publicações já concluídas nas plataformas de destino.</p>',
      },
      {
        heading: '2. Como solicitar a exclusão',
        html: `<p>Envie um e-mail para <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a> a partir do endereço associado à sua conta. Use o assunto <strong>Solicitação de exclusão de dados</strong> e informe: e-mail do workspace; conta conectada envolvida, quando aplicável; se deseja excluir toda a conta ou dados específicos; e detalhes que ajudem a localizar os registros.</p><p>A solicitação é gratuita.</p>`,
      },
      {
        heading: '3. Dados incluídos no pedido',
        html: '<p>Conforme o escopo solicitado e as exceções legais, o pedido pode abranger cadastro, preferências, contas conectadas, tokens OAuth criptografados, mídias, campanhas, tarefas de publicação, metadados, histórico operacional, dados de suporte e informações de integração mantidas pelo PMP.</p>',
      },
      {
        heading: '4. Como revogar o acesso das plataformas',
        html: '<p>Desconecte a conta na área <strong>Contas</strong> do workspace. Você também pode revogar o PMP nas configurações de aplicativos autorizados ou conectados do TikTok, da Conta Google/YouTube ou da Meta/Instagram. Após a revogação, deixamos de usar o token em novas operações; pode ser necessário solicitar separadamente a exclusão dos registros mantidos pelo PMP.</p>',
      },
      {
        heading: '5. Verificação de identidade',
        html: '<p>Para impedir exclusões não autorizadas, poderemos confirmar o controle do e-mail cadastrado ou solicitar informações estritamente necessárias à verificação. Não solicitaremos senha da plataforma conectada. Se não pudermos validar o pedido, explicaremos o motivo e indicaremos, quando possível, como complementá-lo.</p>',
      },
      {
        heading: '6. Prazo e etapas do processamento',
        html: '<p>Após a confirmação do pedido de exclusão de conta, a conta permanece ativa por 24 horas e é então desativada. Os dados aplicáveis são eliminados ou anonimizados em até 30 dias, salvo prazo diferente exigido ou permitido por lei. Pedidos de confirmação e acesso serão atendidos conforme os prazos da LGPD e da regulamentação aplicável.</p><p>Ao concluir o processo, enviaremos uma confirmação ao endereço utilizado na solicitação.</p>',
      },
      {
        heading: '7. Dados que podem ser conservados',
        html: '<p>Registros mínimos poderão ser mantidos quando necessários ao cumprimento de obrigação legal ou regulatória, exercício regular de direitos, segurança, prevenção a fraude, registros financeiros, resolução de disputas, investigação de abuso, dependência operacional ainda não resolvida ou ciclo técnico de backup. Enquanto retidos, esses dados ficam limitados à finalidade que justificou sua conservação e são excluídos ou anonimizados quando essa necessidade termina.</p>',
      },
      {
        heading: '8. Publicações nas plataformas',
        html: '<p>Excluir dados do PMP não remove automaticamente vídeos já publicados no YouTube, TikTok ou Instagram. Para removê-los, utilize os controles da plataforma de destino ou solicite atendimento diretamente a ela. Dados mantidos exclusivamente pela plataforma seguem os termos e a política de privacidade dessa plataforma.</p>',
      },
      {
        heading: '9. Contato e direitos',
        html: `<p>Para acompanhar o pedido ou exercer outro direito previsto na LGPD, fale com Lucas Domingues pelo e-mail <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>. Você também pode peticionar perante a ANPD ou procurar os órgãos de defesa do consumidor, observados os procedimentos aplicáveis.</p>`,
      },
    ],
  },
};
