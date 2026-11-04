# Cabos de força em eletrodutos acima do solo
## Guia de dimensionamento de baixa e média tensão - NEC 2023

Preparado para Reginardo | PlantSERV | 4 de novembro de 2026

Este relatório explica o raciocínio de projeto e a implementação do Raceway Lab no hub design-tools. O foco são circuitos de força industriais. As referências correspondem ao NEC 2023; os limites de automação são identificados separadamente das exigências normativas. Não foi possível revisar integralmente, linha por linha, o texto licenciado do NEC nesta implementação. As regras principais e tabelas foram confrontadas com referências primárias, dados existentes e exemplos calculados. O relatório não constitui certificação independente de conformidade.

## 1. O que muda em relação a leitos e instalações subterrâneas

Um eletroduto aparente pode ser fixado em suportes, paredes ou estruturas, dentro ou fora de edificações. Estar acima do solo não significa que o cabo esteja em ar livre: o calor atravessa a isolação, o espaço interno e a parede do eletroduto antes de alcançar o ambiente. Portanto, a ampacidade de cabo isolado em ar livre não deve ser aplicada automaticamente.

O leito organiza e sustenta cabos, mas deixa o ar circular de forma diferente. O eletroduto protege mecanicamente e define um volume fechado. No subterrâneo, a dissipação envolve solo, profundidade, resistividade térmica e eventual concreto; acima do solo, ganham importância a temperatura do ar, exposição solar, fontes quentes e proximidade entre eletrodutos carregados.

O projeto exige três verificações distintas: capacidade elétrica do cabo, espaço físico do eletroduto e viabilidade mecânica de instalação. Um cabo pode caber e ainda sobreaquecer; pode atender à corrente e ser impossível de puxar sem dano. O diâmetro mínimo por ocupação nem sempre é a escolha construtiva adequada.

## 2. Mapa das referências

| Assunto | Referência NEC 2023 | Aplicação |
|---|---|---|
| Carga de alimentadores BT | 215.2(A)(1), 215.3 | Corrente mínima dos condutores e proteção |
| Motores / entrada de VFD | 430.6, 430.22, 430.250, 430.122(A) | Base de corrente e multiplicadores |
| Alimentadores e proteção MT | Artigos 235 e 245 | Requisitos próprios acima de 1000 V ac |
| Ampacidade BT | 310.14, Tabela 310.16 | Condutores em eletroduto, ambiente de 30°C |
| Temperatura e agrupamento BT | 310.15(B), (C), (E), (F) | Correções, condutores carregados e neutro |
| Ampacidade MT no ar em eletroduto | 315.60(C)(7)/(9), (D)(4), (E) | Cobre, 3 x 1/C ou 1 x 3/C, ambiente de 40°C |
| Limite dos terminais | 110.14(C), 110.40 | Coordenação entre cabo e equipamento |
| EGC / bonding | 250.118, 250.96, 250.97, 250.122, 250.190 | Caminho de corrente de falta e interligações |
| Organização e indução | 300.3(B), 300.20, 305.6 | Fases e condutores associados juntos |
| Instalação MT | 305.5, 305.8, 315.10 | Curvatura, umidade e classe de isolação |
| Ocupação | Capítulo 9, Tabelas 1, 4, 5/5A | Áreas, limites e quantidade de cabos |
| Tipo de eletroduto | 342, 344, 352, 358 | IMC, RMC, PVC e EMT |
| Caixas e puxamento | 314.28, 314.29, 314.71; seção .26 do eletroduto | Dimensões, acesso e curvas |

O NEC 2023 reorganizou diversos assuntos de média tensão. Não copie diretamente a numeração de manuais antigos que citam 310.60 ou 311.60. Verifique o texto e a tabela equivalente na edição 2023. A distinção regulamentar acima de 1000 V também não coincide com o início das tabelas de ampacidade de MT acima de 2000 V.

## 3. Sequência recomendada de dimensionamento

1. Identificar tensão, sistema, frequência, regime da carga, corrente e tipo de equipamento.
2. Definir o critério de corrente mínima: alimentador, motor, entrada de VFD ou outro caso.
3. Selecionar cabo: material, seção, quantidade de vias, tensão nominal, isolação, blindagem e diâmetro externo.
4. Definir eletroduto, ambiente, quantidade de circuitos, neutro e paralelos.
5. Escolher a tabela de ampacidade compatível com o arranjo físico.
6. Aplicar correção de temperatura e ajustes pertinentes; comparar com a limitação dos terminais.
7. Verificar queda de tensão e, quando aplicável, partida de motores.
8. Dimensionar EGC e revisar proteção, curto-circuito e blindagens.
9. Calcular ocupação com todos os cabos e condutores efetivamente instalados.
10. Verificar curvas, caixas, puxamento, suportes, corrosão, expansão e continuidade elétrica.

