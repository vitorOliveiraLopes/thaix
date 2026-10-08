import { EQUIPMENT_OPTIONS, SKILLS, SKILL_IDS, isSkillId, type EquipmentId, type SkillId } from '@thaix/core';
import { useState } from 'react';
import { View } from 'react-native';

import { OnboardingShell, WithAnswers, useAdvance } from '@/components/onboarding';
import { CoachBubble, OptionRow, SectionLabel, Txt } from '@/components/ui';
import type { OnboardingAnswers } from '@/lib/onboarding';
import { spacing } from '@/theme';

const EQUIPMENT_IDS = new Set<string>(EQUIPMENT_OPTIONS.map((e) => e.id));

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Skills que o aluno quer destravar + equipamento disponível.
 * O equipamento entrou nesta tela para não aumentar o onboarding:
 * as duas respostas definem o que dá para treinar.
 */
function SkillsForm({ answers }: { answers: OnboardingAnswers | null }) {
  const advance = useAdvance('skills');
  const [skills, setSkills] = useState<SkillId[]>(() => (answers?.skills ?? []).filter(isSkillId));
  const [equipment, setEquipment] = useState<EquipmentId[]>(
    () => (answers?.equipment ?? []).filter((e): e is EquipmentId => EQUIPMENT_IDS.has(e)),
  );

  const missing = skills.length === 0 ? 'Escolha ao menos uma skill.' : equipment.length === 0 ? 'Marque o equipamento que você tem.' : null;

  return (
    <OnboardingShell step="skills" canContinue={!missing} onSubmit={() => advance({ skills, equipment })}>
      <CoachBubble
        title="Quais skills você quer destravar?"
        subtitle="Escolha uma ou mais. Vamos montar uma trilha para cada uma."
      />
      <View style={{ gap: spacing.sm }}>
        {SKILL_IDS.map((id) => (
          <OptionRow
            key={id}
            multi
            label={SKILLS[id].name}
            sublabel={SKILLS[id].description}
            emoji={SKILLS[id].icon}
            selected={skills.includes(id)}
            onPress={() => setSkills((prev) => toggle(prev, id))}
          />
        ))}
      </View>

      <SectionLabel>Onde você vai treinar, o que tem?</SectionLabel>
      <View style={{ gap: spacing.sm }}>
        {EQUIPMENT_OPTIONS.map((e) => (
          <OptionRow
            key={e.id}
            multi
            label={e.label}
            emoji={e.icon}
            selected={equipment.includes(e.id)}
            onPress={() => setEquipment((prev) => toggle(prev, e.id))}
          />
        ))}
      </View>

      {missing && (
        <Txt variant="small" color="muted" center>
          {missing}
        </Txt>
      )}
    </OnboardingShell>
  );
}

export default function Skills() {
  return <WithAnswers>{(a) => <SkillsForm answers={a} />}</WithAnswers>;
}
