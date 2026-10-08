import { SingleChoiceStep, WithAnswers, type ChoiceOption } from '@/components/onboarding';

const OPTIONS: ChoiceOption[] = [
  { value: 'tecnica', label: 'Trava em técnica que ninguém me explica', emoji: '❓' },
  { value: 'creators', label: 'Fico intimidada pelos creators avançados', emoji: '😟' },
  { value: 'tempo', label: 'Sem tempo entre as aulas e a vida', emoji: '🕐' },
  { value: 'wod', label: 'Minha box só foca no WOD do dia', emoji: '⚠️' },
  { value: 'outro', label: 'Outro', emoji: '💬' },
];

export default function Trava() {
  return (
    <WithAnswers>
      {(a) => (
        <SingleChoiceStep
          step="trava"
          field="trava"
          title="O que costuma te travar?"
          subtitle="Sem julgamento. Já vi de tudo na consultoria."
          options={OPTIONS}
          initial={a?.trava}
        />
      )}
    </WithAnswers>
  );
}
