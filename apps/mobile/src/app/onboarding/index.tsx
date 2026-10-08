import { resumeStep } from '@thaix/core';
import { Redirect } from 'expo-router';

import { WithAnswers } from '@/components/onboarding';

/** Retoma o onboarding na tela em que o aluno parou. */
export default function OnboardingIndex() {
  return <WithAnswers>{(answers) => <Redirect href={`/onboarding/${resumeStep(answers?.current_step)}`} />}</WithAnswers>;
}
