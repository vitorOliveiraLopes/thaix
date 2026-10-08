# Pendências para validar com a Coach Thaís

Pontos de regra de treino que o código já implementa de algum jeito, mas que precisam da palavra final dela antes do coach (Fase 2) usar como verdade.

## Regras de progressão

- **Limite de esforço para subir de nível:** hoje é média ≤ 2,5 (escala 1–5), com a maior parte das séries na meta em 2 sessões seguidas. Está bom?
- **Deload:** existe semana de descarga? A cada quantas semanas, e o que muda (séries, reps, carga)?
- **Volume por semana:** reps sobem +1/+2/+3 nas semanas 3–4, 5–6 e 7+; tempo sobe 5 s por bloco; séries sobem 1 a partir da semana 7 (máximo 5). Confirmar.

## Combinação de skills no mesmo dia

- Hoje: no máximo 2 skills por dia; nunca duas de puxada (pull-up, C2B, BMU) juntas; HSPU não combina com puxada; T2B combina com qualquer uma.
- **Efeito colateral encontrado nos testes:** quando o aluno escolhe puxada + T2B + HSPU, o T2B sempre ocupa a segunda vaga e **o HSPU nunca aparece**. Como ela quer distribuir? (ex.: alternar T2B e HSPU por dia, ou HSPU em dias sem puxada.)

## Conteúdo

- **Exercícios do nível avançado:** o banco tem só 1 core, 1 força e 2 skill; o treino avançado fica com 4 exercícios.
- **Ordem de corte quando o aluno tem pouco tempo:** proposta atual é tirar mobilidade/core, depois força acessória, e preservar a skill.
- **Equivalências de exercícios:** trocas válidas por nível e equipamento (ex.: sem barra, sem paralela).
- **Base de conhecimento do coach:** execução, erros comuns e progressões de cada exercício, no tom dela.

## Coach (fase 2)

- **Equipamento por exercício:** preencher `skill_exercises.equipment` (barra, paralelas, argolas, caixa, chao). Sem isso, o filtro por equipamento e as trocas "não tenho barra" não têm efeito.
- **Base de conhecimento:** textos curtos por exercício em `coach_knowledge` (execução, erros comuns, escala, progressão). É o que o coach cita quando o aluno pergunta "como faço X".
- **Treino ajustado não conta para subir de nível** (encurtado ou aliviado pelo coach). Ela concorda?
- **Ordem de corte por tempo:** mobilidade → core → força, preservando a skill; séries da skill no mínimo 2.
- **Depois de WOD pesado com puxada:** o coach propõe tirar a força acessória das skills de puxada e uma série de cada exercício.

## Coach proativo

- Alerta de esforço alto por 3 dias seguidos: o que ela recomenda nesse caso?
- Tom e frequência das mensagens (no máximo 1 push por dia).