O processo é iterativo. Aumentar a seção para reduzir queda de tensão pode aumentar o EGC e exigir outro eletroduto. Dividir um circuito em paralelos altera a corrente por conjunto, mas exige arranjos equivalentes e caminhos completos em cada eletroduto.

## 4. Baixa tensão: corrente e ampacidade

### 4.1 Carga de alimentadores

Para um alimentador comum, sem aplicação da exceção de conjunto integralmente identificado para 100% da corrente, a condição antes dos fatores é:

I mínimo = 1,25 x I contínua + I não contínua.

A carga contínua é aquela cuja corrente máxima deve permanecer por três horas ou mais. A verificação de 215.2(A)(1) não deve ser reduzida a multiplicar indiscriminadamente todos os fatores: é necessário atender à condição de carga contínua/não contínua antes dos ajustes e à carga efetiva após correções e ajustes. O Raceway Lab mantém essas duas verificações visíveis.

A proteção do alimentador também deve atender a 215.3 e às regras do Artigo 240. A aplicação adota uma verificação conservadora da ampacidade contra o OCPD, sem usar automaticamente a exceção do próximo tamanho padronizado de 240.4(B).

### 4.2 Motores e conversores

Para o motor comum de serviço contínuo abrangido por 430.22, os condutores são dimensionados para pelo menos 125% da corrente de plena carga determinada conforme 430.6. A Tabela 430.250 fornece correntes de motores trifásicos dentro das condições de sua aplicação. Corrente para cabos e corrente para ajuste de sobrecarga não são necessariamente a mesma referência.

Na entrada de um VFD, 430.122(A) utiliza 125% da corrente nominal de entrada do conversor. Não substitua essa corrente pela corrente de saída do motor sem verificar a regra aplicável. Cabos entre VFD e motor exigem outros cuidados, incluindo instruções do fabricante, comprimento, blindagem, correntes de modo comum e sobretensões. O módulo implementa apenas a entrada do VFD.

### 4.3 Tabela 310.16 e fatores

Para o arranjo BT em eletroduto, a base é a Tabela 310.16. Ela considera até três condutores que transportam corrente e ambiente de 30°C. As colunas de 60, 75 e 90°C representam diferentes bases de temperatura do condutor.

A correção de temperatura vem de 310.15(B)(1). Para um condutor com isolação de 90°C em ambiente de 40°C, o fator é 0,91; a 45°C, é 0,87. Deve-se usar a faixa tabulada aplicável, sem interpolar valores arbitrariamente.

| Condutores que transportam corrente | Fator de 310.15(C)(1) |
|---|---|
| Até 3 | 1,00 |
| 4 a 6 | 0,80 |
| 7 a 9 | 0,70 |
| 10 a 20 | 0,50 |
| 21 a 30 | 0,45 |
| 31 a 40 | 0,40 |
| Acima de 40 | 0,35 |

Um circuito trifásico sem neutro tem três condutores carregados. Dois circuitos trifásicos no mesmo eletroduto normalmente totalizam seis. O EGC não entra nessa contagem, mas ocupa área. O neutro que conduz apenas desequilíbrio pode receber o tratamento de 310.15(E); o neutro sujeito à parcela predominante de cargas não lineares deve ser contado. Dimensionar a seção do neutro com harmônicos continua sendo uma análise própria.

### 4.4 Terminais

A ampacidade corrigida pela isolação e o limite do terminal devem ser avaliados separadamente. Um cabo de 90°C não transforma um terminal de 75°C em terminal de 90°C. Para 1/0 AWG e maiores, a base usual é 75°C, salvo identificação aplicável. Para circuitos/equipamentos de menor corrente e condutores menores, 60°C pode ser a base necessária quando não houver identificação permitindo outra temperatura.

Exemplo: 1/0 Cu na Tabela 310.16 tem 170 A na coluna de 90°C e 150 A na coluna de 75°C. A 40°C e com três condutores carregados, 170 x 0,91 = 154,7 A. Com terminal de 75°C, o limite resultante é 150 A.

## 5. Média tensão: o método correto para eletroduto no ar

### 5.1 Escolha da tabela

