import { SingleChoiceStep, WithAnswers, type ChoiceOption } from '@/components/onboarding';

const OPTIONS: ChoiceOption[] = [
  { value: 'instagram', label: 'Reels da @thaixskill', emoji: '📸' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'youtube', label: 'YouTube', emoji: '▶️' },
  { value: 'indicacao', label: 'Indicação na minha box', emoji: '🤝' },
  { value: 'coach', label: 'Pelo meu coach / box', emoji: '🏠' },
  { value: 'outro', label: 'Outro', emoji: '⭕' },
];

export default function ComoConheceu() {
  return (
    <WithAnswers>
      {(a) => (
        <SingleChoiceStep
          step="como-conheceu"
          field="objetivo"
          title="Como você conheceu a Thaix?"
          subtitle="Opcional. Ajuda a gente a entender de onde vem a galera."
          options={OPTIONS}
          initial={a?.objetivo}
          optional
          fallback="nao-informado"
        />
      )}
    </WithAnswers>
  );
}
