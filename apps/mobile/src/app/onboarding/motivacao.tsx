import { SingleChoiceStep, WithAnswers, type ChoiceOption } from '@/components/onboarding';

const OPTIONS: ChoiceOption[] = [
  { value: 'primeira-pullup', label: 'Quero minha primeira pull-up strict', emoji: '🏆' },
  { value: 'kipping', label: 'Quero destravar kipping/butterfly', emoji: '🔄' },
  { value: 'muscle-up', label: 'Quero meu primeiro muscle-up', emoji: '🔥' },
  { value: 'hspu', label: 'Quero o HSPU (handstand push-up)', emoji: '🤸' },
  { value: 'gluteo', label: 'Quero glúteo forte pra CrossFit', emoji: '💪' },
  { value: 'wods', label: 'Quero render mais nos WODs', emoji: '⚡' },
  { value: 'explorando', label: 'Tô só explorando', emoji: '🧭' },
];

export default function Motivacao() {
  return (
    <WithAnswers>
      {(a) => (
        <SingleChoiceStep
          step="motivacao"
          field="motivacao"
          title="O que te trouxe aqui?"
          subtitle="Pode escolher só uma. A gente ajusta o tom do app pra você."
          options={OPTIONS}
          initial={a?.motivacao}
        />
      )}
    </WithAnswers>
  );
}