| Construção em eletroduto isolado no ar | Cobre | Alumínio |
|---|---|---|
| Três cabos unipolares ou triplexados | 315.60(C)(7) | 315.60(C)(8) |
| Um cabo tripolar | 315.60(C)(9) | 315.60(C)(10) |

A base de temperatura ambiente é 40°C, conforme 315.60(E). A correção é obtida na Tabela 315.60(D)(4). Para 90°C de condutor e 45°C de ambiente, o fator é 0,95. Para 105°C e o mesmo ambiente, é 0,96.

O Raceway Lab implementa as duas construções em cobre. As tabelas para alumínio estão indicadas aqui para explicar o método, mas não foram implementadas no módulo. Uma construção de cabo tripolar não pode receber automaticamente a ampacidade de três cabos unipolares.

O uso de uma tabela pressupõe atendimento às suas condições. Vários eletrodutos carregados próximos entre si podem influenciar termicamente uns aos outros. Não aplique automaticamente os fatores BT de quantidade de condutores a essa situação MT. Use análise sob supervisão de engenharia conforme 315.60(B), com documentação das condições reais. O programa bloqueia o uso automático das tabelas de eletroduto isolado para esse arranjo.

### 5.2 Tensão do circuito, classe do cabo e nível de isolação

São informações diferentes. Um circuito pode operar em 4,16 kV e utilizar uma construção de cabo de classe superior. As tabelas possuem faixas de tensão que devem corresponder à base adotada para o cabo e à sua aplicação. Não use a coluna de 5 kV apenas porque o equipamento opera abaixo desse valor sem conferir a classificação adotada.

Cabos com dupla identificação merecem atenção: uma família 5/8 kV pode corresponder a 133% em 5 kV e 100% em 8 kV. A interface permite identificar qual classificação está sendo utilizada e verifica o nível de isolação do catálogo naquela classificação.

Em 315.10(C), a seleção de 100%, 133% e 173% está vinculada às condições do sistema e ao tempo de eliminação de falta à terra. Em termos gerais, a categoria de 100% pressupõe eliminação dentro de um minuto; 133%, dentro de uma hora. Isso não significa que tais tempos sejam desejáveis para uma falta de elevada corrente. A verificação térmica de curto-circuito usa o tempo real da proteção, normalmente muito menor. Aplicações de 173% requerem uma avaliação específica e não são automatizadas.

### 5.3 MV-105 e terminações

O cabo MV-105 admite uma base térmica de isolação de 105°C, mas 110.40 normalmente estabelece a base de 90°C para terminação, salvo outra identificação. Verifique os dois limites. A escolha de 105°C na isolação não autoriza automaticamente a mesma temperatura em todos os equipamentos, emendas e acessórios.

As tabelas e o projeto de blindagem também devem ser compatíveis. Blindagens aterradas, correntes circulantes e perdas precisam ser tratados conforme o arranjo real. Não se deve aplicar um fator adicional de blindagem sem verificar se o efeito já está incluído na tabela utilizada. O programa não faz projeto de aterramento de blindagens nem substitui uma análise térmica específica.

## 6. Escolha do eletroduto e condições ambientais

RMC, Artigo 344, é o eletroduto metálico rígido. IMC, Artigo 342, possui parede intermediária e dimensões internas próprias. EMT, Artigo 358, é mais leve; sua adequação depende da exposição a danos e das condições de instalação. PVC, Artigo 352, exige atenção a danos físicos, temperatura, exposição, sustentação e dilatação. Schedule 40 e Schedule 80 do mesmo tamanho nominal não possuem a mesma área interna.

A disponibilidade de um tamanho no cálculo de ocupação não comprova que o método seja adequado ao local. Escolha material e acessórios conforme corrosão, danos mecânicos, classificação de área e ambiente. Em instalações industriais, a especificação do PlantSERV pode ser mais restritiva que o mínimo do NEC.

Eletrodutos externos podem receber água e condensação. O interior de um eletroduto em local molhado acima do solo deve ser tratado como local molhado: 300.9 em BT e 305.8 no contexto MT. Um condutor identificado apenas para local seco não passa a ser apropriado porque está dentro de um tubo. Observe também 300.7 em transições de temperatura.

Para BT sob sol direto acima de cobertura, 310.15(B)(2) do NEC 2023 exige o adicional de 33°C quando a distância até o fundo do eletroduto for inferior a 3/4 in, com a exceção aplicável a XHHW-2. Não se trata de um adicional universal para qualquer eletroduto externo. A aplicação de condições solares em MT exige uma base térmica documentada.

