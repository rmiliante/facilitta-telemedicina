// Minuta de contrato de prestação de serviços médicos por consulta (baseada na Minuta_Neurologia_1).
// Marcadores: {{ESP}} especialidade (minúscula), {{ESP_CAP}} especialidade, {{MEDICO}}, {{VALOR}}.
export const CONTRATO_MINUTA: { intro3: string; clauses: { h: string; p: string[] }[] } = {
 "intro3": "têm entre si justo e contratado o presente Contrato de Prestação de Serviços Médicos, de natureza civil e empresarial, regido pelo Código Civil, pela Lei nº 13.709/2018, pela Lei nº 13.787/2018, pela Lei nº 14.510/2022, pelas normas do Conselho Federal de Medicina e pelas cláusulas seguintes.",
 "clauses": [
  {
   "h": "CLÁUSULA PRIMEIRA — DO OBJETO E DA AUSÊNCIA DE EXCLUSIVIDADE",
   "p": [
    "1.1. O presente Contrato tem por objeto a prestação, pela CONTRATADA, de consultas médicas especializadas em {{ESP}}, na modalidade de telemedicina, por profissional regularmente habilitado e previamente aprovado pela CONTRATANTE. O profissional responsável técnico pelos atendimentos é {{MEDICO}}.",
    "1.2. Os atendimentos compreenderão anamnese, avaliação clínica, orientação, prescrição, emissão de atestados e relatórios e solicitação de exames, quando clinicamente indicados e permitidos pela legislação e pelas normas profissionais aplicáveis.",
    "1.3. A contratação não possui caráter exclusivo, não estabelece quantidade mínima de consultas, faturamento mínimo, reserva remunerada de agenda ou obrigação de encaminhamento de pacientes pela CONTRATANTE.",
    "1.4. A CONTRATANTE poderá contratar outros profissionais ou empresas para serviços idênticos, semelhantes ou complementares, sem que disso decorra direito de preferência, indenização ou compensação à CONTRATADA."
   ]
  },
  {
   "h": "CLÁUSULA SEGUNDA — DA HABILITAÇÃO E DA REGULARIDADE PROFISSIONAL",
   "p": [
    "2.1. Antes do primeiro atendimento e sempre que solicitado, a CONTRATADA entregará à CONTRATANTE os documentos societários, fiscais e profissionais necessários à comprovação de sua regularidade, incluindo inscrição ativa no Conselho Regional de Medicina competente, Registro de Qualificação de Especialista em {{ESP_CAP}}, certidões ético-profissionais e demais licenças ou autorizações aplicáveis.",
    "2.2. A CONTRATADA manterá válidos todos os registros, documentos e requisitos necessários durante toda a vigência do Contrato e comunicará à CONTRATANTE, no prazo máximo de 24 (vinte e quatro) horas, qualquer suspensão, restrição, investigação ética relevante, impedimento ou alteração capaz de afetar a prestação dos serviços.",
    "2.3. A ausência, irregularidade ou perda de qualquer requisito autoriza a CONTRATANTE a impedir o início dos serviços, suspender imediatamente os atendimentos ou rescindir o Contrato, sem multa ou indenização, preservado o direito de apurar perdas e danos.",
    "2.4. A CONTRATANTE poderá, a qualquer tempo e mediante solicitação escrita, exigir que a CONTRATADA contrate e mantenha seguro de responsabilidade civil profissional com cobertura compatível com os riscos de sua atividade, hipótese em que será concedido prazo razoável para apresentação da respectiva apólice e dos comprovantes de vigência. A inexistência ou eventual dispensa do seguro não excluirá nem limitará a responsabilidade da CONTRATADA pelos atos praticados na execução deste Contrato."
   ]
  },
  {
   "h": "CLÁUSULA TERCEIRA — DA EXECUÇÃO DOS SERVIÇOS",
   "p": [
    "3.1. Os serviços serão prestados com autonomia técnica e científica, observância do Código de Ética Médica, das normas sanitárias, da regulamentação da telemedicina e dos protocolos assistenciais legítimos aplicáveis à operação.",
    "3.2. A CONTRATADA cumprirá as agendas confirmadas, observará os horários acordados, confirmará a identidade do paciente, obterá os consentimentos cuja coleta lhe competir e registrará cada atendimento de forma completa, legível, cronológica e tempestiva.",
    "3.3. A CONTRATADA somente realizará atos compatíveis com a telemedicina e encaminhará o paciente ao atendimento presencial ou de urgência sempre que a avaliação remota não oferecer condições técnicas suficientes ou houver risco à segurança assistencial.",
    "3.4. A CONTRATADA utilizará equipamentos, conexão, ambiente reservado e recursos próprios adequados, responsabilizando-se pela privacidade do local, pela segurança de suas credenciais, pela atualização dos dispositivos sob sua gestão e pela continuidade de sua conexão.",
    "3.5. A CONTRATANTE poderá estabelecer fluxos administrativos, padrões de cadastro, horários de funcionamento, requisitos de registro e controles de qualidade, desde que não interfira na decisão clínica."
   ]
  },
  {
   "h": "CLÁUSULA QUARTA — DAS OBRIGAÇÕES DA CONTRATADA",
   "p": [
    "4.1. Além das demais obrigações previstas neste Contrato, compete à CONTRATADA: a) prestar os serviços com diligência, qualidade, pontualidade e segurança; b) atuar exclusivamente dentro de sua habilitação; c) manter atualizados os cadastros e documentos exigidos; d) preservar o sigilo médico e a confidencialidade; e) emitir documentos médicos com identificação e assinatura válidas; f) emitir nota fiscal regular; g) cumprir as normas de proteção de dados, segurança da informação, integridade e anticorrupção; e h) cooperar com auditorias, apurações, reclamações e defesas relacionadas aos serviços.",
    "4.2. A CONTRATADA comunicará imediatamente à CONTRATANTE eventos adversos, reclamações relevantes, incidentes de segurança, suspeitas de fraude, erros de registro, indisponibilidades e qualquer fato capaz de gerar risco ao paciente, à operação, à imagem ou à responsabilidade da CONTRATANTE.",
    "4.3. A CONTRATADA não poderá cobrar qualquer valor diretamente dos pacientes, oferecer serviços particulares durante ou em decorrência do atendimento, encaminhar pacientes para negócio próprio ou de terceiro por interesse econômico, nem receber vantagem vinculada a prescrições, exames ou encaminhamentos.",
    "4.4. A CONTRATADA responderá integralmente pela conduta de seus sócios, profissionais, empregados, prepostos, representantes e terceiros por ela utilizados, como se próprios fossem seus atos."
   ]
  },
  {
   "h": "CLÁUSULA QUINTA — DAS OBRIGAÇÕES DA CONTRATANTE",
   "p": [
    "5.1. Compete à CONTRATANTE: a) disponibilizar as informações administrativas necessárias à operação; b) coordenar ou viabilizar o agendamento e a comunicação com os pacientes; c) fornecer, quando aplicável, acesso individual ao sistema adotado; d) respeitar a autonomia técnica do médico; e e) pagar os valores devidos após a validação do faturamento.",
    "5.2. As obrigações da CONTRATANTE limitam-se aos recursos e processos que estejam sob sua gestão direta. A CONTRATANTE não responderá por equipamentos, conexão, ambiente, credenciais ou sistemas sob responsabilidade da CONTRATADA, nem por indisponibilidades de fornecedores externos que não decorram de culpa comprovada da CONTRATANTE.",
    "5.3. A indicação de fluxos, protocolos administrativos ou mecanismos de controle não transfere à CONTRATANTE a responsabilidade técnica pelo ato médico, pelo diagnóstico, pela prescrição, pelo encaminhamento ou pelo conteúdo dos registros produzidos pela CONTRATADA."
   ]
  },
  {
   "h": "CLÁUSULA SEXTA — DA REMUNERAÇÃO DO FATURAMENTO E DAS GLOSAS",
   "p": [
    "6.1. A CONTRATANTE pagará à CONTRATADA o valor de {{VALOR}} por consulta em {{ESP}} efetivamente realizada, concluída e devidamente registrada no sistema indicado para a operação.",
    "6.2. Não haverá pagamento por horário disponibilizado, consulta cancelada ou reagendada, ausência ou atraso do paciente, atendimento incompleto, registro ausente ou insuficiente, duplicidade, inconsistência, fraude, ato fora da habilitação, descumprimento de protocolo obrigatório ou serviço cuja realização não possa ser comprovada.",
    "6.3. Até o 5º (quinto) dia útil do mês subsequente, a CONTRATADA apresentará nota fiscal e relatório de produção. O pagamento ocorrerá em até 10 (dez) dias úteis após o recebimento e a validação integral dos documentos.",
    "6.4. A CONTRATANTE poderá glosar, mediante justificativa, valores que não atendam aos requisitos deste Contrato e solicitar documentos complementares. A parcela incontroversa será paga no prazo, e a parcela glosada permanecerá suspensa até a regularização ou conclusão da conferência.",
    "6.5. Se irregularidade for identificada após o pagamento, a CONTRATANTE poderá exigir restituição ou compensar o valor em créditos futuros da CONTRATADA, mediante comunicação fundamentada, sem prejuízo das demais medidas cabíveis.",
    "6.6. O atraso injustificado da CONTRATANTE sobre valor líquido, incontroverso e regularmente faturado acarretará multa de 2% (dois por cento), juros de 1% (um por cento) ao mês, pro rata die, e correção pelo IPCA.",
    "6.7. Os tributos e encargos serão suportados por quem a lei definir como contribuinte, cabendo à CONTRATANTE efetuar as retenções obrigatórias. O valor da consulta será reajustado a cada 12 (doze) meses pela variação acumulada do IPCA, salvo ajuste escrito diverso."
   ]
  },
  {
   "h": "CLÁUSULA SÉTIMA — DAS AUSÊNCIAS E DA CONTINUIDADE ASSISTENCIAL",
   "p": [
    "7.1. A CONTRATADA comunicará qualquer impedimento com a maior antecedência possível e adotará as medidas necessárias para evitar prejuízo ao paciente e à operação.",
    "7.2. A substituição do profissional dependerá de autorização prévia e escrita da CONTRATANTE e da apresentação de todos os documentos exigidos, inclusive CRM ativo e RQE compatível. A CONTRATANTE poderá recusar o substituto sem que disso decorra indenização.",
    "7.3. A falta, atraso recorrente, abandono de agenda ou interrupção injustificada autoriza a suspensão dos atendimentos, a glosa dos serviços afetados e o ressarcimento das despesas adicionais comprovadamente suportadas pela CONTRATANTE."
   ]
  },
  {
   "h": "CLÁUSULA OITAVA — DOS PRONTUÁRIOS E DOS DOCUMENTOS MÉDICOS",
   "p": [
    "8.1. A CONTRATADA é responsável pela correção, completude, pertinência clínica, autenticidade, assinatura e tempestividade dos registros e documentos médicos que produzir.",
    "8.2. Quando a CONTRATANTE disponibilizar sistema de prontuário, responderá pelos controles técnicos sob sua gestão direta, observadas as limitações dos fornecedores contratados. A CONTRATADA responderá pelo uso de suas credenciais, pelo sigilo, pelo conteúdo inserido e por acessos, alterações ou compartilhamentos indevidos originados de sua atuação.",
    "8.3. A CONTRATADA não poderá apagar, alterar retrospectivamente ou retirar registros clínicos fora das hipóteses legais. Correções deverão preservar a versão anterior, a autoria, a data, a justificativa e a rastreabilidade.",
    "8.4. O encerramento do Contrato não autoriza retenção, cópia indiscriminada ou utilização dos prontuários para finalidade própria. O acesso posterior ocorrerá somente quando necessário ao cumprimento de obrigação legal, ética ou ao exercício regular de direitos, mediante canal seguro."
   ]
  },
  {
   "h": "CLÁUSULA NONA — DA PROTEÇÃO DE DADOS E DA SEGURANÇA DA INFORMAÇÃO",
   "p": [
    "9.1. As partes observarão a Lei nº 13.709/2018 e tratarão dados pessoais, especialmente dados de saúde, apenas para finalidades legítimas relacionadas à execução deste Contrato e ao cumprimento de obrigações legais, regulatórias e éticas.",
    "9.2. Cada parte atuará como controladora independente quanto às decisões inseridas em sua esfera de competência e como operadora quando tratar dados estritamente em nome e segundo instruções documentadas da outra.",
    "9.3. A CONTRATADA adotará controles adequados de acesso, autenticação, armazenamento, transmissão, descarte e confidencialidade; não compartilhará credenciais; não utilizará dispositivos ou redes sem segurança compatível; e limitará o acesso às pessoas estritamente necessárias.",
    "9.4. A CONTRATADA comunicará à CONTRATANTE qualquer incidente real ou suspeito no prazo máximo de 12 (doze) horas da ciência, preservará evidências, adotará imediatamente medidas de contenção e fornecerá todas as informações necessárias à avaliação de risco e às comunicações legais.",
    "9.5. A CONTRATADA não utilizará dados de pacientes, profissionais, clientes ou parceiros da CONTRATANTE para publicidade, prospecção, formação de base própria, pesquisa não autorizada, treinamento de sistemas, compartilhamento com terceiros ou qualquer finalidade incompatível.",
    "9.6. A contratação de suboperador dependerá de autorização prévia e escrita da CONTRATANTE e de instrumento que imponha obrigações equivalentes. A autorização não excluirá a responsabilidade integral da CONTRATADA.",
    "9.7. Encerrada a finalidade, a CONTRATADA devolverá, eliminará ou anonimizará os dados tratados em nome da CONTRATANTE, ressalvadas as retenções legalmente obrigatórias, cuja existência deverá ser informada."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA — DA CONFIDENCIALIDADE",
   "p": [
    "10.1. A CONTRATADA manterá sob absoluto sigilo as informações clínicas, pessoais, técnicas, comerciais, financeiras, estratégicas e operacionais acessadas em razão deste Contrato, utilizando-as exclusivamente para sua execução.",
    "10.2. A obrigação alcança sócios, empregados, profissionais, prepostos e terceiros da CONTRATADA e subsistirá por 5 (cinco) anos após o término, sem limitação temporal quanto ao sigilo médico, aos dados pessoais e aos segredos protegidos por prazo legal superior.",
    "10.3. A divulgação exigida por lei ou autoridade será limitada ao estritamente necessário e, quando permitido, comunicada previamente à CONTRATANTE.",
    "10.4. A violação desta cláusula sujeitará a CONTRATADA à multa não compensatória de R$ 20.000,00 (vinte mil reais) por evento, sem prejuízo da cessação imediata da conduta, da rescisão e da reparação integral dos prejuízos que excederem a multa."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA PRIMEIRA — DA MARCA E DA PROPRIEDADE INTELECTUAL",
   "p": [
    "11.1. A CONTRATADA não utilizará nome, marca, logotipo, materiais, fluxos, documentos, conteúdos, sistemas ou sinais distintivos da CONTRATANTE sem autorização prévia e escrita.",
    "11.2. A contratação não transfere direitos sobre software, bases de dados, materiais, protocolos administrativos, métodos, conteúdos, identidade visual ou demais ativos da CONTRATANTE.",
    "11.3. Encerrado o Contrato ou revogada a autorização, a CONTRATADA cessará imediatamente qualquer uso e excluirá materiais cuja conservação não seja legalmente necessária."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA SEGUNDA — DA NÃO ALICIAÇÃO E DA NÃO CIRCUNVENÇÃO",
   "p": [
    "12.1. Durante a vigência e por 12 (doze) meses após o término, a CONTRATADA não poderá abordar de forma direcionada, aliciar, contratar diretamente ou desviar pacientes, clientes, parceiros comerciais ou profissionais que lhe tenham sido apresentados pela CONTRATANTE ou conhecidos exclusivamente em razão desta relação, com a finalidade de contornar a intermediação ou concorrer deslealmente com a operação contratada.",
    "12.2. A restrição não impede candidatura espontânea, publicidade geral não direcionada ou relação comprovadamente preexistente e independente deste Contrato.",
    "12.3. O descumprimento sujeitará a CONTRATADA à multa não compensatória de R$ 30.000,00 (trinta mil reais) por pessoa ou relação desviada, sem prejuízo da rescisão imediata e da reparação dos prejuízos excedentes."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA TERCEIRA — DA AUDITORIA E DO CONTROLE DE QUALIDADE",
   "p": [
    "13.1. A CONTRATANTE poderá auditar o cumprimento das obrigações administrativas, documentais, de faturamento, segurança, privacidade e qualidade, diretamente ou por terceiro sujeito a confidencialidade, sem interferir na autonomia clínica e sem acesso indiscriminado a prontuários.",
    "13.2. A CONTRATADA fornecerá, no prazo solicitado e em formato adequado, os documentos e esclarecimentos necessários, ressalvado o sigilo médico e observada a minimização de dados.",
    "13.3. A identificação de não conformidade autoriza a CONTRATANTE a estabelecer prazo de correção, suspender novos atendimentos, glosar valores afetados ou rescindir o Contrato conforme a gravidade e o risco."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA QUARTA — DA RESPONSABILIDADE E DO DIREITO DE REGRESSO",
   "p": [
    "14.1. A CONTRATADA responderá pelos atos e omissões inseridos em sua esfera de atuação e pelos profissionais que indicar, incluindo erro médico, imprudência, negligência, imperícia, falha de registro, infração ética, violação de sigilo, tratamento irregular de dados e descumprimento contratual.",
    "14.2. A responsabilidade técnica e profissional pelo ato médico permanecerá com o profissional executante e com a CONTRATADA, não sendo transferida à CONTRATANTE pelo agendamento, disponibilização de plataforma, definição de fluxo administrativo, auditoria ou pagamento.",
    "14.3. A CONTRATADA indenizará e manterá a CONTRATANTE indene de condenações, acordos previamente autorizados, multas, despesas, custos periciais, honorários e demais prejuízos decorrentes de fato comprovadamente imputável à CONTRATADA ou às pessoas por ela utilizadas.",
    "14.4. Recebida reclamação, notificação, procedimento ético, administrativo ou judicial, a parte comunicará a outra em até 2 (dois) dias úteis. A CONTRATADA fornecerá prontamente subsídios técnicos e documentos para a defesa, sem que isso implique reconhecimento de responsabilidade pela CONTRATANTE.",
    "14.5. Nenhuma parte poderá confessar, transigir ou assumir obrigação em nome da outra sem autorização prévia e escrita. O direito de regresso e de compensação permanecerá preservado."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA QUINTA — DA LIMITAÇÃO DE RESPONSABILIDADE DA CONTRATANTE",
   "p": [
    "15.1. Na relação interna entre as partes, e ressalvadas as hipóteses em que a limitação seja legalmente vedada, a responsabilidade da CONTRATANTE ficará restrita aos danos diretos comprovadamente causados por dolo ou culpa em obrigação sob sua gestão direta e limitada ao total efetivamente pago à CONTRATADA nos 6 (seis) meses anteriores ao evento.",
    "15.2. A CONTRATANTE não responderá por lucros cessantes, perda de oportunidade, danos indiretos, reflexos ou consequências econômicas remotas, nem por falhas de terceiros, internet, equipamentos ou recursos fora de seu controle, salvo quando houver responsabilidade inderrogável prevista em lei.",
    "15.3. As limitações desta cláusula regulam exclusivamente a relação interna entre as partes e não poderão ser invocadas para restringir direitos indisponíveis de pacientes ou terceiros."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA SEXTA — DA NATUREZA CIVIL E DA AUSÊNCIA DE VÍNCULO",
   "p": [
    "16.1. A relação é civil e empresarial, inexistindo vínculo trabalhista, societário, associativo, previdenciário, de representação, agência, franquia ou solidariedade automática entre a CONTRATANTE e a CONTRATADA ou seus profissionais.",
    "16.2. Não haverá exclusividade, pessoalidade, subordinação jurídica ou controle de jornada típico de emprego. A coordenação de agendas, os controles de qualidade e o cumprimento de fluxos não descaracterizam a autonomia contratual e técnica.",
    "16.3. A CONTRATADA assume integral responsabilidade por remunerações, tributos, encargos e obrigações trabalhistas, previdenciárias e fiscais relativos às pessoas que utilizar, ressarcindo a CONTRATANTE por valores que esta venha a suportar em razão de obrigação comprovadamente imputável à CONTRATADA."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA SÉTIMA — DA CESSÃO E DA SUBCONTRATAÇÃO",
   "p": [
    "17.1. A CONTRATADA não poderá ceder, transferir ou subcontratar, total ou parcialmente, este Contrato ou os serviços sem autorização prévia e escrita da CONTRATANTE.",
    "17.2. A autorização será discricionária, poderá ser revogada diante de risco ou irregularidade e não afastará a responsabilidade integral da CONTRATADA pela qualificação, conduta e obrigações do terceiro.",
    "17.3. A CONTRATANTE poderá ceder o Contrato a empresa do mesmo grupo econômico ou sucessora de sua operação, mediante comunicação escrita, preservadas as condições essenciais."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA OITAVA — DA VIGÊNCIA DA SUSPENSÃO E DA RESCISÃO",
   "p": [
    "18.1. O Contrato vigorará por prazo indeterminado a partir da assinatura. Qualquer parte poderá rescindi-lo sem justa causa mediante aviso escrito com antecedência mínima de 30 (trinta) dias.",
    "18.2. A CONTRATANTE poderá suspender imediatamente agendas, acessos e novos atendimentos quando houver risco assistencial, ético, regulatório, reputacional, de segurança da informação ou à continuidade da operação, sem que a suspensão preventiva gere remuneração ou indenização.",
    "18.3. A CONTRATANTE poderá rescindir imediatamente, independentemente de prazo de cura, em caso de: a) perda ou irregularidade de habilitação; b) infração ética ou legal grave; c) violação de sigilo, dados, marca ou não aliciamento; d) fraude ou corrupção; e) cobrança indevida; f) abandono ou falha assistencial relevante; g) cessão ou substituição não autorizada; h) risco fundamentado à segurança do paciente ou à reputação da CONTRATANTE; ou i) reincidência em descumprimentos.",
    "18.4. Nos demais inadimplementos sanáveis, a parte infratora terá até 10 (dez) dias corridos após notificação para corrigir a irregularidade, salvo se a urgência ou a natureza do fato exigir medida imediata.",
    "18.5. O término não prejudicará obrigações vencidas nem as cláusulas de sigilo, dados, prontuários, propriedade intelectual, não aliciamento, responsabilidade, indenização e solução de controvérsias."
   ]
  },
  {
   "h": "CLÁUSULA DÉCIMA NONA — DO CASO FORTUITO E DA FORÇA MAIOR",
   "p": [
    "19.1. A parte impedida por caso fortuito ou força maior comunicará imediatamente a ocorrência, adotará medidas razoáveis de mitigação e retomará a execução assim que possível.",
    "19.2. Não serão considerados força maior eventos inerentes à atividade e razoavelmente evitáveis, inclusive falha de equipamento próprio, conexão inadequada, ausência de profissional ou perda de credencial causada por conduta da parte afetada.",
    "19.3. Persistindo a impossibilidade por mais de 30 (trinta) dias, a CONTRATANTE poderá rescindir o Contrato sem multa, assegurado apenas o pagamento dos serviços válidos já prestados."
   ]
  },
  {
   "h": "CLÁUSULA VIGÉSIMA — DA INTEGRIDADE E DA ANTICORRUPÇÃO",
   "p": [
    "20.1. A CONTRATADA cumprirá a Lei nº 12.846/2013 e demais normas aplicáveis e não oferecerá, prometerá, solicitará ou receberá vantagem indevida relacionada a este Contrato.",
    "20.2. A CONTRATADA comunicará conflito de interesses real ou potencial e cooperará com apurações legítimas. A prática ou suspeita fundamentada de ilícito autoriza suspensão cautelar e, quando confirmada ou não satisfatoriamente esclarecida, rescisão imediata."
   ]
  },
  {
   "h": "CLÁUSULA VIGÉSIMA PRIMEIRA — DAS COMUNICAÇÕES E DAS DISPOSIÇÕES GERAIS",
   "p": [
    "21.1. As comunicações serão realizadas por escrito, inclusive por correio eletrônico ou plataforma que permita comprovar envio e recebimento, aos contatos oficialmente informados.",
    "21.2. Alterações de objeto, valor ou condições essenciais dependerão de termo aditivo escrito. A tolerância não importará novação ou renúncia, e a invalidade de uma disposição não afetará as demais.",
    "21.3. A CONTRATADA não poderá divulgar a existência, os termos ou os resultados comerciais da relação sem autorização da CONTRATANTE, ressalvadas obrigações legais.",
    "21.4. Este Contrato substitui entendimentos anteriores sobre seu objeto e obriga as partes e seus sucessores autorizados."
   ]
  },
  {
   "h": "CLÁUSULA VIGÉSIMA SEGUNDA — DA ASSINATURA ELETRÔNICA E DO FORO",
   "p": [
    "22.1. As partes reconhecem a validade das assinaturas eletrônicas que permitam identificar os signatários e assegurar a integridade do documento. Assinado pelas partes e por 2 (duas) testemunhas, o instrumento constituirá título executivo extrajudicial, na forma da legislação processual civil.",
    "22.2. Antes do ajuizamento, as partes buscarão solução consensual mediante notificação escrita e prazo de 15 (quinze) dias úteis, ressalvadas medidas urgentes.",
    "22.3. Fica eleito o Foro da Comarca de São Paulo/SP para dirimir questões não solucionadas consensualmente, com renúncia a qualquer outro, por mais privilegiado que seja."
   ]
  }
 ]
};