## 7. Ocupação: como calcular

A área de um cabo circular é A = pi x D² / 4. D é o diâmetro externo completo. Some todas as áreas e divida pela área interna do eletroduto indicada na Tabela 4, ou por outra base dimensional válida e documentada.

| Objetos físicos dentro do eletroduto | Ocupação máxima comum |
|---|---|
| 1 condutor ou 1 cabo | 53% |
| 2 condutores/cabos | 31% |
| Mais de 2 | 40% |

As notas da Tabela 1 são essenciais. Um cabo tripolar é um objeto para ocupação; as três vias não são três círculos independentes. Se houver um EGC externo, serão dois objetos: cabo + EGC, portanto 31%. Se o EGC estiver dentro do cabo, sua área já está dentro do diâmetro externo. Não se deve somá-lo novamente.

O neutro ocupa área mesmo quando não é contado para correção de ampacidade. Cabos elípticos são tratados pelo círculo baseado na maior dimensão, conforme a nota aplicável. Construções compactas podem ter área diferente daquelas representadas por outra tabela: utilize a geometria apropriada.

Existem exceções específicas, como a de certos nipples curtos e a regra de arredondamento para condutores de mesmo tamanho. O Raceway Lab não aplica essas exceções; utiliza os limites comuns e pode adotar um alvo de ocupação mais restritivo. Tal alvo adicional é critério de projeto, não uma nova regra do NEC.

## 8. EGC, paralelos e bonding

O EGC é o condutor de proteção dos equipamentos; não se confunde com condutor de eletrodo de aterramento. Sua base de dimensionamento é a Tabela 250.122, usando a corrente da proteção. Em MT, 250.190(C) trata da corrente nominal do fusível ou do ajuste de sobrecorrente do relé; para o EGC de cobre não integral ao cabo, aplica-se também o mínimo de 6 AWG.

Se os condutores de fase forem aumentados além da seção mínima suficiente para ampacidade, por exemplo por queda de tensão, a regra de 250.122(B) deve ser considerada. A proporcionalidade é feita por área circular mil, não pelo número AWG nem pelo diâmetro externo. O programa compara a seção escolhida à menor seção suportada que atende à ampacidade e à sua verificação conservadora de proteção, no mesmo número de paralelos.

Cada eletroduto de um circuito em paralelo recebe um EGC dimensionado conforme a regra aplicável ao circuito completo. Não divida automaticamente a seção de terra pelo número de eletrodutos. As fases de cada conjunto devem ter características equivalentes, incluindo comprimento, material, seção, isolação e terminação, conforme 310.10(G).

A organização usual em eletroduto de aço é A-B-C no mesmo caminho, com neutro e EGC associados. Separar cada fase em um eletroduto ferromagnético pode gerar aquecimento por indução; verifique 300.3(B), 300.20 e 305.6.

Eletrodutos metálicos listados podem constituir caminho de EGC quando atendidas as condições de 250.118 e de continuidade/bonding. O programa inclui deliberadamente um EGC de fio e não dá crédito automático à blindagem. Isso é uma escolha conservadora do modelo, não uma afirmação de que o NEC sempre exija um fio adicional em qualquer eletroduto metálico.

## 9. Curvas, caixas, sustentação e puxamento

A soma de curvas entre pontos de puxamento não deve exceder 360°, conforme a seção .26 do tipo de eletroduto. Não existe uma regra universal de colocar uma caixa a cada determinado comprimento independentemente do traçado. Curvas, esforços e condições do cabo influenciam os pontos necessários.

Para cabos MT blindados unipolares, 305.5 estabelece raio mínimo relacionado a 12 vezes o diâmetro externo. Para cabo multiconductor com vias individualmente blindadas, considerar o maior entre 12 vezes o diâmetro da via e 7 vezes o diâmetro externo do cabo completo. Uma exigência maior do fabricante continua aplicável. Diferencie raio do cabo, raio da curva do eletroduto e tamanho nominal do tubo.

O risco de jamming é uma verificação adicional. Três cabos semelhantes podem se alinhar e travar em uma curva. A relação entre diâmetro interno do eletroduto e diâmetro do cabo, com consideração da ovalização da curva, ajuda a identificar a faixa crítica. O módulo utiliza 1,05 x D/d e sinaliza a faixa 2,8 a 3,2. A presença de um EGC adicional não elimina automaticamente esse risco.

O dimensionamento mecânico final deve verificar tensão máxima de puxamento, pressão lateral nas curvas, atrito, inclinação, condição das bocas, acessórios, lubrificante, temperatura durante instalação e forma de tração. Esses dados são específicos da construção e do fabricante.

Caixas para grandes condutores BT seguem, quando aplicável, 314.28. Instalações MT têm requisitos próprios em 314.71. As caixas precisam permanecer acessíveis conforme 314.29. Sustentação e fixação seguem a seção .30 de cada método. Como orientação geral, eletrodutos metálicos comuns utilizam fixação próxima às terminações e intervalos usuais máximos de 10 ft, mas devem ser conferidas as condições e exceções exatas. PVC possui espaçamentos próprios por tamanho e requer avaliação de dilatação, inclusive 352.44. Verifique também corrosão e selagem corta-fogo das passagens.

## 10. Queda de tensão e curto-circuito

Para um circuito trifásico equilibrado, uma aproximação usual é:

Delta V = raiz(3) x I x (L/1000) x (R x FP + X x raiz(1 - FP²)) / n.

L é o comprimento de ida em pés; R e X estão em ohm por 1000 ft; n é o número de conjuntos paralelos iguais. Use a corrente de operação para a condição de operação estudada. Corrente de partida requer outro cenário.

R e X dependem da temperatura, construção, material do eletroduto, disposição e blindagens. O modo Tabela 9 do programa é limitado a cabos BT unipolares de cobre, 60 Hz, base de 75°C e circuitos até 600 V. Em MT e cabos multiconductores, o programa exige impedância verificada para a seção e instalação. Trocar a seção não pode conservar silenciosamente a impedância anterior.

O alvo de 3% adotado no módulo é critério de projeto. A orientação conhecida de 3% no circuito e 5% no conjunto alimentador + circuito aparece em notas informativas; não é um limite obrigatório universal para toda situação. Outros artigos e equipamentos podem impor limites específicos.

Ampacidade contínua não comprova suportabilidade a curto-circuito. Verifique corrente de falta, tempo de eliminação, capacidade do condutor e da blindagem, corrente de interrupção e coordenação, conforme 110.9, 110.10 e os artigos de proteção aplicáveis. O módulo compara I x raiz(t) com capacidades de 1 s informadas pelo fabricante, apenas como triagem. A validade da escala, temperaturas e correntes nas blindagens precisam ser confirmadas no estudo.

## 11. Exemplo BT reproduzível na aplicação

Dados: 480 V trifásico, 100 A contínuos, 40°C, um circuito por eletroduto, um conjunto, Cu 90°C, terminais identificados para 75°C, OCPD de 150 A, 200 ft, FP 0,85, limite de queda de 3%, RMC e EGC separado.

A exigência antes dos fatores é 125 A. Para 1/0 Cu: 170 A a 90°C e 150 A a 75°C. Após temperatura: 170 x 0,91 = 154,7 A. O terminal limita a 150 A, atendendo à carga e à proteção no critério implementado.

O cabo da família Southwire 45002 usado no exemplo tem OD de 0,590 in. A ocupação das três fases é 3 x pi x 0,590² / 4 = 0,82019 in². O EGC 6 AWG Cu, com área adotada de 0,0507 in² para THHN/THWN-2, leva o total a 0,87089 in². Em RMC de 2 in, área interna de 3,408 in², a ocupação é 25,55%, inferior a 40%. O RMC imediatamente menor de 1-1/2 in não atende ao limite de ocupação dessa composição.

Usando R = 0,12 e X = 0,055 ohm/1000 ft da base Tabela 9 em aço, a queda aproximada é 4,537 V, ou 0,945%. O resultado ainda depende das verificações de instalação e da confirmação da construção do cabo.

## 12. Exemplo MT e cuidado com dados ilustrativos

Dados: 4,16 kV, corrente de operação 200 A, ampacidade mínima de projeto 250 A já estabelecida pelo engenheiro, ambiente 45°C, 3 x 4/0 Cu, classe 5 kV, isolação de 90°C como base térmica e terminal de 90°C, um eletroduto isolado, EGC baseado em 300 A. A origem dos 250 A precisa ser documentada conforme o tipo de carga.

A Tabela 315.60(C)(7), faixa 2001–5000 V, fornece 280 A para 4/0 a 90°C. Corrigindo: 280 x 0,95 = 266 A. O limite de terminal é 280 A; governa 266 A, superior a 250 A. Se usado MV-105, repetir os dois testes; não eliminar automaticamente a limitação do terminal.

O exemplo da família 46101 é classe 5 kV, 100% de isolação. Sua utilização depende da compatibilidade do sistema com essa categoria; a interface deve mostrar 100% para esse exemplo. Com OD de 0,970 in, as três fases mais EGC 4 AWG, área 0,0824 in², ocupam aproximadamente 2,29934 in². Em RMC de 3 in, área 7,499 in², isso representa 30,66%. O mínimo geométrico de raio para o cabo blindado é 12 x 0,970 = 11,64 in, sujeito ao fabricante.

Para demonstrar apenas a fórmula, R = 0,08 e X = 0,05 ohm/1000 ft, 200 ft e FP 0,85 produziriam 6,536 V, ou 0,157%. Esses R/X são ILUSTRATIVOS: não são uma validação de um cabo Southwire em eletroduto de aço. Substitua pelos valores reais antes de usar o resultado no projeto. O exemplo também não contém capacidades verificadas de curto-circuito do condutor e blindagem e permanece pendente de revisão.

## 13. Como usar o Raceway Lab

Na etapa Circuit & load, informe a corrente e o critério de carga. Em Cable & ampacity, selecione construção, família, temperatura, tensão nominal e terminais. Em Raceway & installation, escolha o eletroduto, condições do local, geometria, EGC e queda de tensão. Em Results & review, examine a memória de cálculo e feche as verificações necessárias.

Em BT unipolar com base Tabela 9, a sugestão automática compara ampacidade, proteção, ocupação e queda de tensão. Em MT ou multicondutor sem impedância verificada, a ferramenta mantém uma proposta de seção por ampacidade/espaço e sinaliza o que falta. Use o botão de verificação detalhada da seção, informe R/X reais e conclua a análise. O programa não interpola impedâncias de MT nem supõe que valores para eletroduto não metálico representem aço.

Os estados têm significados distintos: Blocked indica uma falha ou dado numérico necessário ausente; Review required indica verificações de projeto pendentes; Calculated indica que os controles implementados e as confirmações foram concluídos. Este último não significa certificação independente de conformidade integral com o NEC.

O projeto pode ser salvo no navegador, exportado/importado em JSON e impresso com memória de cálculo. Alterações invalidam confirmações; mudanças de seção/construção invalidam dados específicos de impedância e curto-circuito. A área NEC learning guide explica cada etapa em inglês e possui busca por assunto ou seção.

## 14. Referências e limites de verificação

[1] NFPA 70, NEC 2023. Acesso oficial: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70. Selecionar a edição 2023; conferir emendas aplicáveis e critérios do AHJ.

[2] Okonite, Engineering Handbook 2025, especialmente pp. 21 e 37–40: https://www.okonite.com/media/catalog/product/files/EHB_2025.pdf. As tabelas de cabos blindados em eletroduto no ar foram conferidas visualmente; as colunas de cabos não blindados não foram usadas no módulo.

[3] Southwire CableTech: https://cabletechsupport.southwire.com/. As construções mantêm links individuais no catálogo do módulo. Dados dimensionais de cada produto precisam ser confirmados para a compra efetiva.

[4] Wheatland, EMT & Conduit, revisão WEL-041825: https://www.wheatland.com/wp-content/uploads/2018/03/EMT-and-Conduit-Brochure.pdf. Referência primária para dimensões de RMC, IMC e EMT.

[5] Steel Tube Institute, mudanças do NEC 2023: https://steeltubeinstitute.org/resources/2023-national-electrical-code-nec-changes/. Referência para alterações em instalações com eletrodutos de aço e condição sobre cobertura.

[6] Southwire, calculador de ocupação e jamming: https://www.southwire.com/calculator-conduit. Complementa a avaliação mecânica; não substitui o estudo de puxamento.

[7] Classic Wire, PowerGuard MV-105 ampacities: https://www.classicwire.com/products/ul-type-mv-105-ampacities-copper-conductors-rated-5-kv-to-35-kv/. Comparação independente da coluna de maior tensão para eletroduto no ar.

As fontes foram consultadas em 04/11/2026. O módulo inclui limites explícitos e testes de regressão, mas não cobre todas as instalações permitidas no NEC. Projetos com alumínio, cabos MT não blindados, circuitos diferentes compartilhados, áreas classificadas, agrupamento térmico MT, trechos subterrâneos ou casos de 1001–2000 V exigem outra análise. Verificar o código adotado, a especificação PlantSERV e os fabricantes antes de emitir o projeto para construção.
